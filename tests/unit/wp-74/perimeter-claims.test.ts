import assert from 'node:assert/strict';
import test from 'node:test';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSourcesFile, classifyHost, fetchDate } from '../wp-60/sources.ts';
import type { ClaimRecord, DocumentFacts, DocumentRecord, SourcesFile } from '../wp-60/sources.ts';
import { familyOf, industrySlugs, ledger, pagePath, perimeterClaims, root, sentencesOf } from './pages.ts';
import type { PerimeterClaim } from './pages.ts';

/**
 * The outside facts of the industry pages (W8-9: every source fetched in the writing session, with URL and fetch time). A family page keeps
 * its sources in `family.sources`. The repository-wide reader (sources-ledger.test.ts, `factsFor`) reads them from 60a.4 on; this file
 * runs the same `checkSourcesFile` with the family sources as the document's own, so the rules hold on a branch that predates it.
 */
const repo = repoViewAt(root);
const file = ledger();
const claims = perimeterClaims(file);

function factsOf(path: string): DocumentFacts {
  const slug = path.split('/').pop()?.replace(/\.mdx$/, '') ?? '';
  const family = familyOf(pagePath(slug));
  return { path, sources: family.sources.map((s) => ({ id: s.id, url: s.url, accessed: s.accessed.toISOString().slice(0, 10) })), noStatistics: false, markers: [] };
}

const toRecord = ({ path: _path, ...claim }: PerimeterClaim): ClaimRecord => claim;

function asLedger(source: SourcesFile, perimeter: readonly PerimeterClaim[]): { file: SourcesFile; facts: Map<string, DocumentFacts> } {
  const paths = [...new Set(perimeter.map((c) => c.path))];
  const documents: DocumentRecord[] = paths.map((path) => ({ path, claims: perimeter.filter((c) => c.path === path).map(toRecord) }));
  return { file: { wp: source.wp, fetches: source.fetches, documents }, facts: new Map(paths.map((p) => [p, factsOf(p)])) };
}

test('the perimeter claims pass the sources ledger rules with the family sources as the document sources', () => {
  const { file: checked, facts } = asLedger(file, claims);
  assert.deepEqual(checkSourcesFile(checked, facts, repo), []);
});

test('every perimeter claim restates a sentence of its own page, and every sourced sentence has a claim', () => {
  for (const slug of industrySlugs) {
    const path = pagePath(slug);
    const family = familyOf(path);
    const own = claims.filter((c) => c.path === path);
    assert.ok(own.length >= 3, `${slug} has ${own.length} claims`);
    const sentences = new Set(family.perimeter.flatMap((item) => sentencesOf(item.text)));
    for (const claim of own) assert.ok(sentences.has(claim.sentence), `${slug}: ${claim.id} restates a sentence the page does not hold`);
    // An item cites one source; its claims name that source.
    for (const item of family.perimeter) {
      const itemSentences = new Set(sentencesOf(item.text));
      const itemClaims = own.filter((c) => itemSentences.has(c.sentence));
      assert.ok(itemClaims.length >= 1, `${slug}: "${item.title}" states nothing from its source`);
      for (const claim of itemClaims) assert.equal(claim.sourceId, item.sourceId, `${slug}: ${claim.id} names a different source from its item`);
    }
  }
});

test('every claim is a regulation with a locator and a verbatim quote of at most 25 words', () => {
  for (const claim of claims) {
    assert.equal(claim.kind, 'regulation', claim.id);
    assert.ok(claim.locator.trim().length >= 5, `${claim.id} needs a locator`);
    const quote = claim.quote ?? '';
    const words = quote.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 4 && words <= 25, `${claim.id} quote is ${words} words`);
    assert.ok(quote.length <= 125, `${claim.id} quote is ${quote.length} characters; the brief allows about 125`);
  }
  assert.equal(new Set(claims.map((c) => c.id)).size, claims.length, 'claim ids are unique');
});

test('every fetch is a status 200 WebFetch of an https government or standards page, read on the day the pages state', () => {
  assert.ok(file.fetches.length >= 20);
  for (const fetch of file.fetches) {
    assert.equal(fetch.status, 200, fetch.id);
    assert.equal(fetch.tool, 'WebFetch', fetch.id);
    assert.match(fetch.url, /^https:\/\//, fetch.id);
    assert.ok(['government', 'standards'].includes(classifyHost(fetch.url)), `${fetch.id}: ${fetch.url} is ${classifyHost(fetch.url)}`);
    assert.equal(fetchDate(fetch.fetchedAt), '2026-10-10', fetch.id);
  }
});

test('the fetches and the page sources are the same set: nothing fetched goes unused, nothing cited goes unfetched', () => {
  const cited = new Map<string, string>();
  for (const slug of industrySlugs) for (const s of familyOf(pagePath(slug)).sources) cited.set(s.id, s.url);
  const fetched = new Map(file.fetches.map((f) => [f.id, f.url]));
  assert.deepEqual([...cited.keys()].sort(), [...fetched.keys()].sort());
  for (const [id, url] of cited) assert.equal(fetched.get(id), url, `${id}: the page URL is not the fetched URL`);
});

test('a source id means one fetch: two pages that cite the same instrument cite the same URL and title', () => {
  const seen = new Map<string, string>();
  for (const slug of industrySlugs) {
    for (const s of familyOf(pagePath(slug)).sources) {
      const key = `${s.url}|${s.title}|${s.publisher}`;
      assert.equal(seen.get(s.id) ?? key, key, `${s.id} differs between pages`);
      seen.set(s.id, key);
    }
  }
});

test('the fetch ledger rejects a regulation claim whose quote is too long or whose source is not an agency or a standards body', () => {
  const sample = claims[0];
  assert.ok(sample);
  const long = { ...sample, quote: Array.from({ length: 26 }, (_, i) => `word${i}`).join(' ') };
  const tooLong = asLedger(file, [long]);
  assert.ok(checkSourcesFile(tooLong.file, tooLong.facts, repo).some((p) => /at most 25/.test(p)));
  const scholarly = { ...file, fetches: file.fetches.map((f) => (f.id === sample.sourceId ? { ...f, url: 'https://arxiv.org/abs/2401.00001' } : f)) };
  const wrongHost = asLedger(scholarly, [sample]);
  assert.ok(checkSourcesFile(wrongHost.file, wrongHost.facts, repo).length > 0);
});
