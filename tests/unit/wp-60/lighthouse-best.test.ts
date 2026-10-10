import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as lhMod from '../../../scripts/run-lighthouse.mjs';

// qa:lighthouse judges a route on the median of up to three runs. The budgets stay as they are; what changes is that one run that lost
// the CPU to a neighbouring job on the shared runner (the same 6948 byte page reads TBT 0 in one run and 8814 ms in the next) no longer
// fails the route, while a route that breaches in most of its runs still does.

interface Summary {
  route: string;
  scores: Record<string, number | null>;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  scriptBytes: number;
  thirdParty: string[];
  note?: string;
}
interface Budget {
  scores: Record<string, number>;
  metrics: { lcpMs: number; cls: number; tbtMs: number };
  javascript: { maxGzipBytes: number; exemptPrefixes: string[] };
  runs?: number;
}

const lh = lhMod as unknown as {
  median(values: (number | null)[]): number | null;
  typicalRun(runs: Summary[]): Summary;
  medianSummary(runs: Summary[]): Summary;
  needsAnotherRun(runs: Summary[], config: Budget, maxRuns: number): boolean;
  judge(runs: Summary[], config: Budget): { summary: Summary; failures: string[] };
  measureRoutes(routes: string[], runOnce: (route: string) => Promise<Summary>, config: Budget, maxRuns: number, onRun?: (round: number, summary: Summary) => void): Promise<Map<string, Summary[]>>;
  checkBudgets(summary: Summary, config: Budget): { id: string; sampled: boolean; message: string }[];
};

const config = JSON.parse(readFileSync(new URL('../../../lighthouserc.json', import.meta.url), 'utf8')) as Budget;

const run = (patch: Partial<Summary> = {}): Summary => ({
  route: '/program/',
  scores: { performance: 0.99, accessibility: 1, seo: 1, 'best-practices': 1 },
  lcpMs: 1800,
  cls: 0,
  tbtMs: 0,
  scriptBytes: 6948,
  thirdParty: [],
  ...patch,
});
/** A run in which the runner stalled: blocking time far over budget, and the performance score down with it. */
const stalled = (tbtMs: number): Summary => run({ tbtMs, scores: { performance: 0.57, accessibility: 1, seo: 1, 'best-practices': 1 } });

test('the budgets are the SAGE-PLAN 6.9 ones: variance is handled by the median, not by loosening them', () => {
  assert.equal(config.metrics.tbtMs, 200);
  assert.equal(config.scores.performance, 0.9);
  assert.equal(config.metrics.lcpMs, 2500);
  assert.equal(config.metrics.cls, 0.1);
  assert.equal(config.runs, 3, 'three runs per route');
  assert.ok(!('retries' in config), 'the best-of retry is gone: a retry that stops at the first pass is the opposite of a median');
});

test('median: the middle of an odd count, the mean of the middle two of an even count, null when too many values are missing', () => {
  assert.equal(lh.median([413, 0, 9]), 9);
  assert.equal(lh.median([300, 100]), 200);
  assert.equal(lh.median([7]), 7);
  assert.equal(lh.median([0, 8814, null]), 4407, 'one missing value out of three leaves two to take the median of');
  assert.equal(lh.median([null, 5, null]), null, 'two missing out of three is a missing median');
  assert.equal(lh.median([null, 5]), null, 'one missing out of two is a missing median');
  assert.equal(lh.median([]), null);
});

test('one stalled run out of three does not fail the route: the median is the typical run', () => {
  const verdict = lh.judge([run(), stalled(8814), run({ tbtMs: 11 })], config);
  assert.deepEqual(verdict.failures, []);
  assert.equal(verdict.summary.tbtMs, 11);
  assert.equal(verdict.summary.scores.performance, 0.99);
});

test('two stalled runs out of three fail the route on the median, and the message names the median', () => {
  const verdict = lh.judge([stalled(413), run(), stalled(1136)], config);
  assert.equal(verdict.summary.tbtMs, 413);
  assert.match(verdict.failures.join('\n'), /TBT 413 ms is not under 200 ms/);
  assert.match(verdict.failures.join('\n'), /performance score 57 is below 90/);
});

test('a route that breaches in every run fails whatever the run order', () => {
  for (const runs of [[stalled(300), stalled(250), stalled(900)], [stalled(900), stalled(300), stalled(250)]]) {
    assert.match(lh.judge(runs, config).failures.join('\n'), /TBT/);
  }
});

test('a breach that is not sampled still fails on one run: a third-party request or script weight is fixed by the build', () => {
  const one = lh.judge([run(), run({ thirdParty: ['https://cdn.example.com/x.js'] }), run()], config);
  assert.match(one.failures.join('\n'), /third-party requests: https:\/\/cdn\.example\.com\/x\.js/);
  const heavy = lh.judge([run(), run({ scriptBytes: 50_000 }), run()], config);
  assert.match(heavy.failures.join('\n'), /JavaScript transfer 50000 bytes exceeds 10240/);
  assert.deepEqual(lh.judge([run(), run(), run()], config).failures, []);
});

test('a timing that is over budget in every run is not hidden by a missing value in one', () => {
  const missing = run({ tbtMs: null, lcpMs: null, cls: null, scores: { performance: null, accessibility: null, seo: null, 'best-practices': null } });
  assert.match(lh.judge([stalled(900), missing, stalled(800)], config).failures.join('\n'), /TBT 850 ms/);
  assert.match(lh.judge([missing, missing, run()], config).failures.join('\n'), /TBT missing/);
});

