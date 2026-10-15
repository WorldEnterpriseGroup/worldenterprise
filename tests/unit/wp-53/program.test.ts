/**
 * The program family (WP-53): the five phases on the business clock, the stage views, the calls to action that never link a route
 * that is not live, the figures that come only from the wave 9 statistics register, and the copy rules over every program page.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { HONESTY_LINE, NO_FUNDING_LINE, STATS, stats } from '../../../src/components/program/clock.ts';
import type { StatId } from '../../../src/components/program/clock.ts';
import { ACTIONS, START_REVIEW, pick, routeOf } from '../../../src/components/program/ctas.ts';
import { MISSION_CONTROL, PHASES, STAGE_VIEWS, methodWithExpansion, phasesOf } from '../../../src/components/program/phases.ts';
import { STAGES } from '../../../src/components/program/stages.ts';
import { PROGRAM_STEPS } from '../../../src/components/program/steps.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface Register {
  readonly statistics: readonly { readonly id: string; readonly statistic: string }[];
}
const register = JSON.parse(read('.astro-magazine/plans/wave9/statistics.json')) as Register;

/** The program pages and components WP-53 wrote. how-we-decide stays with the apply form (WP-43, WP-54). */
const PAGES = ['index', 'dream', 'build', 'grow', 'how-it-works', 'dedicated-teams', 'digital-incubation-model', 'who-its-for'].map((p) => `src/pages/program/${p}.astro`);
const CONTENT = ['index', 'dream', 'build', 'grow', 'how-it-works', 'dedicated-teams', 'digital-incubation-model', 'who-its-for'].map((p) => `src/content/pages/program/${p}.mdx`);
const COMPONENTS = ['ClockBar', 'MethodTrack', 'MissionControl', 'PhaseCards', 'PhaseGlyph', 'ProgramEnd', 'StageLong', 'StepRail', 'StageBody'].map((c) => `src/components/program/${c}.astro`);
const DATA = ['phases.ts', 'clock.ts', 'ctas.ts', 'steps.ts'].map((f) => `src/components/program/${f}`);

/** The words a reader sees in a page source: front matter, style blocks, tags, expressions and comments removed. */
function visibleText(source: string): string {
  return source
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ');
}

