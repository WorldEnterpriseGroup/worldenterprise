/**
 * Merges raster-rows.json (build-fallback-art.mjs) and og-rows.json (scripts/build-og.mjs) into
 * src/assets/photo/manifest.json, the single record of size, people class, alt and provenance per slot.
 *
 * Schema version 2 (photography pass, WP-12b). Per slot:
 *   id, group, kind (raster | og-card), profile, aspect, width, height, widths, people, figures,
 *   source (vector | generated), model, seed, prompt, promptSha256, generatedAt,
 *   alt, bytes, quality, file, path, and `motif` (vector) or `text` (og-card).
 * Size, aspect, widths and people come from src/assets/photo/slots.ts, so the manifest cannot disagree with the component.
 * A row whose source is `generated` is image-model output recorded by the photo pass; it is carried over unchanged, so
 * rebuilding the vector fallbacks never overwrites a generated image's provenance.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOT_SPECS } from '../../src/assets/photo/slots.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const MANIFEST = path.join(root, 'src', 'assets', 'photo', 'manifest.json');
/** The date the vector fallbacks and OG cards were built (WP-12). */
const VECTOR_BUILT_ON = '2026-10-06';

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw new Error(`Cannot read ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const raster = await readJson(path.join(here, 'raster-rows.json'), 'raster-rows.json');
const og = await readJson(path.join(here, 'og-rows.json'), 'og-rows.json');
if (!raster || !og) throw new Error('raster-rows.json and og-rows.json are both required');
const previous = await readJson(MANIFEST, 'manifest.json');
const generated = new Map((previous?.slots ?? []).filter((slot) => slot.source === 'generated').map((slot) => [slot.id, slot]));

const specs = new Map(SLOT_SPECS.map((spec) => [spec.id, spec]));
const rows = [
  ...raster.map((row) => ({ ...row, kind: 'raster', path: `src/assets/photo/${row.file}` })),
  ...og.map((row) => ({ ...row, kind: 'og-card', path: `src/assets/og/${row.file}` })),
];

const slots = rows.map((row) => {
  const kept = generated.get(row.id);
  if (kept) return kept;
  const spec = specs.get(row.id);
  if (!spec) throw new Error(`Row ${row.id} has no slot in slots.ts`);
  if (row.width !== spec.width || row.height !== spec.height) {
    throw new Error(`Row ${row.id} is ${row.width}x${row.height} but slots.ts says ${spec.width}x${spec.height}`);
  }
  const { motif, text } = row;
  return {
    id: row.id,
    group: spec.group,
    kind: row.kind,
    profile: spec.profile,
    aspect: spec.aspect,
    width: spec.width,
    height: spec.height,
    widths: [...spec.widths],
    people: spec.people,
    figures: 0,
    source: 'vector',
    model: null,
    seed: row.seed,
    prompt: null,
    promptSha256: null,
    generatedAt: VECTOR_BUILT_ON,
    alt: row.alt,
    bytes: row.bytes,
    quality: row.quality,
    ...(motif === undefined ? {} : { motif }),
    ...(text === undefined ? {} : { text }),
    file: row.file,
    path: row.path,
  };
});

const blank = slots.filter((slot) => typeof slot.alt !== 'string' || slot.alt.trim().length < 20);
if (blank.length > 0) throw new Error(`Slots without real alt text: ${blank.map((s) => s.id).join(', ')}`);

const manifest = {
  version: 2,
  seedRule: '7000 + slot index for raster slots, 7100 + card index for OG cards',
  seedOffsets: 'A candidate adds 0 (first object), 500 (second object) or 1000, 1500, 2000, 2500 (the four figure candidates) to the slot seed; `seed` records the one used.',
  generation: {
    model: 'Boogu/Boogu-Image-0.1-Turbo',
    router: 'GPU Router',
    status: 'pending',
    note: 'Phase A (plumbing) is done; every slot is still a vector composition (`source: "vector"`). Phase B writes `source: "generated"`, model, seed, prompt, promptSha256, generatedAt and the new alt for each slot it replaces. The footer disclosure appears with the first generated slot.',
  },
  slots,
};
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifest: ${slots.length} slots, ${generated.size} generated`);
