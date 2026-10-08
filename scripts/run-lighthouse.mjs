#!/usr/bin/env node
// Runs Lighthouse (mobile, simulated throttling) on up to eight representative routes of the built site and checks the
// budgets in lighthouserc.json (SAGE-PLAN 6.9). The site is served by scripts/lib/serve.mjs with its production origin
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

/** Compares one summary with the budgets. Returns a list of human-readable failures (empty when within budget). */
export function evaluate(summary, config) {
  const failures = [];
  for (const [category, min] of Object.entries(config.scores)) {
    const score = summary.scores[category];
    if (score === null || score < min) failures.push(`${category} score ${score === null ? 'missing' : Math.round(score * 100)} is below ${Math.round(min * 100)}`);
  }
  if (summary.lcpMs === null || summary.lcpMs >= config.metrics.lcpMs) failures.push(`LCP ${summary.lcpMs === null ? 'missing' : `${Math.round(summary.lcpMs)} ms`} is not under ${config.metrics.lcpMs} ms`);
  if (summary.cls === null || summary.cls >= config.metrics.cls) failures.push(`CLS ${summary.cls ?? 'missing'} is not under ${config.metrics.cls}`);
  if (summary.tbtMs === null || summary.tbtMs >= config.metrics.tbtMs) failures.push(`TBT ${summary.tbtMs === null ? 'missing' : `${Math.round(summary.tbtMs)} ms`} is not under ${config.metrics.tbtMs} ms`);
  if (summary.thirdParty.length > 0) failures.push(`third-party requests: ${summary.thirdParty.slice(0, 3).join(', ')}`);
  const exempt = config.javascript.exemptPrefixes.some((p) => summary.route.startsWith(p));
  if (!exempt && summary.scriptBytes > config.javascript.maxGzipBytes) failures.push(`JavaScript transfer ${summary.scriptBytes} bytes exceeds ${config.javascript.maxGzipBytes}`);
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', out: 'reports/lighthouse', config: 'lighthouserc.json' });
  const config = JSON.parse(readFileSync(args.config, 'utf8'));
  const built = builtRoutes(args.dist);
  const routes = pickRoutes(config.candidates, built, config.maxRoutes);
  if (routes.length === 0) throw new Error('None of the Lighthouse candidate routes exist in dist.');
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
  try {
    for (const route of routes) {
      let summary = null;
      let failures = [];
      for (let attempt = 0; attempt <= (config.retries ?? 0); attempt += 1) {
        const run = await lighthouse(`${origin}${route}`, { port: debugPort, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES, formFactor: config.formFactor });
        if (run === undefined) throw new Error(`Lighthouse returned no result for ${route}`);
        summary = summarise(route, run.lhr, origin);
        failures = evaluate(summary, config);
        const events = run.artifacts?.Trace?.traceEvents ?? run.artifacts?.traces?.defaultPass?.traceEvents ?? [];
        summary.shifts = layoutShifts(events);
        summary.traceEvents = events.length;
        summary.network = networkProfile(run.lhr);
        writeFileSync(join(args.out, `${route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '_')}.json`), `${JSON.stringify(run.lhr)}\n`);
        if (failures.length === 0) break;
      }
      results.push({ ...summary, failures });
      const line = `${route}  perf ${Math.round((summary.scores.performance ?? 0) * 100)}  a11y ${Math.round((summary.scores.accessibility ?? 0) * 100)}  bp ${Math.round((summary.scores['best-practices'] ?? 0) * 100)}  seo ${Math.round((summary.scores.seo ?? 0) * 100)}  LCP ${Math.round(summary.lcpMs ?? 0)}ms  CLS ${(summary.cls ?? 0).toFixed(3)}  TBT ${Math.round(summary.tbtMs ?? 0)}ms  JS ${summary.scriptBytes}B`;
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
