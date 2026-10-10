import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { PROGRAM_STEPS } from '../../../src/components/program/steps.ts';
import { routes } from '../../../src/data/routes.ts';
import { pagesSchema } from '../../../src/lib/content-schemas.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SourcesFile } from '../wp-60/sources.ts';
import { documentSentences, headingsOf, JOURNEY_FILES, readJourneyDocument } from './page-copy.ts';

/**
 * The four customer-journey pages (WP-72; docs/wave8-contracts.md, sections 8.2 and 11). The content files are read from disk and held
 * to the contract: a sequence and no durations, the program's own five step titles, a forward link on every page, links that resolve to
 * launched routes, and a sentence ledger that maps every sentence. The template that renders the pages is WP-71's, so nothing here
 * imports it: these checks pass on a base that has no journey route file yet.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const repo = repoViewAt(root);
const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-72.json'), 'utf8')) as SourcesFile;
const docs = JOURNEY_FILES.map((path) => readJourneyDocument(root, path));
const byName = (name: string) => {
  const doc = docs.find((d) => d.path.endsWith(`/${name}.mdx`));
  if (doc === undefined) throw new Error(`No journey document ${name}`);
  return doc;
};
const launched = new Map(routes.filter((r) => r.launch).map((r) => [r.path, r]));

/** The next page in the journey, from the primary reading order of contracts section 11.2 (the last page points at the tools hub). */
const FORWARD: Readonly<Record<string, string>> = {
  index: '/journey/after-you-apply/',
  'after-you-apply': '/journey/first-months/',
  'first-months': '/journey/onboarding-checklist/',
  'onboarding-checklist': '/tools/',
};

const ledgerDocument = (path: string) => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];
const maybeLinkPaths = (body: string): string[] => [...body.matchAll(/<MaybeLink\s+path="([^"]+)"/g)].map((m) => m[1] ?? '');

test('the WP-72 sources file names WP-72 and holds the four journey pages', () => {
  assert.equal(ledger.wp, 'WP-72');
  assert.deepEqual(JOURNEY_FILES.filter((p) => ledger.documents?.some((d) => d.path === p) !== true), []);
  assert.deepEqual(ledger.fetches, []);
});

