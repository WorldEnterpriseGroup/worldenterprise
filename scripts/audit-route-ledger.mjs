#!/usr/bin/env node
// Compares the built site with the route ledger (SAGE-PLAN 3.2, 5.6, 8.1).
//   error: a built page the ledger does not list; a launch:false route that was built; a robots meta that disagrees with the
//          ledger's `indexable`; a launched machine file that the build should always produce and did not.
//   pending (warning): a launch:true route that does not exist yet. With --strict (the release build) pending is an error,
//          and development routes (styleguide, fixtures) are errors too.
// Usage: node scripts/audit-route-ledger.mjs [--dist dist] [--ledger reports/ledger.json] [--strict] [--json reports/ledger-audit.json]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDevRoute, metaContent, parseArgs, readPages, report } from './lib/html.mjs';
import { classify, loadLedger } from './lib/ledger.mjs';

/** Machine routes whose absence is an error even outside strict mode, because nothing else produces them. */
const ALWAYS_PRESENT = new Set(['public', 'postbuild', 'integration']);

function machineFile(path) {
  if (path.endsWith('/')) return join(path, 'pagefind.js');
  return path;
}

export function auditLedger({ distDir, ledger, pages, strict = false, fileExists = (rel) => existsSync(join(distDir, rel)) }) {
  const findings = [];
  const built = new Set(pages.map((p) => p.route));
  const { live, pending, leaked, unledgered } = classify(ledger, built);

  for (const route of unledgered) {
    findings.push({ level: 'error', where: route, message: 'page is built but is not in the route ledger (src/data/routes.ts)' });
  }
  for (const row of leaked) {
    findings.push({ level: 'error', where: row.path, message: `route is built but the ledger marks it launch:false${row.reason ? ` (${row.reason})` : ''}` });
  }
  for (const row of pending) {
    findings.push({ level: strict ? 'error' : 'warn', where: row.path, message: `launched route does not exist yet (owner ${row.owner}, pending)` });
  }
  if (strict) {
    for (const route of built) {
      if (isDevRoute(route)) findings.push({ level: 'error', where: route, message: 'development route present in a release build' });
    }
  }

  const byRoute = new Map(pages.map((p) => [p.route, p]));
  for (const row of live) {
    const page = byRoute.get(row.path);
    if (page === undefined) continue;
    const robots = (metaContent(page.html, 'robots') ?? '').toLowerCase();
    const noindex = robots.includes('noindex');
    if (!row.indexable && !noindex) {
      findings.push({ level: 'error', where: row.path, message: 'ledger says indexable:false but the page has no noindex robots meta' });
    }
    if (row.indexable && noindex) {
      findings.push({ level: 'error', where: row.path, message: 'ledger says indexable:true but the page carries noindex (draft content or a layout bug)' });
    }
  }

  for (const m of ledger.machine) {
    const rel = machineFile(m.path).replace(/^\//, '');
    const present = fileExists(rel);
    if (m.launch && !present) {
      const must = ALWAYS_PRESENT.has(m.generated);
      findings.push({ level: must || strict ? 'error' : 'warn', where: m.path, message: must ? 'launched machine file is missing from dist' : 'launched machine route does not exist yet (pending)' });
    }
    if (!m.launch && present) {
      findings.push({ level: 'error', where: m.path, message: 'machine file is built but the ledger marks it launch:false' });
    }
  }

  return { findings, summary: { built: built.size, live: live.length, pending: pending.map((r) => r.path), leaked: leaked.map((r) => r.path), unledgered } };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', ledger: 'reports/ledger.json', json: 'reports/ledger-audit.json' });
  try {
    const ledger = loadLedger(args.ledger);
    const pages = readPages(args.dist);
    const result = auditLedger({ distDir: args.dist, ledger, pages, strict: args.strict === true });
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, `${JSON.stringify(result.summary, null, 2)}\n`);
    process.exit(report('audit-route-ledger', result.findings, `${result.summary.live} live of ${ledger.routes.filter((r) => r.launch).length} launched, ${result.summary.pending.length} pending`));
  } catch (error) {
    console.error(`audit-route-ledger: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
