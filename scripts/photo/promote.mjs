#!/usr/bin/env node
// Promote chosen candidates: encode each to its AVIF master, rewrite its manifest row (source generated, model, seed, prompt, hash,
// date, alt, bytes, quality), validate the WHOLE manifest, write, run the manifest unit tests, and roll everything back if they fail.
// A batch applies as a unit, which is how the stage trio (all or none) and the figure caps stay satisfiable.
//
//   node scripts/photo/promote.mjs --from-qa [--figures recommended|none]      pick the best passing candidate per slot from qa-results
//   node scripts/photo/promote.mjs --selections FILE                            FILE: { "selections": [{ "slot", "candidate", "alt" }] }
//   node scripts/photo/promote.mjs --slot svc-b --candidate figure-1000 --alt "..."   one slot
// Common: [--model ID] [--staging DIR] [--quality 80] [--dry] [--manifest PATH] [--asset-dir DIR] [--no-tests] [--allow-stale] [--date YYYY-MM-DD]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { ASSET_DIR, DEFAULT_STAGING, MANIFEST_PATH, REPO_ROOT, loadExtract, loadModels, masterSize, modelInfo, parseArgs, readJson } from './lib/common.mjs';
import { DEFAULT_QUALITY, encodeMaster } from './lib/encode.mjs';
import { parseCandidateName, promoteRows } from './lib/promote-core.mjs';
import { selectFromQa, validateQaResult } from './lib/qa.mjs';
import { readCandidate, slotDir } from './lib/staging.mjs';
import { sha256 } from './lib/common.mjs';
import { loadPromptFiles } from './build-prompts.mjs';
import { checkManifest } from '../../tests/unit/wp-12b/manifest-check.ts';

function readQaResults(staging, routerId, extract) {
  const dir = join(staging, routerId, 'qa-results');
  let names;
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch (error) {
    throw new Error(`No QA results at ${dir}: ${error instanceof Error ? error.message : String(error)}. Run the QA pass first (scripts/photo/qa-rubric.md).`, { cause: error });
  }
  const results = [];
  const problems = [];
  for (const name of names) {
    const result = readJson(join(dir, name));
    const slot = extract.slots.find((candidate) => candidate.id === result.slot);
    const found = validateQaResult(result, { srcsetWidths: slot?.srcsetWidths.filter((width) => width <= masterSize(slot)[0]) });
    for (const problem of found) problems.push(`${name}: ${problem}`);
    results.push(result);
  }
  if (problems.length > 0) throw new Error(`QA results are not valid:\n${problems.join('\n')}`);
  return results;
}

function selectionsFromArgs(args, { staging, routerId, extract }) {
  if (args.fromQa) {
    const { picks, skipped } = selectFromQa(readQaResults(staging, routerId, extract), extract, { figures: args.figures ?? 'recommended' });
    for (const item of skipped) console.warn(`not promoted ${item.slot}: ${item.reason}`);
    return picks;
  }
  if (args.selections) return readJson(resolve(args.selections)).selections;
  if (args.slot) {
    if (!args.candidate || !args.alt) throw new Error('--slot needs --candidate and --alt.');
    return [{ slot: args.slot, candidate: args.candidate, alt: args.alt }];
  }
  throw new Error('Say what to promote: --from-qa, --selections FILE or --slot ID --candidate NAME --alt TEXT.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleans: ['fromQa', 'dry', 'noTests', 'allowStale'] });
  const models = loadModels();
  const routerId = args.model ?? models.default;
  const model = modelInfo(routerId, models);
  const staging = args.staging ?? DEFAULT_STAGING;
  const quality = args.quality === undefined ? DEFAULT_QUALITY : Number(args.quality);
  const now = args.date ? new Date(`${args.date}T00:00:00Z`) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('--date is not a calendar date.');
  const manifestPath = resolve(REPO_ROOT, args.manifest ?? MANIFEST_PATH);
  const assetDir = resolve(REPO_ROOT, args.assetDir ?? ASSET_DIR);
  const liveRun = !args.manifest && !args.assetDir;

  const extract = loadExtract();
  const manifestText = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const promptFiles = new Map(loadPromptFiles().map((file) => [file.id, file]));
  const selections = selectionsFromArgs(args, { staging, routerId, extract });
  if (selections.length === 0) throw new Error('Nothing to promote.');

  const entries = [];
  const avifs = [];
  for (const selection of selections) {
    const slot = extract.slots.find((candidate) => candidate.id === selection.slot && candidate.kind === 'raster');
    const row = manifest.slots.find((candidate) => candidate.id === selection.slot);
    if (!slot || !row) throw new Error(`${selection.slot} is not a raster slot of the shotlist and manifest.`);
    const { kind, offset } = parseCandidateName(selection.candidate);
    const candidate = readCandidate(slotDir(staging, routerId, slot.id), kind, offset);
    if (candidate === null) throw new Error(`${slot.id}: candidate ${selection.candidate} is not in staging for ${routerId}.`);
    const currentPrompt = promptFiles.get(slot.id)?.prompts[kind];
    if (!args.allowStale && currentPrompt !== undefined && candidate.promptSha256 !== sha256(currentPrompt)) {
      throw new Error(`${slot.id}: ${selection.candidate} was generated from an older prompt than scripts/photo/prompts/${slot.id}.json; regenerate it (or pass --allow-stale).`);
    }
    const { buffer, plan } = await encodeMaster(candidate.imagePath, masterSize(slot), { quality });
    if (plan.cropped) console.warn(`${slot.id}: cropped the ${candidate.actualSize} candidate to the ${row.aspect} master`);
    avifs.push({ path: join(assetDir, row.file), buffer });
    entries.push({
      slotId: slot.id,
      candidate: { kind, seed: candidate.seed, prompt: candidate.prompt, figures: candidate.figures },
      alt: selection.alt,
      bytes: buffer.length,
      quality,
    });
  }

  const updated = promoteRows(manifest, entries, { modelName: model.name, now });
  const problems = checkManifest(updated, extract);
  if (problems.length > 0) {
    console.error(`The promoted manifest fails validation, nothing was written:\n${problems.join('\n')}`);
    process.exit(1);
  }
  if (args.dry) {
    for (const entry of entries) console.log(`would promote ${entry.slotId} <- ${entry.candidate.kind} seed ${entry.candidate.seed}, ${Math.round(entry.bytes / 1024)} KB`);
    console.log('validation OK (dry run, nothing written)');
    return;
  }

  // Remember what was there so a failing test run leaves the tree as it was.
  const backups = avifs.map((avif) => {
    let previous = null;
    try {
      previous = readFileSync(avif.path);
    } catch {
      previous = null; // the file is new
    }
    return { path: avif.path, previous };
  });
  for (const avif of avifs) writeFileSync(avif.path, avif.buffer);
  writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
  for (const entry of entries) console.log(`promoted ${entry.slotId}: ${entry.candidate.kind} seed ${entry.candidate.seed}, ${Math.round(entry.bytes / 1024)} KB`);

  if (!args.noTests && liveRun) {
    const run = spawnSync(process.execPath, ['--test', 'tests/unit/wp-12b/'], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (run.status !== 0) {
      for (const backup of backups) if (backup.previous !== null) writeFileSync(backup.path, backup.previous);
      writeFileSync(manifestPath, manifestText);
      console.error('The manifest tests failed; the images and the manifest are restored. Fix the cause and promote again.');
      process.exit(1);
    }
  }
  console.log(`${entries.length} slot(s) promoted. Next: git add src/assets/photo && git commit, then push.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