test('each journey page parses against the strict pages schema with the stage the plan gives it', () => {
  const expected: Readonly<Record<string, { stage: string; step?: number }>> = {
    index: { stage: 'awareness' },
    'after-you-apply': { stage: 'consideration', step: 2 },
    'first-months': { stage: 'consideration' },
    'onboarding-checklist': { stage: 'onboarding' },
  };
  for (const doc of docs) {
    const { family } = doc.frontmatter;
    const slug = doc.path.replace(/^.*\//, '').replace(/\.mdx$/, '');
    const parsed = pagesSchema.safeParse(doc.frontmatter);
    assert.ok(parsed.success, `${doc.path}: ${parsed.success ? '' : parsed.error.message}`);
    assert.equal(family.id, 'journey');
    assert.equal(family.slug, slug);
    assert.equal(family.stage, expected[slug]?.stage, `${slug} stage`);
    assert.equal(family.step, expected[slug]?.step, `${slug} step`);
  }
});

test('every sentence the pages hold is mapped (an unmapped sentence fails here)', () => {
  for (const doc of docs) {
    const mapped = new Set(ledgerDocument(doc.path).map((s) => s.text));
    const missing = documentSentences(doc).filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${doc.path}. Add each to .astro-magazine/sources/wp-72.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still on its page', () => {
  for (const doc of docs) {
    const live = new Set(documentSentences(doc));
    const stale = ledgerDocument(doc.path).map((s) => s.text).filter((text) => !live.has(text));
    assert.deepEqual(stale, [], `Stale in ${doc.path}`);
  }
});

test('every journey mapping is well formed: one claim, page, decision or label, and an existing page', () => {
  for (const doc of docs) assert.deepEqual(checkSentences('WP-72', doc.path, ledgerDocument(doc.path), repo), []);
});

test('no sentence of a journey page trips the claims denylist', () => {
  for (const doc of docs) {
    for (const text of documentSentences(doc)) {
      const hits = audit.scan(text, { route: '/journey/', plain: true, flagValues: {} });
      assert.deepEqual(hits.map((h) => h.rule), [], `${doc.path}: "${text}"`);
    }
  }
});

// Durations (DP-W8-16, contracts section 0 rule 10). The title "Your first months, in order" is the plan's own and states no number.
const UNIT = '(?:hours?|days?|weeks?|fortnights?|months?|quarters?|years?)';
const NUMBER_WORDS = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few|several|first|next|last|half)';
const DURATION_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\d+\\s*[-\\u2013]?\\s*${UNIT}\\b`, 'i'),
  new RegExp(`\\b${NUMBER_WORDS}\\s+${UNIT}\\b`, 'i'),
  /\b30\s*[/-]\s*60\s*[/-]\s*90\b/,
  /\b(?:in|within|after|by)\s+(?:a|an|the)\s+(?:day|week|month|year|quarter)\b/i,
  /\b(?:overnight|same day|next day|day one|week one|month one|quickly|soon|promptly|immediately)\b/i,
];
const NAME_OF_PAGE = /first months, in order/gi;
const withoutPageName = (text: string): string => text.replace(NAME_OF_PAGE, '');

test('the pages state no duration: no digit before a unit of time, no 30/60/90, no spelled-out span', () => {
  for (const doc of docs) {
    const stripped = withoutPageName([...documentSentences(doc), doc.body].join('\n'));
    for (const pattern of DURATION_PATTERNS) assert.doesNotMatch(stripped, pattern, `${doc.path} matches ${pattern}`);
  }
});

test('the duration patterns catch what they are for (the test proves itself)', () => {
  const bad = ['a 30/60/90 plan', 'in 2 weeks', 'in 30 days', 'within a week', 'two months', 'the first week', 'day one', '90-day plan', 'a few days'];
  for (const sample of bad) assert.ok(DURATION_PATTERNS.some((p) => p.test(sample)), `"${sample}" should match`);
  const good = ['Your first months, in order', 'Work in focused cycles', 'what changed since the last review'];
  for (const sample of good) assert.ok(!DURATION_PATTERNS.some((p) => p.test(withoutPageName(sample))), `"${sample}" should not match`);
  assert.ok(DURATION_PATTERNS.some((p) => p.test(withoutPageName('the first months of the work'))), 'only the name of the page is exempt');
});

test('first-months walks the five program step titles in order, then a closing section', () => {
  const headings = headingsOf(byName('first-months').body)
    .filter((h) => h.level === 2)
    .map((h) => h.text);
  assert.deepEqual(headings.slice(0, PROGRAM_STEPS.length), PROGRAM_STEPS.map((s) => s.title));
  assert.deepEqual(headings.slice(PROGRAM_STEPS.length), ['Where to go next']);
});

test('every page links forward to the next page of the journey', () => {
  for (const doc of docs) {
    const slug = doc.frontmatter.family.slug;
    const next = FORWARD[slug];
    assert.ok(next !== undefined, `no forward target for ${slug}`);
    const targets = [...maybeLinkPaths(doc.body), ...(doc.frontmatter.family.checklist ?? []).flatMap((c) => (c.href === undefined ? [] : [c.href]))];
    assert.ok(targets.includes(next), `${doc.path} does not link to ${next}`);
  }
});

test('the pages are chained: each journey page is the forward link of exactly the page before it', () => {
  const order = ['index', 'after-you-apply', 'first-months', 'onboarding-checklist'];
  for (let i = 0; i < order.length - 1; i++) assert.equal(FORWARD[order[i] ?? ''], `/journey/${order[i + 1]}/`);
  assert.equal(FORWARD['onboarding-checklist'], '/tools/');
});

test('every link in a journey page is a launched ledger route, so none can resolve to a 404', () => {
  for (const doc of docs) {
    const hrefs = [...maybeLinkPaths(doc.body), ...(doc.frontmatter.family.checklist ?? []).flatMap((c) => (c.href === undefined ? [] : [c.href]))];
    for (const href of hrefs) assert.ok(launched.has(href), `${doc.path} links to ${href}, which is not a launched ledger route`);
    for (const match of doc.body.matchAll(/\]\((\/[^)]*)\)/g)) assert.fail(`${doc.path} uses a bare Markdown link to ${match[1]}; internal links use <MaybeLink>`);
  }
});

test('the onboarding checklist has unique ids, a link to a library template, and says nothing that makes it a condition', () => {
  const doc = byName('onboarding-checklist');
  const items = doc.frontmatter.family.checklist ?? [];
  assert.ok(items.length >= 8);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  for (const required of ['/library/one-page-problem-brief/', '/library/mvp-cut-line-worksheet/', '/fundability/investor-readiness-checklist/']) {
    assert.ok(items.some((i) => i.href === required), `checklist lacks ${required}`);
  }
  const text = documentSentences(doc).join(' ');
  assert.doesNotMatch(text, /\b(required|must|mandatory|need to have|condition of)\b/i);
});

test('the hub carries the pass-it-on section and the funding disclaimer, and no reward, count or testimonial', () => {
  const hub = byName('index');
  assert.deepEqual(headingsOf(hub.body).filter((h) => h.level === 2).map((h) => h.text), ['Pass it on']);
  assert.ok(documentSentences(hub).includes('WE makes no promise of funding.'));
  assert.doesNotMatch(documentSentences(hub).join(' '), /\b(reward|bonus|discount|testimonial|shared by|people have shared)\b/i);
  assert.ok(maybeLinkPaths(hub.body).includes('/network/partners/enquire/'));
});

test('no page states a funding, outcome or response-time promise', () => {
  for (const doc of docs) {
    const text = documentSentences(doc).join(' ');
    assert.doesNotMatch(text, /\b(guarantee|guaranteed|will be funded|we will reply within|response time of)\b/i, doc.path);
  }
});
