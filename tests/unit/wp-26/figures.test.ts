import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { cleanText } from '../../../src/components/visuals/contracts.ts';
import { BDS_2023_BY_AGE, BDS_2023_EXIT_RATE, BDS_2023_SECTOR_EXIT_RATE, BDS_2023_TOTAL, BDS_EXIT_AGES, BDS_STARTUP_FIRMS, BDS_STARTUP_YEARS } from '../../../src/data/insight-figures/bds.generated.ts';
import { AI_USE_BY_SECTOR, BLS_TENURE_2026, BTOS_AI, NIST_AI_RMF_CORE, OWASP_LLM_2025 } from '../../../src/data/insight-figures/datasets.ts';
import {
  BDS_2023_EMP_SUM,
  BDS_2023_FIRM_SUM,
  FIRMS_BY_SIZE,
  INSIGHT_FIGURES,
  JOBS_BY_AGE,
  SECTORS,
  figureById,
  figureCopy,
  figureValues,
} from '../../../src/data/insight-figures/figures.ts';
import { ARTICLE_FIGURES, INLINE_FIGURE_ARTICLES, figuresForPath, slugOf } from '../../../src/data/insight-figures/registry.ts';
import { INSIGHT_SOURCES, RETRIEVED_WP26 } from '../../../src/data/insight-figures/sources.ts';
import { listInsightFiles } from '../../../src/lib/content-files.ts';
import { classifyHost } from '../wp-60/sources.ts';
import { ledgerFigures } from './ledger.ts';

/**
 * WP-26 (wave 11, issue #92): every /insights/ article shows at least one sourced figure. These tests prove the registry covers every
 * article file, every figure resolves to a recorded fetch on an allowlisted host, the sources ledger holds exactly the values the figures
 * print, the copy follows the site rules, the data is internally consistent, and every table the figures render sits in the table frame.
 */
const root = new URL('../../../', import.meta.url).pathname;

