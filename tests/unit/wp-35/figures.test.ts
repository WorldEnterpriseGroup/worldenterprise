import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { cleanText } from '../../../src/components/visuals/contracts.ts';
import { figureMeta } from '../../../src/components/visuals/charts/dataviz.ts';
import { FORMATION_PAGE, HONESTY, HUB, MILESTONES_PAGE, NO_PROMISE, SURVIVAL_PAGE, WHO_PAGE } from '../../../src/data/datasets/copy.ts';
import * as figures from '../../../src/data/datasets/figures.ts';
import { DATASET_SOURCES, RETRIEVED } from '../../../src/data/datasets/sources.ts';
import type { DatasetSourceId } from '../../../src/data/datasets/types.ts';

/**
 * WP-35, the figures and words on /data/. Every chart prop set passes the visuals contract (title, description, at least one https source,
 * the retrieval date), every string passes the claims rules the visuals enforce, and each page lists every source its charts cite.
 */
const root = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

const CHART_PROPS = {
  survivalWaffle: figures.survivalWaffle,
  survivalMultiples: figures.survivalMultiples,
  exitRidgeline: figures.exitRidgeline,
  fiveYearSwarm: figures.fiveYearSwarm,
  applicationsStack: figures.applicationsStack,
  sectorSlope: figures.sectorSlope,
  payrollSlope: figures.payrollSlope,
  formationWaffle: figures.formationWaffle,
  ageShareArea: figures.ageShareArea,
  ageRateMultiples: figures.ageRateMultiples,
  founderAgeRange: figures.founderAgeRange,
  founderAgeScatter: figures.founderAgeScatter,
  milestoneGantt: figures.milestoneGantt,
} as const;

