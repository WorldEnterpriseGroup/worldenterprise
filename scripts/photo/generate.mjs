#!/usr/bin/env node
// Generate candidates for the raster slots through the GPU Router. Serialized (concurrency 1: four concurrent requests wedged the
// router), resumable (a candidate already in staging for the same prompt is skipped), deterministic (seed = slot seed + offset).
//
//   node scripts/photo/generate.mjs [--model boogu_image_turbo] [--slots id,id] [--candidates N] [--figures none|recommended|all]
//                                   [--include-hold] [--staging DIR] [--plan] [--probe] [--force]
//
// Needs the router port-forward (`kubectl -n gpu-suite port-forward svc/gpu-router 18200:8200`). The key comes from
// HARDMAGIC_INTERNAL_KEY or Azure Key Vault (omlab-secrets / hardmagic-internal-api-key) and is never printed.
import { join } from 'node:path';
import sharp from 'sharp';
import { amberCheck } from './lib/amber.mjs';
import { DEFAULT_STAGING, REPO_ROOT, list, loadExtract, loadModels, masterSize, modelInfo, parseArgs, rasterSlots, seedBase, sizeString } from './lib/common.mjs';
import { candidatePlan } from './lib/prompt.mjs';
import { RouterClient, RouterError, loadKey } from './lib/router.mjs';
import { isDone, slotDir, writeCandidate } from './lib/staging.mjs';
import { checkAll, loadPromptFiles } from './build-prompts.mjs';
import { sha256 } from './lib/common.mjs';

const MAX_CONSECUTIVE_FAILURES = 3;

/** Work list: `{ slot, file, base, plan }[]` for the chosen slots, in shotlist order. */
export function buildWorkList({ extract, files, slotIds, includeHold, figures, candidates }) {
  const byId = new Map(files.map((file) => [file.id, file]));
  const raster = rasterSlots(extract);
  const wanted = slotIds ?? raster.filter((slot) => includeHold || slot.generateNow).map((slot) => slot.id);
  const unknown = wanted.filter((id) => !raster.some((slot) => slot.id === id));
  if (unknown.length > 0) throw new Error(`Unknown raster slot(s): ${unknown.join(', ')}.`);
  return raster
    .filter((slot) => wanted.includes(slot.id))
    .map((slot) => {
      const file = byId.get(slot.id);
      if (!file) throw new Error(`No prompt file for ${slot.id}.`);
      const base = seedBase(extract, slot.id);
      return { slot, file, base, plan: candidatePlan(file, base, { figures, candidates }) };
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleans: ['plan', 'probe', 'force', 'includeHold'] });
  const models = loadModels();
  const routerId = args.model ?? models.default;
  const model = modelInfo(routerId, models);
  const staging = args.staging ?? DEFAULT_STAGING;
  const candidates = args.candidates === undefined ? Infinity : Number(args.candidates);
  if (!(candidates >= 1)) throw new Error('--candidates is a positive integer.');
  const figures = args.figures ?? 'recommended';

  const extract = loadExtract(REPO_ROOT);
  const files = loadPromptFiles();
  const problems = checkAll(files, extract);
  if (problems.length > 0) throw new Error(`Prompt files are not clean, run node scripts/photo/build-prompts.mjs --check:\n${problems.join('\n')}`);

  const work = buildWorkList({ extract, files, slotIds: list(args.slots), includeHold: Boolean(args.includeHold), figures, candidates });
  const total = work.reduce((sum, item) => sum + item.plan.length, 0);

  if (args.plan) {
    for (const { slot, plan } of work) for (const c of plan) console.log(`${slot.id}\t${c.kind}-${c.offset}\tseed ${c.seed}\t${sizeString(masterSize(slot))}`);
    console.log(`${total} candidate(s) across ${work.length} slot(s) for ${routerId}`);
    return;
  }

  const client = new RouterClient({ key: await loadKey() });
  if (args.probe) {
    const { ready, reason } = await client.probe(routerId);
    console.log(`${routerId}: ${ready ? 'READY' : 'NOT READY'} (${reason})`);
    process.exit(ready ? 0 : 3);
  }

  let stop = false;
  process.on('SIGINT', () => {
    stop = true;
    console.error('\nStopping after the current candidate; rerun to resume.');
  });

  let done = 0;
  let skipped = 0;
  let consecutiveFailures = 0;
  const failures = [];
  const started = Date.now();
  for (const { slot, file, plan } of work) {
    const dir = slotDir(staging, routerId, slot.id);
    const size = masterSize(slot);
    for (const c of plan) {
      if (stop) break;
      const label = `${slot.id} ${c.kind}-${c.offset} (seed ${c.seed})`;
      const promptSha256 = sha256(c.prompt);
      if (!args.force && isDone(dir, c.kind, c.offset, promptSha256)) {
        skipped += 1;
        console.log(`skip  ${label}`);
        continue;
      }
      try {
        const { bytes } = await client.generate(
          { model: routerId, prompt: c.prompt, size: sizeString(size), seed: c.seed },
          { onRetry: ({ attempt, error, waitMs }) => console.warn(`retry ${label}: attempt ${attempt} failed (${error.kind}${error.status ? ` ${error.status}` : ''}); waiting ${Math.round(waitMs / 1000)} s`) },
        );
        const meta = await sharp(bytes).metadata();
        const amber = await amberCheck(bytes);
        writeCandidate(dir, c.kind, c.offset, bytes, meta.format === 'jpeg' ? 'jpg' : meta.format, {
          slot: slot.id,
          seed: c.seed,
          routerModel: routerId,
          modelName: model.name,
          requestedSize: sizeString(size),
          actualSize: `${meta.width}x${meta.height}`,
          bytes: bytes.length,
          figures: c.kind === 'figure' ? file.figure.count : 0,
          prompt: c.prompt,
          promptSha256,
          generatedAt: new Date().toISOString(),
          amber: { blobs: amber.blobs, areaFraction: Number(amber.areaFraction.toFixed(4)), flags: amber.flags },
        });
        done += 1;
        consecutiveFailures = 0;
        const sizeNote = `${meta.width}x${meta.height}` === sizeString(size) ? '' : ` (asked ${sizeString(size)})`;
        console.log(`ok    ${label}  ${meta.width}x${meta.height}${sizeNote}  ${Math.round(bytes.length / 1024)} KB  ${amber.flags.length === 0 ? 'amber ok' : `amber REVIEW ${amber.flags.join(',')}`}`);
      } catch (error) {
        if (!(error instanceof RouterError)) throw error;
        failures.push({ label, message: error.message });
        consecutiveFailures += 1;
        console.error(`FAIL  ${label}: ${error.message}`);
        if (error.kind === 'auth' || error.kind === 'client') throw error;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`${MAX_CONSECUTIVE_FAILURES} candidates in a row failed; the router or model is not healthy. Last: ${error.message}`, { cause: error });
        }
      }
    }
  }
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n${done} generated, ${skipped} skipped, ${failures.length} failed of ${total} planned, ${minutes} min. Staging: ${join(staging, routerId)}`);
  if (failures.length > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
}
