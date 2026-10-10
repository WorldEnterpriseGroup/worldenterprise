import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt, liveRoutes } from '../../support/routes.ts';

// WP-91: discoverability at scale, rendered half (the static half is tests/unit/wp-91). Each test skips while the route it needs is
// not built, so the suite stays green while the content packages land one by one.

const OPEN_KEY = 'ControlOrMeta+k';
const unthanked = (path: string): boolean => !/thanks/.test(path);

/** The thank-you routes the build holds, whatever family they belong to. */
const thankYouPages = liveRoutes.filter((route) => /thanks/.test(route.path)).map((route) => route.path);

test.describe('machine surfaces', () => {
  test('a thank-you page is in none of llms.txt, llms-full.txt, the sitemap or the feed', async ({ request }) => {
    test.skip(thankYouPages.length === 0, 'no thank-you page is built');
    for (const surface of ['/llms.txt', '/llms-full.txt', '/rss.xml']) {
      const response = await request.get(surface);
      expect(response.ok(), `${surface} is served`).toBe(true);
      const text = await response.text();
      for (const path of thankYouPages) expect(text, `${surface} must not name ${path}`).not.toContain(path);
    }
  });

  test('a thank-you page is not in the sitemap', async ({ request, baseURL }) => {
    test.skip(thankYouPages.length === 0, 'no thank-you page is built');
    // A preview build blocks every crawler and its sitemap is not filtered by the base path (reported in the handoff); audit-geo skips
    // the same comparison there.
    const robots = await (await request.get('/robots.txt')).text();
    test.skip(/^User-agent: \*\nDisallow: \/\n$/.test(robots), 'a preview build; the sitemap check runs on the production build');
    const index = await request.get('/sitemap-index.xml');
    expect(index.ok(), 'sitemap-index.xml is served').toBe(true);
    const files = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? '').pathname);
    expect(files.length, 'the index names a sitemap file').toBeGreaterThan(0);
    for (const file of files) {
      const response = await request.get(new URL(file, baseURL).href);
      expect(response.ok(), `${file} is served`).toBe(true);
      const text = await response.text();
      for (const path of thankYouPages) expect(text, `${file} must not name ${path}`).not.toContain(path);
    }
  });

  test('every Markdown twin that llms.txt links is served as Markdown text', async ({ request, baseURL }) => {
    const text = await (await request.get('/llms.txt')).text();
    const twins = [...text.matchAll(/\]\((https:\/\/worldenterprise\.org[^)\s]+\.md)\)/g)].map((match) => new URL(match[1] ?? '').pathname);
    expect(twins.length, 'llms.txt links twins').toBeGreaterThan(10);
    for (const twin of twins.slice(0, 25)) {
      const response = await request.get(new URL(twin, baseURL).href);
      expect(response.status(), twin).toBe(200);
      expect(response.headers()['content-type'] ?? '', twin).toMatch(/text\/(markdown|plain)/);
    }
  });

  test('the feed is well-formed and lists the newest articles first', async ({ request }) => {
    const response = await request.get('/rss.xml');
    expect(response.ok()).toBe(true);
    const xml = await response.text();
    expect(xml).toContain('<rss');
    const dates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((match) => Date.parse(match[1] ?? ''));
    expect(dates.length).toBeGreaterThan(0);
    for (const [index, date] of dates.entries()) {
      expect(Number.isNaN(date), `item ${index} has a valid date`).toBe(false);
      if (index > 0) expect(date).toBeLessThanOrEqual(dates[index - 1] ?? Infinity);
    }
  });
});

test.describe('the command palette lists the registries', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'the keyboard flows run on the desktop project');
  });

  test('every entry in the palette opens a page that is built, and none is a thank-you page', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press(OPEN_KEY);
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    // The options are links (role="option"); a preview build serves them under its base path, which dist does not have.
    const hrefs = await dialog.getByRole('option').evaluateAll((options) => options.map((option) => (option as HTMLAnchorElement).pathname));
    expect(hrefs.length, 'the empty palette lists the pages').toBeGreaterThan(5);
    for (const href of hrefs.map((path) => path.replace(/^\/worldenterprise(?=\/)/, ''))) {
      expect(unthanked(href), `${href} is not a thank-you page`).toBe(true);
      expect(isBuilt(href), `${href} is built`).toBe(true);
    }
  });

  test('a family page that is built is found by its name', async ({ page }) => {
    const sample = liveRoutes.find((route) => route.path.startsWith('/compare/') && route.path !== '/compare/');
    test.skip(sample === undefined, 'no comparison page is built');
    await page.goto('/');
    await page.keyboard.press(OPEN_KEY);
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    await page.keyboard.type('compare');
    await expect(dialog.getByRole('option').first()).toBeVisible();
  });
});

test.describe('search chips read every result', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/search/') || !existsSync('dist/pagefind/pagefind.js'), '/search/ or the Pagefind index is not in dist');
  });

  const chipNames = (page: Page): Promise<string[]> => page.locator('[data-search-chips] button').allInnerTexts();

  test('a broad search shows the chips of the types found, and a chip filters the list', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto('/search/');
    const input = page.locator('#we-search-input');
    await input.fill('the');
    await input.press('Enter');
    await expect(page.locator('[data-search-results] li').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-search-chips]')).toBeVisible({ timeout: 10_000 });
    const chips = await chipNames(page);
    expect(chips[0]).toMatch(/^All/);
    // The chunked read itself (a type past the 50th result gets its chip) is held by tests/unit/wp-91/search.test.ts.
    expect(chips.length, 'All and at least two types').toBeGreaterThanOrEqual(3);
    // A type chip filters the list to rows of that type and the status line says how many.
    await page.locator('[data-search-chips] button').nth(1).click();
    await expect(page.locator('[data-search-status]')).not.toHaveText('');
    expect(seen.thirdParty).toEqual([]);
    expect(seen.consoleErrors).toEqual([]);
  });
});
