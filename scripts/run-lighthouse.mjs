#!/usr/bin/env node
// Runs Lighthouse (mobile, simulated throttling) on the representative routes of the built site and checks the budgets in
// lighthouserc.json (SAGE-PLAN 6.9). Each route is judged on the best of up to three runs, taken in rounds over all routes: the
// timings move with the CPU the shared runner happens to give the job, contention only ever adds time, and a real regression raises every
// run, the best one included. A route that is within budget on its first run is not measured again. The budgets are not loosened. The site is served by scripts/lib/serve.mjs with its production origin
// rewritten to the local one so the canonical URL is self-referential. Chromium comes from Playwright.
// Usage: node scripts/run-lighthouse.mjs [--dist dist] [--out reports/lighthouse] [--config lighthouserc.json]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './lib/html.mjs';
import { builtRoutes } from './lib/ledger.mjs';

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

/** Picks up to `max` candidate routes that exist in the build, keeping the configured order. */
export function pickRoutes(candidates, built, max) {
  return candidates.filter((c) => built.has(c)).slice(0, max);
}

/**
 * The routes to measure and the ones left out, so the log can say why. `missing` are candidates the build does not have (a package
 * whose pages have not merged yet): skipped, not a failure. `overflow` are built candidates past `max`, which are not measured.
 */
export function planRoutes(candidates, built, max) {
  const present = candidates.filter((c) => built.has(c));
  return { routes: present.slice(0, max), missing: candidates.filter((c) => !built.has(c)), overflow: present.slice(max) };
}

/** Reduces a Lighthouse result to the numbers the budgets use. `lhr` is the Lighthouse report object. */
export function summarise(route, lhr, origin) {
  const num = (id) => lhr.audits?.[id]?.numericValue ?? null;
  const requests = lhr.audits?.['network-requests']?.details?.items ?? [];
  const thirdParty = requests.filter((r) => typeof r.url === 'string' && /^https?:/.test(r.url) && new URL(r.url).origin !== origin).map((r) => r.url);
  const scriptBytes = requests.filter((r) => r.resourceType === 'Script').reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
  return {
    route,
    scores: Object.fromEntries(CATEGORIES.map((c) => [c, lhr.categories?.[c]?.score ?? null])),
    lcpMs: num('largest-contentful-paint'),
    cls: num('cumulative-layout-shift'),
    tbtMs: num('total-blocking-time'),
    scriptBytes,
    thirdParty,
  };
}

/**
 * What each page asks the network for, and when the first paint happens: FCP, the request count and transfer size by type, and the
 * render-blocking requests Lighthouse lists. These are the numbers the stylesheet and font changes are judged by (WP-19), so they are
 * recorded for every route in summary.json and in network.md. Sizes are transfer sizes as Lighthouse measures them (compressed).
 */
export function networkProfile(lhr) {
  const items = lhr.audits?.['network-requests']?.details?.items ?? [];
  const ofType = (type) => items.filter((r) => r.resourceType === type);
  const bytes = (list) => list.reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
  const blocking = lhr.audits?.['render-blocking-insight'];
  return {
    fcpMs: lhr.audits?.['first-contentful-paint']?.numericValue ?? null,
    requests: items.length,
    totalBytes: bytes(items),
    htmlBytes: bytes(ofType('Document')),
    cssRequests: ofType('Stylesheet').length,
    cssBytes: bytes(ofType('Stylesheet')),
    fontRequests: ofType('Font').length,
    fontBytes: bytes(ofType('Font')),
    imageBytes: bytes(ofType('Image')),
    renderBlocking: blocking?.details?.items?.length ?? 0,
    renderBlockingSavingsMs: blocking?.metricSavings?.FCP ?? 0,
  };
}

