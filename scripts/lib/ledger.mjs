// Ledger-aware route classification shared by the audits. Pure functions plus one file loader.
import { existsSync, readFileSync } from 'node:fs';
import { isDevRoute, readPages } from './html.mjs';

/** Loads reports/ledger.json written by export-ledger.mjs. Throws with an actionable message when absent or malformed. */
export function loadLedger(path = 'reports/ledger.json') {
  if (!existsSync(path)) {
    throw new Error(`Route ledger export not found at ${path}. Run: node scripts/lib/export-ledger.mjs ${path}`);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Route ledger export at ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(data.routes) || !Array.isArray(data.machine)) {
    throw new Error(`Route ledger export at ${path} has no routes or machine arrays.`);
  }
  return data;
}

/**
 * Classifies routes. `built` is the set of routes found in dist.
 *  live:     launch:true and built
 *  pending:  launch:true and not built yet (skipped by the test suites, an error only in strict mode)
 *  leaked:   launch:false and built (an L2 or flag-gated route that shipped)
 *  unledgered: built, not in the ledger, and not a development route
 */
export function classify(ledger, built) {
  const rows = new Map(ledger.routes.map((r) => [r.path, r]));
  const live = [];
  const pending = [];
  const leaked = [];
  for (const row of ledger.routes) {
    if (row.launch && built.has(row.path)) live.push(row);
    else if (row.launch) pending.push(row);
    else if (built.has(row.path)) leaked.push(row);
  }
  const unledgered = [...built].filter((p) => !rows.has(p) && !isDevRoute(p)).sort();
  return { live, pending, leaked, unledgered, rows };
}

/** Routes present in dist, from the built pages. */
export function builtRoutes(distDir) {
  return new Set(readPages(distDir).map((p) => p.route));
}
