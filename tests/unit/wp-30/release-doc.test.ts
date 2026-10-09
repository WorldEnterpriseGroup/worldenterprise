import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

// WP-30 (issue #20): .astro-magazine/release/RELEASE.md is the owner's runbook and counsel's checklist. The checklist quotes every
// Investor Introductions sentence from its source file. These tests keep it honest: a quote that no longer matches its source, a
// wrong line number, or a new source file that names the add-on without being listed, fails the build.

const root = new URL('../../../', import.meta.url).pathname;
const doc = readFileSync(join(root, '.astro-magazine/release/RELEASE.md'), 'utf8');

interface Normalized {
  readonly text: string;
  /** Line number (1-based) of each character of `text`. */
  readonly lines: readonly number[];
}

/** Collapses every whitespace run to one space, remembering the source line of each kept character. */
function normalize(raw: string): Normalized {
  let text = '';
  const lines: number[] = [];
  let line = 1;
  let pendingSpace = false;
  for (const ch of raw) {
    if (/\s/.test(ch)) {
      pendingSpace = true;
      if (ch === '\n') line += 1;
      continue;
    }
    if (pendingSpace && text.length > 0) {
      text += ' ';
      lines.push(line);
    }
    pendingSpace = false;
    text += ch;
    lines.push(line);
  }
  return { text, lines };
}

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

interface Item {
  readonly id: string;
  readonly path: string;
  readonly quotes: readonly { readonly line: number; readonly text: string }[];
}

/** Parses the checklist: a `#### CR-nn.` heading, a `Source:` line with a path and line, then `> Lnn: quote` lines. */
function parseItems(): Item[] {
  const items: Item[] = [];
  let current: { id: string; path: string; quotes: { line: number; text: string }[] } | null = null;
  for (const line of doc.split('\n')) {
    const heading = /^#### (CR-\d+)\./.exec(line);
    if (heading !== null) {
      current = { id: heading[1] ?? '', path: '', quotes: [] };
      items.push(current);
      continue;
    }
    if (current === null) continue;
    const source = /^Source: `([^`:]+):\d+`/.exec(line);
    if (source !== null) current.path = source[1] ?? '';
    const quote = /^> L(\d+): (.+)$/.exec(line);
    if (quote !== null) current.quotes.push({ line: Number(quote[1]), text: quote[2] ?? '' });
  }
  return items;
}

const items = parseItems();

test('the counsel checklist lists the sources of the add-on and quotes each one', () => {
  assert.ok(items.length >= 15, `expected the full checklist, found ${items.length} items`);
  for (const item of items) {
    assert.notEqual(item.path, '', `${item.id} has no Source line`);
    assert.ok(item.quotes.length > 0, `${item.id} quotes nothing`);
  }
});

test('every quote is verbatim in its source file, at the line the checklist cites', () => {
  for (const item of items) {
    const source = normalize(readFileSync(join(root, item.path), 'utf8'));
    for (const quote of item.quotes) {
      const index = source.text.indexOf(squash(quote.text));
      assert.ok(index >= 0, `${item.id} ${item.path}: quote not found in the source: ${quote.text.slice(0, 80)}`);
      assert.equal(source.lines[index], quote.line, `${item.id} ${item.path}: quote starts at line ${source.lines[index]}, the checklist says ${quote.line}`);
    }
  }
});

/** Source files that name the add-on. The claim register is an internal ledger, not rendered, and the tests quote the wording on purpose. */
const NAMES_THE_ADD_ON = /Investor Introductions|INTRODUCTIONS_|curated introductions|an introduction is not an endorsement|An introduction through the add-on/;
const NOT_RENDERED = new Set(['src/data/claims.ts']);

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full);
    if (rel.startsWith('src/assets')) continue;
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.(astro|ts|md|mdx|yaml|yml|json)$/.test(name)) found.push(rel);
  }
  return found;
}

test('every source file under src that names the add-on is in the checklist', () => {
  const listed = new Set(items.map((i) => i.path));
  const missing = sourceFiles(join(root, 'src'))
    .filter((rel) => !NOT_RENDERED.has(rel))
    .filter((rel) => NAMES_THE_ADD_ON.test(readFileSync(join(root, rel), 'utf8')))
    .filter((rel) => !listed.has(rel));
  assert.deepEqual(missing, [], `these files name Investor Introductions and are not in the counsel checklist (RELEASE.md section 8): ${missing.join(', ')}`);
});

test('the checklist covers the two owner sentences and the readiness criteria in full', () => {
  const quoted = items.flatMap((i) => i.quotes.map((q) => squash(q.text)));
  assert.ok(quoted.some((q) => q.startsWith('Introductions are a flat-fee service. WE is not a broker-dealer')));
  assert.ok(quoted.includes('The fee does not depend on whether any investment closes.'));
  const criteria = quoted.filter((q) => /^(Complete, with no kind|Organized and reconciled|Every traction statement|Assumptions written down|Organized against a standard|Every factual claim)/.test(q));
  assert.equal(criteria.length, 6);
});

test('the runbook names variables and never carries a value', () => {
  for (const name of ['PUBLIC_WE_INTAKE_API_URL', 'PUBLIC_WE_NEWSLETTER_API_URL', 'RELEASE_APPROVED', 'site.securityContact', 'weg-ghpages-mirror']) {
    assert.ok(doc.includes(name), `RELEASE.md does not mention ${name}`);
  }
  assert.doesNotMatch(doc, /https:\/\/[a-z0-9.-]+\/(api|v1)\b/i, 'RELEASE.md must not carry an endpoint URL');
  assert.doesNotMatch(doc, /gh[pousr]_[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY|glpat-/, 'RELEASE.md must not carry a secret');
});
