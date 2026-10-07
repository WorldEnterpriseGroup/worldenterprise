#!/usr/bin/env node
// Scans built output for claims the ladder forbids (claims-denylist.json). Visible text, alt text,
// meta tags and JSON-LD are checked. Markup inside an element carrying data-generic-definition is
// exempt for rules marked genericDefinitionAllowed (a plain-language definition of a SAFE term).
// Usage: node scripts/audit-claims.mjs [dist-dir] | --self-test
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const rules = JSON.parse(readFileSync(new URL('../claims-denylist.json', import.meta.url), 'utf8')).rules.map((r) => ({
  ...r,
  regex: new RegExp(r.pattern, `${r.flags ?? ''}g`),
}));

/** Removes whole elements that carry the data-generic-definition attribute. */
export function stripGenericDefinitions(html) {
  let out = html;
  const open = /<([a-z][a-z0-9]*)\b[^>]*\bdata-generic-definition\b[^>]*>/i;
  for (let guard = 0; guard < 1000; guard += 1) {
    const m = open.exec(out);
    if (!m) break;
    const tag = m[1].toLowerCase();
    const tokens = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    tokens.lastIndex = m.index;
    let depth = 0;
    let end = out.length;
    for (let t = tokens.exec(out); t; t = tokens.exec(out)) {
      depth += t[1] === '/' ? -1 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    out = out.slice(0, m.index) + out.slice(end);
  }
  return out;
}

/** Reduces markup to the strings a reader or crawler can see. */
export function visibleText(html) {
  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const attrs = [...html.matchAll(/\b(?:alt|content|aria-label|title)="([^"]*)"/gi)].map((m) => m[1]);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [body, ...attrs, ...jsonLd].join('\n');
}

export function scan(html) {
  const hits = [];
  const strict = visibleText(html);
  const relaxed = visibleText(stripGenericDefinitions(html));
  for (const rule of rules) {
    const haystack = rule.genericDefinitionAllowed ? relaxed : strict;
    rule.regex.lastIndex = 0;
    const m = rule.regex.exec(haystack);
    if (m) hits.push({ rule: rule.id, claim: rule.claim, match: m[0] });
  }
  return hits;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'pagefind' && name !== '_astro') yield* walk(p);
    } else if (/\.(html|xml)$/.test(name)) yield p;
  }
}

function selfTest() {
  const seeded = [
    ['a priced seat is caught', '<p>Seats from $49 per seat</p>', true],
    ['a success fee is caught', '<p>There is no success fee.</p>', true],
    ['a SAFE term is caught outside a definition', '<p>Investors may get a valuation cap.</p>', true],
    ['a SAFE term inside a definition is allowed', '<dl data-generic-definition><dt>Term</dt><dd>A valuation cap limits conversion price.</dd></dl>', false],
    ['seeded text in alt is caught', '<img alt="$99 per seat" src="x">', true],
    ['clean copy passes', '<p>Dedicated team seats, steered by WE.</p>', false],
  ];
  let failed = 0;
  for (const [label, html, expectHit] of seeded) {
    const hit = scan(html).length > 0;
    if (hit !== expectHit) {
      failed += 1;
      console.error(`self-test FAIL: ${label}`);
    } else console.log(`self-test ok: ${label}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) selfTest();
  const dist = process.argv[2] ?? 'dist';
  let files;
  try {
    files = [...walk(dist)];
  } catch (error) {
    console.error(`audit-claims: cannot read ${dist}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  let failed = 0;
  for (const file of files) {
    for (const hit of scan(readFileSync(file, 'utf8'))) {
      failed += 1;
      console.error(`FAIL  ${file}: ${hit.rule} (${hit.claim}) matched "${hit.match}"`);
    }
  }
  console.log(`audit-claims: ${files.length} files scanned, ${failed} findings`);
  process.exit(failed === 0 ? 0 : 1);
}
