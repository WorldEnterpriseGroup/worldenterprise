import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESKS, finalizeRow, INSIGHT_SLUGS, L2_RESERVED, LIBRARY_SLUGS, MACHINE_ROUTES, RESEARCH_SLUGS, routes } from '../../../src/data/routes.ts';

test('the ledger has exactly 99 unique rows', () => {
  assert.equal(routes.length, 99);
  assert.equal(new Set(routes.map((r) => r.path)).size, 99);
});

test('95 rows are indexable; the four noindex routes are named', () => {
  const noindex = routes.filter((r) => !r.indexable).map((r) => r.path).sort();
  assert.deepEqual(noindex, ['/404.html', '/apply/thanks/', '/search/', '/sitemap/']);
  assert.equal(routes.filter((r) => r.indexable).length, 95);
});

test('section counts match SAGE-PLAN 5.6', () => {
  const count = (prefix: string): number => routes.filter((r) => r.path.startsWith(prefix)).length;
  assert.equal(count('/program/'), 9);
  assert.equal(count('/services/'), 8);
  assert.equal(count('/playbooks/'), 6);
  assert.equal(count('/fundability/'), 5);
  assert.equal(count('/insights/'), 23);
  assert.equal(count('/research/'), 5);
  assert.equal(count('/library/'), 7);
  assert.equal(count('/about/'), 8);
  assert.equal(INSIGHT_SLUGS.length, 18);
  assert.equal(DESKS.length, 4);
  assert.equal(RESEARCH_SLUGS.length, 4);
  assert.equal(LIBRARY_SLUGS.length, 6);
});

test('paths are site-relative with a trailing slash, except file routes', () => {
  for (const r of routes) {
    assert.match(r.path, /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*\/|404\.html)?$/, r.path);
  }
});

test('a row with requires and no source is forced to launch:false', () => {
  const forced = finalizeRow({ path: '/x/', layout: 'HubLayout', owner: 'WP-01', requires: ['people'], launch: true });
  assert.equal(forced.launch, false);
  const sourced = finalizeRow({ path: '/x/', layout: 'HubLayout', owner: 'WP-01', requires: ['people'], source: 'consent form 2026-01-01' });
  assert.equal(sourced.launch, true);
});

test('every L2 row is unlaunched and absent from the launch ledger', () => {
  const ledgerPaths = new Set(routes.map((r) => r.path));
  for (const r of L2_RESERVED) {
    assert.equal(r.launch, false, r.path);
    assert.equal(ledgerPaths.has(r.path), false, r.path);
  }
});

test('newsletter and terms rows derive launch from forms and flags (both off by default)', () => {
  assert.equal(routes.find((r) => r.path === '/newsletter/')?.launch, false);
  assert.equal(routes.find((r) => r.path === '/legal/terms/')?.launch, false);
});

test('security.txt launches only with a confirmed security contact', () => {
  assert.equal(MACHINE_ROUTES.find((m) => m.path === '/.well-known/security.txt')?.launch, false);
});
