/**
 * Builds the 38 raster slots as vector compositions encoded to AVIF at the exact slot size.
 * Used when the ComfyUI API is unreachable (SAGE-PLAN 8.4, WP-12 acceptance). Deterministic.
 * Usage: node .astro-magazine/media/build-fallback-art.mjs [--svg-dir <dir>] (writes src/assets/photo/<id>.avif)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { rng, svgDoc } from './art.mjs';
import { motifs } from './motifs.mjs';
import { BUDGET, SIZE, SLOTS } from './slots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const outDir = path.join(root, 'src', 'assets', 'photo');
const svgDirFlag = process.argv.indexOf('--svg-dir');
const svgDir = svgDirFlag > -1 ? path.resolve(process.argv[svgDirFlag + 1] ?? '') : null;

const manifestRows = [];

async function encode(svg, budget) {
  let last = null;
  for (const quality of [70, 62, 55, 50]) {
    const buf = await sharp(Buffer.from(svg), { density: 72 }).avif({ quality, effort: 6, chromaSubsampling: '4:2:0' }).toBuffer();
    last = { buf, quality };
    if (buf.length <= budget) return last;
  }
  throw new Error(`AVIF exceeds the ${budget} byte budget at quality 50 (${last?.buf.length} bytes)`);
}

if (svgDir) await mkdir(svgDir, { recursive: true });

for (const [index, slot] of SLOTS.entries()) {
  const motif = motifs[slot.motif];
  if (!motif) throw new Error(`Slot ${slot.id}: unknown motif "${slot.motif}"`);
  const seed = 7000 + index;
  const [w, h] = SIZE[slot.profile];
  const rand = rng(seed + (slot.seedShift ?? 0) * 101);
  const { body, defs } = motif(w, h, rand, slot.variant);
  const svg = svgDoc(w, h, body, defs);
  if (svgDir) await writeFile(path.join(svgDir, `${slot.id}.svg`), svg);
  const { buf, quality } = await encode(svg, BUDGET[slot.profile]);
  const meta = await sharp(buf).metadata();
  if (meta.format !== 'heif' || meta.width !== w || meta.height !== h) throw new Error(`Slot ${slot.id}: unexpected output ${meta.format} ${meta.width}x${meta.height}`);
  const file = `${slot.id}.avif`;
  await writeFile(path.join(outDir, file), buf);
  manifestRows.push({
    id: slot.id,
    group: slot.group,
    file,
    profile: slot.profile,
    width: w,
    height: h,
    bytes: buf.length,
    quality,
    source: 'vector-fallback',
    motif: slot.motif,
    seed,
    comfyui: { style: slot.style, filter: slot.filter, prompt: slot.prompt, generated: false },
    alt: slot.alt,
  });
}

await writeFile(path.join(here, 'raster-rows.json'), `${JSON.stringify(manifestRows, null, 2)}\n`);
console.log(`Wrote ${manifestRows.length} AVIF slots to ${path.relative(root, outDir)}`);
