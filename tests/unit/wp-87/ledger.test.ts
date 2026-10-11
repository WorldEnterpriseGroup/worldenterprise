import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { documentFactsAt } from '../wp-60/document-facts.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSourcesFile, classifyHost } from '../wp-60/sources.ts';
import type { DocumentFacts, SourcesFile } from '../wp-60/sources.ts';

/**
 * The WP-87 sources ledger beyond the shared rules of WP-60: every claim sentence is words the guide really contains, every quote fits the
 * 25-word cap, every source a guide lists was fetched in the writing session, and each guide that makes a claim is covered by the file.
 */
const root = new URL('../../../', import.meta.url).pathname;
const file = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-87.json'), 'utf8')) as SourcesFile;

const GUIDES = [
  'data-room',
  'investor-readiness-checklist',
  'investor-updates',
  'term-sheet-checklist',
  'security-questionnaire-answers',
  'pricing-experiments',
  'customer-interview-synthesis',
].map((slug) => `src/content/guides/${slug}.mdx`);

/** What a reader sees: Markdown links reduced to their text, whitespace folded. A claim sentence is a run of this text. */
const readable = (raw: string): string =>
  raw.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ');

const fold = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ');

test('the WP-87 file is the one the shared rules accept, with every guide it lists present', () => {
  const facts = new Map<string, DocumentFacts>();
  for (const doc of file.documents ?? []) {
    const own = documentFactsAt(root, doc.path);
    if (own !== undefined) facts.set(doc.path, own);
  }
  assert.deepEqual(checkSourcesFile(file, facts, repoViewAt(root)), []);
});

test('the file covers all seven guides and no other document', () => {
  assert.deepEqual((file.documents ?? []).map((d) => d.path).sort(), [...GUIDES].sort());
});

test('every claim sentence is a run of words the guide contains, once links are reduced to their text', () => {
  for (const doc of file.documents ?? []) {
    const text = fold(readable(readFileSync(join(root, doc.path), 'utf8')));
    for (const claim of doc.claims ?? []) assert.ok(text.includes(fold(claim.sentence)), `${doc.path} ${claim.id}: "${claim.sentence}" is not in the guide`);
  }
});

test('claim ids are unique inside a document, and a quote is at most 25 words', () => {
  for (const doc of file.documents ?? []) {
    const ids = (doc.claims ?? []).map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${doc.path} repeats a claim id`);
    for (const claim of doc.claims ?? []) {
      if (claim.quote !== undefined) assert.ok(claim.quote.split(/\s+/).filter(Boolean).length <= 25, `${doc.path} ${claim.id} quote is over 25 words`);
    }
  }
});

test('a statistic or regulation claim carries a verbatim quote from a government or standards host', () => {
  const byId = new Map(file.fetches.map((f) => [f.id, f]));
  for (const doc of file.documents ?? []) {
    for (const claim of doc.claims ?? []) {
      const source = byId.get(claim.sourceId);
      assert.ok(source !== undefined, `${doc.path} ${claim.id} names an unknown source`);
      if (claim.kind === 'regulation' || claim.kind === 'statistic') {
        assert.ok((claim.quote ?? '').length > 0, `${doc.path} ${claim.id} has no quote`);
        assert.ok(['government', 'standards'].includes(classifyHost(source.url)), `${doc.path} ${claim.id} is sourced from ${source.url}`);
      }
    }
  }
});

test('every source a guide lists was fetched, on the date the guide says, and every fetch is used by a guide', () => {
  const used = new Set<string>();
  for (const path of GUIDES) {
    const facts = documentFactsAt(root, path);
    assert.ok(facts !== undefined, path);
    for (const source of facts.sources) {
      const fetched = file.fetches.find((f) => f.url === source.url);
      assert.ok(fetched !== undefined, `${path} cites ${source.url} with no fetch`);
      assert.equal(fetched.fetchedAt.slice(0, 10), source.accessed, `${path}: ${source.id}`);
      used.add(fetched.url);
    }
  }
  assert.deepEqual(file.fetches.filter((f) => !used.has(f.url)).map((f) => f.id), [], 'a fetch no guide cites');
});

test('every fetch was made with WebFetch and returned 200', () => {
  for (const fetched of file.fetches) {
    assert.equal(fetched.tool, 'WebFetch', fetched.id);
    assert.equal(fetched.status, 200, fetched.id);
  }
});

test('every guide that cites a source has a claim for each of its sources, so no source is decoration', () => {
  for (const doc of file.documents ?? []) {
    const facts = documentFactsAt(root, doc.path);
    assert.ok(facts !== undefined);
    const cited = new Set((doc.claims ?? []).map((c) => file.fetches.find((f) => f.id === c.sourceId)?.url));
    for (const source of facts.sources) assert.ok(cited.has(source.url), `${doc.path}: ${source.id} has no claim`);
  }
});

test('no sources file other than this one lists these guides', () => {
  const dir = join(root, '.astro-magazine/sources');
  for (const name of readdirSync(dir).filter((n) => /^wp-\d+\.json$/.test(n) && n !== 'wp-87.json')) {
    let other: { documents?: { path: string }[] };
    try {
      other = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { documents?: { path: string }[] };
    } catch (error) {
      throw new Error(`Could not read ${name}: ${(error as Error).message}`);
    }
    for (const doc of Array.isArray(other.documents) ? other.documents : []) assert.ok(!GUIDES.includes(doc.path), `${doc.path} is also in ${name}`);
  }
});
