/**
 * WP-23 (#89): media density for the reference families. The sourced figures pass the visual contracts and match the ledger, the brief
 * covers are deterministic, the components carry no inline style or script, and every hub and child page has enough media moments.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { COVER_H, COVER_W, PALETTES, coverModel } from '../../../src/components/briefs/cover.ts';
import { BRIEF_FIGURES, BRIEF_PATH, briefFigure } from '../../../src/components/briefs/media.ts';
import * as fundability from '../../../src/components/fundability/media.ts';
import { GUIDE_MEDIA_SLUGS } from '../../../src/components/fundability/media.ts';
import * as D from '../../../src/components/research/media/data.ts';
import * as research from '../../../src/components/research/media/research.ts';
import { REPORT_SLUGS } from '../../../src/components/research/media/research.ts';
import { PRICE, data, findDenied, milestones, stat, survivalSeries } from '../../../src/components/visuals/contracts.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const slugsIn = (dir: string): string[] => readdirSync(join(ROOT, dir)).filter((f) => !f.startsWith('.')).map((f) => f.replace(/\.mdx?$/, '')).sort();

interface LedgerEntry {
  readonly source_id: string;
  readonly exact_url_or_locator: string;
  readonly retrieved_at: string;
  readonly transformation: string;
  readonly captured_by: string;
}
const ledger = JSON.parse(read('.astro-magazine/sources/wp-23.json')) as { wp: string; sources: readonly LedgerEntry[] };
const ledgerIds = new Set(ledger.sources.map((s) => s.source_id));

// ---- The figures ----

const DATA_SETS = {
  ROUND_GAPS: D.ROUND_GAPS,
  AGE_AT_ROUND: D.AGE_AT_ROUND,
  APPROVAL_BY_AGE: D.APPROVAL_BY_AGE,
  APPROVAL_BY_YEAR: D.APPROVAL_BY_YEAR,
  SHUTDOWN_REASONS: D.SHUTDOWN_REASONS,
  FOUNDER_TRACK_RECORD: D.FOUNDER_TRACK_RECORD,
  INDUSTRY_EXPERIENCE: D.INDUSTRY_EXPERIENCE,
  FOUNDER_AGE: D.FOUNDER_AGE,
  WCAG_FAILURES: D.WCAG_FAILURES,
  THIRD_PARTY_TREND: D.THIRD_PARTY_TREND,
};

test('every chart data set passes the visual data contract', () => {
  for (const [name, set] of Object.entries(DATA_SETS)) assert.doesNotThrow(() => data(name, set, 2, 12), name);
});

test('every stat passes the stat contract, with an https source and no price', () => {
  const stats = [...D.FUNDING_STATS, D.MONTHLY_UPDATES_BEFORE_A, ...D.BUSINESS_STATS, ...D.FORMATION_STATS, ...D.ACCESSIBILITY_STATS, ...D.BREACH_STATS];
  for (const s of stats) {
    assert.doesNotThrow(() => stat('wp-23', s), s.value);
    assert.match(s.source.href ?? '', /^https:\/\//, `${s.value} links its source`);
    assert.equal(PRICE.test(s.value), false);
  }
});

test('the timelines and survival curves pass their contracts on a ten-year horizon', () => {
  assert.doesNotThrow(() => milestones('clock', D.TIMELINE_CLOCK, 10));
  assert.doesNotThrow(() => milestones('funding', D.FUNDING_CLOCK, 10));
  assert.doesNotThrow(() => survivalSeries('survival', D.SURVIVAL_2015));
  for (const series of D.SURVIVAL_2015) {
    assert.equal(series.points.length, 11, `${series.label} runs year 0 to 10`);
    assert.equal(series.points[0]?.percent, 100);
    for (let i = 1; i < series.points.length; i += 1) assert.ok((series.points[i]?.percent ?? 0) <= (series.points[i - 1]?.percent ?? 0), `${series.label} never rises`);
  }
});

test('every source is an https link', () => {
  for (const [key, source] of Object.entries(D.SOURCES)) assert.match(source.href, /^https:\/\//, key);
});

test('figures match the ledger as published', () => {
  const values = (set: readonly { value: number }[]): number[] => set.map((d) => d.value);
  assert.deepEqual(values(D.ROUND_GAPS), [2.0, 2.1, 2.4], 'W23-01');
  assert.deepEqual(values(D.AGE_AT_ROUND), [2.8, 7.4, 9.5], 'ST-09, W23-02');
  assert.deepEqual(values(D.APPROVAL_BY_AGE), [48, 51, 63], 'W23-05');
  assert.deepEqual(values(D.APPROVAL_BY_YEAR), [58, 62, 50, 46, 53, 51, 52, 52], 'W23-06');
  assert.deepEqual(values(D.SHUTDOWN_REASONS), [70, 43, 29, 19], 'ST-11, W23-04');
  assert.deepEqual(values(D.WCAG_FAILURES), [83.9, 53.1, 51, 46.3, 30.6, 13.5], 'W23-08');
  assert.deepEqual(values(D.THIRD_PARTY_TREND), [15, 30, 48], 'W23-11');
  assert.deepEqual(values(D.FOUNDER_TRACK_RECORD), [30, 22, 21], 'ST-19');
  assert.deepEqual(values(D.INDUSTRY_EXPERIENCE), [0.26, 0.12], 'ST-18');
  assert.deepEqual(values(D.FOUNDER_AGE), [45, 41.9], 'ST-16');
  assert.deepEqual(D.BUSINESS_STATS.map((s) => s.value), ['5.67 million', '77.9%', '51.4%', '34.7%'], 'ST-06, ST-01 to ST-03');
  assert.deepEqual(D.FORMATION_STATS.map((s) => s.value), ['7.5%', '2.29 quarters', '42 months'], 'ST-07, ST-08, ST-05');
  assert.deepEqual(D.ACCESSIBILITY_STATS.map((s) => s.value), ['95.9%', '56.1'], 'W23-07, W23-09');
  assert.deepEqual(D.BREACH_STATS.map((s) => s.value), ['31%', '62%', '26%', '43 days'], 'W23-10, W23-12 to W23-14');
  assert.equal(D.MONTHLY_UPDATES_BEFORE_A.value, String((D.ROUND_GAPS[0]?.value ?? 0) * 12), 'W23-03 is derived from W23-01');
  for (const set of Object.values(DATA_SETS)) for (const d of set) if (d.display !== undefined) assert.ok(d.display.includes(String(d.value).replace(/^(\d+)$/, '$1')), `${d.label}: display "${d.display}" shows ${d.value}`);
});

test('the ledger records every figure id the data module cites, with a URL, a retrieval date and a transformation', () => {
  assert.equal(ledger.wp, 'WP-23');
  const cited = new Set([...read('src/components/research/media/data.ts').matchAll(/\b(ST-\d{2}|W23-\d{2})\b/g)].map((m) => m[1]));
  // Named in comments only: the register range (ST-41), sources declared but not rendered here (ST-04), the band W23-05 corrects
  // (ST-33) and the industry curves the ledger carries as W23-15 (ST-35).
  const allowedElsewhere = new Set(['ST-04', 'ST-33', 'ST-35', 'ST-41']);
  for (const id of cited) if (!allowedElsewhere.has(id ?? '')) assert.ok(ledgerIds.has(id ?? ''), `${id} is in the ledger`);
  for (const entry of ledger.sources) {
    assert.match(entry.exact_url_or_locator, /^https:\/\//, entry.source_id);
    assert.match(entry.retrieved_at, /^2026-10-\d{2}$/, entry.source_id);
    assert.ok(entry.transformation.trim().length > 0, `${entry.source_id} records its transformation`);
    assert.equal(entry.captured_by, 'WP-23');
  }
});

// ---- Brief covers ----

test('a cover is the same for the same slug and differs between slugs', () => {
  assert.deepEqual(coverModel('funding-paths'), coverModel('funding-paths'));
  const briefs = slugsIn('src/content/briefs');
  const arms = new Set(briefs.map((s) => coverModel(s).arm));
  assert.equal(arms.size, briefs.length, 'every brief draws its own cover');
});

test('every cover has exactly one amber tile, a known palette, and stars and moon inside the frame', () => {
  for (const slug of [...slugsIn('src/content/briefs'), ...slugsIn('src/content/research')]) {
    const m = coverModel(slug);
    assert.equal(m.tiles.filter((t) => t.tone === 'amber').length, 1, slug);
    assert.ok((PALETTES as readonly string[]).includes(m.palette), slug);
    for (const s of m.stars) assert.ok(s.x >= 0 && s.x <= COVER_W && s.y >= 0 && s.y <= COVER_H, `${slug} star in frame`);
    if (m.moon !== null) {
      assert.ok(m.moon.cx - m.moon.r >= 0 && m.moon.cx + m.moon.r <= COVER_W, `${slug} moon x`);
      assert.ok(m.moon.cy - m.moon.r >= 0 && m.moon.cy + m.moon.r <= COVER_H, `${slug} moon y`);
    }
  }
});

test('an empty slug cannot seed a cover', () => {
  assert.throws(() => coverModel(''));
  assert.throws(() => coverModel('   '));
});

// ---- Content maps ----

test('every guide, report and brief has its media entry', () => {
  assert.deepEqual([...GUIDE_MEDIA_SLUGS].sort(), slugsIn('src/content/guides'));
  assert.deepEqual([...REPORT_SLUGS].sort(), slugsIn('src/content/research'));
  assert.deepEqual(Object.keys(BRIEF_FIGURES).sort(), slugsIn('src/content/briefs'));
  assert.equal(briefFigure('a-brief-added-later'), 'survival-all');
});

/** Every string inside a value exported by a module. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('every diagram and figure string is free of denied words and prices', () => {
  const copy = [...strings(Object.values(fundability)), ...strings(Object.values(research)), ...strings(BRIEF_PATH), ...strings(Object.values(D))];
  assert.ok(copy.length > 100);
  for (const text of copy) {
    assert.equal(findDenied(text), null, `denied word in "${text}"`);
    assert.equal(PRICE.test(text), false, `price in "${text}"`);
    assert.doesNotMatch(text, /\bfree\b/i, `"free" in "${text}"`);
    assert.doesNotMatch(text, /\b(accelerator|investor in)\b/i, `framing in "${text}"`);
  }
});

// ---- Markup ----

const COMPONENT_DIRS = ['src/components/fundability', 'src/components/research', 'src/components/research/media', 'src/components/briefs', 'src/components/playbooks'];
const COMPONENTS = COMPONENT_DIRS.flatMap((dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.astro')).map((f) => `${dir}/${f}`));
const PAGES = ['src/pages/fundability/index.astro', 'src/pages/fundability/[slug].astro', 'src/pages/research/index.astro', 'src/pages/research/[slug].astro', 'src/pages/briefs/index.astro', 'src/pages/briefs/[id].astro', 'src/pages/playbooks/index.astro'];

test('no inline style attribute, inline script or raster image in the components and pages', () => {
  for (const file of [...COMPONENTS, ...PAGES]) {
    const source = read(file);
    assert.doesNotMatch(source, /\sstyle=["{]/, `${file} has no style attribute`);
    assert.doesNotMatch(source, /<script\b/, `${file} has no script`);
    assert.doesNotMatch(source, /data:image|blob:/, `${file} has no data or blob image`);
  }
});

/** Media moments in a source block: each opening Moment tag. */
const moments = (block: string): number => (block.match(/<Moment\s/g) ?? []).length;

