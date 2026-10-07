/**
 * Merges raster-rows.json (build-fallback-art.mjs) and og-rows.json (scripts/build-og.mjs) into
 * src/assets/photo/manifest.json, the single record of seed, prompt, alt and bytes per slot.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

async function readRows(name) {
  const file = path.join(here, name);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const raster = await readRows('raster-rows.json');
const og = await readRows('og-rows.json');
const slots = [
  ...raster.map((row) => ({ ...row, path: `src/assets/photo/${row.file}` })),
  ...og.map((row) => ({ ...row, path: `src/assets/og/${row.file}` })),
];
const blank = slots.filter((slot) => typeof slot.alt !== 'string' || slot.alt.trim().length < 20);
if (blank.length > 0) throw new Error(`Slots without real alt text: ${blank.map((s) => s.id).join(', ')}`);

const manifest = {
  version: 1,
  seedRule: '7000 + slot index for raster slots, 7100 + card index for OG cards',
  generation: {
    tool: 'comfyui',
    endpoint: 'https://api.studio.hardmagic.com',
    status: 'unreachable',
    error: 'urllib.error.URLError: <urlopen error [Errno -3] Temporary failure in name resolution> (curl: (6) Could not resolve host: api.studio.hardmagic.com), 2026-10-06',
    fallback: 'All 38 raster slots are vector compositions in the brand palette encoded to AVIF at the exact slot size (SAGE-PLAN 8.4 fallback). Each slot keeps the intended ComfyUI prompt in `comfyui.prompt` so a later run can replace it without changing slot ids.',
  },
  slots,
};
await writeFile(path.join(root, 'src', 'assets', 'photo', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifest: ${slots.length} slots`);
