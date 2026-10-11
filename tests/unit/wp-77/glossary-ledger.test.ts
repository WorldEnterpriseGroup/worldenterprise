import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { checkSourcesFile, classifyHost } from '../wp-60/sources.ts';
import type { FetchRecord } from '../wp-60/sources.ts';

/**
 * WP-77 sources file: every glossary term this package added restates at least one page fetched in the session, and the file records the
 * fetch. The generic rules (status 200, https, allowlisted host, valid timestamp, a tool) are also run by tests/unit/wp-60/sources-ledger.
 */
const root = new URL('../../../', import.meta.url).pathname;

interface TermSource {
  readonly sourceId: string;
  readonly locator: string;
  readonly quote: string;
}

interface Ledger {
  readonly wp: string;
  readonly fetches: readonly FetchRecord[];
  readonly documents?: readonly unknown[];
  readonly markers?: readonly unknown[];
  readonly terms: readonly { readonly id: string; readonly group: string; readonly sources: readonly TermSource[] }[];
}

function readText(path: string): string {
  try {
    return readFileSync(new URL(path, `file://${root}`), 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${path}: ${(error as Error).message}`);
  }
}

const ledger = JSON.parse(readText('.astro-magazine/sources/wp-77.json')) as Ledger;
const entries = parse(readText('src/data/glossary.yaml')) as { id: string; group: string }[];
const originalIds = new Set(Object.keys((JSON.parse(readText('tests/unit/wp-60/fixtures/reference-originals.json')) as { glossary: Record<string, string> }).glossary));
const added = entries.filter((e) => !originalIds.has(e.id));
const fetchById = new Map(ledger.fetches.map((f) => [f.id, f]));
const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

test('the sources file is WP-77 and holds the generic sources rules', () => {
  assert.equal(ledger.wp, 'WP-77');
  assert.deepEqual(checkSourcesFile({ wp: ledger.wp, fetches: ledger.fetches }, new Map()), []);
});

test('every added term has an entry in the ledger, and the ledger names no other term', () => {
  assert.deepEqual(
    ledger.terms.map((t) => t.id).sort(),
    added.map((e) => e.id).sort(),
  );
  for (const t of ledger.terms) assert.equal(t.group, entries.find((e) => e.id === t.id)?.group, `${t.id}: ledger group differs from the glossary`);
});

test('every added term cites at least one fetched source with a locator and a short verbatim-style quote', () => {
  for (const t of ledger.terms) {
    assert.ok(t.sources.length >= 1, `${t.id} has no source`);
    for (const s of t.sources) {
      assert.ok(fetchById.has(s.sourceId), `${t.id} cites unknown fetch "${s.sourceId}"`);
      assert.ok(s.locator.trim() !== '', `${t.id}: a source needs a locator`);
      assert.ok(s.quote.trim() !== '' && words(s.quote) <= 25 && s.quote.length <= 125, `${t.id}: quote must be 1 to 25 words and at most 125 characters`);
    }
  }
});

test('every fetch record is used by a term, is on an approved host, and was fetched on or after the wave-8 start', () => {
  const used = new Set(ledger.terms.flatMap((t) => t.sources.map((s) => s.sourceId)));
  for (const f of ledger.fetches) {
    assert.ok(used.has(f.id), `fetch "${f.id}" is recorded but no term uses it`);
    assert.notEqual(classifyHost(f.url), 'unlisted', `${f.url} is not an approved host`);
    assert.ok(Date.parse(f.fetchedAt) >= Date.parse('2026-10-10T00:00:00Z'), `${f.id}: fetchedAt predates this package`);
  }
});

test('no claims marker is used, so the marker ledger stays empty', () => {
  assert.deepEqual(ledger.markers ?? [], []);
  assert.deepEqual(ledger.documents ?? [], []);
  const raw = readText('src/data/glossary.yaml');
  assert.doesNotMatch(raw, /^\s*genericDefinition:\s*true/m);
  assert.doesNotMatch(raw, /^\s*claimAllow:\s*\[\s*[^\]\s]/m);
});
