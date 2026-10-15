import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { STATIONS, PACED, HEAD_START } from '../../../src/data/sales/clock.ts';
import { CLOCK_HONESTY, HONESTY_LINE, NO_FUNDING, POSITIONING } from '../../../src/data/sales/copy.ts';
import { areaPath, compact, linePath, linear, orbitPoints, share, thousands, ticks } from '../../../src/data/sales/geometry.ts';
import { EQUITY_FALLBACK, FIT_TEXT, NOT_FIT_TEXT, SITUATIONS, situationBySlug, situationPath } from '../../../src/data/sales/situations.ts';
import { SALES_SOURCES, salesSource, sourceAnchor } from '../../../src/data/sales/sources.ts';
import type { SalesSourceId } from '../../../src/data/sales/sources.ts';
import { STATS } from '../../../src/data/sales/stats.ts';
import type { StatId } from '../../../src/data/sales/stats.ts';
import { APPLICATIONS_BY_YEAR, CHART_STATS, FORMATION_FUNNEL, NECESSITY_SHARE, ODDS_STAIRCASE_2013, PHASES, SURVIVAL_2015 } from '../../../src/data/sales/timeline.ts';
import { getRoute } from '../../../src/data/routes.ts';
import { classifyHost, fetchDate } from '../wp-60/sources.ts';

/**
 * WP-58, the sales pages: /why-it-takes-time/ (and its brief) and /who-we-work-with/ with seven situation pages. These tests hold the
 * data to the sales rules (SALES.md sections 3 and 8, SITE-COPY.md sections 5 and 6): every figure has a source and a recorded fetch
 * with a short verbatim quote, the honesty and fit wording is exact, no banned word or price appears, and situations never name a group.
 */
const root = new URL('../../../', import.meta.url).pathname;

