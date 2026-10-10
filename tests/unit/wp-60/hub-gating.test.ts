import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPARISONS, FAMILIES, INDUSTRIES, JOURNEY } from '../../../src/data/families.ts';
import { routes } from '../../../src/data/routes.ts';
import { computeRouteState, fileToRoute, routeExists } from '../../../src/lib/route-core.ts';
import type { PageFileRoute, RouteContext } from '../../../src/lib/route-core.ts';

/**
 * A hub of a page family is live only when its `<folder>/index` entry exists in the `pages` collection (WP-60 60a.1, item 4). A static
 * `index.astro` alone must not publish an empty hub on fallback copy. Nav, sitemap, search and the site map read `computeRouteState().live`,
 * so a hub that is not live there is not linked from any of them.
 */
function ctx(files: readonly string[], pages: readonly string[] = []): RouteContext {
  const pageRoutes = files.map((f) => fileToRoute(f)).filter((r): r is PageFileRoute => r !== null);
  return { pageRoutes, entryIds: { pages: new Set(pages) } };
}

const PAGES_FAMILIES = FAMILIES.filter((f) => f.collection === 'pages' && f.hub !== undefined);

test('the wave 8 hubs in the registry are the industries, compare and journey hubs', () => {
  assert.deepEqual(PAGES_FAMILIES.map((f) => f.hub?.path), ['/industries/', '/compare/', '/journey/']);
  assert.deepEqual([INDUSTRIES.folder, COMPARISONS.folder, JOURNEY.folder], ['industries', 'compare', 'journey']);
});

for (const family of PAGES_FAMILIES) {
  const hub = family.hub?.path ?? '';
  const files = [`/src/pages/${family.folder}/index.astro`];

  test(`${hub} is not live from a static index page alone`, () => {
    assert.equal(routeExists(hub, ctx(files)), false);
    assert.equal(routeExists(hub, ctx(files, ['program/index'])), false, 'another family index does not stand in');
  });

  test(`${hub} is not live from an entry alone, because the page file is still needed`, () => {
    assert.equal(routeExists(hub, ctx([], [`${family.folder}/index`])), false);
  });

  test(`${hub} is live with its page file and its ${family.folder}/index entry`, () => {
    assert.equal(routeExists(hub, ctx(files, [`${family.folder}/index`])), true);
  });

  test(`${hub} is pending in the route state until the entry exists, so nav and the sitemap never see it`, () => {
    const without = computeRouteState(ctx(files), routes);
    assert.equal(without.isLive(hub), false);
    assert.ok(without.missing.includes(hub), `${hub} is reported as pending`);
    const withEntry = computeRouteState(ctx(files, [`${family.folder}/index`]), routes);
    assert.equal(withEntry.isLive(hub), true);
    assert.ok(!withEntry.missing.includes(hub));
  });
}

// WP-71 serves a hub and its entries from one rest page, `src/pages/<folder>/[...hub].astro`, whose hub root has an empty parameter.
for (const family of PAGES_FAMILIES) {
  const hub = family.hub?.path ?? '';
  const rest = [`/src/pages/${family.folder}/[...hub].astro`];

  test(`${hub} from a [...hub] page is live with its ${family.folder}/index entry and pending without it`, () => {
    assert.equal(routeExists(hub, ctx(rest, [`${family.folder}/index`])), true);
    assert.equal(routeExists(hub, ctx(rest)), false);
    assert.equal(routeExists(hub, ctx(rest, [`${family.folder}/other`])), false);
  });

  test(`${hub} from a [...hub] page: an entry page is live with its own entry, and the hub entry alone does not make it live`, () => {
    const slug = family.entries[0]?.slug ?? 'x';
    assert.equal(routeExists(`${hub}${slug}/`, ctx(rest, [`${family.folder}/index`, `${family.folder}/${slug}`])), true);
    assert.equal(routeExists(`${hub}${slug}/`, ctx(rest, [`${family.folder}/index`])), false);
  });

  test(`${hub} from a [...hub] page is pending in the route state until the entry exists`, () => {
    assert.equal(computeRouteState(ctx(rest), routes).isLive(hub), false);
    assert.equal(computeRouteState(ctx(rest, [`${family.folder}/index`]), routes).isLive(hub), true);
  });
}

test('a rest route outside a hub family still resolves its root from the folder index entry', () => {
  const files = ['/src/pages/about/[...slug].astro'];
  assert.equal(routeExists('/about/', ctx(files, ['about/index'])), true);
  assert.equal(routeExists('/about/', ctx(files)), false);
});

test('an entry of the family does not make the hub live', () => {
  const files = ['/src/pages/industries/index.astro', '/src/pages/industries/[slug].astro'];
  assert.equal(routeExists('/industries/', ctx(files, ['industries/fintech'])), false);
});

test('the gate does not touch the program hub, whose index entry is the existing precedent', () => {
  assert.equal(routeExists('/program/', ctx(['/src/pages/program/index.astro'])), true);
});