/** Every quoted string literal of a module or frontmatter (module paths left out). */
function stringLiterals(source: string): string[] {
  return [...source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
    .filter((literal) => !/^\.{1,2}\//.test(literal));
}

/**
 * Pinned by other packages, so allowed as written: who-its-for (layout only for WP-53) links an insight by its published title.
 */
const PINNED_TITLE = /Is your SaaS idea a business or a feature\?/g;
const copy = [
  ...[...PAGES, ...COMPONENTS].map((f) => visibleText(read(f))),
  ...[...PAGES, ...COMPONENTS].flatMap((f) => stringLiterals(read(f).split('<style>')[0] ?? '')),
  ...DATA.flatMap((f) => stringLiterals(read(f))),
  ...CONTENT.map(read),
]
  .join('\n')
  .replace(PINNED_TITLE, '');

// ---- The phases and the clock ----

test('five phases run in order on one clock, each window starting where the last one ended', () => {
  assert.deepEqual(PHASES.map((p) => p.id), ['ignite', 'build', 'launch', 'grow', 'orbit']);
  for (const [i, phase] of PHASES.entries()) {
    const before = PHASES[i - 1];
    if (before !== undefined) assert.equal(phase.from, before.to, `${phase.name} starts where ${before.name} ends`);
    if (phase.to !== undefined) assert.ok(phase.to > phase.from, `${phase.name} has a forward window`);
    assert.ok(phase.methods.length > 0, `${phase.name} names its WE method`);
  }
  assert.equal(PHASES.at(-1)?.to, undefined, 'Orbit stays open');
});

test('the phases map onto the three stages: Ignite is Dream, Build and Launch are Build, Grow and Orbit are Grow', () => {
  assert.deepEqual(phasesOf('dream').map((p) => p.id), ['ignite']);
  assert.deepEqual(phasesOf('build').map((p) => p.id), ['build', 'launch']);
  assert.deepEqual(phasesOf('grow').map((p) => p.id), ['grow', 'orbit']);
  for (const stage of STAGES) assert.ok(STAGE_VIEWS[stage.id], `${stage.id} has a stage view`);
});

test('a method reads with the words its letters stand for, and the barred source name is never used', () => {
  const growth = PHASES.find((p) => p.id === 'grow')?.methods[0];
  assert.ok(growth);
  assert.equal(methodWithExpansion(growth), 'G.R.O.W.T.H. phase (Gauge, Research, Organize, Work, Target, Health)');
  // One word per letter, except S.T.A.R.T.U.P., whose "Think Tank" stands for two letters.
  for (const phase of PHASES) {
    for (const method of phase.methods) {
      const letters = (/^((?:[A-Z]\.)+)/.exec(method.name)?.[1] ?? '').length / 2;
      if (method.expansion.length === 0 || method.name.startsWith('S.T.A.R.T.U.P.')) continue;
      assert.equal(method.expansion.length, letters, method.name);
    }
  }
  assert.doesNotMatch(copy, /G\.R\.O\.W\.T\.H\. (?!phase)/, 'the G.R.O.W.T.H. name is always "G.R.O.W.T.H. phase"');
});

test('Mission Control runs from the week to the phase checkpoint; the yearly review waits for the operator', () => {
  assert.deepEqual(MISSION_CONTROL.map((r) => r.ring), ['Every week', 'Every month', 'Every quarter', 'Every checkpoint']);
  assert.doesNotMatch(copy, /\bevery year\b|\byearly Orbit Review\b/i);
});

// ---- The figures ----

test('every figure is a wave 9 register figure, printed exactly as the register states it, with a source a reader can open', () => {
  const byId = new Map(register.statistics.map((s) => [s.id, s.statistic]));
  for (const [id, stat] of Object.entries(STATS) as [StatId, (typeof STATS)[StatId]][]) {
    const statistic = byId.get(id);
    assert.ok(statistic !== undefined, `${id} is in the register`);
    const number = stat.value.replace(/ (?:months|quarters)$/, '');
    assert.ok(statistic.includes(number), `${id}: ${stat.value} appears in the register line`);
    assert.match(stat.source.href ?? '', /^https:\/\/(?:www\.bls\.gov|www\.census\.gov|www\.babson\.edu|advocacy\.sba\.gov)\//, `${id} cites a public source`);
  }
  for (const view of Object.values(STAGE_VIEWS)) assert.equal(stats(...view.stats).length, view.stats.length);
});

test('every block of figures carries the honesty line, and the required lines are on / and /program/grow/', () => {
  assert.equal(HONESTY_LINE, "These figures describe all new U.S. businesses, not WE's results.");
  assert.equal(NO_FUNDING_LINE, 'WE makes no promise of funding.');
  const long = read('src/components/program/StageLong.astro');
  assert.match(long, /<StatTiles[^>]*\/>\s*<p class="stagelong__honesty">\{HONESTY_LINE\}<\/p>/);
  assert.match(read('src/pages/program/grow.astro'), /<ProgramEnd[^>]*\bnoFunding\b/);
  assert.match(read('src/pages/program/index.astro'), /NO_FUNDING_LINE/);
  assert.match(read('src/pages/index.astro'), /NO_FUNDING_LINE/);
});

// ---- Calls to action ----

test('the primary action is the readiness review, and a secondary falls back until its route is live', () => {
  assert.deepEqual(START_REVIEW, { label: 'Start a readiness review', href: '/apply/' });
  assert.equal(pick('howWeWork', () => false), undefined, 'nothing live, no link');
  assert.equal(pick('howWeWork', (p) => p === '/program/how-it-works/')?.href, '/program/how-it-works/');
  assert.equal(pick('howWeWork', () => true)?.href, '/how-we-work/');
  assert.equal(pick('paid', (p) => p === '/how-we-work/')?.href, '/how-we-work/#paid');
  assert.equal(routeOf('/how-we-work/#paid'), '/how-we-work/');
  for (const candidates of Object.values(ACTIONS)) for (const action of candidates) assert.notEqual(routeOf(action.href), '/pricing/');
});

test('the stage pages lead with the readiness review and never with the retired calls to action', () => {
  for (const file of PAGES.filter((f) => !/who-its-for/.test(f))) assert.match(read(file), /primary=\{START_REVIEW\}/, `${file} leads with the readiness review`);
  for (const file of [...PAGES, ...CONTENT]) assert.doesNotMatch(read(file), /\/pricing\/|team-composer|Compose your team|SeatDiagram/, `${file} has no retired block`);
  // who-its-for keeps its own closing band (layout-only exception); every page WP-53 composes closes on the program end band.
  for (const file of PAGES.filter((f) => !/who-its-for/.test(f))) assert.doesNotMatch(read(file), /CtaBand/, `${file} closes on ProgramEnd`);
});

// ---- Copy rules ----

test('the program copy has no seats, prices, packages, competitors or barred program words', () => {
  assert.doesNotMatch(copy, /\bseats?\b/i, 'no seat language');
  assert.doesNotMatch(copy, /[$€£]\s?\d|\bUSD\b|\bper (?:month|seat|hour)\b/i, 'no amount');
  assert.doesNotMatch(copy, /\b(?:Spark|Accelerate|Studio)\b/, 'no package name');
  assert.doesNotMatch(copy, /\b(?:free|perks?|accelerators?|cohorts?|mentors?|alumni|investor network|demo day|batch|graduation|employer of record|staffing)\b/i);
  assert.doesNotMatch(copy, /\bWe (?:build|steer|are|make|will)\b/, 'WE in the third person, in capitals');
  assert.doesNotMatch(copy, /\b(?:SaaS|digital incubator)\b/, 'no SaaS-only or digital-incubator framing');
  assert.doesNotMatch(copy, /\b(?:organis|colour|behaviour|centre\b)/i, 'US spelling');
});

test('the pages hold the hard rules: no inline style, no inline script, no data or blob images', () => {
  for (const file of [...PAGES, ...COMPONENTS]) {
    const source = read(file);
    assert.doesNotMatch(source, /\sstyle="/, `${file} has no style attribute`);
    assert.doesNotMatch(source, /is:inline|<script(?![^>]*\bsrc=)/, `${file} has no inline script`);
    assert.doesNotMatch(source, /(?:src|href)="(?:data|blob):/, `${file} has no data or blob URL`);
    if (source.includes('<style>')) assert.match(source, /<style>\s*@layer pages \{/, `${file} scopes its style in @layer pages`);
  }
});

test('the five program steps keep the titles the journey family uses as headings', () => {
  assert.deepEqual(PROGRAM_STEPS.map((s) => s.title), ['Apply', 'Agree the scope', 'Assemble your team', 'Work in focused cycles', 'Review and decide']);
  for (const step of PROGRAM_STEPS) assert.doesNotMatch(step.body, /\bseats?\b|offshore/i, `${step.title} body`);
});

test('every program component file is covered by these rules', () => {
  const astro = readdirSync(join(ROOT, 'src/components/program')).filter((f) => f.endsWith('.astro'));
  const kept = ['AltitudeDiagram.astro', 'ArtifactList.astro', 'ExitEvidence.astro', 'SeatDiagram.astro', 'StageExplorer.astro', 'StageRail.astro'];
  for (const file of astro) assert.ok(kept.includes(file) || COMPONENTS.includes(`src/components/program/${file}`), `${file} is checked or listed as kept`);
});
