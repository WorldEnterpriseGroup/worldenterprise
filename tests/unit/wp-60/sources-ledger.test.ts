import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { listCollectionFiles, listInsightFiles } from '../../../src/lib/content-files.ts';
import { checkMarkers, checkSourcesFile, classifyHost, fetchDate } from './sources.ts';
import type { DocumentFacts, FetchRecord, SentenceRecord, SourcesFile } from './sources.ts';

/**
 * The sources ledger (docs/wave8-contracts.md, section 9). A package that writes a document with sources records, in
 * `.astro-magazine/sources/wp-NN.json`, each page it fetched, and the document's claims. The rules live in sources.ts and are proven here
 * on fabricated files; the real run covers every sources file in the wave-8 shape (`fetches`), so the older sentence ledgers are not read.
 */
const root = new URL('../../../', import.meta.url).pathname;
const SOURCES_DIR = join(root, '.astro-magazine', 'sources');

/** Content that carried a marker before wave 8 and so has no `markers` entry: the SAFE explainer, pinned by path. */
const LEGACY_MARKER_FILES: ReadonlySet<string> = new Set(['src/content/guides/safe-explained.mdx']);

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${path}: ${(error as Error).message}`);
  }
}

function isWave8File(value: unknown): value is SourcesFile {
  return typeof value === 'object' && value !== null && Array.isArray((value as { fetches?: unknown }).fetches);
}

function loadSourcesFiles(): SourcesFile[] {
  if (!existsSync(SOURCES_DIR)) return [];
  const files: SourcesFile[] = [];
  for (const name of readdirSync(SOURCES_DIR).filter((n) => /^wp-\d+\.json$/.test(n)).sort()) {
    const value = readJson(join(SOURCES_DIR, name));
    if (isWave8File(value)) files.push(value);
  }
  return files;
}

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value : '';
}

/** What a content file says about its own sources and markers. */
function factsFor(path: string): DocumentFacts | undefined {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return undefined;
  const raw = readFileSync(absolute, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (match === null) return undefined;
  let data: Record<string, unknown>;
  try {
    data = (parse(match[1] ?? '') ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${path}: the frontmatter is not valid YAML: ${(error as Error).message}`);
  }
  const sources = (Array.isArray(data.sources) ? (data.sources as Record<string, unknown>[]) : []).map((s) => ({
    id: String(s.id ?? ''),
    url: String(s.url ?? ''),
    accessed: isoDate(s.accessed),
  }));
  const body = match[2] ?? '';
  const markers = [
    ...[...body.matchAll(/data-claim-allow=["']([^"']+)["']/g)].flatMap((m) => (m[1] ?? '').split(/\s+/).filter(Boolean).map((id) => `claim-allow:${id}`)),
    ...(/\bdata-generic-definition\b/.test(body) ? ['generic-definition'] : []),
  ];
  return { path, sources, noStatistics: data.noStatistics === true, markers };
}

const real = loadSourcesFiles();
const repoHas = (path: string): boolean => existsSync(join(root, path));

