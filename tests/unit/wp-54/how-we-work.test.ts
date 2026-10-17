import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { buildPaletteCommands } from '../../../src/components/nav/commands.ts';
import { rankCommands } from '../../../src/components/islands/we-palette/match.ts';
import { INTRODUCTIONS_DISCLAIMER, INTRODUCTIONS_FLAT_FEE } from '../../../src/components/blocks/introductions.ts';
import { SURFACES } from '../../../src/data/cta/map.ts';
import { activeSectionId, applyButton, footerNav, primaryNav, resolveFooter, resolveNav, resolveUtility } from '../../../src/data/nav.ts';
import { routes } from '../../../src/data/routes.ts';
import * as model from '../../../src/pages/how-we-work/_model.ts';

// WP-54 (W9-13): /how-we-work/ replaces /pricing/. These tests read the page data and source, so they run without a build. The e2e
// layout checks are in tests/e2e/wave8/wp-54.

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/how-we-work/index.astro');
const mdx = read('src/content/pages/how-we-work/how-we-work.mdx');
const stub = read('src/pages/pricing/index.astro');

/** Every string the model exports, flattened, so each sentence is checked against the copy rules. */
function strings(value: unknown): string[] {
  // Paths and links are not copy: "/how-we-work/" would read as a lowercase "we".
  if (typeof value === 'string') return /^(\/|https?:)/.test(value) ? [] : [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
const copy = strings(Object.values(model)).join('\n');
/** The visible text of the page source: the markup with the frontmatter, tags and expressions taken out. */
const pageText = page
  .replace(/^---[\s\S]*?\n---\n/, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/\{[^{}]*\}/g, ' ')
  .replace(/<[^>]+>/g, ' ');
const surfaces: readonly (readonly [string, string])[] = [
  ['_model.ts', copy],
  ['index.astro', pageText],
  ['how-we-work.mdx', mdx],
];

const BANNED: readonly (readonly [string, RegExp])[] = [
  ['free', /\bfree\b/i],
  ['accelerator', /\baccelerat(or|ors|e)\b/i],
  ['cohort', /\bcohorts?\b/i],
  ['mentor', /\bmentor(s|ship|ing)?\b/i],
  ['alumni', /\balumn(i|us|a)\b/i],
  ['investor network', /\binvestor network\b/i],
  ['perks', /\bperks?\b/i],
  ['co-founder', /\bco-?founders?\b/i],
  ['EoR', /\b(EoR|employer of record)\b/i],
  ['staff augmentation', /\bstaff augmentation\b/i],
  ['demo day', /\bdemo day\b/i],
  ['YC', /\b(YC|Y Combinator|Techstars)\b/],
  ['first person', /\b(We|we|our|Our|us)\b/],
  ['price', /\$\s?\d|\bper seat\b|\bseat price\b|\bper month\b|\/mo\b/i],
  ['package', /\b(Spark|Accelerate|Studio)\b|\bpackages?\b/],
  ['IP promise', /belongs to your company/i],
  ['equity', /\b(equity|stake in your company|shares in your company)\b/i],
  ['UK spelling', /\b(organis|programme|colour|behaviour|centre)\w*/i],
];

test('the copy of /how-we-work/ holds none of the banned words, no first person, no price, no package and no IP or equity line', () => {
  for (const [name, text] of surfaces) {
    for (const [rule, pattern] of BANNED) {
      assert.doesNotMatch(text, pattern, `${name}: ${rule}`);
    }
  }
});

test('the required texts are on /how-we-work/, which is their single home', () => {
  assert.ok(page.includes('WE makes no promise of funding.'));
  assert.match(page, /<IntroductionsDisclaimer \/>/);
  assert.match(page, /\{INTRODUCTIONS_FLAT_FEE\}/);
  assert.equal(INTRODUCTIONS_DISCLAIMER, 'Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.');
  assert.equal(INTRODUCTIONS_FLAT_FEE, 'The fee does not depend on whether any investment closes.');
  assert.equal(model.PAID_FALLBACK, 'WE is paid for work already done, never in advance of it. Every term, including how steering is valued, is in the agreement you review with your own counsel.');
  assert.match(page, /\{PAID_FALLBACK\}/);
  assert.equal(model.DEFAULT_TERM_LABEL, 'Default initial term: six months. Default; your agreement sets the real terms.');
  assert.match(page, /\{DEFAULT_TERM_LABEL\}/);
  assert.match(page, /Step down, not stop/);
  // The stub carries no required text: it only points to /how-we-work/.
  assert.ok(!stub.includes('promise of funding'));
  assert.ok(!stub.includes('INTRODUCTIONS'));
});

test('the five phases run in order with no gap, map to Dream, Build and Grow, and name their SuperNova method', () => {
  assert.deepEqual(model.PHASES.map((p) => p.name), ['Ignite', 'Build', 'Launch', 'Grow', 'Orbit']);
  assert.deepEqual(model.PHASES.map((p) => p.stage), ['Dream', 'Build', 'Build', 'Grow', 'Grow']);
  assert.deepEqual(model.PHASES.map((p) => [p.from, p.to]), [[0, 6], [6, 18], [18, 36], [36, 60], [60, null]]);
  for (let i = 1; i < model.PHASES.length; i += 1) assert.equal(model.PHASES[i]?.from, model.PHASES[i - 1]?.to);
  const methods = model.PHASES.map((p) => p.method).join(' | ');
  for (const name of ['D.R.E.A.M. Playbook', 'O.R.B.I.T.A.L. Plan', 'S.T.A.R.T.U.P. Initiative', 'A.N.D.R.O.I.D. Ops', 'L.A.U.N.C.H. Sequence', 'G.R.O.W.T.H. phase', 'Event Horizon']) {
    assert.ok(methods.includes(name), name);
  }
  assert.deepEqual(model.CHECKPOINTS.map((c) => c.at), [6, 12, 36, 60]);
  assert.equal(model.PHASES.at(-1)?.checkpoint, 'WE steps down by notice');
});

test('the timeline is drawn to scale: each phase spans its months in six-month columns', () => {
  assert.deepEqual(model.scaleColumns(0, 6), { start: 1, end: 2 });
  assert.deepEqual(model.scaleColumns(6, 18), { start: 2, end: 4 });
  assert.deepEqual(model.scaleColumns(18, 36), { start: 4, end: 7 });
  assert.deepEqual(model.scaleColumns(36, 60), { start: 7, end: 11 });
  assert.deepEqual(model.scaleColumns(60, null), { start: 11, end: 13 });
  for (const phase of model.PHASES) {
    const { start, end } = model.scaleColumns(phase.from, phase.to);
    assert.equal((end - start) * 6, (phase.to ?? model.SCALE_MONTHS) - phase.from, phase.name);
  }
  assert.throws(() => model.scaleColumns(3, 6), /six-month step/);
  assert.throws(() => model.scaleColumns(6, 6), /six-month step/);
  assert.throws(() => model.scaleColumns(0, 78), /six-month step/);
  assert.deepEqual(model.YEAR_TICKS.map(model.tickLabel), ['Day One', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']);
});

test('start in any month: the strip shows all twelve months', () => {
  assert.equal(model.MONTHS.length, 12);
  assert.equal(new Set(model.MONTHS).size, 12);
});

test('the cadence is weekly, monthly, quarterly and the yearly Orbit Review, with no response times', () => {
  assert.deepEqual(model.CADENCE.map((r) => r.name), ['Weekly', 'Monthly', 'Quarterly', 'Yearly']);
  assert.match(model.CADENCE[3]?.body ?? '', /Orbit Review/);
  assert.doesNotMatch(strings(model.CADENCE).join(' '), /\b\d+\s*(hours?|business days?|minutes?)\b|\bSLA\b/i);
});

test('the team is roles only, with the three named contacts, and nothing priced', () => {
  const named = model.TEAM_ROLES.filter((r) => r.level === 'Named contact').map((r) => r.role);
  assert.deepEqual(named, ['Delivery Lead', 'Technical Lead', 'Executive Sponsor']);
  assert.match(page, /<TeamConstellation/);
  const constellation = page.slice(page.indexOf('<TeamConstellation'), page.indexOf('/>', page.indexOf('<TeamConstellation')));
  assert.doesNotMatch(constellation, /price|rate|cost/i);
});

test('the figures are register statistics with a source each, followed by the honesty line', () => {
  assert.equal(model.HONESTY_LINE, "These figures describe all new U.S. businesses, not WE's results.");
  for (const stat of model.CLOCK_STATS) {
    assert.ok(stat.source !== undefined && /^https:\/\/www\.(bls\.gov|babson\.edu)\//.test(stat.source.href ?? ''), stat.value);
  }
  const statsAt = page.indexOf('<StatTiles');
  assert.ok(statsAt > 0 && page.indexOf('{HONESTY_LINE}', statsAt) > statsAt);
});

test('the is and is-not table says WE is not an investor, a staffing provider or a short program', () => {
  const isNot = model.IS_AND_IS_NOT.map(([, not]) => not).join(' | ');
  assert.match(isNot, /investor/);
  assert.match(isNot, /staffing provider/);
  assert.match(isNot, /three-month program/);
  assert.equal(model.IS_AND_IS_NOT.length, 5);
});

test('the call to action is Start a readiness review, then Talk to WE', () => {
  assert.deepEqual(model.PRIMARY_CTA, { label: 'Start a readiness review', href: '/apply/' });
  assert.deepEqual(model.SECONDARY_CTA, { label: 'Talk to WE', href: '/contact/' });
  const row = SURFACES.find((rule) => rule.id === 'how-we-work');
  assert.deepEqual(row?.match, { path: '/how-we-work/' });
  assert.deepEqual([row?.primary, row?.secondary], [['apply'], ['contact']]);
});

test('/how-we-work/ is launched and indexed, /pricing/ is a noindex pointer, and the page sits in the Program section', () => {
  const row = routes.find((r) => r.path === '/how-we-work/');
  assert.ok(row?.launch);
  assert.equal(row?.indexable, true);
  const pricing = routes.find((r) => r.path === '/pricing/');
  assert.equal(pricing?.indexable, false);
  assert.match(stub, /\/how-we-work\//);
  assert.equal(activeSectionId('/how-we-work/'), 'program');
  assert.ok(existsSync(new URL('../../../src/content/pages/how-we-work/how-we-work.mdx', import.meta.url)));
});

test('the menus link How WE works where Pricing was, and no strip, column or footer link goes to /pricing/', () => {
  for (const item of primaryNav) {
    if (item.kind !== 'mega') continue;
    for (const link of [...item.columns.flatMap((c) => c.links), ...(item.strip ?? [])]) assert.notEqual(link.href, '/pricing/', `${item.id}: ${link.label}`);
  }
  for (const column of footerNav) for (const link of column.links) assert.notEqual(link.href, '/pricing/', `footer ${column.heading}: ${link.label}`);
  const program = primaryNav.find((i) => i.id === 'program');
  assert.ok(program?.kind === 'mega' && program.strip?.some((l) => l.href === '/how-we-work/' && l.label === 'How WE works'));
  assert.ok(footerNav.some((c) => c.links.some((l) => l.href === '/how-we-work/' && l.label === 'How WE works')));
});

test('the palette finds How WE works for "how we work" and for "pricing"', () => {
  const isLive = (): boolean => true;
  const commands = buildPaletteCommands({ items: resolveNav(isLive), utility: resolveUtility(isLive), apply: applyButton, footer: resolveFooter(isLive) }, isLive);
  assert.ok(commands.some((c) => c.href === '/how-we-work/'));
  assert.equal(rankCommands(commands, 'how we work')[0]?.command.href, '/how-we-work/');
  assert.ok(rankCommands(commands, 'pricing').some((r) => r.command.href === '/how-we-work/'));
});