function read(rel: string): string {
  try {
    return readFileSync(join(root, rel), 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${rel}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function filesUnder(rel: string, ext: RegExp): string[] {
  const dir = join(root, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? filesUnder(`${rel}/${d.name}`, ext) : ext.test(d.name) ? [`${rel}/${d.name}`] : [],
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Sources and statistics
// ---------------------------------------------------------------------------------------------------------------------------------

test('every statistic cites known sources, and every source is cited', () => {
  const known = new Set(SALES_SOURCES.map((s) => s.id));
  const cited = new Set<SalesSourceId>();
  for (const st of Object.values(STATS)) {
    assert.ok(st.sources.length > 0, `${st.id} cites no source`);
    for (const id of st.sources) {
      assert.ok(known.has(id), `${st.id} cites unknown source ${id}`);
      cited.add(id);
    }
  }
  for (const s of SITUATIONS) for (const id of s.chart.sources) cited.add(id);
  for (const s of STATIONS) for (const id of s.sources) cited.add(id);
  for (const id of known) assert.ok(cited.has(id), `source ${id} is never cited`);
});

test('every source is an https page with a short citation and an ISO access date', () => {
  for (const s of SALES_SOURCES) {
    assert.match(s.url, /^https:\/\//, s.id);
    assert.ok(s.short.trim().length > 0, s.id);
    assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/, s.id);
    assert.equal(sourceAnchor(s.id), `#source-${s.id}`);
    assert.equal(salesSource(s.id).url, s.url);
  }
});

test('stations, closing sections and charts quote register figures only', () => {
  const ids = new Set(Object.keys(STATS));
  const used: StatId[] = [...STATIONS.flatMap((s) => s.tiles), ...HEAD_START.tiles, ...SITUATIONS.flatMap((s) => s.stats), ...Object.values(CHART_STATS).flat()];
  for (const id of used) assert.ok(ids.has(id), `${id} is not in STATS`);
  for (const [key, st] of Object.entries(STATS)) assert.equal(st.id, key);
  assert.equal(STATIONS.length, 6, 'six charts');
  assert.deepEqual(PACED.sources, ['cohen-hochberg-2014']);
});

interface LedgerFetch {
  readonly id: string;
  readonly url: string;
  readonly fetchedAt: string;
  readonly status: number;
  readonly tool: string;
}

interface Ledger {
  readonly wp: string;
  readonly fetches: readonly LedgerFetch[];
  readonly pendingHostFetches: readonly (LedgerFetch & { readonly reason: string })[];
  readonly statistics: readonly { readonly st: string; readonly sourceId: string; readonly locator: string; readonly quote: string }[];
}

const ledger = JSON.parse(read('.astro-magazine/sources/wp-58.json')) as Ledger;

test('the sources ledger records a fetch for every source, on its access date', () => {
  assert.equal(ledger.wp, 'WP-58');
  const all = [...ledger.fetches, ...ledger.pendingHostFetches];
  for (const s of SALES_SOURCES) {
    const f = all.find((x) => x.id === s.id);
    assert.ok(f !== undefined, `no fetch record for ${s.id}`);
    assert.equal(f.url, s.url, s.id);
    assert.equal(f.status, 200, s.id);
    assert.ok(f.tool.trim() !== '', s.id);
    assert.equal(fetchDate(f.fetchedAt), s.accessed, `${s.id} accessed date`);
  }
});

test('allowlisted hosts sit in fetches; unlisted ones wait in pendingHostFetches with a reason', () => {
  for (const f of ledger.fetches) assert.notEqual(classifyHost(f.url), 'unlisted', `${f.id} is unlisted but in fetches`);
  for (const f of ledger.pendingHostFetches) {
    assert.equal(classifyHost(f.url), 'unlisted', `${f.id} is allowlisted; move it to fetches`);
    assert.ok(f.reason.trim().length > 0, f.id);
  }
});

test('every statistic has a ledger quote of at most 25 words from a recorded source', () => {
  const ids = new Set(SALES_SOURCES.map((s) => s.id as string));
  for (const st of Object.keys(STATS)) assert.ok(ledger.statistics.some((x) => x.st === st), `${st} has no ledger entry`);
  for (const x of ledger.statistics) {
    assert.ok(ids.has(x.sourceId), `${x.st} names unknown source ${x.sourceId}`);
    assert.ok(x.locator.trim() !== '', x.st);
    const words = x.quote.trim().split(/\s+/).length;
    assert.ok(words > 0 && words <= 25, `${x.st} quote is ${words} words`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Copy rules
// ---------------------------------------------------------------------------------------------------------------------------------

test('the honesty, fit and payment wording is exact', () => {
  assert.equal(HONESTY_LINE, "These figures describe all new U.S. businesses, not WE's results.");
  assert.equal(CLOCK_HONESTY[0], HONESTY_LINE);
  assert.equal(
    FIT_TEXT,
    'The core of the business can be built on a screen: software, a digital product, or a service run on software and expertise. You can fund a team from revenue, savings, outside capital or a corporate budget.',
  );
  assert.match(NOT_FIT_TEXT, /^WE is not the right help if the core work of the business is physical/);
  assert.equal(EQUITY_FALLBACK, 'WE is paid for work already done. The agreement sets every term before you sign.');
  assert.equal(NO_FUNDING, 'WE makes no promise of funding.');
  assert.match(POSITIONING, /^WE is a long-horizon business incubation and consulting firm\./);
});

test('the under-backed page says WE makes no promise of funding where the reader sees it', () => {
  const s = situationBySlug('under-backed-builders');
  assert.ok(s !== undefined);
  assert.ok(s.subhead.includes(NO_FUNDING));
});

/** The copy files: data modules and the page and component markup, with styles, imports and attribute names removed. */
function copyOf(rel: string): string {
  return read(rel)
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/^import .*$/gm, '')
    .replace(/\bclass(?::list)?=/g, '')
    .replace(/https:\/\/\S+/g, '');
}

const COPY_FILES = [
  ...filesUnder('src/data/sales', /\.ts$/).filter((f) => !f.endsWith('/sources.ts')),
  ...filesUnder('src/components/sales', /\.astro$/),
  ...filesUnder('src/pages/who-we-work-with', /\.astro$/),
  ...filesUnder('src/pages/why-it-takes-time', /\.astro$/),
];

const BANNED: readonly RegExp[] = [
  /\bfree\b/i,
  /\bperks?\b/i,
  /\baccelerators?\b/i,
  /\bcohorts?\b/i,
  /\bmentors?\b/i,
  /\balumni\b/i,
  /\binvestor network\b/i,
  /\bdemo day\b/i,
  /\bgraduation\b/i,
  /\bpeer sessions?\b/i,
  /\bfundable\b/i,
  /\bguarantee[ds]?\b/i,
  /\bsuccess[- ]fees?\b/i,
  /\bno fees?\b/i,
  /\b(?:20|twenty)\+?\s+years?\b/i,
  /\btwo decades\b/i,
  /\bWe (?:build|steer)/,
  /\b(?:programmes?|colour|centre|organis(?:e|ation)|behaviour|favour|licence)\b/i,
  // A price: a dollar figure of two or more digits, or one with a scale or rate ('$1' alone is a regex back-reference in code).
  /\$\s?\d{2,}|\$\s?\d[\d,.]*\s*(?:k|m|million|thousand|per|a month)\b/i,
  /\b(?:USD|EUR|GBP)\b/,
];

test('the sales copy uses no banned word, UK spelling or price', () => {
  assert.ok(COPY_FILES.length >= 15, `found only ${COPY_FILES.length} copy files`);
  for (const rel of COPY_FILES) {
    const text = copyOf(rel);
    for (const re of BANNED) assert.doesNotMatch(text, re, `${rel} matches ${re}`);
  }
});

test('only the cited research title names a program category, and the page marks its sources list for it', () => {
  const titled = SALES_SOURCES.filter((s) => /accelerat/i.test(s.title)).map((s) => s.id);
  assert.deepEqual(titled, ['cohen-hochberg-2014']);
  assert.match(read('src/components/sales/SalesSources.astro'), /data-claim-allow="C-13-peers"/);
});

// Words that name a protected group or an identity. Situation headlines, H1s and meta titles never carry them.
const GROUP_WORDS =
  /\b(?:immigrants?|women|woman|female|men|male|black|white|latino|latina|latinx|hispanic|asian|veterans?|disabled|disability|older|elderly|seniors?|young|youth|retirees?|minority|minorities|religio\w*|gay|lesbian|lgbt\w*|mothers?|fathers?|parents?)\b/i;

test('situations are situations: every page is for anyone in it, and no headline or meta title names a group', () => {
  assert.equal(SITUATIONS.length, 7);
  for (const s of SITUATIONS) {
    assert.match(s.situation, /^For any(?:one| capable founder)\b/, `${s.id} situation line`);
    for (const field of [s.headline, s.seoTitle, s.name, s.card, s.worldAlt]) assert.doesNotMatch(field, GROUP_WORDS, `${s.id}: "${field}"`);
    assert.ok(s.description.length <= 160, `${s.id} description is ${s.description.length} characters`);
    assert.ok(s.objections.length >= 2, `${s.id} answers too few questions`);
    assert.ok(s.stats.length >= 1 && s.stats.length <= 3, `${s.id} shows ${s.stats.length} figures`);
  }
});

test('each situation has its own world and a readiness call to action', () => {
  assert.equal(new Set(SITUATIONS.map((s) => s.world)).size, 7);
  assert.equal(new Set(SITUATIONS.map((s) => s.slug)).size, 7);
  for (const s of SITUATIONS) {
    const all = [s.primary, ...s.secondary];
    assert.ok(all.some((c) => c.href === `/apply/?situation=${s.id}`), `${s.id} has no readiness link`);
    for (const c of all) assert.match(c.href, /^\/[a-z0-9/-]*\/(?:\?situation=[a-z-]+)?$/, `${s.id} link ${c.href}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Routes and pages
// ---------------------------------------------------------------------------------------------------------------------------------

test('every WP-58 route is a launched ledger row owned by WP-58 with a page file', () => {
  const paths = ['/why-it-takes-time/', '/who-we-work-with/', ...SITUATIONS.map(situationPath)];
  for (const path of paths) {
    const row = getRoute(path);
    assert.ok(row !== undefined, `${path} has no ledger row`);
    assert.equal(row.owner, 'WP-58', path);
    assert.equal(row.launch, true, path);
    const file = path === '/who-we-work-with/' || path.startsWith('/why-it-takes-time/') ? `src/pages${path}index.astro` : `src/pages${path.replace(/\/$/, '')}.astro`;
    assert.ok(existsSync(join(root, file)), `${path} has no page at ${file}`);
  }
});

test('situation page files pass their own slug', () => {
  for (const s of SITUATIONS) assert.match(read(`src/pages/who-we-work-with/${s.slug}.astro`), new RegExp(`slug="${s.slug}"`));
});

test('charts are images with a title and a description, and every chart frame offers its data', () => {
  for (const name of ['LineChart', 'ColumnChart']) {
    const src = read(`src/components/sales/${name}.astro`);
    assert.match(src, /role="img"/, name);
    assert.match(src, /<title id=/, name);
    assert.match(src, /<desc id=/, name);
  }
  assert.match(read('src/components/sales/ChartFrame.astro'), /<details[\s\S]*Show the data[\s\S]*DataTable/);
  for (const rel of COPY_FILES.filter((f) => f.endsWith('.astro'))) {
    const src = read(rel);
    assert.doesNotMatch(src, /\bstyle="/, `${rel} has an inline style`);
    assert.doesNotMatch(src, /<script\b/, `${rel} ships a script`);
    assert.doesNotMatch(src, /is:inline/, `${rel} uses is:inline`);
    assert.doesNotMatch(src, /(?:src|href)="(?:data|blob):/, `${rel} embeds a data URL`);
    assert.doesNotMatch(src, /animation-iteration-count:\s*infinite/, `${rel} animates forever`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Data shape
// ---------------------------------------------------------------------------------------------------------------------------------

test('the chart data matches the figures it restates', () => {
  const last = APPLICATIONS_BY_YEAR[APPLICATIONS_BY_YEAR.length - 1];
  assert.deepEqual(last, { x: 2025, y: 5671836 });
  assert.equal(Math.max(...APPLICATIONS_BY_YEAR.map((p) => p.y)), 5671836, '2025 is the record year');
  const [apps, , two] = FORMATION_FUNNEL;
  assert.ok(apps !== undefined && two !== undefined);
  assert.equal(Math.round((two.value / apps.value) * 1000) / 10, 7.5);
  const all = SURVIVAL_2015[0];
  assert.ok(all !== undefined);
  assert.equal(all.points.find((p) => p.x === 10)?.y, 34.7);
  for (const s of SURVIVAL_2015) assert.equal(s.points.length, 11, s.label);
  assert.equal(ODDS_STAIRCASE_2013[0]?.value, 79.6);
  assert.equal(ODDS_STAIRCASE_2013[ODDS_STAIRCASE_2013.length - 1]?.value, 94.4);
  assert.equal(NECESSITY_SHARE.points.find((p) => p.x === 2020)?.y, 30.2);
  assert.equal(NECESSITY_SHARE.points.find((p) => p.x === 2025)?.y, 16.7);
  for (let i = 1; i < PHASES.length; i += 1) assert.equal(PHASES[i]?.from, PHASES[i - 1]?.to, 'phases are contiguous');
});

test('geometry: scales, paths, ticks and formats', () => {
  const s = linear({ min: 0, max: 10 }, 0, 100);
  assert.equal(s(5), 50);
  assert.throws(() => linear({ min: 1, max: 1 }, 0, 1), RangeError);
  const id = (v: number): number => v;
  assert.equal(linePath([], id, id), '');
  assert.equal(linePath([{ x: 1, y: 2 }, { x: 3, y: 4 }], id, id), 'M1 2 L3 4');
  assert.equal(areaPath([{ x: 1, y: 2 }, { x: 3, y: 4 }], id, id, 0), 'M1 2 L3 4 L3 0 L1 0 Z');
  assert.deepEqual(ticks({ min: 0, max: 100 }, 25), [0, 25, 50, 75, 100]);
  assert.throws(() => ticks({ min: 0, max: 1 }, 0), RangeError);
  assert.equal(share(50, 100), 50);
  assert.equal(share(150, 100), 100);
  assert.throws(() => share(1, 0), RangeError);
  assert.equal(thousands(5671836), '5,671,836');
  assert.equal(compact(5671836), '5.7M');
  assert.equal(compact(6000000), '6M');
  assert.equal(compact(250000), '250K');
  assert.equal(orbitPoints(0, 0, 10, 4).length, 4);
  assert.deepEqual(orbitPoints(0, 0, 10, 1)[0], { x: 0, y: -10 });
});
