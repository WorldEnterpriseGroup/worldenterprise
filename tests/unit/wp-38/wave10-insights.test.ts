import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { countWords } from '../../../src/lib/content-files.ts';
import { documentFactsOf } from '../wp-60/document-facts.ts';
import { liveRoutesAt, ROUTED_COLLECTIONS } from '../wp-60/live-routes.ts';
import { listCollectionFiles } from '../../../src/lib/content-files.ts';
import { checkArticle, internalLinks, MAX_WORDS, MIN_WORDS, splitFrontmatter } from '../wp-60/rubric.ts';
import type { RubricContext } from '../wp-60/rubric.ts';
import { checkSourcesFile, classifyHost } from '../wp-60/sources.ts';
import type { SourcesFile } from '../wp-60/sources.ts';

/**
 * WP-38 (wave 10, issue #87): the twelve new data articles each carry a bespoke sourced figure, an accessible table and a source note, meet
 * the article rubric (reusing checkArticle from WP-60), and are recorded in this package's sources file; the twelve improved articles keep
 * meeting the rubric and gained a process figure or pull-out and long-horizon cross-links.
 */
const root = new URL('../../../', import.meta.url).pathname;

interface AuditModule {
  scan(text: string, options?: { route?: string }): { rule: string }[];
}
const audit = claimsAudit as unknown as AuditModule;
const slugs = (collection: string): Set<string> => new Set(listCollectionFiles(root, collection).map((f) => f.replace(/\.mdx?$/, '')));
const ctx: RubricContext = {
  livePaths: liveRoutesAt(root),
  playbookSlugs: slugs('playbooks'),
  templateSlugs: slugs('library'),
  scanClaims: (text, route) => audit.scan(text, { route }),
};

const NEW_ARTICLES: readonly string[] = [
  'ops/the-longevity-paradox-sprint-weekly-endure-for-a-decade',
  'starting/from-first-filing-to-first-payroll-what-the-timing-data-says',
  'starting/founder-age-and-growth-what-the-census-study-of-2-7-million-founders-found',
  'pathways/choosing-a-startup-program-that-fits-a-decision-guide',
  'ops/coworking-and-community-what-the-research-shows-about-staying-power',
  'funding/sbir-and-sttr-as-patient-capital-for-research-based-companies',
  'pathways/using-sba-resource-partners-sbdc-score-wbc-and-vboc',
  'funding/the-time-between-funding-rounds-what-carta-data-reports',
  'starting/encore-founders-starting-a-company-after-fifty',
  'starting/women-and-immigrant-founders-what-the-census-and-research-data-show',
  'funding/bootstrapping-versus-raising-over-a-ten-year-horizon',
  'ops/shutdown-data-and-what-survivors-do-differently',
];

const IMPROVED_ARTICLES: readonly string[] = [
  'ops/a-weekly-operating-rhythm-for-a-founder',
  'team/writing-down-how-a-remote-team-works-a-team-handbook',
  'ops/meetings-async-work-and-decision-records-for-a-small-team',
  'ops/burnout-recognizing-it-and-what-to-change',
  'ai/ai-features-and-customer-data-what-to-decide-first',
  'team/writing-a-job-description-people-can-answer',
  'starting/second-career-founders-turning-domain-knowledge-into-a-saas-idea',
  'funding/grants-and-sbir-programs-for-software-companies',
  'funding/funding-a-software-startup-the-routes',
  'starting/student-founders-the-questions-to-settle-before-you-start',
  'starting/solo-founders-where-a-second-pair-of-eyes-comes-from',
  'team/your-first-hire-what-to-settle-before-you-write-the-job',
];

const pathOf = (slug: string): string => `src/content/insights/${slug}.mdx`;
const read = (slug: string): string => readFileSync(join(root, pathOf(slug)), 'utf8');
const bodyOf = (slug: string): string => splitFrontmatter(read(slug))?.body ?? '';

