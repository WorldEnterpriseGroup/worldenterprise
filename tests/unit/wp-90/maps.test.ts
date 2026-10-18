import assert from 'node:assert/strict';
import test from 'node:test';
import { BRIEFS } from '../../../src/data/families.ts';
import { AUDIENCE_LINKS } from '../../../src/data/cta/audiences.ts';
import { allKeys, targetFor } from '../../../src/data/cta/targets.ts';
import { applyButton, primaryNav, utilityNav } from '../../../src/data/nav.ts';
import type { NavLink } from '../../../src/data/nav.ts';
import { routes } from '../../../src/data/routes.ts';
import { THANKS_COPY } from '../../../src/components/briefs/copy.ts';
import { APPLY, HOW_IT_WORKS, TALK_TO_WE } from '../../../src/components/hero/ctas.ts';
import { ASK_TO_MEET, JOURNEY_LINKS, MATERIAL_LINKS, OPEN_NOW_LINKS } from '../../../src/components/investors/copy.ts';
import { ACTIONS as PARTNER_ACTIONS, ENQUIRE_PAGE, THANKS_PAGE } from '../../../src/components/partners/copy.ts';
import { ACTIONS as PROGRAM_ACTIONS } from '../../../src/components/program/ctas.ts';
import { HOW_LONG_CTA, HOW_WE_WORK_CTA, PRIMARY_CTA, TIMELINE_BRIEF_CTA } from '../../../src/data/sales/copy.ts';
import {
  AUDIENCE_IDS,
  FORM_ANSWERS,
  MAPS,
  MAX_CLICK_DEPTH,
  STAGE_ORDER,
  depthFromHome,
  pairKey,
  planWalk,
  validateMap,
} from '../../e2e/wave8/journeys/maps.ts';
import type { JourneyMap, MapContext } from '../../e2e/wave8/journeys/maps.ts';
import { BROKEN_CHAIN, DEAD_LINK, OPEN_END, REMOVED_FORWARD_LINK, TOO_DEEP, UNKNOWN_CTA } from './fixtures.ts';

/**
 * WP-90 (docs/wave8-contracts.md, section 11): the four customer-journey maps are data, and this test holds the data to the site. Every page
 * of a map is a launched route of the ledger, every link that a map says comes from the CTA or navigation data is offered by that data under
 * that name to that target, each audience has a map that reaches a form, and a deliberately broken map is rejected. The browser walk of
 * the same maps is tests/e2e/wave8/journeys/*.spec.ts.
 */

const launched = new Set(routes.filter((row) => row.launch).map((row) => row.path));
const isLaunched = (path: string): boolean => launched.has(path);

function navPairs(): string[] {
  const links: NavLink[] = [...utilityNav.links, applyButton];
  const pairs: string[] = links.map((l) => pairKey(l.label, l.href));
  for (const item of primaryNav) {
    if (item.kind === 'direct') {
      pairs.push(pairKey(item.label, item.href));
      continue;
    }
    for (const link of [...item.columns.flatMap((c) => c.links), ...item.strip]) pairs.push(pairKey(link.label, link.href));
    pairs.push(pairKey(item.featured.cta.label, item.featured.cta.href), pairKey(item.leadLink, item.href));
  }
  return pairs;
}

/** Every label and target the CTA, hero, navigation and journey-page data can put on a link. */
function ctaPairs(): ReadonlySet<string> {
  const pairs = new Set<string>(navPairs());
  const add = (label: string, href: string): void => void pairs.add(pairKey(label, href));
  for (const key of allKeys()) {
    const target = targetFor(key);
    if (target !== undefined) add(target.label, target.href);
  }
  for (const door of AUDIENCE_LINKS) add(door.label, door.href);
  for (const brief of BRIEFS.entries) add(`Request the brief: ${brief.label}`, brief.path);
  for (const cta of [APPLY, TALK_TO_WE, HOW_IT_WORKS, ASK_TO_MEET, PRIMARY_CTA, HOW_LONG_CTA, HOW_WE_WORK_CTA, TIMELINE_BRIEF_CTA]) add(cta.label, cta.href);
  for (const list of Object.values(PROGRAM_ACTIONS)) for (const cta of list) add(cta.label, cta.href);
  for (const link of [...JOURNEY_LINKS, ...OPEN_NOW_LINKS, ...MATERIAL_LINKS]) add(link.title, link.href);
  for (const cta of Object.values(PARTNER_ACTIONS)) add(cta.label, cta.href);
  for (const link of [...THANKS_PAGE.links, ...ENQUIRE_PAGE.links]) add(link.label, link.href);
  // The brief thanks page labels its aside links from THANKS_COPY and hard-codes the paths.
  add(THANKS_COPY.afterApply, '/journey/after-you-apply/');
  add(THANKS_COPY.moreBriefs, '/briefs/');
  add(THANKS_COPY.apply, '/apply/');
  add(THANKS_COPY.contact, '/contact/');
  return pairs;
}

const context: MapContext = { isLaunched, ctaPairs: ctaPairs() };

