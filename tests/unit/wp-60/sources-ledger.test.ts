import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { listCollectionFiles, listInsightFiles } from '../../../src/lib/content-files.ts';
import { documentFactsAt, documentFactsOf } from './document-facts.ts';
import { repoViewAt } from './repo-view.ts';
import { checkMarkers, checkSourcesFile, classifyHost, fetchDate, h2SlugsOf, slugify } from './sources.ts';
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

/** What a content file says about its own sources and markers (top-level `sources` and `family.sources`). */
const factsFor = (path: string): DocumentFacts | undefined => documentFactsAt(root, path);

const real = loadSourcesFiles();
const repo = repoViewAt(root);

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
    assert.deepEqual(checkSourcesFile(file, facts, repo), []);
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
  assert.equal(classifyHost('https://docs.stripe.com/x'), 'vendor');
  assert.equal(classifyHost('https://irs.gov.evil.example/x'), 'unlisted');
  assert.equal(classifyHost('https://notiso.org/x'), 'unlisted');
  assert.equal(classifyHost('not a url'), 'unlisted');
});

test('a vendor documentation host cannot source a statistic or a regulation, and a regulation needs a statute, agency or standards source', () => {
  const vendor = (kind: 'statistic' | 'regulation'): SourcesFile => ({
    ...base(),
    fetches: [fetchRecord({ id: 'irs', url: 'https://docs.stripe.com/a' }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' })],
    documents: [{ path: DOC, claims: [{ id: 'A1', sentence: 'x', kind, sourceId: 'irs', locator: 'p1', quote: 'q' }] }],
  });
  const f = facts({ sources: [{ id: 'irs', url: 'https://docs.stripe.com/a', accessed: '2026-10-13' }, { id: 'sec', url: 'https://www.sec.gov/b', accessed: '2026-10-13' }] });
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
const checkCopy = (sentences: SentenceRecord[]): string[] => checkSourcesFile(copyFile(sentences), new Map(), repo);

test('page copy: a sentence mapped to a claim, a page with a heading, a decision or a short label passes', () => {
  assert.deepEqual(checkCopy([
    { text: 'WE makes no promise of funding.', claim: 'C-05' },
    { text: 'Read what WE does and does not do.', page: 'src/content/pages/investors/index.mdx#What WE does' },
    { text: 'Read the steps after you apply.', page: 'src/content/pages/apply/apply.mdx' },
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
  assert.ok(checkCopy([{ text: 'd', page: 'src/content/pages/investors/index.mdx#Nothing like this' }]).some((p) => p.includes('is not an H2')));
  assert.ok(checkCopy([{ text: 'd2', page: 'src/content/pages/investors/index.mdx#' }]).some((p) => p.includes('empty heading')));
  assert.ok(checkCopy([{ text: 'one two three four five six seven eight', label: true }]).some((p) => p.includes('too long to be a label')));
});

test('page copy: a claim id or a decision id that is not in its registry fails', () => {
  assert.ok(checkCopy([{ text: 'f', claim: 'C-99' }]).some((p) => p.includes('not in the claims registry')));
  assert.ok(checkCopy([{ text: 'g', decision: 'W8-999' }]).some((p) => p.includes('not in .astro-magazine/decisions.md')));
  assert.ok(checkCopy([{ text: 'h', decision: 'D-20' }, { text: 'i', decision: 'W8-1' }]).length === 0, 'a D-nn and a W8-nn decision that exist pass');
});

test('page copy: a bare page path is valid, and a heading matches an H2 by its slug, not its case or punctuation', () => {
  assert.deepEqual(checkCopy([{ text: 'j', page: 'src/content/pages/investors/index.mdx' }]), []);
  assert.deepEqual(checkCopy([{ text: 'k', page: 'src/content/pages/investors/index.mdx#what-we-does' }]), []);
  assert.deepEqual(checkCopy([{ text: 'l', page: 'src/content/pages/investors/index.mdx#WHAT WE DOES?' }]), []);
});

test('the H2 reader takes Markdown and HTML headings and ignores deeper ones', () => {
  assert.deepEqual(h2SlugsOf('# One\n\n## Two & Three\n\n### Four\n\n<h2 class="x">Five <em>six</em></h2>\n'), ['two-three', 'five-six']);
  assert.equal(slugify('  What WE does! '), 'what-we-does');
});

// A desk page (src/content/pages/insights/topic-*.mdx) has no sources and a strict schema: it carries sentences and no claims.
const DESK_PAGE = 'src/content/pages/investors/index.mdx';
const deskFile = (doc: { claims?: [] }): SourcesFile => ({ wp: 'WP-99', fetches: [], documents: [{ path: DESK_PAGE, ...doc, sentences: [{ text: 'm', page: DESK_PAGE }] }] });
const deskFacts = new Map([[DESK_PAGE, facts({ path: DESK_PAGE, sources: [], noStatistics: false })]]);

test('a document with only sentences passes the source rules, with `claims` absent or an empty array', () => {
  assert.deepEqual(checkSourcesFile(deskFile({}), deskFacts, repo), []);
  assert.deepEqual(checkSourcesFile(deskFile({ claims: [] }), deskFacts, repo), []);
});

test('a document that carries claims is still held to two sources or noStatistics, even when it also lists sentences', () => {
  const withClaims: SourcesFile = {
    wp: 'WP-99',
    fetches: [fetchRecord()],
    documents: [{ path: DESK_PAGE, claims: [{ id: 'A1', sentence: 'x', kind: 'definition', sourceId: 'irs', locator: 'p1' }], sentences: [{ text: 'm', page: DESK_PAGE }] }],
  };
  assert.ok(checkSourcesFile(withClaims, deskFacts, repo).some((p) => p.includes('0 distinct sources')));
});

test('a document with neither claims nor sentences must still exist as a content document', () => {
  const empty: SourcesFile = { wp: 'WP-99', fetches: [], documents: [{ path: 'src/content/pages/nothing.mdx' }] };
  assert.ok(checkSourcesFile(empty, new Map(), repo).some((p) => p.includes('does not exist or is not a content document')));
});

test('the host classes of OP-HOSTS: one positive each, the apex of a suffix rule, subdomains, and the path is never looked at', () => {
  const classes: Record<string, string> = {
    'https://uscode.house.gov/view.xhtml': 'government',
    'https://corp.delaware.gov/x': 'government',
    'https://oag.ca.gov/privacy/ccpa': 'government',
    'https://eur-lex.europa.eu/eli/reg/2016/679/oj': 'government',
    'https://ised-isde.canada.ca/site/x': 'government',
    'https://canada.ca/en/x': 'government',
    'https://www.gov.uk/service-manual': 'government',
    'https://gov.uk/x': 'government',
    'https://www.legislation.gov.uk/ukpga/2018/12': 'government',
    'https://www.revenue.gov.ie/x': 'government',
    'https://www.bmf.bund.de/x': 'government',
    'https://www.bka.gv.at/x': 'government',
    'https://csrc.nist.gov/pubs': 'government',
    'https://nvlpubs.nist.gov/x.pdf': 'government',
    'https://genai.owasp.org/x': 'standards',
    'https://ico.org.uk/for-organisations': 'standards',
    'https://www.aicpa-cima.com/x': 'standards',
    'https://www.ycombinator.com/documents': 'standards',
    'https://nvca.org/wp-content/uploads/model.docx': 'standards',
    'https://martinfowler.com/articles/feature-toggles.html': 'standards',
    'https://basecamp.com/shapeup': 'standards',
    'https://spdx.org/licenses': 'standards',
    'https://arxiv.org/abs/1706.03762': 'scholarly',
    'https://proceedings.neurips.cc/paper/x': 'scholarly',
    'https://aclanthology.org/x': 'scholarly',
    'https://www.mit.edu/x': 'university',
    'https://www.stanford.edu/x': 'university',
    'https://www.ox.ac.uk/x': 'university',
    'https://www.nber.org/papers/w24489': 'scholarly',
    'https://indicators-new.kauffman.org/x': 'scholarly',
    'https://www.kauffman.org/x': 'scholarly',
    'https://gemconsortium.org/x': 'scholarly',
    'https://www.babson.edu/x': 'university',
    'https://carta.com/data/x': 'datapublisher',
    'https://www.cbinsights.com/research/x': 'datapublisher',
    'https://www.score.org/x': 'program',
    'https://www.americassbdc.org/x': 'program',
    'https://www.angelcapitalassociation.org/x': 'program',
    'https://www.techstars.com/x': 'program',
    'https://aws.amazon.com/startups': 'program',
    'https://sbir.gov/x': 'government',
    'https://www.crowell.com/x': 'unlisted',
    'https://www.amazon.com/x': 'unlisted',
    'https://docs.djangoproject.com/en/5.0/': 'vendor',
    'https://sre.google/sre-book/': 'vendor',
    'https://platform.claude.com/docs/x': 'vendor',
    'https://privacy.claude.com/x': 'vendor',
    'https://developers.openai.com/x': 'vendor',
    'https://ai.google.dev/x': 'vendor',
    'https://developers.google.com/x': 'vendor',
    'https://docs.cloud.google.com/x': 'vendor',
  };
  for (const [url, expected] of Object.entries(classes)) assert.equal(classifyHost(url), expected, url);
});

test('hosts that were never approved are unlisted: a blog, a news site, an encyclopedia, and the hosts OP-HOSTS removed', () => {
  for (const url of [
    'https://paulgraham.com/startupideas.html', 'https://en.wikipedia.org/wiki/SAFE', 'https://www.cooleygo.com/x', 'https://www.oecd.org/x',
    'https://www.wto.org/x', 'https://web.dev/x', 'https://developer.mozilla.org/x', 'https://docs.github.com/x', 'https://www.defense.mil/x',
    'https://www.state.us/x', 'https://www.education.gov.au.example.com/x', 'https://www.abc.edu.au/x', 'https://www.parliament.uk/x',
    'https://techcrunch.com/x', 'https://medium.com/x',
  ]) {
    assert.equal(classifyHost(url), 'unlisted', url);
  }
});

test('a fetch tool is any non-empty string, and WebFetch with a 200 passes', () => {
  const tooled = (tool: string): SourcesFile => ({ ...base(), fetches: [fetchRecord({ tool }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b', tool: 'curl' })] });
  assert.deepEqual(check(tooled('WebFetch')), []);
  assert.deepEqual(check(tooled('curl')), []);
  assert.ok(check(tooled(' ')).some((p) => p.includes('records no tool')));
});

test('a regulation claim may come from a government or standards host, and not from a scholarly one', () => {
  const regulation = (url: string): SourcesFile => ({
    ...base(),
    fetches: [fetchRecord({ url }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/b' })],
    documents: [{ path: DOC, claims: [{ id: 'A1', sentence: 'x', kind: 'regulation', sourceId: 'irs', locator: 'p1', quote: 'q' }] }],
  });
  const withUrl = (url: string): DocumentFacts => facts({ sources: [{ id: 'irs', url, accessed: '2026-10-13' }, { id: 'sec', url: 'https://www.sec.gov/b', accessed: '2026-10-13' }] });
  assert.deepEqual(check(regulation('https://www.ico.org.uk/x'), withUrl('https://www.ico.org.uk/x')), []);
  assert.ok(check(regulation('https://arxiv.org/abs/1'), withUrl('https://arxiv.org/abs/1')).some((p) => p.includes('needs a statute')));
});

test('page copy: a listed file that does not exist fails, and a path outside the repository is not a page', () => {
  const missing: SourcesFile = { wp: 'WP-99', fetches: [], documents: [{ path: 'src/data/cta/not-a-file.ts', sentences: [] }] };
  assert.ok(checkSourcesFile(missing, new Map(), repo).some((p) => p.includes('does not exist')));
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Where a document keeps its sources (60a.4): top-level `sources`, or `family.sources` on a family page (contracts 8.2)
// ---------------------------------------------------------------------------------------------------------------------------------

const PAGE = 'src/content/pages/industries/fabricated.mdx';
const sourceLines = (indent: string, ...ids: string[]): string[] => ids.flatMap((id) => [
  `${indent}- id: ${id}`,
  `${indent}  title: ${id}`,
  `${indent}  publisher: P`,
  `${indent}  url: https://www.${id}.gov/a`,
  `${indent}  accessed: 2026-10-13`,
]);
const mdx = (...frontmatter: string[]): string => ['---', 'title: A page', ...frontmatter, '---', '', 'Body.', ''].join('\n');
const pageFile = (): SourcesFile => ({
  wp: 'WP-99',
  fetches: [fetchRecord({ id: 'irs', url: 'https://www.irs.gov/a' }), fetchRecord({ id: 'sec', url: 'https://www.sec.gov/a' })],
  documents: [{ path: PAGE, claims: [{ id: 'A1', sentence: 'x', kind: 'paraphrase', sourceId: 'irs', locator: 'p1' }] }],
});
const checkPage = (raw: string): string[] => {
  const found = documentFactsOf(PAGE, raw);
  return checkSourcesFile(pageFile(), new Map(found === undefined ? [] : [[PAGE, found]]), repo);
};

test('a family page that keeps its sources in family.sources passes the source rules', () => {
  const raw = mdx('family:', '  id: industries', '  sources:', ...sourceLines('    ', 'irs', 'sec'));
  assert.deepEqual(documentFactsOf(PAGE, raw)?.sources.map((s) => s.id), ['irs', 'sec']);
  assert.deepEqual(checkPage(raw).filter((p) => p.includes('distinct sources') || p.includes('no fetch record')), []);
});

test('a page with neither top-level sources nor family.sources fails the distinct-sources rule', () => {
  assert.ok(checkPage(mdx('family:', '  id: industries')).some((p) => p.includes('0 distinct sources')));
  assert.ok(checkPage(mdx()).some((p) => p.includes('0 distinct sources')));
});

test('top-level sources and family.sources are a union, and a source listed in both counts once', () => {
  const split = mdx('sources:', ...sourceLines('  ', 'irs'), 'family:', '  id: industries', '  sources:', ...sourceLines('    ', 'sec'));
  assert.deepEqual(documentFactsOf(PAGE, split)?.sources.map((s) => s.id), ['irs', 'sec']);
  const both = mdx('sources:', ...sourceLines('  ', 'irs', 'sec'), 'family:', '  id: industries', '  sources:', ...sourceLines('    ', 'sec'));
  assert.deepEqual(documentFactsOf(PAGE, both)?.sources.map((s) => s.id), ['irs', 'sec']);
});

test('one family source is not enough, a family source with no fetch record fails, and a stale accessed date fails', () => {
  assert.ok(checkPage(mdx('family:', '  id: industries', '  sources:', ...sourceLines('    ', 'irs'))).some((p) => p.includes('1 distinct sources')));
  const unfetched = mdx('family:', '  id: industries', '  sources:', ...sourceLines('    ', 'irs', 'nist'));
  assert.ok(checkPage(unfetched).some((p) => p.includes('https://www.nist.gov/a with no fetch record')));
  const stale = mdx('family:', '  id: industries', '  sources:', ...sourceLines('    ', 'irs', 'sec')).replace('accessed: 2026-10-13', 'accessed: 2026-10-12');
  assert.ok(checkPage(stale).some((p) => p.includes('was accessed 2026-10-12')));
});

test('noStatistics still lifts the two-source rule, and a file with no frontmatter has no facts', () => {
  assert.deepEqual(checkPage(mdx('noStatistics: true', 'family:', '  id: industries')).filter((p) => p.includes('distinct sources')), []);
  assert.equal(documentFactsOf(PAGE, 'No frontmatter here.'), undefined);
});
