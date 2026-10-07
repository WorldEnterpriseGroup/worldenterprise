#!/usr/bin/env node
// Image audit over dist (SAGE-PLAN 6.7).
//   Files:  every raster is .avif. The only other raster allowed is apple-touch-icon.png. SVG is allowed.
//   Markup: every <img> has alt (decorative = alt=""), width, height and decoding; alt text is not "image of" filler; the LCP
//           image (fetchpriority=high) is not also lazy; no external image URLs; no data: raster; og:image is AVIF.
//   Size:   no raster displays wider than 1024 CSS px; a card (<= 512 px) weighs <= 60 KB, a band <= 120 KB, and the images
//           a page loads by default weigh <= 400 KB in total.
// Usage: node scripts/audit-images.mjs [--dist dist] [--json reports/images.json]
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { distRel, isDevRoute, metaContent, ORIGIN, parseArgs, readPages, report, srcsetUrls, startTags, stripNonMarkup, walkFiles } from './lib/html.mjs';

export const BUDGET = { card: 60 * 1024, band: 120 * 1024, page: 400 * 1024, cardMaxWidth: 512, maxWidth: 1024 };
const RASTER = /\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|ico)(?:[?#].*)?$/i;
const ALLOWED_RASTER = new Set(['apple-touch-icon.png']);
const FILLER_ALT = /^(?:image|photo|picture|graphic|img|image of|photo of|picture of|a photo of|an image of)\b/i;

/** Raster files in dist that are not AVIF. */
export function auditFiles(root) {
  const findings = [];
  for (const file of walkFiles(root)) {
    const rel = distRel(root, file);
    if (RASTER.test(rel) && !ALLOWED_RASTER.has(rel)) {
      findings.push({ level: 'error', where: rel, message: 'non-AVIF raster in dist (AVIF only; SVG for vector art)' });
    }
  }
  return findings;
}

function toDistPath(url, route) {
  if (/^data:/i.test(url)) return null;
  let u;
  try {
    u = new URL(url, `${ORIGIN}${route}`);
  } catch {
    return null;
  }
  return u.origin === ORIGIN ? decodeURI(u.pathname).replace(/^\/+/, '') : null;
}

export function auditMarkup({ root, pages, sizeOf = (rel) => (existsSync(join(root, rel)) ? statSync(join(root, rel)).size : null) }) {
  const findings = [];
  const stats = [];
  for (const page of pages) {
    const where = (extra = '') => `${page.route}${extra}`;
    const doc = stripNonMarkup(page.html);
    let pageBytes = 0;
    const counted = new Set();

    for (const img of startTags(doc, 'img')) {
      const a = img.attrs;
      const label = where(` <img src="${(a.src ?? '').slice(0, 80)}">`);
      if (!('alt' in a)) findings.push({ level: 'error', where: label, message: 'missing alt attribute (use alt="" for decoration)' });
      else if (FILLER_ALT.test(a.alt.trim())) findings.push({ level: 'error', where: label, message: `alt text starts with filler "${a.alt.slice(0, 30)}"; describe what the image shows` });
      if (!a.width || !a.height) findings.push({ level: 'error', where: label, message: 'missing width or height (layout shift)' });
      if (a.decoding !== 'async') findings.push({ level: 'error', where: label, message: 'missing decoding="async"' });
      if (a.fetchpriority === 'high' && a.loading === 'lazy') findings.push({ level: 'error', where: label, message: 'LCP image is lazy-loaded' });
      const src = a.src ?? '';
      if (/^data:image\/(?:png|jpe?g|gif|webp|avif)/i.test(src)) findings.push({ level: 'error', where: label, message: 'inline data: raster' });
      if (/^(?:https?:)?\/\//i.test(src) && toDistPath(src, page.route) === null) findings.push({ level: 'error', where: label, message: 'external image URL (commit images to the repo)' });
      const width = Number(a.width);
      const file = toDistPath(src, page.route);
      const isSvg = /\.svg(?:[?#].*)?$/i.test(src);
      if (!isSvg && Number.isFinite(width) && width > BUDGET.maxWidth) {
        findings.push({ level: 'error', where: label, message: `raster displayed at ${width}px, above the ${BUDGET.maxWidth}px cap` });
      }
      if (file !== null && file !== '') {
        const bytes = sizeOf(file);
        if (bytes === null) {
          findings.push({ level: 'error', where: label, message: `image file missing from dist: ${file}` });
        } else if (!isSvg) {
          if (!counted.has(file)) {
            counted.add(file);
            pageBytes += bytes;
          }
          const limit = Number.isFinite(width) && width <= BUDGET.cardMaxWidth ? BUDGET.card : BUDGET.band;
          if (bytes > limit) {
            findings.push({ level: 'error', where: label, message: `${(bytes / 1024).toFixed(0)} KB exceeds the ${limit / 1024} KB ${limit === BUDGET.card ? 'card' : 'band'} budget` });
          }
        }
      }
    }

    for (const source of startTags(doc, 'source')) {
      for (const u of source.attrs.srcset !== undefined ? srcsetUrls(source.attrs.srcset) : []) {
        if (RASTER.test(u) && !/\.avif(?:[?#].*)?$/i.test(u)) findings.push({ level: 'error', where: where(` <source srcset="${u.slice(0, 80)}">`), message: 'non-AVIF source in a picture element' });
      }
    }
    for (const img of startTags(doc, 'img')) {
      for (const u of img.attrs.srcset !== undefined ? srcsetUrls(img.attrs.srcset) : []) {
        if (RASTER.test(u) && !/\.avif(?:[?#].*)?$/i.test(u)) findings.push({ level: 'error', where: where(` <img srcset="${u.slice(0, 80)}">`), message: 'non-AVIF srcset candidate' });
      }
      const src = img.attrs.src ?? '';
      if (RASTER.test(src) && !/\.avif(?:[?#].*)?$/i.test(src) && !ALLOWED_RASTER.has(src.replace(/^\//, ''))) {
        findings.push({ level: 'error', where: where(` <img src="${src.slice(0, 80)}">`), message: 'non-AVIF image reference' });
      }
    }
    for (const style of page.html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      if (RASTER.test(style[1]) && !/\.avif(?:[?#].*)?$/i.test(style[1])) findings.push({ level: 'error', where: where(), message: `CSS references a non-AVIF raster: ${style[1].slice(0, 80)}` });
      if (/^data:image\/(?:png|jpe?g|gif|webp|avif)/i.test(style[1])) findings.push({ level: 'error', where: where(), message: 'CSS data: raster' });
    }

    const og = metaContent(page.html, 'og:image');
    if (og !== null && !/\.avif(?:[?#].*)?$/i.test(og)) findings.push({ level: 'error', where: where(' og:image'), message: `og:image is not AVIF: ${og}` });

    if (pageBytes > BUDGET.page && !isDevRoute(page.route)) {
      findings.push({ level: 'error', where: where(), message: `images weigh ${(pageBytes / 1024).toFixed(0)} KB, above the ${BUDGET.page / 1024} KB page budget` });
    }
    stats.push({ route: page.route, imageBytes: pageBytes, images: counted.size });
  }
  return { findings, stats };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', json: 'reports/images.json' });
  try {
    const pages = readPages(args.dist);
    const fileFindings = auditFiles(args.dist);
    const markup = auditMarkup({ root: args.dist, pages });
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, `${JSON.stringify(markup.stats, null, 2)}\n`);
    process.exit(report('audit-images', [...fileFindings, ...markup.findings], `${pages.length} pages`));
  } catch (error) {
    console.error(`audit-images: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
