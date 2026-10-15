import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DENYLIST, PRICE, milestones } from '../../../src/components/visuals/contracts.ts';
import { SITUATIONS, situationBySlug } from '../../../src/data/sales/situations.ts';
import { STATS } from '../../../src/data/sales/stats.ts';
import {
  DATA_HEADLINE,
  DATA_LEAD,
  DATA_STATS,
  DECADE_STATS,
  JOIN_HEADLINE,
  JOIN_LEAD,
  JOIN_NOTE,
  JOIN_TILES,
  ROUTES,
  SBIR_HEADLINE,
  SBIR_LEAD,
  SBIR_NOTE,
  SBIR_STEPS,
  SITUATION_POINTERS,
  SPINE_HEADLINE,
  WEEKLY_LOOP,
  decadeMilestones,
  pointerFor,
  visualStat,
} from '../../../src/components/program/longevity/data.ts';

/**
 * WP-37 (wave 10, #86): the longevity narrative and the inclusive ecosystem moments. These tests hold the shared data to the site's
 * rules (sourced figures only, no denied words, no prices, no claim about a program's status) and the pages to the structure the
 * issue asks for (the spine on each page, a pointer on each situation page, no inline style).
 */
const root = new URL('../../../', import.meta.url).pathname;

function read(rel: string): string {
  try {
    return readFileSync(join(root, rel), 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${rel}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Every sentence the new bands print, from the shared data. */
function allCopy(): string[] {
  return [
    SPINE_HEADLINE,
    JOIN_HEADLINE,
    JOIN_LEAD,
    JOIN_NOTE,
    SBIR_HEADLINE,
    SBIR_LEAD,
    SBIR_NOTE,
    DATA_HEADLINE,
    DATA_LEAD,
    ...WEEKLY_LOOP.flatMap((s) => [s.label, s.line]),
    ...JOIN_TILES.flatMap((t) => [t.label, t.line]),
    ...SBIR_STEPS.flatMap((s) => [s.label, s.line]),
    ...SITUATION_POINTERS.flatMap((p) => [p.headline, p.lead, p.pace, ...(p.sbir === undefined ? [] : [p.sbir]), ...p.programs.flatMap((x) => [x.label, x.line])]),
    ...decadeMilestones().flatMap((m) => [m.label, ...(m.detail === undefined ? [] : [m.detail])]),
  ];
}

test('the spine headline is the CEO line, exactly', () => {
  assert.equal(SPINE_HEADLINE, 'Move fast every week. Build for the decade.');
});

test('the long-horizon track satisfies the visuals contract and every survival gate carries a source', () => {
  const items = milestones('wp-37', decadeMilestones(), 10);
  assert.ok(items.length >= 5);
  const gates = items.filter((m) => m.kind === 'survival');
  assert.deepEqual(gates.map((g) => g.at), [1, 5, 10]);
  for (const m of items) {
    if (m.kind === 'survival' || m.label === 'First payroll' || m.label === 'Counted as established') {
      assert.ok(m.source?.href?.startsWith('https://'), `${m.label} needs an https source`);
      assert.ok(m.source?.period, `${m.label} needs the period its figure describes`);
    }
  }
});

test('the gate labels print the register figures exactly', () => {
  const labels = decadeMilestones().filter((m) => m.kind === 'survival').map((m) => m.label);
  assert.deepEqual(labels, [`${STATS['ST-01'].value} still operating`, `${STATS['ST-02'].value} still operating`, `${STATS['ST-03'].value} still operating`]);
});

test('every figure on the new bands is a register statistic with a source, and no new figure is introduced', () => {
  for (const id of [...DECADE_STATS, ...DATA_STATS, 'ST-33', 'ST-19', 'ST-27'] as const) {
    const s = visualStat(id);
    assert.ok(s.source.href?.startsWith('https://'), `${id} source link`);
    assert.ok(/\d/.test(s.value), `${id} value has a number`);
  }
  const ledger = JSON.parse(read('.astro-magazine/sources/wp-37.json')) as { reusedStatistics: string[]; statistics: unknown[] };
  assert.deepEqual(ledger.statistics, [], 'WP-37 records no statistic of its own');
  for (const id of ledger.reusedStatistics) assert.ok(id in STATS, `${id} is a register statistic`);
});

test('no denied word, price or investor/accelerator framing appears in the copy', () => {
  for (const text of allCopy()) {
    for (const pattern of DENYLIST) assert.ok(!pattern.test(text), `"${text}" matches ${pattern}`);
    assert.ok(!PRICE.test(text), `"${text}" shows a price`);
    assert.ok(!/\b(incubators?|coho|accelerat|investor network|demo day|mentor|alumni)/i.test(text), `"${text}" uses an ecosystem-only word outside an ecosystem context`);
    assert.ok(!/\bguarantee|\bwe will win\b|\bwin an award\b/i.test(text.replace(/cannot promise an award/i, '')), `"${text}" promises an outcome`);
  }
});

test('the SBIR band states no status, deadline or amount and disclaims being an agency', () => {
  const text = [SBIR_LEAD, SBIR_NOTE, ...SBIR_STEPS.map((s) => s.line)].join(' ');
  assert.ok(!/\b(20\d\d|authoriz|reauthoriz|expire|lapse|deadline|\d+%)/i.test(text), 'status and dates belong to /sbir-sttr/');
  assert.match(SBIR_NOTE, /not an agency/);
  assert.match(SBIR_NOTE, /cannot promise an award/);
});

test('the ecosystem band says WE is independent of the programs and encourages them', () => {
  assert.match(JOIN_NOTE, /No affiliation or endorsement is implied/);
  assert.match(JOIN_LEAD, /does not compete/);
  assert.match(JOIN_LEAD, /for as long as the work is useful/);
});

test('the routes the bands link to are the ecosystem, SBIR, data and the two clock pages', () => {
  assert.deepEqual(ROUTES, {
    ecosystem: '/ecosystem/',
    sbir: '/sbir-sttr/',
    data: '/data/',
    howLong: '/why-it-takes-time/',
    howWeWork: '/how-we-work/',
    apply: '/apply/',
  });
});

test('every situation has exactly one pointer, a pace line and at least three kinds of program', () => {
  assert.equal(SITUATION_POINTERS.length, SITUATIONS.length);
  for (const s of SITUATIONS) {
    assert.ok(situationBySlug(s.slug) !== undefined);
    const p = pointerFor(s.slug);
    assert.ok(p.programs.length >= 3, `${s.slug} lists three kinds of program`);
    assert.ok(p.pace.length > 20, `${s.slug} has a pace line`);
    assert.ok(p.sbir !== undefined, `${s.slug} has an SBIR and STTR line`);
    for (const x of p.programs) assert.ok(x.label !== '' && x.line !== '');
  }
  assert.throws(() => pointerFor('nobody'), /No situation pointer/);
});

test('situation pointers never name a protected group in a headline', () => {
  for (const p of SITUATION_POINTERS) assert.ok(!/\b(women|veteran|immigrant|black|latino|disabled|lgbt)/i.test(p.headline), p.headline);
});

const PAGES: readonly string[] = [
  'src/pages/index.astro',
  'src/pages/program/index.astro',
  'src/pages/program/dream.astro',
  'src/pages/program/build.astro',
  'src/pages/program/grow.astro',
  'src/pages/program/how-it-works.astro',
  'src/pages/program/dedicated-teams.astro',
  'src/pages/program/digital-incubation-model.astro',
  'src/pages/program/how-we-decide.astro',
  'src/pages/program/who-its-for.astro',
  'src/pages/how-we-work/index.astro',
  'src/pages/why-it-takes-time/index.astro',
  'src/pages/who-we-work-with/index.astro',
  'src/components/sales/SituationPage.astro',
];

test('every page of the family carries the longevity spine', () => {
  for (const page of PAGES) assert.match(read(page), /<LongevitySpine\b/, `${page} renders the spine`);
});

test('the home, program, how-we-work, why-it-takes-time and who-we-work-with hubs carry the ecosystem and SBIR bands', () => {
  for (const page of ['src/pages/index.astro', 'src/pages/program/index.astro', 'src/pages/how-we-work/index.astro', 'src/pages/why-it-takes-time/index.astro', 'src/pages/who-we-work-with/index.astro']) {
    const source = read(page);
    assert.match(source, /<JoinPrograms\b/, `${page} joins the ecosystem`);
    assert.match(source, /<SbirBand\b/, `${page} points to SBIR and STTR`);
    assert.match(source, /<DataTeaser\b/, `${page} teases the data`);
  }
});

test('each situation page renders through SituationPage, which holds the pointers', () => {
  for (const s of SITUATIONS) {
    const file = `src/pages/who-we-work-with/${s.slug}.astro`;
    assert.ok(existsSync(join(root, file)), file);
    assert.match(read(file), /<SituationPage\b/);
  }
  assert.match(read('src/components/sales/SituationPage.astro'), /<SituationPointers\b/);
});

test('the primary call to action stays "Start a readiness review" on the family pages', () => {
  for (const page of ['src/pages/index.astro', 'src/pages/program/index.astro']) assert.match(read(page), /START_REVIEW/);
  assert.match(read('src/pages/how-we-work/_model.ts'), /Start a readiness review/);
  assert.match(read('src/data/sales/copy.ts'), /Start a readiness review/);
});

test('the new components use no inline style, no inline script and no third-party host', () => {
  for (const file of ['LongevitySpine', 'JoinPrograms', 'SbirBand', 'DataTeaser']) {
    const source = read(`src/components/program/longevity/${file}.astro`);
    assert.ok(!/\sstyle=/.test(source), `${file} has a style attribute`);
    assert.ok(!/<script/.test(source), `${file} has a script`);
    assert.ok(!/https?:\/\//.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), `${file} names a host`);
  }
  for (const file of ['SituationPointers', 'SituationMatrix']) {
    const source = read(`src/components/program/longevity/${file}.astro`);
    assert.ok(!/\sstyle=/.test(source) && !/<script/.test(source), `${file} has inline style or script`);
  }
});

test('the bands render nothing until their route is built, and never link a route that is not', () => {
  for (const [file, route] of [
    ['JoinPrograms', 'ecosystem'],
    ['SbirBand', 'sbir'],
    ['DataTeaser', 'data'],
  ] as const) {
    assert.match(read(`src/components/program/longevity/${file}.astro`), new RegExp(`isLiveOnDisk\\(ROUTES\\.${route}\\)`), `${file} checks ${route}`);
  }
  assert.match(read('src/components/program/longevity/SituationPointers.astro'), /isLiveOnDisk\(ROUTES\.ecosystem\)/);
});

test('how-we-work keeps the line the release checklist pins (CR-12 quotes line 276)', () => {
  const lines = read('src/pages/how-we-work/index.astro').split('\n');
  assert.match(lines[275] ?? '', /Investor Introductions is a separate add-on/);
});