/** The source between `slug === 'x'` and the next slug branch. */
function branch(source: string, slug: string): string {
  const start = source.indexOf(`slug === '${slug}'`);
  assert.ok(start >= 0, `branch for ${slug}`);
  const next = source.indexOf("slug === '", start + 10);
  return source.slice(start, next < 0 ? undefined : next);
}

test('each fundability guide has at least three media moments', () => {
  const source = read('src/components/fundability/GuideMedia.astro');
  for (const slug of GUIDE_MEDIA_SLUGS) assert.ok(moments(branch(source, slug)) >= 3, slug);
});

test('each research report has a cover and at least three more moments', () => {
  const source = read('src/components/research/ReportMedia.astro');
  assert.equal(moments(read('src/pages/research/[slug].astro')), 1, 'the cover');
  for (const slug of REPORT_SLUGS) assert.ok(moments(branch(source, slug)) >= 3, slug);
});

test('each brief page has a cover, a chapter map and a figure', () => {
  const page = read('src/pages/briefs/[id].astro');
  for (const id of ['brief-cover', 'brief-chapter-map', 'brief-figure']) assert.match(page, new RegExp(`id="${id}"`));
});

test('each hub has at least six media moments', () => {
  const hubs = {
    fundability: 'src/components/fundability/FundabilityMedia.astro',
    research: 'src/components/research/ResearchHubMedia.astro',
    briefs: 'src/components/briefs/BriefsHubMedia.astro',
    playbooks: 'src/components/playbooks/PlaybooksHubMedia.astro',
  };
  for (const [hub, file] of Object.entries(hubs)) assert.ok(moments(read(file)) >= 6, `${hub}: ${moments(read(file))}`);
});

test('every chart moment sits beside its source: each chart component call passes a source', () => {
  for (const file of COMPONENTS) {
    const source = read(file);
    for (const call of source.match(/<(BarChart|SurvivalCurve)\b[^>]*\/>/g) ?? []) assert.match(call, /source=\{/, `${file}: ${call.slice(0, 60)}`);
  }
});

test('media bands render eagerly, tables sit in the shared scroll frame, and no label reads as a years claim', () => {
  for (const file of COMPONENTS) {
    const source = read(file);
    // A deferred band (content-visibility) is laid out at its placeholder height, so its content overlaps what follows for axe.
    assert.doesNotMatch(source, /<Band\b[^>]*\bdefer\b/, `${file} defers a media band`);
    if (/<table\b/.test(source)) assert.match(source, /<div class="table-wrap" /, `${file} wraps its table in the table-wrap frame`);
  }
  const claim = /\b(?:over\s+)?(?:20|twenty)\+?\s+years?\b|\btwo\s+decades\b/i;
  for (const text of [...strings(Object.values(D)), ...COMPONENTS.map(read)]) assert.doesNotMatch(text, claim);
});
