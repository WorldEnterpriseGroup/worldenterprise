import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { quiet, watch } from './support/page-guards.ts';
import { fileFor, liveRoutes, pendingRoutes } from './support/routes.ts';

// Route smoke over every launched ledger route that is built: status, one h1, canonical, console, third parties
// and a screenshot. Horizontal fit is measured per element in layout.spec.ts. Pending routes are listed as skipped so the gap stays visible.

const SHOT_MAX_HEIGHT = 16_384;

const slug = (route: string): string => (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/[/.]/g, '-'));

for (const { path: route } of liveRoutes) {
  test(`route ${route}`, async ({ page, baseURL }, info) => {
    const base = baseURL ?? '';
    const seen = watch(page, base);
    const network = quiet(page);
    const response = await page.goto(route, { waitUntil: 'load' });
    expect(response?.status(), 'HTTP status').toBe(200);
    await expect(page.locator('h1'), 'exactly one h1').toHaveCount(1);
    await expect(page.locator('main#main'), 'main landmark').toHaveCount(1);
    const title = await page.title();
    expect(title.trim(), 'title').not.toBe('');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical, 'canonical link').toMatch(/^https:\/\/worldenterprise\.org\//);
    expect(new URL(canonical ?? '').pathname, 'canonical path').toBe(route);

    await network.settled();
    expect(seen.pageErrors, 'uncaught exceptions').toEqual([]);
    expect(seen.consoleErrors, 'console errors').toEqual([]);
    expect(seen.thirdParty, 'third-party requests').toEqual([]);

    const file = `test-results/screenshots/${info.project.name}/${slug(route)}.jpg`;
    mkdirSync(dirname(file), { recursive: true });
    // CSS scale and a 16384 px cap (Chrome's texture limit): past it the capture is tiled, and a 55,000 px hub page took 40 s on a CI runner.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const width = page.viewportSize()?.width ?? 0;
    const shot = { path: file, type: 'jpeg', quality: 55, animations: 'disabled', scale: 'css' } as const;
    await page.screenshot(height > SHOT_MAX_HEIGHT ? { ...shot, fullPage: true, clip: { x: 0, y: 0, width, height: SHOT_MAX_HEIGHT } } : { ...shot, fullPage: true });
    if (height > SHOT_MAX_HEIGHT) info.annotations.push({ type: 'screenshot', description: `cut at ${SHOT_MAX_HEIGHT} of ${height} px` });
    await info.attach(`${slug(route)}-${info.project.name}`, { path: file, contentType: 'image/jpeg' });
  });
}

for (const route of pendingRoutes) {
  test(`route ${route.path} (pending: owner ${route.owner} has not merged it)`, () => {
    test.skip(true, `${route.path} is launched in the ledger but not built yet`);
  });
}

test('every built route has a unique title', () => {
  const owners = new Map<string, string>();
  const clashes: string[] = [];
  for (const route of liveRoutes) {
    const html = readFileSync(fileFor(route.path), 'utf8');
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? '';
    expect(title, `${route.path} title`).not.toBe('');
    const first = owners.get(title);
    if (first !== undefined) clashes.push(`${route.path} repeats the title of ${first}: ${title}`);
    else owners.set(title, route.path);
  }
  expect(clashes).toEqual([]);
});
