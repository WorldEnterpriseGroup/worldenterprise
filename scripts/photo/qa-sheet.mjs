#!/usr/bin/env node
// Build the QA material for the candidates in staging: one PNG sheet per candidate and a qa-queue.json that a QA agent (or a person)
// works through with scripts/photo/qa-rubric.md.
//
//   node scripts/photo/qa-sheet.mjs [--model boogu_image_turbo] [--slots id,id] [--staging DIR]
//
// A sheet stacks three views, each at the size a visitor gets: the master with the safe zone drawn on it, the page crops (hexagon
// clip, 1.9:1/3.2:1/5:1 band crops, card detail crop) and every srcset width below the master at its own pixel width.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { DEFAULT_STAGING, list, loadExtract, loadModels, masterSize, parseArgs, rasterSlots, sizeString } from './lib/common.mjs';
import { encodeMaster, encodeVariants } from './lib/encode.mjs';
import { cropViews, hexagonPoints, qaWidths } from './lib/qa-views.mjs';
import { listCandidates, slotDir } from './lib/staging.mjs';
import { loadPromptFiles } from './build-prompts.mjs';

const SHEET_BG = { r: 238, g: 242, b: 247, alpha: 1 };
const GAP = 16;

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}

function rectSvg({ left, top, width, height }, stroke, dash = '') {
  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="none" stroke="${stroke}" stroke-width="3"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

/** Master with the page rectangle (solid) and the safe zone (dashed) drawn over it. */
async function overlayMaster(masterPng, master, group) {
  const views = cropViews(group, master);
  const shapes = views
    .map((view, i) => {
      const colour = ['#e8a33d', '#d1306b', '#12a150'][i % 3];
      const parts = [];
      if (group === 'stage') parts.push(`<polygon points="${hexagonPoints(master)}" fill="none" stroke="${colour}" stroke-width="3"/>`);
      else parts.push(rectSvg(view.rect, colour));
      if (view.safe) parts.push(rectSvg(view.safe, colour, '10 8'));
      return parts.join('');
    })
    .join('');
  return sharp(masterPng).composite([{ input: svg(master[0], master[1], shapes) }]).png().toBuffer();
}

/** The page crops, each scaled to at most 360 px high / 900 px wide, as PNG buffers with their sizes. */
async function cropImages(masterPng, master, group) {
  const out = [];
  for (const view of cropViews(group, master)) {
    let image = sharp(masterPng).extract(view.rect);
    if (group === 'stage') {
      const mask = svg(master[0], master[1], `<polygon points="${hexagonPoints(master)}" fill="#fff"/>`);
      image = sharp(await sharp(masterPng).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()).flatten({ background: SHEET_BG });
    }
    const buffer = await image.resize({ width: 900, height: 360, fit: 'inside' }).png().toBuffer();
    const meta = await sharp(buffer).metadata();
    out.push({ buffer, width: meta.width, height: meta.height, name: view.name });
  }
  return out;
}

/** Stack rows (each an array of `{ buffer, width, height }`) on one background, rows centred left-aligned with a gap. */
async function stack(rows) {
  const width = Math.max(...rows.map((row) => row.reduce((sum, item) => sum + item.width, 0) + GAP * (row.length + 1)));
  const height = rows.reduce((sum, row) => sum + Math.max(...row.map((item) => item.height)) + GAP, GAP);
  const composites = [];
  let y = GAP;
  for (const row of rows) {
    let x = GAP;
    for (const item of row) {
      composites.push({ input: item.buffer, left: x, top: y });
      x += item.width + GAP;
    }
    y += Math.max(...row.map((item) => item.height)) + GAP;
  }
  return sharp({ create: { width, height, channels: 4, background: SHEET_BG } }).composite(composites).png().toBuffer();
}

async function sheetFor(candidate, slot, row) {
  const master = masterSize(slot);
  const { buffer: avif } = await encodeMaster(candidate.imagePath, master);
  const masterPng = await sharp(avif).png().toBuffer();
  const overlaid = await overlayMaster(masterPng, master, slot.group);
  const rows = [[{ buffer: overlaid, width: master[0], height: master[1] }]];
  rows.push(await cropImages(masterPng, master, slot.group));
  const variants = await encodeVariants(avif, master, qaWidths(row ?? slot.srcsetWidths));
  const variantRow = [];
  for (const [width, variantAvif] of variants) {
    const png = await sharp(variantAvif).png().toBuffer();
    const meta = await sharp(png).metadata();
    variantRow.push({ buffer: png, width: meta.width, height: meta.height });
  }
  if (variantRow.length > 0) rows.push(variantRow);
  return stack(rows);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleans: ['includeHold', 'force', 'plan', 'probe'] }); // phase-b.sh forwards the generate flags too; only --model, --slots and --staging matter here
  const models = loadModels();
  const routerId = args.model ?? models.default;
  const staging = args.staging ?? DEFAULT_STAGING;
  const extract = loadExtract();
  const files = new Map(loadPromptFiles().map((file) => [file.id, file]));
  const only = list(args.slots);
  const queue = [];
  for (const slot of rasterSlots(extract)) {
    if (only && !only.includes(slot.id)) continue;
    const dir = slotDir(staging, routerId, slot.id);
    const candidates = listCandidates(dir);
    if (candidates.length === 0) continue;
    const qaDir = join(dir, 'qa');
    mkdirSync(qaDir, { recursive: true });
    const widths = slot.srcsetWidths.filter((width) => width <= masterSize(slot)[0]);
    for (const candidate of candidates) {
      const name = `${candidate.kind}-${candidate.offset}`;
      const sheet = join(qaDir, `${name}.png`);
      writeFileSync(sheet, await sheetFor(candidate, slot, widths));
      const file = files.get(slot.id);
      queue.push({
        slot: slot.id,
        candidate: name,
        group: slot.group,
        people: slot.people,
        master: sizeString(masterSize(slot)),
        srcsetWidths: widths,
        image: candidate.imagePath,
        sheet,
        resultPath: join(staging, routerId, 'qa-results', `${slot.id}__${name}.json`),
        copy: file.copy,
        prompt: candidate.prompt,
        amberPrefilter: candidate.amber,
        figures: candidate.figures,
      });
      console.log(`sheet ${slot.id} ${name}`);
    }
  }
  mkdirSync(join(staging, routerId, 'qa-results'), { recursive: true });
  const queuePath = join(staging, routerId, 'qa-queue.json');
  writeFileSync(queuePath, `${JSON.stringify({ model: routerId, generatedAt: new Date().toISOString(), rubric: 'scripts/photo/qa-rubric.md', schema: 'scripts/photo/qa-result.schema.json', items: queue }, null, 2)}\n`);
  console.log(`${queue.length} sheet(s). Queue: ${queuePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
