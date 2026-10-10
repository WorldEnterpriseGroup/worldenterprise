import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as lhMod from '../../../scripts/run-lighthouse.mjs';

// Which routes qa:lighthouse measures. A candidate a package has not merged yet is skipped and the log says so; a candidate that the cap
// leaves out is named too, so a route added to the list can never silently never run (wave 7 listed 16 candidates under a cap of 12, and
// the last four were never measured).

const lh = lhMod as unknown as {
  planRoutes(candidates: string[], built: Set<string>, max: number): { routes: string[]; missing: string[]; overflow: string[] };
  pickRoutes(candidates: string[], built: Set<string>, max: number): string[];
};

const config = JSON.parse(readFileSync(new URL('../../../lighthouserc.json', import.meta.url), 'utf8')) as { candidates: string[]; maxRoutes: number };

test('planRoutes keeps the configured order, skips what is not built and reports it', () => {
  const plan = lh.planRoutes(['/', '/a/', '/b/', '/c/', '/d/'], new Set(['/', '/b/', '/c/', '/d/']), 3);
  assert.deepEqual(plan, { routes: ['/', '/b/', '/c/'], missing: ['/a/'], overflow: ['/d/'] });
});

test('planRoutes agrees with pickRoutes on the routes it picks', () => {
  const built = new Set(['/', '/b/', '/c/']);
  assert.deepEqual(lh.planRoutes(['/', '/a/', '/b/', '/c/'], built, 2).routes, lh.pickRoutes(['/', '/a/', '/b/', '/c/'], built, 2));
});

test('with nothing missing and room under the cap, every candidate is measured and nothing is left out', () => {
  const plan = lh.planRoutes(['/x/', '/y/'], new Set(['/x/', '/y/']), 5);
  assert.deepEqual(plan, { routes: ['/x/', '/y/'], missing: [], overflow: [] });
});

test('the candidate list fits the cap, so no listed route is left out when the whole site is built', () => {
  assert.ok(config.candidates.length <= config.maxRoutes, `${config.candidates.length} candidates under maxRoutes ${config.maxRoutes}`);
  assert.equal(new Set(config.candidates).size, config.candidates.length, 'no candidate is listed twice');
});

test("WP-76's three tool pages are candidates, after the tools hub and the metrics calculator, and a build without them still runs", () => {
  for (const route of ['/tools/', '/tools/metrics-calculator/', '/tools/runway-calculator/', '/tools/pricing-page-checker/', '/tools/cap-table-explainer/']) {
    assert.ok(config.candidates.includes(route), `${route} is a candidate`);
  }
  const withoutWp76 = new Set(config.candidates.filter((c) => !/runway|pricing-page|cap-table/.test(c)));
  const plan = lh.planRoutes(config.candidates, withoutWp76, config.maxRoutes);
  assert.deepEqual(plan.missing, ['/tools/runway-calculator/', '/tools/pricing-page-checker/', '/tools/cap-table-explainer/']);
  assert.equal(plan.routes.length, config.candidates.length - 3);
  assert.deepEqual(plan.overflow, []);
});

test('the page templates measured before are all still candidates', () => {
  for (const route of ['/', '/program/', '/services/', '/services/brand-and-identity/', '/insights/', '/insights/is-your-saas-idea-a-business-or-a-feature/', '/research/saas-security-baseline-year-one/', '/library/one-page-problem-brief/', '/program/how-we-decide/', '/about/facts/']) {
    assert.ok(config.candidates.includes(route), `${route} is still measured`);
  }
});
