import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { checkManifest, sha256 } from '../wp-12b/manifest-check.ts';
import type { Extract, Manifest, ManifestRow } from '../wp-12b/manifest-check.ts';
import { encodeMaster, encodeVariants, planMaster, variantHeight } from '../../../scripts/photo/lib/encode.mjs';
import { isoDate, parseCandidateName, promoteRows, promotedRow } from '../../../scripts/photo/lib/promote-core.mjs';
import { isDone, listCandidates, readCandidate, slotDir, writeCandidate } from '../../../scripts/photo/lib/staging.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const extract = JSON.parse(readFileSync(`${ROOT}.astro-magazine/media/shotlist-extract.json`, 'utf8')) as Extract;
const manifest = JSON.parse(readFileSync(`${ROOT}src/assets/photo/manifest.json`, 'utf8')) as Manifest;
const NOW = new Date('2026-10-12T09:30:00Z');
const MODEL = 'Boogu/Boogu-Image-0.1-Turbo';

interface Candidate {
  kind: 'object' | 'figure';
  seed: number;
  prompt: string;
  figures: number;
}

function row(source: Manifest, id: string): ManifestRow {
  const found = source.slots.find((slot) => slot.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
}

function entry(slotId: string, kind: 'object' | 'figure', offset: number, alt: string, figures = kind === 'figure' ? 1 : 0): { slotId: string; candidate: Candidate; alt: string; bytes: number; quality: number } {
  const index = extract.slots.filter((slot) => slot.kind === 'raster').findIndex((slot) => slot.id === slotId);
  return { slotId, candidate: { kind, seed: 7000 + index + offset, prompt: `Prompt for ${slotId} ${kind} ${offset}, with one amber object.`, figures }, alt, bytes: 52_000, quality: 80 };
}

const ALTS: Record<string, string> = {
  'svc-b': 'Hands resting on a table beside a three-tier steel scaffold model with an amber middle plate.',
  'stage-dream': 'Two pairs of forearms on a long table beside a layered paper contour model with one small amber disc.',
  'stage-build': 'Forearms on a drafting table beside a deep blue blueprint card with one small amber hexagon tile.',
  'stage-grow': 'Two pairs of forearms at a table laying hexagon tiles onto a terraced model with one amber field.',
  'band-1': 'A tabletop model in which rough white hexagon tiles lock into a blue honeycomb and end in a tidy stack.',
  'svc-c': 'Two large hexagonal blocks, one deep blue and one white, facing each other with a small amber tile between.',
};

test('promotedRow writes the provenance fields and keeps everything else', () => {
  const before = row(manifest, 'band-1');
  const updated = promotedRow(before, entry('band-1', 'object', 0, ALTS['band-1']), { modelName: MODEL, now: NOW });
  assert.equal(updated.source, 'generated');
  assert.equal(updated.model, MODEL);
  assert.equal(updated.seed, 7034);
  assert.equal(updated.generatedAt, '2026-10-12');
  assert.equal(updated.promptSha256, sha256(updated.prompt ?? ''));
  assert.equal(updated.figures, 0);
  assert.equal(updated.alt, ALTS['band-1']);
  assert.equal(updated.bytes, 52_000);
  assert.equal((updated as unknown as { quality: number }).quality, 80);
  for (const key of ['id', 'group', 'kind', 'profile', 'aspect', 'width', 'height', 'widths', 'people', 'path'] as const) assert.deepEqual(updated[key], before[key], key);
  assert.equal(before.source, 'vector', 'the input row is not mutated');
});

test('promotedRow refuses what the policy and the manifest check would reject later', () => {
  const ok = entry('svc-b', 'figure', 1000, ALTS['svc-b']);
  const base = row(manifest, 'svc-b');
  assert.throws(() => promotedRow(base, { ...ok, alt: '  ' }, { modelName: MODEL, now: NOW }), /alt text/);
  assert.throws(() => promotedRow(base, { ...ok, bytes: 0 }, { modelName: MODEL, now: NOW }), /encoded size/);
  assert.throws(() => promotedRow(base, ok, { modelName: '', now: NOW }), /model name/);
  assert.throws(() => promotedRow(base, { ...ok, candidate: { ...ok.candidate, prompt: '' } }, { modelName: MODEL, now: NOW }), /no prompt/);
  assert.throws(() => promotedRow(base, { ...ok, candidate: { ...ok.candidate, kind: 'portrait' as 'figure' } }, { modelName: MODEL, now: NOW }), /neither object nor figure/);
  assert.throws(() => promotedRow(row(manifest, 'band-1'), entry('band-1', 'figure', 1000, ALTS['band-1']), { modelName: MODEL, now: NOW }), /forbids/);
});

test('promoteRows validates clean through checkManifest for an object and for a figure slot', () => {
  const objects = promoteRows(manifest, [entry('band-1', 'object', 0, ALTS['band-1']), entry('svc-c', 'object', 500, ALTS['svc-c'])], { modelName: MODEL, now: NOW });
  assert.deepEqual(checkManifest(objects, extract), []);
  const figure = promoteRows(manifest, [entry('svc-b', 'figure', 1000, ALTS['svc-b'])], { modelName: MODEL, now: NOW });
  assert.deepEqual(checkManifest(figure, extract), []);
  assert.equal(row(figure, 'svc-b').figures, 1);
  assert.equal(row(figure, 'svc-c').source, 'vector', 'untouched rows stay as they were');
});

test('the stage trio is all or none: one stage figure alone fails the manifest, the trio together passes, so promotion is a batch', () => {
  const one = promoteRows(manifest, [entry('stage-dream', 'figure', 1000, ALTS['stage-dream'])], { modelName: MODEL, now: NOW });
  assert.match(checkManifest(one, extract).join('\n'), /stage images must all carry a figure or none/);
  const trio = promoteRows(
    manifest,
    [entry('stage-dream', 'figure', 1000, ALTS['stage-dream'], 2), entry('stage-build', 'figure', 1000, ALTS['stage-build']), entry('stage-grow', 'figure', 1000, ALTS['stage-grow'], 2)],
    { modelName: MODEL, now: NOW },
  );
  assert.deepEqual(checkManifest(trio, extract), []);
});

test('an alt that names an identity, or a person on a no-figure slot, fails the manifest check after promotion', () => {
  const founder = promoteRows(manifest, [entry('band-1', 'object', 0, 'A founder at a table with a tabletop model of blue hexagon tiles.')], { modelName: MODEL, now: NOW });
  assert.match(checkManifest(founder, extract).join('\n'), /identity or role/);
  const hands = promoteRows(manifest, [entry('band-1', 'object', 0, 'A tabletop model of blue hexagon tiles with hands resting beside it on a table.')], { modelName: MODEL, now: NOW });
  assert.match(checkManifest(hands, extract).join('\n'), /mentions a person/);
});

test('a seed that is not the slot seed plus an offset fails the manifest check', () => {
  const bad = promoteRows(manifest, [entry('svc-c', 'object', 123, ALTS['svc-c'])], { modelName: MODEL, now: NOW });
  assert.match(checkManifest(bad, extract).join('\n'), /seed .* is not 70\d\d plus a candidate offset/);
});

test('promoteRows is atomic and pure: an unknown slot or a duplicate throws, the input is untouched', () => {
  const snapshot = JSON.stringify(manifest);
  assert.throws(() => promoteRows(manifest, [entry('band-1', 'object', 0, ALTS['band-1']), { ...entry('band-1', 'object', 500, ALTS['band-1']) }], { modelName: MODEL, now: NOW }), /twice/);
  assert.throws(() => promoteRows(manifest, [{ ...entry('band-1', 'object', 0, ALTS['band-1']), slotId: 'nope' }], { modelName: MODEL, now: NOW }), /not in the manifest/);
  assert.equal(JSON.stringify(manifest), snapshot);
});

test('candidate names and dates parse strictly', () => {
  assert.deepEqual(parseCandidateName('figure-1500'), { kind: 'figure', offset: 1500 });
  assert.deepEqual(parseCandidateName('object-0'), { kind: 'object', offset: 0 });
  assert.throws(() => parseCandidateName('portrait-1'), /not object-<offset>/);
  assert.equal(isoDate(NOW), '2026-10-12');
});

test('the manifest file round-trips byte for byte through JSON.stringify, so promotion produces a minimal diff', () => {
  const text = readFileSync(`${ROOT}src/assets/photo/manifest.json`, 'utf8');
  assert.equal(`${JSON.stringify(JSON.parse(text), null, 2)}\n`, text);
});

// ---------------------------------------------------------------------------------------------------------------------------------
test('planMaster crops to the target aspect around the centre and refuses to upscale', () => {
  const same = planMaster([1024, 768], [1024, 768]);
  assert.equal(same.cropped, false);
  const wide = planMaster([1024, 1024], [1024, 576]);
  assert.deepEqual(wide.crop, { left: 0, top: 224, width: 1024, height: 576 });
  assert.equal(wide.cropped, true);
  const tall = planMaster([1344, 768], [1024, 768]);
  assert.deepEqual(tall.crop, { left: 160, top: 0, width: 1024, height: 768 });
  assert.throws(() => planMaster([800, 600], [1024, 768]), /too small/);
  assert.equal(planMaster([800, 600], [1024, 768], { allowUpscale: true }).upscale, true);
  assert.equal(variantHeight([1024, 576], 640), 360);
  assert.equal(variantHeight([1024, 768], 512), 384);
});

test('encodeMaster writes an AVIF at the exact master size and encodeVariants the narrower widths', async () => {
  const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 30, g: 70, b: 140 } } }).png().toBuffer();
  const { buffer, width, height, plan } = await encodeMaster(source, [1024, 576], { quality: 60 });
  assert.deepEqual([width, height], [1024, 576]);
  assert.equal(plan.cropped, true);
  const meta = await sharp(buffer).metadata();
  assert.equal(meta.format, 'heif');
  assert.equal(meta.compression, 'av1');
  assert.deepEqual([meta.width, meta.height], [1024, 576]);
  const variants = await encodeVariants(buffer, [1024, 576], [640, 1024]);
  assert.deepEqual([...variants.keys()], [640], 'the master width itself is not a variant');
  const small = await sharp(variants.get(640)).metadata();
  assert.deepEqual([small.width, small.height], [640, 360]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
test('staging: a candidate is done only for the same prompt, a sidecar with no image is not done, and listing is ordered', () => {
  const root = mkdtempSync(join(tmpdir(), 'wp12d-staging-'));
  try {
    const dir = slotDir(root, 'mage_flow_turbo', 'svc-b');
    writeCandidate(dir, 'object', 500, Buffer.from('b'), 'png', { slot: 'svc-b', seed: 7510, promptSha256: 'h1' });
    writeCandidate(dir, 'figure', 1000, Buffer.from('f'), 'png', { slot: 'svc-b', seed: 8010, promptSha256: 'h2' });
    writeCandidate(dir, 'object', 0, Buffer.from('a'), 'png', { slot: 'svc-b', seed: 7010, promptSha256: 'h1' });
    assert.equal(isDone(dir, 'object', 0, 'h1'), true);
    assert.equal(isDone(dir, 'object', 0, 'other'), false, 'a candidate from an older prompt is regenerated');
    assert.equal(isDone(dir, 'object', 1000, 'h1'), false);
    assert.deepEqual(listCandidates(dir).map((c: { kind: string; offset: number }) => `${c.kind}-${c.offset}`), ['object-0', 'object-500', 'figure-1000']);
    assert.equal(readCandidate(dir, 'object', 0)?.file, 'object-0.png');
    rmSync(join(dir, 'object-500.png'));
    assert.equal(readCandidate(dir, 'object', 500), null);
    writeFileSync(join(dir, 'figure-1500.json'), '{not json');
    assert.throws(() => readCandidate(dir, 'figure', 1500), /Corrupt sidecar/);
    assert.deepEqual(listCandidates(join(root, 'missing')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
