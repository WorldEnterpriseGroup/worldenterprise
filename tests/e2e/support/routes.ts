import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Route discovery for the suites. The ledger export (reports/ledger.json, written by scripts/lib/export-ledger.mjs) says which routes
// are launched; dist/ says which of them exist yet. A launched route that has not been built is pending and its tests skip, so the suites
// stay green while work packages merge one by one. verify:release and audit-route-ledger --strict turn pending into a failure.

export interface LedgerRoute {
  readonly path: string;
  readonly launch: boolean;
  readonly indexable: boolean;
  readonly layout: string;
  readonly owner: string;
}
interface LedgerFile {
  readonly routes: readonly LedgerRoute[];
}

const DIST = process.env.E2E_DIST ?? 'dist';

export function fileFor(route: string): string {
  if (route.endsWith('.html')) return join(DIST, route);
  return join(DIST, route, 'index.html');
}

export function isBuilt(route: string): boolean {
  return existsSync(fileFor(route));
}

function readLedger(): readonly LedgerRoute[] {
  const path = process.env.E2E_LEDGER ?? 'reports/ledger.json';
  if (!existsSync(path)) {
    throw new Error(`Route ledger export not found at ${path}. The e2e jobs need verify:static artifacts (node scripts/lib/export-ledger.mjs).`);
  }
  const data = JSON.parse(readFileSync(path, 'utf8')) as LedgerFile;
  return data.routes;
}

const ledger = readLedger();

/** Launched, built, non-404 page routes. */
export const liveRoutes: readonly LedgerRoute[] = ledger.filter((r) => r.launch && r.path.endsWith('/') && isBuilt(r.path));
export const pendingRoutes: readonly LedgerRoute[] = ledger.filter((r) => r.launch && r.path.endsWith('/') && !isBuilt(r.path));
export const liveIndexable: readonly LedgerRoute[] = liveRoutes.filter((r) => r.indexable);

/** Origins a page may contact. Everything else is a third-party request and fails the suite. */
export function isFirstParty(url: string, baseURL: string): boolean {
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return true;
  return new URL(url).origin === new URL(baseURL).origin;
}
