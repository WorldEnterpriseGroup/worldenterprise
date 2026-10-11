import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { GLOSSARY_GROUP_ORDER } from '../../../src/components/reference/jsonld.ts';
import { routes } from '../../../src/data/routes.ts';
import { glossarySchema } from '../../../src/lib/content-schemas.ts';
import { scan } from '../../../scripts/audit-claims.mjs';

/**
 * WP-77: the glossary grows from 40 to about 120 terms, additions only (decision W8-28, contracts section 8.4). Every new definition is
 * general and neutral, one to three sentences, ten to eighty words. The originals are pinned byte for byte by tests/unit/wp-60.
 */
const root = new URL('../../../', import.meta.url).pathname;

interface Entry {
  readonly id: string;
  readonly term: string;
  readonly definition: string;
  readonly group: string;
  readonly related?: readonly string[];
  readonly seeAlso?: readonly string[];
  readonly genericDefinition?: boolean;
  readonly claimAllow?: readonly string[];
}

function readText(path: string): string {
  try {
    return readFileSync(new URL(path, `file://${root}`), 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${path}: ${(error as Error).message}`);
  }
}

const entries = parse(readText('src/data/glossary.yaml')) as Entry[];
const originals = JSON.parse(readText('tests/unit/wp-60/fixtures/reference-originals.json')) as { glossary: Readonly<Record<string, string>> };
const originalIds = new Set(Object.keys(originals.glossary));
const added = entries.filter((e) => !originalIds.has(e.id));
const byId = new Map(entries.map((e) => [e.id, e]));

const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;
const sentenceCount = (text: string): number => text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).filter(Boolean).length;

test('the glossary holds at least 80 terms, and the 40 originals are still the first 40', () => {
  assert.ok(entries.length >= 80, `${entries.length} terms`);
  assert.equal(originalIds.size, 40);
  assert.deepEqual(
    entries.slice(0, 40).map((e) => e.id),
    [...originalIds],
    'the originals keep their order at the head of the file',
  );
  assert.equal(added.length, entries.length - 40);
});

test('ids are unique kebab-case and terms are unique', () => {
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
  assert.equal(new Set(entries.map((e) => e.term.toLowerCase())).size, entries.length);
  for (const e of added) assert.match(e.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, e.id);
});

test('every term parses under the schema', () => {
  for (const e of entries) {
    const result = glossarySchema.safeParse(e);
    assert.ok(result.success, `${e.id}: ${result.success ? '' : result.error.message}`);
  }
});

test('every group is one the page orders, and the nine topic groups each hold at least five terms', () => {
  const groups = new Set(entries.map((e) => e.group));
  for (const g of groups) assert.ok(GLOSSARY_GROUP_ORDER.includes(g), `group "${g}" is not in GLOSSARY_GROUP_ORDER`);
  for (const g of GLOSSARY_GROUP_ORDER) assert.ok(groups.has(g), `group "${g}" has no terms`);
  for (const g of GLOSSARY_GROUP_ORDER.filter((x) => x !== 'WE vocabulary')) {
    assert.ok(entries.filter((e) => e.group === g).length >= 5, `group "${g}" holds fewer than five terms`);
  }
});

test('the existing WE vocabulary group is not grown by this package', () => {
  assert.deepEqual(added.filter((e) => e.group === 'WE vocabulary'), []);
});

test('each new definition is one to three sentences and 10 to 80 words', () => {
  for (const e of added) {
    const words = wordCount(e.definition);
    const sentences = sentenceCount(e.definition);
    assert.ok(words >= 10 && words <= 80, `${e.id}: ${words} words`);
    assert.ok(sentences >= 1 && sentences <= 3, `${e.id}: ${sentences} sentences`);
    assert.doesNotMatch(e.definition, /\b(?:e\.g\.|i\.e\.|etc\.|vs\.|U\.S\.)/, `${e.id}: an abbreviation with periods fools the sentence count`);
    assert.ok(/[.!?]$/.test(e.definition), `${e.id}: a definition ends with a full stop`);
  }
});

test('each new definition is general and neutral: no WE voice, no program vocabulary, no UK spelling', () => {
  const banned = /\b(?:accelerators?|cohorts?|mentors?|mentorship|alumni|perks?|WE|World Enterprise|we|our|us|you|your|free|tranches?)\b/;
  const uk = /\b(?:programme|organisation|colour|licence|judgement|catalogue|behaviour|favour|centre|analyse|recognise|authorise|utilise)\w*\b/i;
  for (const e of added) {
    const hit = banned.exec(e.definition) ?? banned.exec(e.term);
    assert.equal(hit, null, `${e.id}: "${hit?.[0]}" does not belong in a neutral definition`);
    assert.doesNotMatch(e.definition, uk, `${e.id}: US spelling only`);
  }
});

test('the SAFE-mechanics terms and "cohort" and "accelerator" are not defined here', () => {
  const ids = entries.map((e) => `${e.id} ${e.term}`.toLowerCase()).join('\n');
  for (const word of ['valuation cap', 'discount rate', 'pro rata', 'pro-rata', 'most favored', 'mfn', 'cohort', 'accelerator']) {
    assert.ok(!ids.includes(word), `"${word}" must not be a glossary term`);
  }
});

test('no new definition trips the claims denylist when scanned as plain text, as the Markdown twin and llms-full.txt are', () => {
  for (const e of added) {
    const hits = scan(`${e.term}. ${e.definition}`, { route: '/glossary.md', plain: true });
    assert.deepEqual(
      hits.map((h: { rule: string }) => h.rule),
      [],
      `${e.id}`,
    );
  }
});

test('related ids name real terms, never the term itself, and every new term links to at least one', () => {
  for (const e of entries) {
    for (const rel of e.related ?? []) {
      assert.ok(byId.has(rel), `${e.id} relates to unknown "${rel}"`);
      assert.notEqual(rel, e.id, `${e.id} relates to itself`);
    }
    assert.equal(new Set(e.related ?? []).size, (e.related ?? []).length, `${e.id}: duplicate related id`);
  }
  for (const e of added) assert.ok((e.related ?? []).length >= 1 && (e.related ?? []).length <= 4, `${e.id}: 1 to 4 related terms`);
});

test('seeAlso paths are route-ledger paths that exist as a row', () => {
  const paths = new Set(routes.map((r) => r.path));
  for (const e of entries) for (const path of e.seeAlso ?? []) assert.ok(paths.has(path), `${e.id}: ${path} is not in the route ledger`);
});

test('the original entries are unchanged, byte for byte', () => {
  const parts = readText('src/data/glossary.yaml').split(/^(?=- id: )/m).filter((b) => b.startsWith('- id: '));
  const blocks = new Map(parts.map((b) => [/^- id: (\S+)/.exec(b)?.[1] ?? '', b.trimEnd()]));
  for (const [id, hash] of Object.entries(originals.glossary)) {
    const block = blocks.get(id);
    assert.ok(block !== undefined, `original "${id}" was removed`);
    assert.equal(createHash('sha256').update(block).digest('hex'), hash, `original "${id}" was edited`);
  }
});
