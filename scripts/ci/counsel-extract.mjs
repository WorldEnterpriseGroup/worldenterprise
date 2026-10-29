#!/usr/bin/env node
// Counsel review extract (WP-30, issue #20). Lists, from the built dist and not from the sources, every sentence a visitor, a search
// engine or a screen reader can read that concerns Investor Introductions or investors, with the pages that carry it. Counsel signs off
// what renders, and a sentence assembled from a component constant plus MDX only exists in the built page.
// Sources per page: the text of <main>, the meta and Open Graph descriptions, and every string in the JSON-LD blocks.
// It never fails on content. It fails only when dist is missing, so a green job means a report exists.
// Usage: node scripts/ci/counsel-extract.mjs [--dist dist] [--out reports/counsel-review.md]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { innerHtml, isDevRoute, metaContent, parseArgs, readPages, startTags, stripNonMarkup, textOf } from '../lib/html.mjs';

/** Sentences that touch the add-on, investors or the securities and fee limits around them. */
const RELEVANT = /\bintroduc|\binvestors?\b|\binvestment\b|\bbroker|\bsecurities\b|\bflat[- ]fee\b|\bsuccess[- ]fee|\bcarried interest\b|\bcommission\b|\bfunding\b|\bmeeting\b/i;

/** Splits visible text into sentences. A sentence ends at . ! or ? followed by a capital letter or an opening quote. */
export function sentencesOf(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z“"'(])/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);
}

export function isRelevant(sentence) {
  return RELEVANT.test(sentence);
}

/** Every string value in a parsed JSON value. */
export function jsonStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) jsonStrings(item, out);
  else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) jsonStrings(item, out);
  return out;
}

function mainText(html) {
  const cleaned = stripNonMarkup(html);
  const tags = startTags(cleaned, 'main');
  return tags.length === 0 ? '' : textOf(innerHtml(cleaned, 'main', tags[0].end));
}

function jsonLdStrings(html) {
  const strings = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonStrings(JSON.parse(m[1]), strings);
    } catch (error) {
      strings.push(`[unparseable JSON-LD block: ${error instanceof Error ? error.message : String(error)}]`);
    }
  }
  return strings;
}

/** Collects sentence -> [{ route, source }] for one built page. */
export function collect(page, into) {
  const sources = [
    ['main', mainText(page.html)],
    ['meta description', textOf(metaContent(page.html, 'description') ?? '')],
    ['og:description', textOf(metaContent(page.html, 'og:description') ?? '')],
    ...jsonLdStrings(page.html).map((s) => ['json-ld', textOf(s)]),
  ];
  for (const [source, text] of sources) {
    for (const sentence of sentencesOf(text)) {
      if (!isRelevant(sentence)) continue;
      const rows = into.get(sentence) ?? [];
      if (!rows.some((r) => r.route === page.route && r.source === source)) rows.push({ route: page.route, source });
      into.set(sentence, rows);
    }
  }
}

export function render(into, pageCount) {
  const lines = [
    '# Counsel review extract',
    '',
    `Built from dist: ${pageCount} pages scanned, ${into.size} distinct sentences about investors or Investor Introductions.`,
    'Each sentence is quoted as it renders, once, with every page that carries it. Review each one; the owner decision is that the add-on is a',
    'flat-fee curation and preparation service with no success fee, no stake, no negotiation, no securities advice and no promise of a meeting.',
    '',
  ];
  const ordered = [...into.entries()].sort((a, b) => a[1][0].route.localeCompare(b[1][0].route) || a[0].localeCompare(b[0]));
  let n = 0;
  for (const [sentence, rows] of ordered) {
    n += 1;
    const where = rows.map((r) => `${r.route} (${r.source})`).join(', ');
    lines.push(`${n}. > ${sentence}`, `   - ${where}`, '');
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', out: 'reports/counsel-review.md' });
  try {
    const pages = readPages(args.dist).filter((p) => !isDevRoute(p.route));
    const into = new Map();
    for (const page of pages) collect(page, into);
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, render(into, pages.length));
    console.log(`counsel-extract: ${into.size} sentences from ${pages.length} pages written to ${args.out}`);
  } catch (error) {
    console.error(`counsel-extract: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