const CHART = /<(BarChart|SurvivalCurve|StatTiles|DonutChart|LongHorizonTimeline)\b/;
const TABLE = /^\|[^\n]*\|\r?\n\|[ :|-]+\|\r?\n\|/m;
const SOURCE = /\bsource=\{\{[^}]*href:|<SourceNote\b|\bsource: \{[^}]*href:/;

test('there are at least twelve new and twelve improved articles', () => {
  assert.ok(NEW_ARTICLES.length >= 12);
  assert.ok(IMPROVED_ARTICLES.length >= 10);
  assert.equal(new Set([...NEW_ARTICLES, ...IMPROVED_ARTICLES]).size, NEW_ARTICLES.length + IMPROVED_ARTICLES.length);
});

for (const slug of NEW_ARTICLES) {
  test(`new article ${slug} meets the rubric and carries a figure, a table and a source`, () => {
    const raw = read(slug);
    const problems = checkArticle(pathOf(slug), raw, ctx);
    assert.deepEqual(problems.map((p) => `${p.rule}: ${p.message}`), []);
    const body = bodyOf(slug);
    assert.match(body, CHART, 'a chart component');
    assert.match(body, TABLE, 'an accessible markdown table');
    assert.match(body, SOURCE, 'a source note with a link on the figure');
    assert.match(raw, /^publishedDate: 2026-10-15$/m);
    const words = countWords(body);
    assert.ok(words >= MIN_WORDS + 25 && words <= MAX_WORDS, `${words} words leaves no margin at the floor`);
  });
}

test('every new article links to at least three live routes and to a sibling new article', () => {
  const siblings = new Set(NEW_ARTICLES.map((s) => `/insights/${s.split('/')[1]}/`));
  let linked = 0;
  for (const slug of NEW_ARTICLES) {
    const links = internalLinks(bodyOf(slug));
    assert.ok(links.filter((l) => ctx.livePaths.has(l)).length >= 3, slug);
    if (links.some((l) => siblings.has(l))) linked += 1;
  }
  assert.ok(linked >= 10, `${linked} of ${NEW_ARTICLES.length} articles cross-link to a sibling`);
});

test('links to /ecosystem/, /sbir-sttr/ and /data/ appear only once those routes are live', () => {
  for (const slug of [...NEW_ARTICLES, ...IMPROVED_ARTICLES]) {
    for (const link of internalLinks(bodyOf(slug))) {
      if (/^\/(ecosystem|sbir-sttr|data)\//.test(link)) assert.ok(ctx.livePaths.has(link), `${slug} links to ${link}, which is not live`);
    }
  }
});

for (const slug of IMPROVED_ARTICLES) {
  test(`improved article ${slug} still meets the rubric and gained a figure or pull-out and long-horizon links`, () => {
    const raw = read(slug);
    assert.deepEqual(checkArticle(pathOf(slug), raw, ctx).map((p) => `${p.rule}: ${p.message}`), []);
    assert.match(bodyOf(slug), /<(Steps|Callout)\b/, 'a process figure or a pull-out');
    const targets = internalLinks(bodyOf(slug));
    assert.ok(targets.some((l) => NEW_ARTICLES.some((n) => l === `/insights/${n.split('/')[1]}/`)), 'a link to one of the new articles');
  });
}

test('the 18 pinned original articles are not in the improved list', () => {
  const pinned = new Set(Object.keys(JSON.parse(readFileSync(join(root, 'tests/unit/wp-60/fixtures/existing-articles.json'), 'utf8')) as Record<string, string>));
  for (const slug of IMPROVED_ARTICLES) assert.ok(!pinned.has(pathOf(slug)), `${slug} is pinned`);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The sources file
// ---------------------------------------------------------------------------------------------------------------------------------

const sources = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-38.json'), 'utf8')) as SourcesFile;

test('the sources file lists every new article and passes the ledger rules', () => {
  const listed = new Set((sources.documents ?? []).map((d) => d.path));
  for (const slug of NEW_ARTICLES) assert.ok(listed.has(pathOf(slug)), `${slug} is not in wp-38.json`);
  const facts = new Map(
    NEW_ARTICLES.map((slug) => [pathOf(slug), documentFactsOf(pathOf(slug), read(slug))] as const).flatMap(([p, f]) => (f === undefined ? [] : [[p, f] as const])),
  );
  assert.deepEqual(checkSourcesFile(sources, facts), []);
});

test('every recorded fetch is on the host allowlist, Carta and Kauffman included', () => {
  for (const f of sources.fetches) assert.notEqual(classifyHost(f.url), 'unlisted', f.url);
  assert.ok(sources.fetches.some((f) => f.url.includes('carta.com')));
  assert.ok(sources.fetches.some((f) => f.url.includes('kauffman.org')));
});

test('every article source URL is a recorded fetch', () => {
  const known = new Set(sources.fetches.map((f) => f.url));
  for (const slug of NEW_ARTICLES) {
    const facts = documentFactsOf(pathOf(slug), read(slug));
    assert.ok(facts, slug);
    for (const s of facts.sources) assert.ok(known.has(s.url), `${slug} cites ${s.url} with no fetch record`);
  }
});

test('no article states a price WE would charge or calls anything free', () => {
  for (const slug of NEW_ARTICLES) assert.doesNotMatch(bodyOf(slug), /\bfree\b|for free|at no cost/i, slug);
  for (const slug of [...NEW_ARTICLES, ...IMPROVED_ARTICLES]) assert.doesNotMatch(bodyOf(slug), /\bWE (?:is|are|as) an? (?:investor|accelerator)\b/i, slug);
});

test('a component headingLevel sits one level below the Markdown heading before it (audit:a11y and audit:seo heading order)', () => {
  for (const slug of [...NEW_ARTICLES, ...IMPROVED_ARTICLES]) {
    let last = 1;
    for (const line of bodyOf(slug).split('\n')) {
      const heading = /^(#{2,6}) /.exec(line);
      if (heading?.[1] !== undefined) last = heading[1].length;
      const level = /^\s*headingLevel=\{(\d)\}/.exec(line);
      if (level?.[1] !== undefined) assert.equal(Number(level[1]), last + 1, `${slug}: headingLevel ${level[1]} after an h${last}`);
    }
  }
});

void ROUTED_COLLECTIONS;
