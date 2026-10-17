import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { PAGE_TWINS } from '../../../src/components/geo/assemble.ts';
import { L2_RESERVED, routes } from '../../../src/data/routes.ts';
import { computeRouteState, fileToRoute } from '../../../src/lib/route-core.ts';
import type { PageFileRoute, RouteContext } from '../../../src/lib/route-core.ts';
import { KIT_PATH, KIT_SLUG, kitStaticPaths, paletteCopyText, parseBrandPalette, parseFontRoles } from '../../../src/pages/press/_kit-data.ts';
import { copyOrSelect } from '../../../src/scripts/brand-copy.ts';
import type { CopyEnvironment } from '../../../src/scripts/brand-copy.ts';

// WP-71: the brand kit stays behind its launch:false ledger row (OP-BRAND). This file pins the gate, follows the three leak paths
// (twins, llms, sitemaps), proves the press page link is fail-closed, and drives the kit data and the copy island.

const ROOT = new URL('../../../', import.meta.url);
const ROOT_PATH = ROOT.pathname;
const read = (path: string): string => readFileSync(new URL(path, ROOT), 'utf8');

function walk(dir: string): string[] {
  const abs = join(ROOT_PATH, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(ROOT_PATH, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

function context(files: string[], entryIds: Record<string, string[]>): RouteContext {
  const pageRoutes = files.map((f) => fileToRoute(f)).filter((r): r is PageFileRoute => r !== null);
  return { pageRoutes, entryIds: Object.fromEntries(Object.entries(entryIds).map(([key, ids]) => [key, new Set(ids)])) };
}

const kitRow = L2_RESERVED.find((row) => row.path === KIT_PATH);

test('the brand kit row is launch:false in L2_RESERVED, absent from the launch ledger, and waits for the brand-owner sign-off', () => {
  assert.ok(kitRow !== undefined, `${KIT_PATH} has no row in L2_RESERVED`);
  assert.equal(kitRow.launch, false, 'the kit row must stay launch:false until OP-BRAND is signed off');
  assert.match(kitRow.reason ?? '', /sign-off/);
  assert.ok(!routes.some((row) => row.path === KIT_PATH), 'the kit row is not in the launch ledger; moving it there with launch:true is the release step');
});

test('no page is built for the kit until its row is launched in the live ledger', () => {
  assert.deepEqual(kitStaticPaths(routes), []);
  assert.deepEqual(kitStaticPaths([]), []);
  assert.deepEqual(kitStaticPaths([{ path: KIT_PATH, launch: false }]), []);
  assert.deepEqual(kitStaticPaths([{ path: '/press/', launch: true }]), []);
  assert.deepEqual(kitStaticPaths([{ path: KIT_PATH, launch: true }]), [{ params: { kit: KIT_SLUG } }]);
  const page = read('src/pages/press/[kit].astro');
  assert.match(page, /export const getStaticPaths = \(\(\) => kitStaticPaths\(routes\)\) satisfies GetStaticPaths;/);
});

test('route state excludes the kit until its row is launched, even with the page file and the entry present', () => {
  const ctx = context(['/src/pages/press/[kit].astro'], { pages: ['press/brand-kit'] });
  assert.ok(kitRow !== undefined);
  const state = computeRouteState(ctx, routes);
  assert.equal(state.isLive(KIT_PATH), false);
  assert.ok(!state.missing.includes(KIT_PATH), 'an unlaunched row is neither live nor missing');
  const parked = computeRouteState(ctx, [kitRow]);
  assert.equal(parked.isLive(KIT_PATH), false, 'a launch:false row is never live');
  const released = computeRouteState(ctx, [{ ...kitRow, launch: true }]);
  assert.equal(released.isLive(KIT_PATH), true, 'a launched row with the page and the entry present is live');
  const withoutEntry = computeRouteState(context(['/src/pages/press/[kit].astro'], { pages: [] }), [{ ...kitRow, launch: true }]);
  assert.equal(withoutEntry.isLive(KIT_PATH), false, 'a launched row with no content entry is reported missing, not live');
});

test('leak path: the kit is in no twin, no llms list and no navigation or search source', () => {
  assert.ok(!PAGE_TWINS.some((twin) => twin.route === KIT_PATH || twin.id === 'press/brand-kit'), 'PAGE_TWINS lists the kit');
  const allowed = new Set([
    'src/data/routes.ts',
    'src/pages/press/_kit-data.ts',
    'src/pages/press/[kit].astro',
    'src/pages/press/index.astro',
    'src/content/pages/press/brand-kit.mdx',
  ]);
  const files = [...walk('src'), ...walk('scripts'), 'astro.config.mjs', 'public/robots.txt'].filter((file) => existsSync(join(ROOT_PATH, file)) && /\.(ts|mjs|astro|md|mdx|json|txt|yaml|yml|css)$/.test(file));
  const offenders = files.filter((file) => !allowed.has(relative('.', file)) && /brand-kit/.test(read(file)));
  assert.deepEqual(offenders, [], 'a file other than the allow-listed ones names the kit; check it cannot publish a link to it');
  for (const file of ['src/components/geo/llms-input.ts', 'src/components/geo/assemble.ts', 'src/data/nav.ts']) assert.doesNotMatch(read(file), /brand-kit/, file);
});

test('the sitemaps are built from built pages and ledger rows only, so an unbuilt launch:false row cannot appear', () => {
  const config = read('astro.config.mjs');
  assert.match(config, /sitemap\(/, 'the XML sitemap comes from @astrojs/sitemap, which lists built pages only');
  assert.doesNotMatch(config, /brand-kit/);
});

test('the press page links the kit only through the live route state (fail closed)', () => {
  const page = read('src/pages/press/index.astro');
  assert.match(page, /getRouteState\(\)\)\.isLive\('\/press\/brand-kit\/'\)/);
  const links = [...page.matchAll(/href\('\/press\/brand-kit\/'\)/g)];
  assert.equal(links.length, 1, 'one link to the kit');
  const linkAt = page.indexOf("href('/press/brand-kit/')");
  const guardAt = page.indexOf('kitLive &&');
  assert.ok(guardAt !== -1 && guardAt < linkAt, 'the link sits inside the kitLive guard');
  assert.equal([...page.matchAll(/brand-kit/g)].length, 2, 'the kit is named only by the route-state check and the guarded link');
});

test('the press page and the kit state the same boilerplate, from one module', () => {
  for (const file of ['src/pages/press/index.astro', 'src/pages/press/[kit].astro']) assert.match(read(file), /pressBoilerplate\(\)/, file);
  assert.doesNotMatch(read('src/pages/press/index.astro'), /digital incubator for SaaS\. Dedicated/, 'the boilerplate text lives in _boilerplate.ts only');
});

test('the kit palette and type roles are read from tokens.css, not retyped', () => {
  const css = read('src/styles/tokens.css');
  const swatches = parseBrandPalette(css);
  assert.ok(swatches.length >= 10, `expected the brand palette, found ${swatches.length}`);
  for (const swatch of swatches) {
    assert.match(swatch.token, /^--we-[a-z-]+$/);
    assert.match(swatch.hex, /^#[0-9A-F]{6}$/);
  }
  assert.equal(new Set(swatches.map((s) => s.token)).size, swatches.length, 'a token is listed twice');
  const link = swatches.find((s) => s.token === '--we-blue-deep');
  assert.ok(link?.usedAs.includes('--color-link'), 'the deep blue is the link color');
  const text = swatches.find((s) => s.token === '--we-charcoal');
  assert.ok(text?.usedAs.includes('--color-text'), 'charcoal is the text color');
  assert.deepEqual(parseFontRoles(css).map((f) => f.role), ['display', 'serif', 'sans', 'mono']);
  assert.ok(parseFontRoles(css).every((f) => f.family !== '' && f.token.startsWith('--ff-')));
  const lines = paletteCopyText(swatches).split('\n');
  assert.equal(lines.length, swatches.length);
  assert.match(lines[0] ?? '', /^--we-[a-z-]+ #[0-9A-F]{6}$/);
});

test('the kit data parsers fail loudly when the token file format changes', () => {
  assert.throws(() => parseBrandPalette('/* nothing here */'), /no brand colors found/);
  assert.throws(() => parseFontRoles('--ff-display: var(--font-display), \'Titillium Web\', sans-serif;'), /expected four type roles, found 1/);
});

interface Recorded {
  written: string[];
  selected: Node[];
  refused: unknown[];
}

function environment(options: { clipboard: 'ok' | 'refuse' | 'missing'; canSelect: boolean }): { env: CopyEnvironment; recorded: Recorded } {
  const recorded: Recorded = { written: [], selected: [], refused: [] };
  const clipboard =
    options.clipboard === 'missing'
      ? undefined
      : {
          writeText: async (text: string): Promise<void> => {
            if (options.clipboard === 'refuse') throw new Error('NotAllowedError');
            recorded.written.push(text);
          },
        };
  return {
    recorded,
    env: {
      clipboard,
      select(node: Node): boolean {
        recorded.selected.push(node);
        return options.canSelect;
      },
    },
  };
}

const node = {} as Node;

test('copyOrSelect copies through the clipboard when it can', async () => {
  const { env, recorded } = environment({ clipboard: 'ok', canSelect: true });
  assert.equal(await copyOrSelect('text', node, env, (error) => recorded.refused.push(error)), 'copied');
  assert.deepEqual(recorded.written, ['text']);
  assert.deepEqual(recorded.selected, []);
});

test('copyOrSelect reports a refused write, then selects the text', async () => {
  const { env, recorded } = environment({ clipboard: 'refuse', canSelect: true });
  assert.equal(await copyOrSelect('text', node, env, (error) => recorded.refused.push(error)), 'selected');
  assert.equal(recorded.refused.length, 1, 'the refusal is reported, not swallowed');
  assert.deepEqual(recorded.selected, [node]);
});

test('copyOrSelect selects the text where there is no clipboard API, and says so when nothing can be selected', async () => {
  const noApi = environment({ clipboard: 'missing', canSelect: true });
  assert.equal(await copyOrSelect('text', node, noApi.env, (error) => noApi.recorded.refused.push(error)), 'selected');
  assert.deepEqual(noApi.recorded.refused, []);
  const noSelect = environment({ clipboard: 'missing', canSelect: false });
  assert.equal(await copyOrSelect('text', node, noSelect.env, () => undefined), 'empty');
  assert.equal(await copyOrSelect('text', null, noSelect.env, () => undefined), 'empty');
});

test('copyOrSelect has nothing to copy for an empty string and touches nothing', async () => {
  const { env, recorded } = environment({ clipboard: 'ok', canSelect: true });
  assert.equal(await copyOrSelect('', node, env, () => undefined), 'empty');
  assert.deepEqual(recorded.written, []);
  assert.deepEqual(recorded.selected, []);
});

test('the copy island is progressive enhancement and stores and sends nothing', () => {
  const script = read('src/scripts/brand-copy.ts');
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon|gtag|analytics/i);
  const host = read('src/components/islands/we-brand-copy/WeBrandCopy.astro');
  assert.match(host, /data-copy-hint/, 'the no-JavaScript hint is in the markup');
  assert.match(host, /<slot\s*\/>/, 'the text is real page content in a slot, selectable without JavaScript');
  assert.match(host, /import '\.\.\/\.\.\/\.\.\/scripts\/brand-copy\.ts'/);
  const kit = read('src/pages/press/[kit].astro');
  assert.match(kit, /<pre>\{paletteCopyText\(swatches\)\}<\/pre>/, 'the palette is on the page as text, not only in an attribute');
  assert.match(kit, /<p>\{boilerplate\}<\/p>/, 'the boilerplate is on the page as text, not only in an attribute');
});