test('typicalRun is the run with the median blocking time, so shifts and the network profile come from a typical run', () => {
  const runs = [run({ tbtMs: 500, note: 'slow' }), run({ tbtMs: 0, note: 'fast' }), run({ tbtMs: 40, note: 'middle' })];
  assert.equal(lh.typicalRun(runs).note, 'middle');
  assert.equal(lh.typicalRun([runs[0]!, runs[1]!]).note, 'fast', 'the lower middle one of an even count');
  assert.equal(lh.medianSummary(runs).note, 'middle');
  assert.throws(() => lh.typicalRun([]), /at least one run/);
});

test('needsAnotherRun: one run is never enough, two agreeing runs are, a split pair earns the third, three is the limit', () => {
  assert.equal(lh.needsAnotherRun([run()], config, 3), true, 'a single run cannot be a median');
  assert.equal(lh.needsAnotherRun([run(), run({ tbtMs: 30 })], config, 3), false, 'two passes: a third run cannot make two breaches');
  assert.equal(lh.needsAnotherRun([stalled(300), stalled(900)], config, 3), false, 'two breaches: the median fails whatever the third says');
  assert.equal(lh.needsAnotherRun([run(), stalled(900)], config, 3), true, 'a split pair leaves the verdict open');
  assert.equal(lh.needsAnotherRun([run(), stalled(900), run()], config, 3), false, 'three runs are the limit');
  assert.equal(lh.needsAnotherRun([run()], config, 1), false, 'with one run configured there is nothing to add');
});

test('needsAnotherRun looks at each budget: two runs that agree on blocking time but split on LCP still need a third', () => {
  const slowPaint = (lcpMs: number): Summary => run({ lcpMs });
  assert.equal(lh.needsAnotherRun([slowPaint(2600), slowPaint(1800)], config, 3), true);
  assert.equal(lh.needsAnotherRun([slowPaint(2600), slowPaint(2700)], config, 3), false);
});

test('the verdict from the early stop equals the verdict of three full runs, for every pass and breach pattern of one budget', () => {
  // Each of the eight patterns of three runs, each run either clean or over the blocking-time budget. Stopping after two runs when
  // `needsAnotherRun` says so must give the same verdict as judging all three.
  for (let pattern = 0; pattern < 8; pattern += 1) {
    const runs = [0, 1, 2].map((i) => ((pattern >> i) & 1 ? stalled(900) : run()));
    const taken: Summary[] = [];
    for (const next of runs) {
      taken.push(next);
      if (!lh.needsAnotherRun(taken, config, 3)) break;
    }
    assert.deepEqual(lh.judge(taken, config).failures.length > 0, lh.judge(runs, config).failures.length > 0, `pattern ${pattern.toString(2).padStart(3, '0')}`);
  }
});

/** A runner that answers each route from a script of blocking times, and records the order it was asked in. */
function scripted(script: Record<string, number[]>): { order: string[]; runOnce: (route: string) => Promise<Summary> } {
  const order: string[] = [];
  const seen = new Map<string, number>();
  return {
    order,
    runOnce: async (route) => {
      order.push(route);
      const n = seen.get(route) ?? 0;
      seen.set(route, n + 1);
      const tbtMs = script[route]?.[n];
      assert.notEqual(tbtMs, undefined, `${route} was run ${n + 1} times, more than scripted`);
      return tbtMs! >= config.metrics.tbtMs ? { ...stalled(tbtMs!), route } : { ...run({ tbtMs: tbtMs! }), route };
    },
  };
}

test('measureRoutes runs in rounds over all routes, and a third run goes only to a route whose first two runs disagree', async () => {
  const { order, runOnce } = scripted({ '/a/': [0, 0], '/b/': [900, 0, 5], '/c/': [700, 800], '/d/': [10, 20] });
  const measured = await lh.measureRoutes(['/a/', '/b/', '/c/', '/d/'], runOnce, config, 3);
  assert.deepEqual(order, ['/a/', '/b/', '/c/', '/d/', '/a/', '/b/', '/c/', '/d/', '/b/'], 'two full rounds, then the one split route');
  assert.deepEqual([...measured.keys()], ['/a/', '/b/', '/c/', '/d/']);
  assert.equal(measured.get('/b/')!.length, 3);
  assert.deepEqual(lh.judge(measured.get('/b/')!, config).failures, [], 'one stalled run of three is not a failure');
  assert.match(lh.judge(measured.get('/c/')!, config).failures.join('\n'), /TBT/, 'a route over budget in both runs still fails');
  assert.deepEqual(lh.judge(measured.get('/d/')!, config).failures, []);
});

test('measureRoutes reports each run with its round, and a run that throws stops the job instead of being skipped', async () => {
  const seen: string[] = [];
  const { runOnce } = scripted({ '/a/': [0, 0] });
  await lh.measureRoutes(['/a/'], runOnce, config, 3, (round, summary) => seen.push(`${round}:${summary.route}`));
  assert.deepEqual(seen, ['1:/a/', '2:/a/']);
  await assert.rejects(lh.measureRoutes(['/a/'], async () => { throw new Error('Lighthouse returned no result for /a/'); }, config, 3), /no result for \/a\//);
});

test('measureRoutes with one run configured measures each route once', async () => {
  const { order, runOnce } = scripted({ '/a/': [900], '/b/': [0] });
  await lh.measureRoutes(['/a/', '/b/'], runOnce, config, 1);
  assert.deepEqual(order, ['/a/', '/b/']);
});

test('the budget check reports which budgets are sampled, so the stop rule knows which ones a run can only vote on', () => {
  const ids = lh.checkBudgets(run({ tbtMs: 900, thirdParty: ['https://x.example/y.js'] }), config).map((f) => `${f.id}:${f.sampled}`);
  assert.deepEqual(ids.sort(), ['third-party:false', 'tbt:true'].sort());
});
