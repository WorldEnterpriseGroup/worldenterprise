import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as lhMod from '../../../scripts/run-lighthouse.mjs';

// Issue #113: a run that began on a starved CPU must not count as a TBT regression. Demo pipeline 73611 (merge 13936b3, tests only) failed
// qa:lighthouse on / with TBT 641/474/323 ms at CPU benchmark index 989/969/1143; the last green demo (73405) read 174 ms at index 1989.
// The budgets are unchanged: a starved run is left out of the TBT verdict only, and every other metric is judged on every run.

interface Summary {
  route: string;
  scores: Record<string, number | null>;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  scriptBytes: number;
  thirdParty: string[];
  benchmarkIndex: number | null;
  tbtInconclusive?: (number | null)[];
}
interface Budget {
  scores: Record<string, number>;
  metrics: { lcpMs: number; cls: number; tbtMs: number };
  javascript: { maxGzipBytes: number; exemptPrefixes: string[] };
  runs?: number;
  benchmark?: { floor: number; maxExtraRuns: number };
}

const lh = lhMod as unknown as {
  isStarved(run: Pick<Summary, 'benchmarkIndex'>, config: Budget): boolean;
  bestSummary(runs: Summary[], config?: Budget): Summary;
  needsAnotherRun(runs: Summary[], config: Budget, maxRuns: number, attempts?: number): boolean;
  judge(runs: Summary[], config: Budget, attempts?: number): { summary: Summary | null; failures: string[] };
  measureRoutes(routes: string[], runOnce: (route: string) => Promise<Summary>, config: Budget, maxRuns: number): Promise<Map<string, Summary[]>>;
};

const config = JSON.parse(readFileSync(new URL('../../../lighthouserc.json', import.meta.url), 'utf8')) as Budget;
const floor = config.benchmark?.floor ?? 0;

const run = (patch: Partial<Summary> = {}): Summary => ({
  route: '/',
  scores: { performance: 0.99, accessibility: 1, seo: 1, 'best-practices': 1 },
  lcpMs: 1800,
  cls: 0,
  tbtMs: 100,
  scriptBytes: 9683,
  thirdParty: [],
  benchmarkIndex: 2000,
  ...patch,
});
/** A run on a starved CPU: the benchmark index is under the floor and the blocking time is inflated. */
const starved = (tbtMs: number, benchmarkIndex = 989, patch: Partial<Summary> = {}): Summary => run({ tbtMs, benchmarkIndex, ...patch });

test('the benchmark floor is configured, evidence-based and leaves every budget alone', () => {
  assert.ok(config.benchmark, 'lighthouserc.json has a benchmark section');
  assert.ok(floor > 1143 && floor < 1500, `floor ${floor} is above the starved runs of pipeline 73611 (up to 1143) and below healthy ones`);
  assert.ok((config.benchmark?.maxExtraRuns ?? 0) >= 1, 'a bounded number of extra runs');
  assert.equal(config.metrics.tbtMs, 200, 'the TBT budget is unchanged');
  assert.equal(config.metrics.lcpMs, 2500);
  assert.equal(config.metrics.cls, 0.1);
  assert.equal(config.runs, 3);
});

test('isStarved: under the floor only; an unknown benchmark or a config without a floor excludes nothing', () => {
  assert.equal(lh.isStarved({ benchmarkIndex: floor - 1 }, config), true);
  assert.equal(lh.isStarved({ benchmarkIndex: floor }, config), false);
  assert.equal(lh.isStarved({ benchmarkIndex: 1989 }, config), false);
  assert.equal(lh.isStarved({ benchmarkIndex: null }, config), false);
  const noFloor = { ...config, benchmark: undefined };
  assert.equal(lh.isStarved({ benchmarkIndex: 100 }, noFloor), false);
});

test('a starved run is excluded from the TBT verdict: its inflated blocking time does not fail the route', () => {
  const verdict = lh.judge([starved(641), run({ tbtMs: 120 })], config);
  assert.equal(verdict.summary?.tbtMs, 120);
  assert.deepEqual(verdict.failures, []);
});

test('a mix of starved and healthy runs is judged on the healthy ones: a starved run with a lower TBT does not hide a breach', () => {
  // The starved run happens to read 10 ms; it must not count, so the healthy runs (350 and 400) decide, and fail.
  const verdict = lh.judge([starved(10), run({ tbtMs: 350 }), run({ tbtMs: 400 })], config);
  assert.equal(verdict.summary?.tbtMs, 350);
  assert.match(verdict.failures.join('\n'), /TBT 350 ms is not under 200 ms/);
  assert.doesNotMatch(verdict.failures.join('\n'), /inconclusive/);
  // And a healthy run within budget passes whatever the starved ones read.
  assert.deepEqual(lh.judge([starved(641), starved(474, 969), run({ tbtMs: 174 })], config).failures, []);
});

