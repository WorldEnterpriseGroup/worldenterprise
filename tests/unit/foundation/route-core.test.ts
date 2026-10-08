import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeRouteState, entryRouteIds, fileToRoute, matchDynamic, routeExists } from '../../../src/lib/route-core.ts';
import type { PageFileRoute, RouteContext } from '../../../src/lib/route-core.ts';

function ctx(files: string[], entryIds: Record<string, string[]> = {}): RouteContext {
  const pageRoutes = files.map((f) => fileToRoute(f)).filter((r): r is PageFileRoute => r !== null);
  return { pageRoutes, entryIds: Object.fromEntries(Object.entries(entryIds).map(([k, v]) => [k, new Set(v)])) };
}

test('fileToRoute converts page files to route patterns', () => {
  assert.deepEqual(fileToRoute('/src/pages/index.astro'), { pattern: '/', dynamic: false });
  assert.deepEqual(fileToRoute('/src/pages/program/index.astro'), { pattern: '/program/', dynamic: false });
  assert.deepEqual(fileToRoute('/src/pages/pricing.astro'), { pattern: '/pricing/', dynamic: false });
  assert.deepEqual(fileToRoute('/src/pages/insights/[slug].astro'), { pattern: '/insights/[slug]/', dynamic: true });
  assert.deepEqual(fileToRoute('/src/pages/404.astro'), { pattern: '/404.html', dynamic: false });
  assert.deepEqual(fileToRoute('/src/pages/rss.xml.ts'), { pattern: '/rss.xml', dynamic: false });
  assert.equal(fileToRoute('/src/pages/_draft.astro'), null);
});

test('matchDynamic extracts parameters', () => {
  assert.deepEqual(matchDynamic('/insights/[slug]/', '/insights/hello/'), { slug: 'hello' });
  assert.equal(matchDynamic('/insights/[slug]/', '/insights/hello/more/'), null);
  assert.equal(matchDynamic('/insights/[slug]/', '/research/hello/'), null);
  assert.deepEqual(matchDynamic('/docs/[...rest]/', '/docs/a/b/'), { rest: 'a/b' });
});

test('an optional rest segment matches zero remaining parts', () => {
  assert.deepEqual(matchDynamic('/docs/[...rest]/', '/docs/'), { rest: '' });
  assert.equal(matchDynamic('/docs/[...rest]/', '/'), null);
  assert.equal(matchDynamic('/docs/[...rest]/', '/other/'), null);
});

test('/newsletter/ exists with the rest-segment page file, and deeper paths do not', () => {
  const files = ['/src/pages/newsletter/[...slug].astro'];
  assert.equal(routeExists('/newsletter/', ctx(files)), true);
  assert.equal(routeExists('/newsletter/archive/', ctx(files)), false);
  assert.equal(routeExists('/newsletter/', ctx([])), false);
});

test('insight entries in desk folders are routed by their last id segment', () => {
  assert.deepEqual(entryRouteIds('insights', 'dream/first-idea'), ['dream/first-idea', 'first-idea']);
  assert.deepEqual(entryRouteIds('insights', 'flat'), ['flat']);
  assert.deepEqual(entryRouteIds('research', 'a/b'), ['a/b']);
  const files = ['/src/pages/insights/[slug].astro'];
  const ids = entryRouteIds('insights', 'dream/first-idea');
  assert.equal(routeExists('/insights/first-idea/', ctx(files, { insights: [...ids] })), true);
  assert.equal(routeExists('/insights/dream/', ctx(files, { insights: [...ids] })), false);
});

test('static pages exist when a page file exists', () => {
  const c = ctx(['/src/pages/index.astro', '/src/pages/program/index.astro']);
  assert.equal(routeExists('/', c), true);
  assert.equal(routeExists('/program/', c), true);
  assert.equal(routeExists('/pricing/', c), false);
});

test('dynamic pages need both the page file and a published entry', () => {
  const files = ['/src/pages/insights/[slug].astro'];
  assert.equal(routeExists('/insights/a/', ctx(files, { insights: ['a'] })), true);
  assert.equal(routeExists('/insights/b/', ctx(files, { insights: ['a'] })), false);
  assert.equal(routeExists('/insights/a/', ctx([], { insights: ['a'] })), false);
});

test('topic hubs exist for the four desks only', () => {
  const files = ['/src/pages/insights/topic/[topic].astro'];
  assert.equal(routeExists('/insights/topic/dream/', ctx(files)), true);
  assert.equal(routeExists('/insights/topic/finance/', ctx(files)), false);
});

test('an unmapped dynamic page falls back to a pages entry that mirrors the path', () => {
  const files = ['/src/pages/about/[slug].astro'];
  assert.equal(routeExists('/about/manifesto/', ctx(files, { pages: ['about/manifesto'] })), true);
  assert.equal(routeExists('/about/manifesto/', ctx(files, { pages: [] })), false);
});

test('computeRouteState reports launched routes that do not exist', () => {
  const state = computeRouteState(ctx(['/src/pages/index.astro']));
  assert.equal(state.isLive('/'), true);
  assert.equal(state.isLive('/program/'), false);
  assert.ok(state.missing.includes('/program/'));
  assert.equal(state.isLive('/favicon.svg'), true);
});
