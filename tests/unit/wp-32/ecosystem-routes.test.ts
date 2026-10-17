import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DYNAMIC_FIXED, computeRouteState, fileToRoute, routeExists } from '../../../src/lib/route-core.ts';
import type { PageFileRoute, RouteContext } from '../../../src/lib/route-core.ts';
import { CATEGORY_IDS } from '../../../src/data/ecosystem/types.ts';
import { routes } from '../../../src/data/routes.ts';

// The ecosystem directory (WP-33) emits one page per category from CATEGORY_IDS. Route existence reads the same list through
// DYNAMIC_FIXED, so isLive() and the CTA bands see every category page the build emits, and nothing else under /ecosystem/.
const PAGE = '/src/pages/ecosystem/[category].astro';

function ctx(files: string[]): RouteContext {
  const pageRoutes = files.map((f) => fileToRoute(f)).filter((r): r is PageFileRoute => r !== null);
  return { pageRoutes, entryIds: {} };
}

test('the category pattern takes its parameters from CATEGORY_IDS itself', () => {
  assert.equal(DYNAMIC_FIXED['/ecosystem/[category]/'], CATEGORY_IDS);
  assert.match(readFileSync(new URL('../../../src/pages/ecosystem/[category].astro', import.meta.url), 'utf8'), /CATEGORY_IDS\.map\(/, 'the page emits the same list');
});

test('every category page exists with the page file, and no other path under /ecosystem/ does', () => {
  for (const id of CATEGORY_IDS) {
    assert.equal(routeExists(`/ecosystem/${id}/`, ctx([PAGE])), true, `/ecosystem/${id}/`);
    assert.equal(routeExists(`/ecosystem/${id}/`, ctx([])), false, `/ecosystem/${id}/ needs the page file`);
  }
  assert.equal(routeExists('/ecosystem/accelerators/', ctx([PAGE])), false, 'a retired or unknown slug is not live');
  assert.equal(routeExists('/ecosystem/incubators/extra/', ctx([PAGE])), false);
});

test('the launched category rows of the ledger are live once the page file exists', () => {
  const rows = routes.filter((r) => r.launch && /^\/ecosystem\/[^/]+\/$/.test(r.path));
  assert.ok(rows.length >= CATEGORY_IDS.length, 'the ledger lists the category pages');
  // computeRouteState also checks the machine routes (robots.txt, rss.xml), which this context has no files for; only /ecosystem/ counts.
  const state = computeRouteState(ctx([PAGE]), rows);
  assert.deepEqual(state.missing.filter((path) => path.startsWith('/ecosystem/')), []);
  for (const r of rows) assert.ok(state.isLive(r.path), `${r.path} is live`);
});