test('the four audiences are covered, once each', () => {
  assert.deepEqual([...AUDIENCE_IDS], ['startup', 'investor', 'partner', 'corporate']);
  assert.deepEqual(MAPS.map((m) => m.audience), [...AUDIENCE_IDS]);
});

for (const map of MAPS) {
  test(`${map.audience}: every page is a launched route and every call to action is offered by the CTA or navigation data`, () => {
    const pages = new Set<string>();
    for (const step of map.steps) {
      pages.add(step.page);
      assert.ok(step.page.endsWith('/'), `${step.page} is a page route`);
      assert.ok(isLaunched(step.page), `${step.page} is not a launched route in src/data/routes.ts`);
      if (step.take?.kind === 'submit') assert.ok(isLaunched(step.take.thanks), `${step.take.thanks} is not a launched route`);
    }
    assert.equal(pages.size, map.steps.length, 'a page appears once in a map');
    assert.deepEqual(validateMap(map, context), []);
  });

  test(`${map.audience}: the stages never go backwards, the map reaches a form with answers to type and ends after it`, () => {
    const indexes = map.steps.map((s) => STAGE_ORDER.indexOf(s.stage));
    assert.deepEqual([...indexes].sort((a, b) => a - b), indexes);
    const stages = map.steps.map((s) => s.stage);
    for (const stage of ['awareness', 'conversion', 'onboarding'] as const) assert.ok(stages.includes(stage), `the map has a ${stage} step`);
    const submit = map.steps.find((s) => s.take?.kind === 'submit')?.take;
    assert.ok(submit?.kind === 'submit');
    assert.ok(Object.keys(FORM_ANSWERS[submit.form].text).includes('email'), 'the form has an email answer');
  });

  test(`${map.audience}: the form is at most ${MAX_CLICK_DEPTH} navigations from the home page`, () => {
    const depth = depthFromHome(map);
    assert.ok(depth !== undefined && depth <= MAX_CLICK_DEPTH, `depth ${String(depth)} from /`);
    if (map.homeDoor === undefined) assert.equal(map.steps[0]?.page, '/');
    else assert.equal(map.homeDoor.href, map.steps[0]?.page);
  });
}

test('a step whose route is not launched is skipped and listed, with every step after it', () => {
  const map = MAPS.find((m) => m.audience === 'investor') as JourneyMap;
  const cut = 'not a launched route (launch: false, a cut page)';
  const plan = planWalk(map, (path) => (path === '/investors/interest/' ? cut : undefined));
  assert.deepEqual(plan.steps.map((s) => s.page), ['/investors/', '/investors/meet-startups/']);
  assert.deepEqual(plan.skipped.map((s) => s.page), ['/investors/interest/', '/investors/interest/thanks/', '/investors/what-you-can-see/']);
  assert.match(plan.skipped[0]?.reason ?? '', /launch: false/);
  assert.match(plan.skipped[1]?.reason ?? '', /an earlier step is not live/);
});

test('a map with every route live skips nothing', () => {
  for (const map of MAPS) {
    const plan = planWalk(map, () => undefined);
    assert.equal(plan.steps.length, map.steps.length);
    assert.deepEqual(plan.skipped, []);
  }
});

test('a launch:false row of the ledger is reported by the planner as cut', () => {
  const cutRow = routes.find((row) => !row.launch && row.path.endsWith('/'));
  assert.ok(cutRow, 'the ledger has a cut page route to prove the planner against');
  const fake: JourneyMap = { audience: 'startup', title: 'fixture', steps: [{ page: cutRow.path, stage: 'awareness' }] };
  const plan = planWalk(fake, (path) => (isLaunched(path) ? undefined : 'not a launched route (launch: false, a cut page)'));
  assert.deepEqual(plan.steps, []);
  assert.deepEqual(plan.skipped.map((s) => s.page), [cutRow.path]);
});

const BROKEN: readonly (readonly [string, JourneyMap, RegExp])[] = [
  ['a link to a page that is not launched', DEAD_LINK, /dead-link/],
  ['a removed forward link', REMOVED_FORWARD_LINK, /dead-end/],
  ['a call to action that no data offers', UNKNOWN_CTA, /unknown-cta/],
  ['a link whose next step is another page', BROKEN_CHAIN, /broken-chain/],
  ['a form more than three navigations from the home page', TOO_DEEP, /click-depth/],
  ['a journey that stops on the form', OPEN_END, /open-end/],
];

for (const [what, fixture, code] of BROKEN) {
  test(`the validator rejects a broken fixture: ${what}`, () => {
    const problems = validateMap(fixture, context);
    assert.ok(problems.length > 0, `${fixture.title} was accepted`);
    assert.ok(problems.some((p) => code.test(p)), `expected ${String(code)} in:\n${problems.join('\n')}`);
  });
}

test('a real map passes, and the same map with its first forward link removed is rejected', () => {
  const sound = MAPS[0] as JourneyMap;
  assert.deepEqual(validateMap(sound, context), []);
  const [first, ...rest] = sound.steps;
  assert.ok(first);
  const { take: _removed, ...bare } = first;
  const broken: JourneyMap = { ...sound, steps: [bare, ...rest] };
  assert.ok(validateMap(broken, context).some((p) => /dead-end/.test(p)));
});