test('every other metric is still judged on starved runs: LCP, CLS, scores, third parties and script bytes', () => {
  const lcp = lh.judge([starved(0, 989, { lcpMs: 3100 }), run({ lcpMs: 3000 })], config);
  assert.match(lcp.failures.join('\n'), /LCP 3000 ms/, 'a healthy run does not rescue LCP; the best of all runs counts');
  assert.deepEqual(lh.judge([starved(900, 989, { lcpMs: 1500 }), run({ lcpMs: 3000 })], config).failures, [], 'a starved run with the best LCP still counts for LCP');
  assert.match(lh.judge([starved(900, 989, { cls: 0.5 }), run({ cls: 0.4 })], config).failures.join('\n'), /CLS 0\.4 is not under 0\.1/);
  assert.match(lh.judge([starved(900, 989, { thirdParty: ['https://cdn.example.com/x.js'] }), run()], config).failures.join('\n'), /third-party requests/);
  assert.match(lh.judge([starved(900, 989, { scriptBytes: 50_000 }), run()], config).failures.join('\n'), /JavaScript transfer 50000 bytes/);
  const lowScore = { performance: 0.5, accessibility: 1, seo: 1, 'best-practices': 1 };
  assert.match(lh.judge([starved(0, 989, { scores: lowScore }), run({ scores: lowScore })], config).failures.join('\n'), /performance score 50 is below 90/);
});

test('every run starved: the route fails with the distinct "TBT inconclusive" message, not as a TBT regression', () => {
  const verdict = lh.judge([starved(641, 989), starved(474, 969), starved(323, 1143)], config);
  assert.equal(verdict.failures.length, 1);
  assert.match(verdict.failures[0], /^TBT inconclusive: runner CPU starved \(benchmark 989\/969\/1143, floor \d+\)$/);
  assert.equal(verdict.summary?.tbtMs, null, 'no blocking time is reported as a measurement');
  assert.doesNotMatch(verdict.failures.join('\n'), /is not under 200 ms/);
  // Other breaches are still reported next to it.
  const both = lh.judge([starved(641, 989, { lcpMs: 3000 }), starved(474, 969, { lcpMs: 3100 })], config).failures.join('\n');
  assert.match(both, /TBT inconclusive/);
  assert.match(both, /LCP 3000 ms/);
});

test('a healthy run over budget still fails as a regression', () => {
  const verdict = lh.judge([run({ tbtMs: 1969, benchmarkIndex: 2208 }), run({ tbtMs: 1500, benchmarkIndex: 2100 }), run({ tbtMs: 1700, benchmarkIndex: 2300 })], config);
  assert.match(verdict.failures.join('\n'), /TBT 1500 ms is not under 200 ms/);
  assert.doesNotMatch(verdict.failures.join('\n'), /inconclusive/);
});

test('without a floor in the config the verdict is the old one (no run is called starved)', () => {
  const noFloor = { ...config, benchmark: undefined };
  const verdict = lh.judge([starved(641), starved(474, 969)], noFloor);
  assert.match(verdict.failures.join('\n'), /TBT 474 ms is not under 200 ms/);
});

test('needsAnotherRun: a starved run earns an extra run beyond maxRuns, bounded by maxExtraRuns', () => {
  const extra = config.benchmark?.maxExtraRuns ?? 0;
  const allStarved = (n: number) => Array.from({ length: n }, () => starved(500));
  assert.equal(lh.needsAnotherRun([run()], config, 3), false, 'a healthy run within budget is done');
  assert.equal(lh.needsAnotherRun([starved(500)], config, 3), true, 'every run so far starved: TBT unjudged, measure again');
  assert.equal(lh.needsAnotherRun(allStarved(3), config, 3), true, 'starved runs do not use up the three runs');
  assert.equal(lh.needsAnotherRun(allStarved(3 + extra), config, 3), false, 'but the extra runs are bounded');
  // Healthy runs over budget keep the old limit of three.
  assert.equal(lh.needsAnotherRun([run({ tbtMs: 500 }), run({ tbtMs: 500 }), run({ tbtMs: 500 })], config, 3), false);
  // One starved run among three over-budget ones grants exactly one more run.
  const mixed = [starved(500), run({ tbtMs: 500 }), run({ tbtMs: 500 })];
  assert.equal(lh.needsAnotherRun(mixed, config, 3), true);
  assert.equal(lh.needsAnotherRun([...mixed, run({ tbtMs: 500 })], config, 3), false);
  // Stalled attempts count toward the bound even though they produced no run.
  assert.equal(lh.needsAnotherRun([starved(500)], config, 3, 3 + 1), false);
});

test('measureRoutes: starved runs are replaced by extra rounds; a healthy run ends the route, and all-starved stops at the bound', async () => {
  const extra = config.benchmark?.maxExtraRuns ?? 0;
  const calls = new Map<string, number>();
  const measured = await lh.measureRoutes(
    ['/recovers/', '/always-starved/', '/healthy/'],
    async (route) => {
      const n = (calls.get(route) ?? 0) + 1;
      calls.set(route, n);
      if (route === '/healthy/') return run({ route, tbtMs: 50 });
      if (route === '/recovers/') return n < 3 ? starved(600, 900, { route }) : run({ route, tbtMs: 80 });
      return starved(600, 900, { route });
    },
    config,
    3,
  );
  assert.equal(calls.get('/healthy/'), 1);
  assert.equal(calls.get('/recovers/'), 3, 'two starved runs, then a healthy one ends it');
  assert.equal(calls.get('/always-starved/'), 3 + extra, 'bounded at maxRuns plus the extra runs');
  assert.deepEqual(lh.judge(measured.get('/recovers/') ?? [], config).failures, []);
  assert.match(lh.judge(measured.get('/always-starved/') ?? [], config).failures.join('\n'), /^TBT inconclusive: runner CPU starved \(benchmark 900(\/900)+, floor \d+\)$/);
});
