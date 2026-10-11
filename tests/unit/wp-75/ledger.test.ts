import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSourcesFile, classifyHost, fetchDate } from '../wp-60/sources.ts';
import type { DocumentFacts, FetchRecord, SentenceRecord, SourcesFile } from '../wp-60/sources.ts';
import { LEDGER_PATH, ROOT, compareFamily, comparisons, loadComparePages, pageSentences } from './pages.ts';

/**
 * The sources ledger of the comparison pages. ComparePage has no top-level `sources`, so the shared sources-ledger test cannot read a
 * page family; the package ledger therefore maps every sentence of every page two ways (see the `note` in the file) and this test holds
 * both: the shared rules through checkSourcesFile, and the package rules below.
 */
interface Evidence {
  readonly path: string;
  readonly sentence: string;
  readonly support: readonly { readonly sourceId: string; readonly quote: string }[];
}
interface Ledger extends SourcesFile {
  readonly evidence: readonly Evidence[];
}

function readLedger(): Ledger {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${LEDGER_PATH}: ${(error as Error).message}`);
  }
  assert.ok(typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as Ledger).fetches) && Array.isArray((parsed as Ledger).evidence), 'ledger has fetches and evidence');
  return parsed as Ledger;
}

const ledger = readLedger();
const repo = repoViewAt(ROOT);
const MAX_QUOTE_WORDS = 25;
const norm = (text: string): string => text.replace(/\\(['"])/g, '$1').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

test('the ledger holds the shared sources rules (fetch records, host allowlist, sentence mappings)', () => {
  const facts = new Map<string, DocumentFacts>();
  assert.deepEqual(checkSourcesFile(ledger, facts, repo), []);
});

test('every page and the hub is a document of the ledger, and no other path is', () => {
  const paths = (ledger.documents ?? []).map((d) => d.path).sort();
  assert.deepEqual(paths, loadComparePages().map((p) => p.path).sort());
  for (const doc of ledger.documents ?? []) assert.deepEqual(doc.claims, [], `${doc.path} carries no claims array content (the sentences carry the mapping)`);
});

test('every sentence of every page is in exactly one of the ledger lists, and the ledger holds no sentence a page lacks', () => {
  const problems: string[] = [];
  for (const page of loadComparePages()) {
    const doc = (ledger.documents ?? []).find((d) => d.path === page.path);
    const mapped = new Set((doc?.sentences ?? []).map((s) => s.text));
    const sourced = new Set(ledger.evidence.filter((e) => e.path === page.path).map((e) => e.sentence));
    const onPage = new Set(pageSentences(page));
    for (const sentence of onPage) {
      const count = Number(mapped.has(sentence)) + Number(sourced.has(sentence));
      if (count !== 1) problems.push(`${page.slug}: "${sentence}" is in ${count} lists`);
    }
    for (const sentence of [...mapped, ...sourced]) if (!onPage.has(sentence)) problems.push(`${page.slug}: ledger holds "${sentence}", which is not on the page`);
  }
  assert.deepEqual(problems, []);
});

test('a sentence that states a fact about the other category is evidence, never a bare framing sentence', () => {
  const FACT = /\b(?:says|describes|defines|reports|lists|notes|calls|quotes|adds|places)\b/;
  for (const doc of ledger.documents ?? []) {
    for (const sentence of doc.sentences ?? []) {
      assert.doesNotMatch(sentence.text, FACT, `${doc.path}: "${sentence.text}" attributes a statement but has no quote`);
    }
  }
});

test('page-mapped sentences are verbatim in the program page or component they name', () => {
  const problems: string[] = [];
  for (const doc of ledger.documents ?? []) {
    for (const sentence of doc.sentences ?? []) {
      if (sentence.page === undefined) continue;
      const file = sentence.page.split('#')[0] ?? '';
      const text = existsSync(join(ROOT, file)) ? norm(readFileSync(join(ROOT, file), 'utf8')) : '';
      if (!text.includes(norm(sentence.text))) problems.push(`${doc.path}: "${sentence.text}" is not verbatim in ${file}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('framing and label sentences state no fact about WE: decision W8-24 or a short label, and no claim id is cited outside the program claims', () => {
  for (const doc of ledger.documents ?? []) {
    for (const sentence of doc.sentences ?? []) {
      const kinds = [sentence.claim, sentence.page, sentence.decision].filter((v) => v !== undefined).length + (sentence.label === true ? 1 : 0);
      assert.equal(kinds, 1, `${doc.path}: ${sentence.text}`);
      if (sentence.decision !== undefined) assert.equal(sentence.decision, 'W8-24', `${doc.path}: ${sentence.text}`);
    }
  }
});

test('page claimsUsed lists exactly the claim ids the page restates or cites through a program sentence, and each is usable', () => {
  for (const page of comparisons()) {
    assert.ok(page.data.claimsUsed.length >= 1, page.path);
    const restated = (ledger.documents ?? []).find((d) => d.path === page.path)?.sentences?.flatMap((s: SentenceRecord) => (s.claim === undefined ? [] : [s.claim])) ?? [];
    for (const id of restated) assert.ok(page.data.claimsUsed.includes(id as never), `${page.path} restates ${id} but does not list it`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Evidence against fetch records and family.sources
// ---------------------------------------------------------------------------------------------------------------------------------

test('every evidence entry names a fetched source that the page cites, with a quote of at most 25 words', () => {
  const byId = new Map(ledger.fetches.map((f) => [f.id, f] as const));
  const problems: string[] = [];
  for (const entry of ledger.evidence) {
    const page = loadComparePages().find((p) => p.path === entry.path);
    if (page === undefined) {
      problems.push(`${entry.path} is not a page`);
      continue;
    }
    const cited = new Set((page.data.family?.sources ?? []).map((s) => s.id));
    if (entry.support.length === 0) problems.push(`${entry.path}: "${entry.sentence}" has no support`);
    for (const support of entry.support) {
      if (!byId.has(support.sourceId)) problems.push(`${entry.path}: ${support.sourceId} has no fetch record`);
      if (!cited.has(support.sourceId)) problems.push(`${entry.path}: ${support.sourceId} is not in family.sources`);
      const words = support.quote.split(/\s+/).filter(Boolean).length;
      if (words === 0 || words > MAX_QUOTE_WORDS) problems.push(`${entry.path}: quote of ${words} words: ${support.quote}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('family.sources of every page matches the fetch records: the same URL, the fetch date as the accessed date, and no source left uncited', () => {
  const byUrl = new Map<string, FetchRecord>(ledger.fetches.map((f) => [f.url, f]));
  const problems: string[] = [];
  for (const page of comparisons()) {
    const family = compareFamily(page);
    const cited = new Set(ledger.evidence.filter((e) => e.path === page.path).flatMap((e) => e.support.map((s) => s.sourceId)));
    assert.ok(family.sources.length >= 2, page.path);
    for (const source of family.sources) {
      const record = byUrl.get(source.url);
      if (record === undefined) {
        problems.push(`${page.slug}: ${source.url} has no fetch record`);
        continue;
      }
      if (record.id !== source.id) problems.push(`${page.slug}: source id ${source.id} is fetch id ${record.id}`);
      const accessed = source.accessed.toISOString().slice(0, 10);
      if (accessed !== fetchDate(record.fetchedAt)) problems.push(`${page.slug}: ${source.id} accessed ${accessed}, fetched ${fetchDate(record.fetchedAt) ?? 'never'}`);
      if (!cited.has(source.id)) problems.push(`${page.slug}: ${source.id} is listed but no sentence of the page rests on it`);
    }
    // Each definition rests on the source it names.
    for (const definition of family.definitions) {
      const text = definition.text;
      const entry = ledger.evidence.find((e) => e.path === page.path && e.sentence === text);
      if (entry === undefined) problems.push(`${page.slug}: definition "${definition.term}" is not evidence`);
      else if (!entry.support.some((s) => s.sourceId === definition.sourceId)) problems.push(`${page.slug}: definition "${definition.term}" cites ${definition.sourceId} but rests on other sources`);
    }
  }
  assert.deepEqual(problems, []);
});

test('every fetch record is on the host allowlist and a source authority class that fits its use: no vendor, no blog host, no unlisted host', () => {
  for (const fetch of ledger.fetches) {
    const host = classifyHost(fetch.url);
    assert.ok(['government', 'standards', 'university'].includes(host), `${fetch.id} (${fetch.url}) is ${host}`);
    assert.equal(fetch.status, 200);
  }
});

test('every fetch record was fetched on the date the pages say, and is used by a page', () => {
  const used = new Set(comparisons().flatMap((p) => compareFamily(p).sources.map((s) => s.id)));
  for (const fetch of ledger.fetches) {
    assert.equal(fetchDate(fetch.fetchedAt), '2026-10-10', fetch.id);
    assert.ok(used.has(fetch.id), `${fetch.id} is fetched but no page cites it`);
  }
});

test('a source whose title carries the blocked word is cited on the one page that may use it', () => {
  for (const page of comparisons()) {
    const family = compareFamily(page);
    for (const source of family.sources) {
      if (/accelerat/i.test(`${source.title} ${source.publisher}`)) assert.equal(page.slug, 'incubator-vs-other-programs', `${page.slug} cites ${source.id}`);
    }
  }
});

test('the quotes sit in sources that say what the sentence says: a source cited for a sentence is not a source only named elsewhere on the page', () => {
  const countBySource = new Map<string, number>();
  for (const entry of ledger.evidence) for (const s of entry.support) countBySource.set(`${entry.path}|${s.sourceId}`, (countBySource.get(`${entry.path}|${s.sourceId}`) ?? 0) + 1);
  for (const page of comparisons()) {
    for (const source of compareFamily(page).sources) assert.ok((countBySource.get(`${page.path}|${source.id}`) ?? 0) >= 1, `${page.slug}: ${source.id}`);
  }
});