test('every chart carries an id, a title, a description, https sources and the retrieval date', () => {
  const ids = new Set<string>();
  for (const [name, c] of Object.entries(CHART_PROPS)) {
    assert.ok(!ids.has(c.id), `${name}: duplicate id ${c.id}`);
    ids.add(c.id);
    const meta = figureMeta(name, { id: c.id, title: c.title, description: c.description, sources: c.sources, retrieved: RETRIEVED, derived: c.derived });
    assert.ok(meta.title.length > 10 && meta.description.length > 60, `${name}: title and description are substantial`);
    for (const s of c.sources) assert.match(s.href ?? '', /^https:\/\//, `${name}: source href`);
    assert.ok('caption' in c && c.caption.length > 20, `${name}: has a takeaway caption`);
  }
  assert.equal(ids.size, 13);
});

test('every source a chart cites is in the registry, and every registered source is cited somewhere', () => {
  const known = new Map(DATASET_SOURCES.map((s) => [s.url, s.id]));
  const cited = new Set<string>();
  for (const [name, c] of Object.entries(CHART_PROPS)) {
    for (const s of c.sources) {
      assert.ok(known.has(s.href ?? ''), `${name}: ${s.href} is not a registered source`);
      cited.add(known.get(s.href ?? '') ?? '');
    }
  }
  for (const b of [figures.dilutionBars, figures.roundGapBars, figures.roundAgeBars]) cited.add(known.get(b.source.href ?? '') ?? '');
  for (const t of HUB.tiles) cited.add(t.source);
  for (const s of DATASET_SOURCES) {
    if (s.id === 'census-bfs-definitions' || s.id === 'sba-faq-2026') continue; // listed as background for definitions and the 2015 survival note
    assert.ok(cited.has(s.id), `source ${s.id} is never cited by a chart`);
  }
});

test('the waffle squares add up and the captions quote the data they describe', () => {
  assert.equal(figures.survivalWaffle.groups.reduce((a, g) => a + g.value, 0).toFixed(1), '100.0');
  assert.equal(figures.SURVIVAL_2015_YEAR10, 34.7);
  assert.match(figures.survivalWaffle.caption, /34\.7 of every 100/);
  assert.match(figures.formationWaffle.description, /59 squares/);
  assert.match(figures.payrollSlope.caption, /2\.29 quarters/);
  assert.match(figures.applicationsStack.caption, /5,671,836/);
  assert.equal(figures.APPLICATIONS_2025, 5671836);
});

test('series lengths line up with their axes', () => {
  const m = figures.survivalMultiples;
  assert.equal(m.xs.length, 32);
  for (const p of m.panels) for (const s of p.series) assert.ok(s.values.length >= 2 && s.values.length <= m.xs.length, `${p.label}/${s.label}`);
  for (const r of figures.exitRidgeline.ridges) assert.equal(r.values.length, figures.exitRidgeline.xs.length);
  for (const l of figures.applicationsStack.layers) assert.equal(l.values.length, figures.applicationsStack.xs.length);
  for (const l of figures.ageShareArea.layers) assert.equal(l.values.length, figures.ageShareArea.xs.length);
  for (const d of figures.fiveYearSwarm.rows) assert.equal(d.dots.length, 27);
  assert.ok(figures.applicationsStack.layers.every((l) => l.values.every((v) => v >= 0)), 'the all-other layer is never negative');
  const gantt = figures.milestoneGantt;
  assert.ok(gantt.rows.every((r) => gantt.groups.includes(r.group)));
});

/** Every string in the figure props and the page copy. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value !== null && typeof value === 'object') for (const [k, v] of Object.entries(value)) if (k !== 'href') strings(v, out);
  return out;
}

test('every string passes the visuals claims rules: no price, free, accelerator, cohort, investor network, British spelling', () => {
  const all = strings([CHART_PROPS, figures.dilutionBars, figures.roundGapBars, figures.roundAgeBars, HUB, SURVIVAL_PAGE, FORMATION_PAGE, WHO_PAGE, MILESTONES_PAGE, HONESTY, NO_PROMISE]);
  assert.ok(all.length > 200, `scanned ${all.length} strings`);
  for (const text of all) cleanText('wp-35 test', 'text', text);
  const banned = /\b(free|accelerator|incubator|cohorts?|mentors?|alumni|investor network|demo day|guarantee[sd]?|best-in-class|revolutionary)\b/i;
  for (const text of all) assert.ok(!banned.test(text), `banned wording in: ${text}`);
  assert.ok(!all.some((t) => /[$£€]\s?\d/.test(t)), 'no currency amount');
});

test('the pages say the figures are about all new U.S. businesses, and promise nothing', () => {
  assert.equal(HONESTY, "These figures describe all new U.S. businesses, not WE's results.");
  assert.match(NO_PROMISE, /No one can promise that a company will survive/);
  assert.match(NO_PROMISE, /no promise of funding/);
  assert.ok(HUB.close.body.includes(HONESTY));
  for (const note of [SURVIVAL_PAGE.note, WHO_PAGE.note]) assert.match(note, /does not show|not a cause|association/i);
  assert.match(HUB.close.body.join(' '), /long-horizon business incubation and consulting firm/);
  assert.doesNotMatch(strings(HUB).join(' '), /\b(guarantee|improves? (your )?(odds|survival)|raises? (your )?(odds|survival))\b/i);
});

test('the longevity message runs through the hub: fast pace day to day, patience across the years', () => {
  const text = strings(HUB).join(' ');
  assert.match(text, /fast pace/i);
  assert.match(text, /patience/i);
  assert.match(text, /years/);
  assert.equal(Object.keys(HUB.stages).length, 5, 'five stages: formation, first revenue, survival, funding rounds, exits');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Source-level checks on the components and pages (the build renders them; CI e2e checks the output)
// ---------------------------------------------------------------------------------------------------------------------------------

const CHARTS = ['StackedArea', 'SlopeChart', 'WaffleChart', 'SmallMultiples', 'Ridgeline', 'RangeDotPlot', 'BeeswarmStrip', 'ScatterPlot', 'GanttTimeline'];

test('each new chart component renders inside ChartFigure, which supplies the data table, the source line and the retrieval date', () => {
  const shell = read('src/components/visuals/charts/ChartFigure.astro');
  assert.match(shell, /<DataTable/);
  assert.match(shell, /<SourceNote/);
  assert.match(shell, /Retrieved \{meta\.retrieved\}/);
  assert.match(shell, /<details class="dv__data">/);
  assert.match(shell, /prefers-reduced-motion/);
  assert.match(shell, /forced-colors: active/);
  assert.match(shell, /@supports \(animation-timeline: view\(\)\)/);
  for (const name of CHARTS) {
    const src = read(`src/components/visuals/charts/${name}.astro`);
    assert.match(src, /<ChartFigure \{\.\.\.props\} table=\{table\}>/, `${name} uses the shell with a table`);
    assert.match(src, /const table = \{/, `${name} builds its table from the same data it draws`);
    if (name === 'GanttTimeline') {
      // Real HTML text rows with decorative tracks; the group is named by the figure title.
      assert.match(src, /role="group" aria-labelledby=\{`\$\{props\.id\}-title`\}/, `${name}: the drawing is a named group`);
      continue;
    }
    assert.match(src, /role="img" aria-labelledby=\{`\$\{props\.id\}-svg-t \$\{props\.id\}-svg-d`\}/, `${name}: the drawing is a named image`);
    assert.match(src, /<title id=\{`\$\{props\.id\}-svg-t`\}>/, `${name}: svg title`);
    assert.match(src, /<desc id=\{`\$\{props\.id\}-svg-d`\}>/, `${name}: svg description`);
    assert.match(src, /interface Props extends FigureMeta/, `${name}: requires id, title, description, sources, retrieved`);
  }
});

test('no new file sets a style attribute, runs inline script or calls a third party', () => {
  const files = [
    ...readdirSync(join(root, 'src/components/visuals/charts')).map((f) => `src/components/visuals/charts/${f}`),
    ...['index', 'survival/index', 'formation/index', 'who-starts/index', 'years-to-milestones/index'].map((f) => `src/pages/data/${f}.astro`),
  ];
  for (const f of files) {
    if (!existsSync(join(root, f))) continue;
    const src = read(f);
    assert.doesNotMatch(src, /\sstyle=/, `${f}: style attribute`);
    assert.doesNotMatch(src, /<script/i, `${f}: script`);
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)/, `${f}: absolute URL in source`);
  }
});

const PAGES: readonly { readonly file: string; readonly used: readonly (keyof typeof CHART_PROPS)[]; readonly extra?: readonly DatasetSourceId[] }[] = [
  { file: 'index', used: ['survivalWaffle', 'applicationsStack', 'payrollSlope', 'exitRidgeline', 'milestoneGantt', 'founderAgeRange'], extra: HUB.tiles.map((t) => t.source) },
  { file: 'survival/index', used: ['survivalMultiples', 'exitRidgeline', 'fiveYearSwarm'] },
  { file: 'formation/index', used: ['applicationsStack', 'sectorSlope', 'formationWaffle', 'payrollSlope'] },
  { file: 'who-starts/index', used: ['ageShareArea', 'ageRateMultiples', 'founderAgeScatter'] },
  { file: 'years-to-milestones/index', used: ['milestoneGantt'], extra: ['carta-spm-q1-2026'] },
];

for (const page of PAGES) {
  test(`/data/${page.file.replace('index', '')} uses its charts and lists every source they cite`, () => {
    const src = read(`src/pages/data/${page.file}.astro`);
    for (const name of page.used) assert.match(src, new RegExp(`\\{\\.\\.\\.${name}\\b`), `${name} is rendered`);
    const listed = /ids=\{\[([^\]]+)\]\}/.exec(src)?.[1];
    assert.ok(listed, 'the page lists its sources with DataSources');
    const ids = [...listed.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1] as DatasetSourceId);
    for (const id of ids) assert.ok(DATASET_SOURCES.some((s) => s.id === id), `unknown source id ${id}`);
    const urls = new Set(ids.map((id) => DATASET_SOURCES.find((s) => s.id === id)?.url));
    for (const name of page.used) for (const s of CHART_PROPS[name].sources) assert.ok(urls.has(s.href), `${name} cites ${s.label}, which the page does not list`);
    for (const id of page.extra ?? []) assert.ok(ids.includes(id), `the page does not list ${id}`);
    assert.match(src, /<(Hub|Marketing)Layout/);
  });
}

test('the hub offers the two calls to action the brief names, and never prices or free offers', () => {
  const hub = read('src/pages/data/index.astro');
  assert.match(hub, /secondary=\{HOW_LONG_CTA\}/);
  assert.match(hub, /primary=\{PRIMARY_CTA\}/);
  const copy = read('src/data/sales/copy.ts');
  assert.match(copy, /HOW_LONG_CTA = \{ label: 'See how long it really takes', href: '\/why-it-takes-time\/' \}/);
  assert.match(copy, /PRIMARY_CTA = \{ label: 'Start a readiness review', href: '\/apply\/' \}/);
});
