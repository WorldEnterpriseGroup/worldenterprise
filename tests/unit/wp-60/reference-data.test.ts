import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { faqSchema, glossarySchema } from '../../../src/lib/content-schemas.ts';

/**
 * Reference data grows by additions only (decision W8-28, contracts section 8.4): the 18 FAQ entries and the 40 glossary terms that
 * exist today parse unchanged under the extended schemas and are kept byte for byte. A correction goes to a handoff, not to the file.
 */
const root = new URL('../../../', import.meta.url).pathname;

interface Originals {
  readonly faq: Readonly<Record<string, string>>;
  readonly glossary: Readonly<Record<string, string>>;
}

function readText(path: string): string {
  try {
    return readFileSync(new URL(path, `file://${root}`), 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${path}: ${(error as Error).message}`);
  }
}

const originals = JSON.parse(readText('tests/unit/wp-60/fixtures/reference-originals.json')) as Originals;

/** The raw text of each entry, keyed by id: from its `- id:` line to the next entry, trailing whitespace dropped. */
function blocks(name: 'faq' | 'glossary'): Map<string, string> {
  const parts = readText(`src/data/${name}.yaml`).split(/^(?=- id: )/m).filter((b) => b.startsWith('- id: '));
  return new Map(parts.map((b) => [/^- id: (\S+)/.exec(b)?.[1] ?? '', b.trimEnd()]));
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

for (const name of ['faq', 'glossary'] as const) {
  test(`${name}: every original entry is still present, byte for byte`, () => {
    const current = blocks(name);
    for (const [id, hash] of Object.entries(originals[name])) {
      const block = current.get(id);
      assert.ok(block !== undefined, `${name} entry "${id}" was removed; reference data grows by additions only`);
      assert.equal(sha(block), hash, `${name} entry "${id}" was edited; send a correction to the handoff instead`);
    }
  });

  test(`${name}: ids are unique and every entry parses under the schema`, () => {
    const entries = parse(readText(`src/data/${name}.yaml`)) as { id: string }[];
    const schema = name === 'faq' ? faqSchema : glossarySchema;
    const seen = new Set<string>();
    for (const entry of entries) {
      assert.ok(!seen.has(entry.id), `duplicate ${name} id "${entry.id}"`);
      seen.add(entry.id);
      const result = schema.safeParse(entry);
      assert.ok(result.success, `${name} "${entry.id}": ${result.success ? '' : result.error.message}`);
    }
    for (const id of Object.keys(originals[name])) assert.ok(seen.has(id), `${name} "${id}" missing`);
  });

  test(`${name}: every related id names an entry of the same file`, () => {
    const entries = parse(readText(`src/data/${name}.yaml`)) as { id: string; related?: string[] }[];
    const ids = new Set(entries.map((e) => e.id));
    for (const entry of entries) for (const rel of entry.related ?? []) assert.ok(ids.has(rel), `${name} "${entry.id}" relates to unknown "${rel}"`);
  });
}

test('the 18 FAQ entries and the existing glossary terms are all present in the pin', () => {
  assert.equal(Object.keys(originals.faq).length, 18);
  assert.equal(Object.keys(originals.glossary).length, 40);
});

const baseFaq = { id: 'x', question: 'Q?', answer: 'A.', group: 'About WE' };
const baseTerm = { id: 'x', term: 'X', definition: 'A general definition of x.', group: 'Funding' };

test('faq: the new fields are optional and default to general', () => {
  const parsed = faqSchema.parse(baseFaq);
  assert.equal(parsed.audience, undefined);
  assert.deepEqual(parsed.seeAlso, []);
});

test('faq: audience takes the four audiences and nothing else', () => {
  for (const audience of ['startup', 'investor', 'partner', 'corporate']) assert.ok(faqSchema.safeParse({ ...baseFaq, audience }).success, audience);
  assert.ok(!faqSchema.safeParse({ ...baseFaq, audience: 'everyone' }).success);
});

test('faq and glossary: seeAlso takes ledger paths only', () => {
  assert.ok(faqSchema.safeParse({ ...baseFaq, seeAlso: ['/program/how-it-works/'] }).success);
  assert.ok(!faqSchema.safeParse({ ...baseFaq, seeAlso: ['program/how-it-works'] }).success);
  assert.ok(!glossarySchema.safeParse({ ...baseTerm, seeAlso: ['https://example.com/'] }).success);
});

test('glossary: genericDefinition defaults to false and claimAllow to empty', () => {
  const parsed = glossarySchema.parse(baseTerm);
  assert.equal(parsed.genericDefinition, false);
  assert.deepEqual(parsed.claimAllow, []);
});

test('glossary: claimAllow takes only the three rule ids the contract names', () => {
  for (const rule of ['C-13-peers', 'C-14-success-based', 'W7-C09-no-equity']) assert.ok(glossarySchema.safeParse({ ...baseTerm, claimAllow: [rule] }).success, rule);
  assert.ok(!glossarySchema.safeParse({ ...baseTerm, claimAllow: ['C-01'] }).success);
});

test('both schemas stay strict: an unknown key fails', () => {
  assert.ok(!faqSchema.safeParse({ ...baseFaq, tags: ['x'] }).success);
  assert.ok(!glossarySchema.safeParse({ ...baseTerm, tags: ['x'] }).success);
});