function factsMap(paths: readonly string[]): Map<string, DocumentFacts> {
  const map = new Map<string, DocumentFacts>();
  for (const path of paths) {
    const facts = factsFor(path);
    if (facts !== undefined) map.set(path, facts);
  }
  return map;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The real files
// ---------------------------------------------------------------------------------------------------------------------------------

for (const file of real) {
  test(`${file.wp} sources file holds every sources rule`, () => {
    const facts = factsMap((file.documents ?? []).map((d) => d.path));
    assert.deepEqual(checkSourcesFile(file, facts, repoHas), []);
  });
}

test('every marker in a content file has an entry in a sources file, except the pinned legacy file', () => {
  const content = ['pages', 'guides', 'playbooks', 'library', 'research', 'faq', 'glossary', 'briefs', 'services']
    .flatMap((collection) => listCollectionFiles(root, collection).map((rel) => `src/content/${collection}/${rel}`))
    .concat(listInsightFiles(root).map((f) => f.file))
    .filter((path) => !LEGACY_MARKER_FILES.has(path));
  assert.deepEqual(checkMarkers(factsMap(content), real), []);
});

test('the legacy marker file still exists, so the exemption cannot outlive it', () => {
  for (const path of LEGACY_MARKER_FILES) assert.ok(existsSync(join(root, path)), `${path} is pinned as legacy but missing`);
});

test('every article written after wave 7 is covered by a sources file, so a new article cannot skip the fetch ledger', () => {
  const originals = new Set(Object.keys(readJson(join(root, 'tests/unit/wp-60/fixtures/existing-articles.json')) as Record<string, string>));
  const covered = new Set(real.flatMap((f) => (f.documents ?? []).map((d) => d.path)));
  const missing = listInsightFiles(root).map((f) => f.file).filter((file) => !originals.has(file) && !covered.has(file));
  assert.deepEqual(missing, []);
});

test('a document is listed in at most one sources file', () => {
  const seen = new Map<string, string>();
  for (const file of real) {
    for (const doc of file.documents ?? []) {
      assert.ok(!seen.has(doc.path), `${doc.path} is in ${seen.get(doc.path)} and ${file.wp}`);
      seen.set(doc.path, file.wp);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The rules have teeth
// ---------------------------------------------------------------------------------------------------------------------------------

const DOC = 'src/content/insights/legal/a-fabricated-article.mdx';
const fetchRecord = (over: Partial<FetchRecord> = {}): FetchRecord => ({
  id: 'irs', url: 'https://www.irs.gov/a', title: 'A', publisher: 'IRS', fetchedAt: '2026-10-13T09:41:07Z', status: 200, tool: 'WebFetch', ...over,
});
const facts = (over: Partial<DocumentFacts> = {}): DocumentFacts => ({
  path: DOC,
  sources: [
    { id: 'irs', url: 'https://www.irs.gov/a', accessed: '2026-10-13' },
    { id: 'sec', url: 'https://www.sec.gov/b', accessed: '2026-10-13' },
  ],
  noStatistics: false,
  markers: [],
  ...over,
});
const base = (): SourcesFile => ({
  wp: 'WP-99',
  fetches: [fetchRecord(), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' })],
  documents: [{ path: DOC, claims: [{ id: 'A1', sentence: 'x', kind: 'statistic', sourceId: 'irs', locator: 'p1', quote: 'a short verbatim quote' }] }],
});
const check = (file: SourcesFile, f: DocumentFacts = facts()): string[] => checkSourcesFile(file, new Map([[DOC, f]]));

test('a well-formed sources file passes', () => {
  assert.deepEqual(check(base()), []);
});

test('a frontmatter source URL with no fetch record fails', () => {
  const file = { ...base(), fetches: [fetchRecord()] };
  assert.ok(check(file).some((p) => p.includes('no fetch record')));
});

test('a fetch that is not status 200 fails', () => {
  const file = { ...base(), fetches: [fetchRecord({ status: 404 }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' })] };
  assert.ok(check(file).some((p) => p.includes('status 404')));
});

test('an accessed date that differs from the fetch date fails, and the fetch date is the UTC date', () => {
  const stale = facts({ sources: [{ id: 'irs', url: 'https://www.irs.gov/a', accessed: '2026-10-12' }, { id: 'sec', url: 'https://www.sec.gov/b', accessed: '2026-10-13' }] });
  assert.ok(check(base(), stale).some((p) => p.includes('was accessed 2026-10-12')));
  assert.equal(fetchDate('2026-10-13T23:59:59Z'), '2026-10-13');
  assert.equal(fetchDate('2026-10-13T23:59:59-05:00'), '2026-10-14');
  assert.equal(fetchDate('not a date'), null);
});

test('fewer than two distinct sources fails unless the document is noStatistics', () => {
  const one = facts({ sources: [{ id: 'irs', url: 'https://www.irs.gov/a', accessed: '2026-10-13' }, { id: 'again', url: 'https://www.irs.gov/a', accessed: '2026-10-13' }] });
  assert.ok(check(base(), one).some((p) => p.includes('1 distinct sources')));
  assert.ok(!check(base(), { ...one, noStatistics: true }).some((p) => p.includes('distinct sources')));
});

test('a claim that names an unknown sourceId fails', () => {
  const file = { ...base(), documents: [{ path: DOC, claims: [{ id: 'A1', sentence: 'x', kind: 'paraphrase' as const, sourceId: 'nope', locator: 'p1' }] }] };
  assert.ok(check(file).some((p) => p.includes('unknown sourceId "nope"')));
});

test('a statistic or regulation claim needs a quote of at most 25 words', () => {
  const claim = (kind: 'statistic' | 'regulation', quote?: string) => ({ ...base(), documents: [{ path: DOC, claims: [{ id: 'A1', sentence: 'x', kind, sourceId: 'irs', locator: 'p1', ...(quote === undefined ? {} : { quote }) }] }] });
  assert.ok(check(claim('statistic')).some((p) => p.includes('needs a verbatim quote')));
  assert.ok(check(claim('regulation', '   ')).some((p) => p.includes('needs a verbatim quote')));
  assert.ok(check(claim('statistic', Array.from({ length: 26 }, () => 'word').join(' '))).some((p) => p.includes('26 words')));
  assert.deepEqual(check(claim('regulation', Array.from({ length: 25 }, () => 'word').join(' '))), []);
});

test('a definition or paraphrase needs no quote', () => {
  const file = { ...base(), documents: [{ path: DOC, claims: [{ id: 'A1', sentence: 'x', kind: 'definition' as const, sourceId: 'irs', locator: 'p1' }] }] };
  assert.deepEqual(check(file), []);
});

test('a fetch on a host that is not on the allowlist fails, an http URL fails, and a duplicate fetch id fails', () => {
  const file = { ...base(), fetches: [fetchRecord(), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' }), fetchRecord({ id: 'blog', url: 'https://some-blog.example.com/post' })] };
  assert.ok(check(file).some((p) => p.includes('some-blog.example.com is not on the host allowlist')));
  assert.ok(check({ ...base(), fetches: [fetchRecord({ url: 'http://www.irs.gov/a' }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' })] }).some((p) => p.includes('not an https URL')));
  assert.ok(check({ ...base(), fetches: [fetchRecord(), fetchRecord()] }).some((p) => p.includes('is used twice')));
});

test('host classes: government, standards, university and vendor documentation hosts are listed; lookalikes are not', () => {
  assert.equal(classifyHost('https://www.irs.gov/x'), 'government');
  assert.equal(classifyHost('https://www.legislation.gov.uk/x'), 'government');
  assert.equal(classifyHost('https://eur-lex.europa.eu/x'), 'government');
  assert.equal(classifyHost('https://www.w3.org/x'), 'standards');
  assert.equal(classifyHost('https://www.ycombinator.com/documents'), 'standards');
  assert.equal(classifyHost('https://law.stanford.edu/x'), 'university');
  assert.equal(classifyHost('https://developer.mozilla.org/x'), 'vendor');
  assert.equal(classifyHost('https://irs.gov.evil.example/x'), 'unlisted');
  assert.equal(classifyHost('https://notiso.org/x'), 'unlisted');
  assert.equal(classifyHost('not a url'), 'unlisted');
});

test('a vendor documentation host cannot source a statistic or a regulation, and a regulation needs a statute, agency or standards source', () => {
  const vendor = (kind: 'statistic' | 'regulation'): SourcesFile => ({
    ...base(),
    fetches: [fetchRecord({ id: 'irs', url: 'https://developer.mozilla.org/a' }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' })],
    documents: [{ path: DOC, claims: [{ id: 'A1', sentence: 'x', kind, sourceId: 'irs', locator: 'p1', quote: 'q' }] }],
  });
  const f = facts({ sources: [{ id: 'irs', url: 'https://developer.mozilla.org/a', accessed: '2026-10-13' }, { id: 'sec', url: 'https://www.sec.gov/b', accessed: '2026-10-13' }] });
  assert.ok(check(vendor('statistic'), f).some((p) => p.includes('vendor documentation host')));
  assert.ok(check(vendor('regulation'), f).some((p) => p.includes('needs a statute, agency or standards-body source')));
  const university: SourcesFile = { ...vendor('regulation'), fetches: [fetchRecord({ id: 'irs', url: 'https://law.stanford.edu/a' }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' })] };
  assert.ok(check(university, facts({ sources: [{ id: 'irs', url: 'https://law.stanford.edu/a', accessed: '2026-10-13' }, { id: 'sec', url: 'https://www.sec.gov/b', accessed: '2026-10-13' }] })).some((p) => p.includes('needs a statute')));
});

test('a document that does not exist fails', () => {
  assert.ok(checkSourcesFile(base(), new Map()).some((p) => p.includes('does not exist')));
});

// Page copy (a component or a data module) is listed with `sentences`, and each sentence needs one mapping.
const COPY_DOC = 'src/data/cta/targets.ts';
const copyFile = (sentences: SentenceRecord[]): SourcesFile => ({ wp: 'WP-99', fetches: [], documents: [{ path: COPY_DOC, sentences }] });
const checkCopy = (sentences: SentenceRecord[]): string[] => checkSourcesFile(copyFile(sentences), new Map(), repoHas);

test('page copy: a sentence mapped to a claim, a page with a heading, a decision or a short label passes', () => {
  assert.deepEqual(checkCopy([
    { text: 'WE makes no promise of funding.', claim: 'C-05' },
    { text: 'Read the steps after you apply.', page: 'src/content/pages/apply/apply.mdx#What happens next' },
    { text: 'Request the brief', decision: 'W8-6' },
    { text: 'Open the tools', label: true },
  ]), []);
});

test('page copy: an unmapped sentence, a double mapping, a repeated sentence and an empty one fail', () => {
  assert.ok(checkCopy([{ text: 'Nothing maps this.' }]).some((p) => p.includes('exactly one of')));
  assert.ok(checkCopy([{ text: 'Two.', claim: 'C-05', decision: 'W8-6' }]).some((p) => p.includes('exactly one of')));
  assert.ok(checkCopy([{ text: 'Same.', claim: 'C-05' }, { text: 'Same.', claim: 'C-05' }]).some((p) => p.includes('listed twice')));
  assert.ok(checkCopy([{ text: ' ', claim: 'C-05' }]).some((p) => p.includes('empty sentence')));
});

test('page copy: a bad claim id, a bad decision id, a page that is missing or has no heading, and a long label fail', () => {
  assert.ok(checkCopy([{ text: 'a', claim: 'claim-5' }]).some((p) => p.includes('not a claim id')));
  assert.ok(checkCopy([{ text: 'b', decision: 'because' }]).some((p) => p.includes('not a decision id')));
  assert.ok(checkCopy([{ text: 'c', page: 'src/content/pages/nothing-here.mdx#Heading' }]).some((p) => p.includes('does not exist')));
  assert.ok(checkCopy([{ text: 'd', page: 'src/content/pages/apply/apply.mdx' }]).some((p) => p.includes('no heading')));
  assert.ok(checkCopy([{ text: 'one two three four five six seven eight', label: true }]).some((p) => p.includes('too long to be a label')));
});

test('page copy: a listed file that does not exist fails, and a path outside the repository is not a page', () => {
  const missing: SourcesFile = { wp: 'WP-99', fetches: [], documents: [{ path: 'src/data/cta/not-a-file.ts', sentences: [] }] };
  assert.ok(checkSourcesFile(missing, new Map(), repoHas).some((p) => p.includes('does not exist')));
  assert.ok(checkCopy([{ text: 'e', page: '../outside.md#H' }]).some((p) => p.includes('does not exist')));
});

test('a marker in a file with no markers entry fails, and a recorded one passes', () => {
  const marked = new Map([[DOC, facts({ markers: ['claim-allow:C-13-peers', 'generic-definition'] })]]);
  assert.equal(checkMarkers(marked, [base()]).length, 2);
  const recorded: SourcesFile = {
    ...base(),
    markers: [
      { path: DOC, rule: 'C-13-peers', reason: 'generic retention term', sourceId: 'irs' },
      { path: DOC, rule: 'generic-definition', reason: 'defines the term generically', sourceId: 'irs' },
    ],
  };
  assert.deepEqual(checkMarkers(marked, [recorded]), []);
  assert.ok(check({ ...recorded, markers: [{ path: DOC, rule: 'C-13-peers', reason: '', sourceId: 'zzz' }] }).length >= 2);
});

test('factsFor reads the markers of a real file the way the check expects', () => {
  const safe = factsFor('src/content/guides/safe-explained.mdx');
  assert.ok(safe !== undefined && safe.markers.includes('generic-definition'));
});
