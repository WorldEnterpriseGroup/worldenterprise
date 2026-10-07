/**
 * Composes the nine Open Graph cards (SAGE-PLAN 6.7): SVG with text outlined to paths (no font dependency at render
 * time), rendered to AVIF at 1200x630 into src/assets/og/<slot>.avif. Deterministic. Not a site build.
 * Usage: node scripts/build-og.mjs [--svg-dir <dir>]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkitten';
import sharp from 'sharp';
import { C, hex, rng, svgDoc, axial } from '../.astro-magazine/media/art.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src', 'assets', 'og');
const W = 1200;
const H = 630;
const MAX_BYTES = 60 * 1024;
const svgDirFlag = process.argv.indexOf('--svg-dir');
const svgDir = svgDirFlag > -1 ? path.resolve(process.argv[svgDirFlag + 1] ?? '') : null;

/** Copy for each card. Only enabled, published claims (SAGE-PLAN 3): no prices, no outcomes, no superlatives. */
export const CARDS = [
  { id: 'og-home', title: ['Where vision', 'becomes evidence.'], sub: 'A digital incubator for SaaS.', alt: 'World Enterprise Incubator card: Where vision becomes evidence. A digital incubator for SaaS.' },
  { id: 'og-program', title: ['Dream. Build.', 'Grow.'], sub: 'The World Enterprise program, stage by stage.', alt: 'World Enterprise Incubator card: Dream. Build. Grow. The program, stage by stage.' },
  { id: 'og-services', title: ['Seven service', 'lines.'], sub: 'What each line does, and what it does not.', alt: 'World Enterprise Incubator card: Seven service lines, what each does and does not do.' },
  { id: 'og-playbooks', title: ['Playbooks for', 'each stage.'], sub: 'Step-by-step guides for building a SaaS company.', alt: 'World Enterprise Incubator card: Playbooks for each stage of building a SaaS company.' },
  { id: 'og-fundability', title: ['Fundability,', 'explained.'], sub: 'Prepare to raise. No promise of funding.', alt: 'World Enterprise Incubator card: Fundability, explained. Prepare to raise, with no promise of funding.' },
  { id: 'og-resources', title: ['Resources for', 'founders.'], sub: 'Insights, research, templates and a glossary.', alt: 'World Enterprise Incubator card: Resources for founders, including insights, research, templates and a glossary.' },
  { id: 'og-network', title: ['Founders,', 'operators, investors.'], sub: 'How each works with World Enterprise.', alt: 'World Enterprise Incubator card: Founders, operators and investors, and how each works with World Enterprise.' },
  { id: 'og-about', title: ['About World', 'Enterprise.'], sub: 'A fully digital incubator for SaaS companies.', alt: 'World Enterprise Incubator card: About World Enterprise, a fully digital incubator for SaaS companies.' },
  { id: 'og-default', title: ['World Enterprise', 'Incubator.'], sub: 'WE Dream. WE Build. WE Grow.', alt: 'World Enterprise Incubator card: WE Dream. WE Build. WE Grow.' },
];

async function loadFont(file) {
  const buf = await readFile(path.join(root, 'src', 'assets', 'fonts', file));
  return create(buf);
}

/** Outline `text` into one SVG path at baseline (x, y) and pixel size `size`. Applies advance widths and tracking. */
function outline(font, text, x, y, size, fill, tracking = 0) {
  const scale = size / font.unitsPerEm;
  let pen = 0;
  const d = [];
  for (const ch of text) {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    const p = glyph.path.toSVG();
    if (p) d.push(`<path transform="translate(${(x + pen).toFixed(2)} ${y}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${p}"/>`);
    pen += glyph.advanceWidth * scale + tracking;
  }
  return { svg: `<g fill="${fill}">${d.join('')}</g>`, width: pen };
}