interface Fetch {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly fetchedAt: string;
  readonly status: number;
  readonly tool: string;
}
interface Ledger {
  readonly wp: string;
  readonly fetches: readonly Fetch[];
  readonly figures?: unknown;
  readonly documents?: unknown;
}
const readLedger = (wp: string): Ledger => {
  const path = join(root, '.astro-magazine', 'sources', `${wp}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Ledger;
  } catch (error) {
    throw new Error(`Could not read ${path}: ${(error as Error).message}`);
  }
};
const WP26 = readLedger('wp-26');
const WP35 = readLedger('wp-35');
const fetchOf = (wp: 'WP-26' | 'WP-35', id: string): Fetch | undefined => (wp === 'WP-26' ? WP26 : WP35).fetches.find((f) => f.id === id);

const articles = listInsightFiles(root).map((f) => `${f.desk}/${f.slug}`);

// ---------------------------------------------------------------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------------------------------------------------------------

test('every insight article is in the registry or in the inline list, exactly once, and nothing else is', () => {
  assert.ok(articles.length >= 130, `found only ${articles.length} articles; is the content folder readable?`);
  const registered = Object.keys(ARTICLE_FIGURES);
  const both = registered.filter((k) => INLINE_FIGURE_ARTICLES.includes(k));
  assert.deepEqual(both, [], 'an article is both in the registry and in the inline list');
  const covered = new Set([...registered, ...INLINE_FIGURE_ARTICLES]);
  assert.deepEqual(articles.filter((a) => !covered.has(a)), [], 'articles without a figure');
  assert.deepEqual([...covered].filter((k) => !articles.includes(k)).sort(), [], 'registry keys with no article file');
  assert.equal(INLINE_FIGURE_ARTICLES.length, 12);
  assert.equal(new Set(INLINE_FIGURE_ARTICLES).size, 12);
});

test('route slugs are unique, so a page path resolves to one article', () => {
  const slugs = articles.map(slugOf);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('every registered article resolves to at least one known figure, without repeats', () => {
  for (const [key, ids] of Object.entries(ARTICLE_FIGURES)) {
    assert.ok(ids.length >= 1, `${key} has no figure`);
    assert.equal(new Set(ids).size, ids.length, `${key} repeats a figure`);
    for (const id of ids) assert.doesNotThrow(() => figureById(id), `${key}: unknown figure ${id}`);
    assert.deepEqual(figuresForPath(`/insights/${slugOf(key)}/`).map((f) => f.id), ids);
  }
});

test('pages that are not registered articles get no figures: inline-figure articles, the index, the style guide', () => {
  for (const key of INLINE_FIGURE_ARTICLES) assert.deepEqual(figuresForPath(`/insights/${slugOf(key)}/`), []);
  for (const path of ['/insights/', '/styleguide/', '/data/', '/insights/desk/funding/', '/insights/not-an-article/', 'insights/runway-and-burn-the-arithmetic']) {
    assert.deepEqual(figuresForPath(path), [], path);
  }
});

test('figure ids are unique, well formed, and every figure is shown somewhere', () => {
  const ids = INSIGHT_FIGURES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  const used = new Set(Object.values(ARTICLE_FIGURES).flat());
  for (const id of ids) {
    assert.match(id, /^[a-z][a-z0-9-]*$/);
    assert.ok(used.has(id), `${id} is on no article`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Sources and ledger
// ---------------------------------------------------------------------------------------------------------------------------------

test('the WP-26 fetch ledger matches the source registry, one fetch per source, every fetch 200 on an allowlisted host', () => {
  assert.equal(WP26.wp, 'WP-26');
  assert.equal(WP26.documents, undefined, 'WP-26 adds no document entries (article claims stay in their own ledgers)');
  assert.deepEqual(
    WP26.fetches.map((f) => ({ id: f.id, url: f.url, title: f.title, publisher: f.publisher })),
    INSIGHT_SOURCES.map((s) => ({ id: s.id, url: s.url, title: s.title, publisher: s.publisher })),
  );
  for (const f of WP26.fetches) {
    assert.equal(f.status, 200, f.id);
    assert.equal(f.fetchedAt.slice(0, 10), RETRIEVED_WP26, f.id);
    assert.ok(f.tool.trim() !== '', f.id);
    assert.notEqual(classifyHost(f.url), 'unlisted', `${f.id} host`);
  }
});

test('every figure cites recorded fetches, and every source line it prints links to one of them', () => {
  for (const f of INSIGHT_FIGURES) {
    assert.ok(f.ledger.length >= 1, `${f.id} names no fetch`);
    assert.ok(f.sources.length >= 1, `${f.id} prints no source line`);
    const urls = f.ledger.map((r) => {
      const rec = fetchOf(r.wp, r.sourceId);
      assert.ok(rec !== undefined, `${f.id}: ${r.wp} has no fetch "${r.sourceId}"`);
      assert.notEqual(classifyHost(rec.url), 'unlisted', `${f.id}: ${rec.url}`);
      return rec.url;
    });
    for (const s of f.sources) {
      assert.ok(s.href !== undefined && urls.includes(s.href), `${f.id}: source line ${s.href ?? '(no link)'} is not one of its fetches`);
      assert.ok((s.period ?? '').trim() !== '', `${f.id}: source line has no period`);
    }
    assert.match(f.retrieved, /^2026-10-1[56]$/);
    assert.ok((f.derived ?? '').trim() !== '', `${f.id} says nothing on how it was derived`);
  }
});

test('the ledger records exactly the values every figure prints, and the articles that show it', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(WP26.figures)), JSON.parse(JSON.stringify(ledgerFigures())));
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------------------------------------------------------------

const BANNED: readonly RegExp[] = [
  /\b(?:over\s+)?(?:20|twenty)\+?\s+years?\b/i,
  /\btwo decades\b/i,
  /\b(?:cohorts?|accelerators?|mentors?|alumni|free|perks?|tranche|pro rata|discount rate|valuation cap|MFN|premier|revolutionary|testimonials?|investors? in)\b/i,
  /\b(?:colour|favour|organis|analys(?:e|ing))/i,
  /[$€£]/,
];

test('every piece of figure copy passes the visual contract and the site denylist', () => {
  for (const f of INSIGHT_FIGURES) {
    for (const text of figureCopy(f).filter((t) => t !== '')) {
      assert.doesNotThrow(() => cleanText('wp-26', f.id, text), `${f.id}: "${text}"`);
      for (const re of BANNED) assert.doesNotMatch(text, re, `${f.id}: "${text}"`);
    }
    for (const row of figureValues(f)) for (const cell of row) for (const re of BANNED) assert.doesNotMatch(cell, re, `${f.id} table: "${cell}"`);
  }
});

test('every table has rows, and every row has a label and one cell per column', () => {
  for (const f of INSIGHT_FIGURES) {
    const rows = figureValues(f);
    assert.ok(rows.length >= 2, `${f.id} has fewer than two rows`);
    const width = rows[0]?.length ?? 0;
    for (const r of rows) {
      assert.equal(r.length, width, `${f.id}: ragged row ${r.join(' | ')}`);
      assert.ok((r[0] ?? '').trim() !== '', `${f.id}: row with no label`);
      assert.ok(!r.includes('n/a'), `${f.id}: missing value`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The data holds together
// ---------------------------------------------------------------------------------------------------------------------------------

test('BDS: the firm-age classes add up to the published economy-wide totals', () => {
  assert.equal(BDS_2023_FIRM_SUM, BDS_2023_TOTAL.firms);
  assert.equal(BDS_2023_EMP_SUM, BDS_2023_TOTAL.emp);
  assert.equal(BDS_STARTUP_FIRMS.at(-1), BDS_2023_BY_AGE['0'].firms, 'the 2023 startup count is the age-0 firm count');
  assert.equal(BDS_STARTUP_YEARS.length, BDS_STARTUP_FIRMS.length);
  assert.deepEqual(BDS_STARTUP_YEARS, Array.from({ length: 2023 - 1978 + 1 }, (_, i) => 1978 + i));
});

test('BDS: the all-sector exit rate falls with every age class, and each sector covers every class', () => {
  for (let i = 1; i < BDS_EXIT_AGES.length; i++) {
    const a = BDS_EXIT_AGES[i - 1];
    const b = BDS_EXIT_AGES[i];
    if (a === undefined || b === undefined) throw new Error('age classes');
    assert.ok(BDS_2023_EXIT_RATE[b] < BDS_2023_EXIT_RATE[a], `${b} is not below ${a}`);
  }
  for (const s of SECTORS) {
    const rates = BDS_2023_SECTOR_EXIT_RATE[s.code];
    assert.ok(rates !== undefined, s.code);
    for (const a of BDS_EXIT_AGES) assert.ok(rates[a] > 0 && rates[a] < 100, `${s.code} ${a}`);
    assert.ok(rates['1'] > rates['26+'], `${s.code}: the caption says young firms close more often`);
  }
});

test('BDS: shares of jobs, of firms and of firm sizes add to 100 within rounding', () => {
  const near100 = (xs: readonly number[]): boolean => Math.abs(xs.reduce((a, b) => a + b, 0) - 100) <= 0.3;
  assert.ok(near100(JOBS_BY_AGE.map((g) => g.jobs)));
  assert.ok(near100(JOBS_BY_AGE.map((g) => g.firms)));
  assert.ok(near100(FIRMS_BY_SIZE.map((g) => g.value)));
});

test('BTOS: consecutive periods, and expected use is above actual use in every period', () => {
  assert.equal(BTOS_AI.length, 23);
  assert.equal(BTOS_AI[0]?.code, '202524');
  assert.equal(BTOS_AI.at(-1)?.code, '202620');
  assert.equal(new Set(BTOS_AI.map((p) => p.code)).size, BTOS_AI.length);
  for (const p of BTOS_AI) {
    assert.ok(p.expected > p.used, p.code);
    assert.ok(p.used > 10 && p.used < 40, p.code);
  }
  assert.deepEqual(AI_USE_BY_SECTOR.map((s) => s.value), [39.7, 33.9, 19.8, 14]);
});

test('NIST, OWASP and BLS lists match the published counts', () => {
  assert.deepEqual(NIST_AI_RMF_CORE.map((f) => [f.fn, f.categories, f.subcategories]), [['Govern', 6, 19], ['Map', 5, 18], ['Measure', 4, 22], ['Manage', 4, 13]]);
  assert.equal(OWASP_LLM_2025.length, 10);
  OWASP_LLM_2025.forEach((r, i) => assert.equal(r.code, `LLM${String(i + 1).padStart(2, '0')}:2025`));
  assert.equal(BLS_TENURE_2026.at(-1)?.years, 4.1);
});

test('every figure description states numbers that appear in its own table', () => {
  for (const f of INSIGHT_FIGURES) {
    if (f.kind === 'waffle' || f.kind === 'slope' || f.kind === 'ridgeline' || f.kind === 'range' || f.kind === 'area') continue; // WP-35 tests them
    const cells = figureValues(f).flat().join(' ');
    const numbers = f.description.replace(/NAICS \d+/g, "").match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? [];
    for (const n of numbers) {
      if (/^(?:19|20)\d\d$/.test(n) || Number(n.replace(/,/g, '')) <= 30) continue; // years, counts of bars and class ages
      if (f.id === 'nist-ai-rmf-core' && n === '72') {
        assert.equal(NIST_AI_RMF_CORE.reduce((t, c) => t + c.subcategories, 0), 72, 'the stated total');
        continue;
      }
      assert.ok(cells.includes(n), `${f.id}: "${n}" in the description is not in the table`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Rendering contract
// ---------------------------------------------------------------------------------------------------------------------------------

const COMPONENTS = join(root, 'src', 'components', 'insights');
const read = (path: string): string => readFileSync(path, 'utf8');

test('the figure components draw no table of their own: every table comes from the chart shell, inside the table frame', () => {
  for (const name of readdirSync(COMPONENTS).filter((n) => /^Insight(?:Bars|LineChart|RankList|Figures)\.astro$/.test(n))) {
    const src = read(join(COMPONENTS, name));
    assert.doesNotMatch(src, /<table\b/, `${name} draws a table outside DataTable`);
    assert.doesNotMatch(src, /<script\b/, `${name} ships a script`);
    assert.doesNotMatch(src, /style=/, `${name} uses a style attribute`);
    assert.doesNotMatch(src, /https?:\/\//, `${name} references an external URL`);
    if (name !== 'InsightFigures.astro') assert.match(src, /import ChartFigure from '\.\.\/visuals\/charts\/ChartFigure\.astro'/, name);
  }
  const shell = read(join(root, 'src', 'components', 'visuals', 'charts', 'ChartFigure.astro'));
  assert.match(shell, /<DataTable /);
  assert.match(read(join(root, 'src', 'components', 'ui', 'DataTable.astro')), /<div class="table-wrap" tabindex="0" role="region" aria-label=\{caption\}>/);
});

test('the article layout draws the figures after the body and before the sources; the index and cards never do', () => {
  const layout = read(join(root, 'src', 'layouts', 'ArticleLayout.astro'));
  assert.match(layout, /<slot \/>\s*<InsightFigures path=\{meta\.path\} \/>\s*<SourcesList /);
  for (const path of ['src/pages/insights/index.astro', 'src/components/insights/InsightCard.astro', 'src/components/insights/DeskRail.astro']) {
    assert.doesNotMatch(read(join(root, path)), /InsightFigures|insight-figures/, path);
  }
  const section = read(join(COMPONENTS, 'InsightFigures.astro'));
  assert.match(section, /<h2 id="in-the-data">In the data<\/h2>/);
  assert.match(section, /not WE’s results/);
});