/** A Markdown table of the network profile per route, with the mean of each column. `results` holds { route, lcpMs, network }. */
export function networkReport(results) {
  const rows = results.filter((r) => r.network);
  const mean = (pick) => (rows.length === 0 ? 0 : rows.reduce((sum, r) => sum + (pick(r) ?? 0), 0) / rows.length);
  const kb = (n) => (n / 1024).toFixed(1);
  const line = (label, c) => `| ${label} | ${Math.round(c.fcp)} | ${Math.round(c.lcp)} | ${c.css} | ${c.blocking} | ${kb(c.cssBytes)} | ${c.fonts} | ${kb(c.fontBytes)} | ${kb(c.total)} | ${c.requests} |`;
  const body = rows.map((r) =>
    line(`\`${r.route}\``, {
      fcp: r.network.fcpMs ?? 0,
      lcp: r.lcpMs ?? 0,
      css: r.network.cssRequests,
      blocking: r.network.renderBlocking,
      cssBytes: r.network.cssBytes,
      fonts: r.network.fontRequests,
      fontBytes: r.network.fontBytes,
      total: r.network.totalBytes,
      requests: r.network.requests,
    }),
  );
  const average = line('**mean**', {
    fcp: mean((r) => r.network.fcpMs),
    lcp: mean((r) => r.lcpMs),
    css: mean((r) => r.network.cssRequests).toFixed(2),
    blocking: mean((r) => r.network.renderBlocking).toFixed(2),
    cssBytes: mean((r) => r.network.cssBytes),
    fonts: mean((r) => r.network.fontRequests).toFixed(2),
    fontBytes: mean((r) => r.network.fontBytes),
    total: mean((r) => r.network.totalBytes),
    requests: mean((r) => r.network.requests).toFixed(1),
  });
  const header = ['| Route | FCP ms | LCP ms | CSS requests | Render-blocking | CSS KB | Font requests | Font KB | Total KB | Requests |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
  return [...header, ...body, average, ''].join('\n');
}

/**
 * The layout shifts in a trace, for the failure message: when it happened, its score and where each impacted node moved from
 * and to ([x, y, width, height] in CSS pixels). Lighthouse's own audit names the element but not the distance it moved.
 * Chromium flags the first shifts after Lighthouse resizes the viewport with `had_recent_input` and Lighthouse still counts them
 * (core/computed/metrics/cumulative-layout-shift.js), so shifts are listed whatever that flag says and carry it as `input`.
 * Only main-frame shifts are listed.
 */
export function layoutShifts(traceEvents) {
  const start = traceEvents.find((e) => e.name === 'navigationStart')?.ts ?? Math.min(...traceEvents.map((e) => e.ts ?? Infinity));
  return traceEvents
    .filter((e) => e.name === 'LayoutShift' && e.args?.data?.is_main_frame === true)
    .map((e) => ({
      atMs: Math.round(((e.ts ?? start) - start) / 1000),
      score: e.args.data.weighted_score_delta ?? e.args.data.score ?? 0,
      input: e.args.data.had_recent_input === true,
      nodes: (e.args.data.impacted_nodes ?? []).map((n) => ({ from: n.old_rect, to: n.new_rect })),
    }));
}

/**
 * Compares one summary with the budgets. Returns one entry per breach: `id` names the budget, `message` is the human-readable line, and
 * `sampled` says whether the number varies from run to run (scores and timings) or is fixed by the build (third-party requests, JavaScript bytes).
 */
export function checkBudgets(summary, config) {
  const failures = [];
  for (const [category, min] of Object.entries(config.scores)) {
    const score = summary.scores[category];
    if (score === null || score < min) failures.push({ id: category, sampled: true, message: `${category} score ${score === null ? 'missing' : Math.round(score * 100)} is below ${Math.round(min * 100)}` });
  }
  if (summary.lcpMs === null || summary.lcpMs >= config.metrics.lcpMs) failures.push({ id: 'lcp', sampled: true, message: `LCP ${summary.lcpMs === null ? 'missing' : `${Math.round(summary.lcpMs)} ms`} is not under ${config.metrics.lcpMs} ms` });
  if (summary.cls === null || summary.cls >= config.metrics.cls) failures.push({ id: 'cls', sampled: true, message: `CLS ${summary.cls ?? 'missing'} is not under ${config.metrics.cls}` });
  if (summary.tbtMs === null || summary.tbtMs >= config.metrics.tbtMs) failures.push({ id: 'tbt', sampled: true, message: `TBT ${summary.tbtMs === null ? 'missing' : `${Math.round(summary.tbtMs)} ms`} is not under ${config.metrics.tbtMs} ms` });
  if (summary.thirdParty.length > 0) failures.push({ id: 'third-party', sampled: false, message: `third-party requests: ${summary.thirdParty.slice(0, 3).join(', ')}` });
  const exempt = config.javascript.exemptPrefixes.some((p) => summary.route.startsWith(p));
  if (!exempt && summary.scriptBytes > config.javascript.maxGzipBytes) failures.push({ id: 'javascript', sampled: false, message: `JavaScript transfer ${summary.scriptBytes} bytes exceeds ${config.javascript.maxGzipBytes}` });
  return failures;
}

/** Compares one summary with the budgets. Returns a list of human-readable failures (empty when within budget). */
export function evaluate(summary, config) {
  return checkBudgets(summary, config).map((f) => f.message);
}

/**
 * The best of a list of numbers: the smallest (`'min'`) or the largest (`'max'`) of those that are present, or null when none is. A run
 * that produced no number (null) says nothing about the page; the other runs still can.
 */
export function best(values, direction) {
  const present = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (present.length === 0) return null;
  return direction === 'min' ? Math.min(...present) : Math.max(...present);
}

/**
 * The run with the lowest total blocking time, the run that saw the least contention. Fields a summary cannot combine (the network
 * profile, the trace the LHR file holds) come from it.
 */
export function bestRun(runs) {
  if (runs.length === 0) throw new Error('bestRun needs at least one run');
  return runs.reduce((a, b) => ((b.tbtMs ?? Infinity) < (a.tbtMs ?? Infinity) ? b : a));
}

/**
 * One summary for a route from several runs of it: the best value of each timing and score. Contention on a shared runner only ever adds
 * time (a page that costs 11 ms of blocking time reads 8814 ms when the CPU goes to a neighbouring job, and never the other way round), so
 * the least contended run is the closest to the page itself, and a real regression raises every run, the best included. The median this
 * replaces did not hold: on pipeline 66023 the contention lasted the whole measurement window and the raw blocking times were 830/0/990 and
 * 402/0/209 on pages with the same bytes. Each metric takes its own best, since each is disturbed on its own. Facts fixed by the build are
 * not sampled: any third-party request in any run counts, and the script transfer is the largest seen. The shifts shown for a CLS breach
 * come from the run with the lowest CLS.
 */
export function bestSummary(runs) {
  const lowestShift = runs.reduce((a, b) => ((b.cls ?? Infinity) < (a.cls ?? Infinity) ? b : a));
  return {
    ...bestRun(runs),
    scores: Object.fromEntries(CATEGORIES.map((c) => [c, best(runs.map((r) => r.scores[c]), 'max')])),
    lcpMs: best(runs.map((r) => r.lcpMs), 'min'),
    cls: best(runs.map((r) => r.cls), 'min'),
    tbtMs: best(runs.map((r) => r.tbtMs), 'min'),
    shifts: lowestShift.shifts,
    scriptBytes: Math.max(...runs.map((r) => r.scriptBytes)),
    thirdParty: [...new Set(runs.flatMap((r) => r.thirdParty))],
  };
}

/**
 * Whether the route still needs a run: it does while the best of the runs so far breaches a sampled budget and fewer than `maxRuns` have
 * been made. A route that is within budget in its first run is done (a later run could only match or improve it), and a route that
 * breaches in all `maxRuns` runs fails. Breaches that are fixed by the build (third-party requests, script weight) are the same in every
 * run, so they never earn another run.
 */
export function needsAnotherRun(runs, config, maxRuns) {
  if (runs.length >= maxRuns) return false;
  return checkBudgets(bestSummary(runs), config).some((f) => f.sampled);
}

/**
 * Runs every route up to `maxRuns` times, in rounds over all routes, and returns a Map of route to its run summaries. `runOnce(route)`
 * measures a route once and returns its summary; `onRun(round, summary)` is told about each run as it finishes.
 *
 * Rounds, not all runs of one route back to back: a stall on the shared runner lasts tens of seconds, so back-to-back runs of one route
 * catch the same stall, while runs a whole round apart almost never do. The first round measures every route; each later round measures
 * only the routes that still breach (`needsAnotherRun`), so a page that is within budget costs one run.
 */
export async function measureRoutes(routes, runOnce, config, maxRuns, onRun = () => {}) {
  const measured = new Map(routes.map((route) => [route, []]));
  let pending = routes;
  for (let round = 1; pending.length > 0 && round <= maxRuns; round += 1) {
    for (const route of pending) {
      const summary = await runOnce(route);
      measured.get(route).push(summary);
      onRun(round, summary);
    }
    pending = pending.filter((route) => needsAnotherRun(measured.get(route), config, maxRuns));
  }
  return measured;
}

/** The verdict for a route: the best summary of its runs and the budgets that summary breaches. */
export function judge(runs, config) {
  const summary = bestSummary(runs);
  return { summary, failures: evaluate(summary, config) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', out: 'reports/lighthouse', config: 'lighthouserc.json' });
  const config = JSON.parse(readFileSync(args.config, 'utf8'));
  const built = builtRoutes(args.dist);
  const { routes, missing, overflow } = planRoutes(config.candidates, built, config.maxRoutes);
  if (routes.length === 0) throw new Error('None of the Lighthouse candidate routes exist in dist.');
  // A candidate that is not in the build yet is skipped, not failed: a package's routes arrive with its own merge request. Say so.
  if (missing.length > 0) console.log(`skipped, not in this build: ${missing.join(' ')}`);
  if (overflow.length > 0) console.log(`not measured, over maxRoutes ${config.maxRoutes}: ${overflow.join(' ')}`);
  console.log(`measuring ${routes.length} routes, up to ${config.runs ?? 3} runs each`);
  mkdirSync(args.out, { recursive: true });

  const { createStaticServer, listen } = await import('./lib/serve.mjs');
  const options = {};
  const live = createStaticServer(args.dist, options);
  const port = await listen(live, 0);
  const origin = `http://127.0.0.1:${port}`;
  options.rewriteOrigin = origin;

  const { chromium } = await import('@playwright/test');
  const debugPort = 9222;
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${debugPort}`, '--no-sandbox'] });
  const { default: lighthouse } = await import('lighthouse');
  const results = [];
  let failed = 0;
  const maxRuns = config.runs ?? 3;
  /** What the noise looked like, for the log: the blocking time of each run of a route, in the order they ran. */
  const spread = (runs) => runs.map((r) => (r.tbtMs === null ? 'n/a' : Math.round(r.tbtMs))).join('/');
  /** The benchmark index of each run, in the same order. Lighthouse measures it once as a run starts, so a low one marks a run that began on a starved CPU. */
  const benchmarks = (runs) => runs.map((r) => (r.benchmarkIndex === null ? 'n/a' : Math.round(r.benchmarkIndex))).join('/');
  try {
    const lhrOf = new Map();
    const measured = await measureRoutes(
      routes,
      async (route) => {
        const run = await lighthouse(`${origin}${route}`, { port: debugPort, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES, formFactor: config.formFactor });
        if (run === undefined) throw new Error(`Lighthouse returned no result for ${route}`);
        const summary = summarise(route, run.lhr, origin);
        const events = run.artifacts?.Trace?.traceEvents ?? run.artifacts?.traces?.defaultPass?.traceEvents ?? [];
        summary.shifts = layoutShifts(events);
        summary.traceEvents = events.length;
        summary.network = networkProfile(run.lhr);
        summary.benchmarkIndex = run.lhr.environment?.benchmarkIndex ?? null;
        lhrOf.set(summary, `${JSON.stringify(run.lhr)}\n`);
        return summary;
      },
      config,
      maxRuns,
      (round, summary) => console.log(`run ${round}/${maxRuns}  ${summary.route}  perf ${Math.round((summary.scores.performance ?? 0) * 100)}  TBT ${Math.round(summary.tbtMs ?? 0)}ms  benchmark ${summary.benchmarkIndex === null ? 'n/a' : Math.round(summary.benchmarkIndex)}`),
    );

    for (const route of routes) {
      const runs = measured.get(route);
      const { summary, failures } = judge(runs, config);
      writeFileSync(join(args.out, `${route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '_')}.json`), lhrOf.get(bestRun(runs)));
      results.push({
        ...summary,
        runs: runs.map((r) => ({ tbtMs: r.tbtMs, lcpMs: r.lcpMs, cls: r.cls, performance: r.scores.performance, benchmarkIndex: r.benchmarkIndex, failures: evaluate(r, config) })),
        failures,
      });
      const line = `${route}  perf ${Math.round((summary.scores.performance ?? 0) * 100)}  a11y ${Math.round((summary.scores.accessibility ?? 0) * 100)}  bp ${Math.round((summary.scores['best-practices'] ?? 0) * 100)}  seo ${Math.round((summary.scores.seo ?? 0) * 100)}  LCP ${Math.round(summary.lcpMs ?? 0)}ms  CLS ${(summary.cls ?? 0).toFixed(3)}  TBT ${Math.round(summary.tbtMs ?? 0)}ms  JS ${summary.scriptBytes}B  (best of ${runs.length}, TBT ${spread(runs)}, benchmark ${benchmarks(runs)})`;
      if (failures.length === 0) console.log(`ok    ${line}`);
      else {
        failed += 1;
        console.error(`FAIL  ${line}`);
        for (const f of failures) console.error(`        ${f}`);
        if (failures.some((f) => f.startsWith('CLS'))) {
          for (const shift of summary.shifts.slice(0, 6)) {
            console.error(`        shift ${shift.score.toFixed(3)} at ${shift.atMs} ms${shift.input ? ' (recent input flag)' : ''}: ${shift.nodes.slice(0, 4).map((n) => `${JSON.stringify(n.from)} -> ${JSON.stringify(n.to)}`).join('; ')}`);
          }
          if (summary.shifts.length === 0) console.error(`        no LayoutShift events in the trace (${summary.traceEvents} trace events)`);
        }
      }
    }
  } finally {
    await browser.close();
    live.close();
  }
  writeFileSync(join(args.out, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`);
  const table = networkReport(results);
  writeFileSync(join(args.out, 'network.md'), table);
  console.log(`\n${table}`);
  console.log(`run-lighthouse: ${results.length} routes, ${failed} over budget`);
  process.exit(failed === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`run-lighthouse: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exit(2);
  });
}