async function wordmark() {
  const raw = await readFile(path.join(root, 'src', 'assets', 'brand', 'we-logo-wordmark.svg'), 'utf8');
  const vb = /viewBox="([\d.\s-]+)"/.exec(raw);
  if (!vb) throw new Error('we-logo-wordmark.svg has no viewBox');
  const [, , vw, vh] = vb[1].trim().split(/\s+/).map(Number);
  const targetW = 360;
  const targetH = (targetW * vh) / vw;
  return raw.replace(/<svg\b[^>]*>/, `<svg x="72" y="64" width="${targetW}" height="${targetH.toFixed(2)}" viewBox="${vb[1]}" overflow="hidden">`);
}

function art(seed) {
  const rand = rng(seed);
  const s = 64;
  const parts = [];
  const ox = 1010;
  const oy = 330;
  for (let q = -2; q <= 2; q += 1) {
    for (let r = -2; r <= 2; r += 1) {
      if (Math.abs(q + r) > 2) continue;
      const [x, y] = axial(q, r, s);
      const roll = rand();
      const amber = q === 1 && r === 0;
      const center = q === 0 && r === 0;
      const fill = amber ? C.amber : center ? C.blueDeep : roll < 0.3 ? C.tint : roll < 0.5 ? C.sky : 'none';
      parts.push(hex(ox + x, oy + y, s - 3, { fill, fo: amber || center ? 1 : 0.8, stroke: amber ? C.amber : C.blue, sw: 2.5, so: amber ? 1 : 0.7 }));
    }
  }
  return parts.join('');
}

async function main() {
  const titleFont = await loadFont('titillium-web-latin-700-normal.woff');
  const subFont = await loadFont('titillium-web-latin-600-normal.woff');
  const logo = await wordmark();
  await mkdir(outDir, { recursive: true });
  if (svgDir) await mkdir(svgDir, { recursive: true });
  const rows = [];

  for (const [index, card] of CARDS.entries()) {
    const seed = 7100 + index;
    const parts = [];
    parts.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
    parts.push(`<rect x="0" y="0" width="14" height="${H}" fill="${C.blue}"/>`);
    parts.push(art(seed));
    parts.push(logo);
    let y = 270;
    for (const line of card.title) {
      parts.push(outline(titleFont, line, 72, y, 72, C.charcoal).svg);
      y += 82;
    }
    parts.push(`<rect x="72" y="${y - 52}" width="100" height="6" fill="${C.amber}"/>`);
    parts.push(outline(subFont, card.sub, 72, y + 20, 28, C.blueDeep).svg);
    const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.white}"/><stop offset="1" stop-color="${C.mist}"/></linearGradient>`;
    const svg = svgDoc(W, H, parts.join(''), defs);
    if (svgDir) await writeFile(path.join(svgDir, `${card.id}.svg`), svg);
    let encoded = null;
    for (const quality of [70, 60, 50]) {
      const buf = await sharp(Buffer.from(svg), { density: 72 }).avif({ quality, effort: 6, chromaSubsampling: '4:4:4' }).toBuffer();
      encoded = { buf, quality };
      if (buf.length <= MAX_BYTES) break;
    }
    if (!encoded || encoded.buf.length > MAX_BYTES) throw new Error(`${card.id}: AVIF is ${encoded?.buf.length} bytes, over ${MAX_BYTES}`);
    const meta = await sharp(encoded.buf).metadata();
    if (meta.width !== W || meta.height !== H) throw new Error(`${card.id}: expected ${W}x${H}, got ${meta.width}x${meta.height}`);
    await writeFile(path.join(outDir, `${card.id}.avif`), encoded.buf);
    rows.push({
      id: card.id, group: 'og', file: `${card.id}.avif`, profile: 'og', width: W, height: H, bytes: encoded.buf.length,
      quality: encoded.quality, source: 'svg-composed', seed, text: [...card.title, card.sub].join(' '), alt: card.alt,
    });
  }
  await writeFile(path.join(root, '.astro-magazine', 'media', 'og-rows.json'), `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`Wrote ${rows.length} OG cards to ${path.relative(root, outDir)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
