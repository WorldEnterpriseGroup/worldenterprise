import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { watch } from './support/page-guards.ts';
import { isBuilt, liveRoutes } from './support/routes.ts';

// Islands: Team Composer, readiness check, search and the copy button. Each skips while its route is not built.

test.describe('Team Composer', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/tools/team-composer/'), '/tools/team-composer/ is not built');
  });

  test('seat counts update the headline and roster, Clear resets them', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto('/tools/team-composer/');
    const composer = page.locator('we-team-composer');
    const headline = composer.locator('[data-headline]');
    await expect(headline).toContainText('No seats chosen yet');
    const first = composer.locator('input.composer__seats').first();
    await first.fill('2');
    await expect(headline).not.toContainText('No seats chosen yet');
    await expect(composer.locator('[data-roster]')).toBeVisible();
    await expect(composer.locator('[data-roster] li')).toHaveCount(1);
    await composer.getByRole('button', { name: 'Clear' }).click();
    await expect(headline).toContainText('No seats chosen yet');
    expect(seen.consoleErrors).toEqual([]);
  });

  test('the form is a plain GET to /apply/ that carries the team in the link', async ({ page }) => {
    await page.goto('/tools/team-composer/');
    const form = page.locator('we-team-composer form');
    await expect(form).toHaveAttribute('method', 'get');
    await expect(form).toHaveAttribute('action', /\/apply\/$/);
  });

  test('seat counts are bounded: negative and oversized values are not accepted into the roster', async ({ page }) => {
    await page.goto('/tools/team-composer/');
    const composer = page.locator('we-team-composer');
    const first = composer.locator('input.composer__seats').first();
    await first.fill('-3');
    await expect(composer.locator('[data-headline]')).toContainText('No seats chosen yet');
    await first.fill('99999');
    const max = Number(await first.getAttribute('max'));
    const text = await composer.locator('[data-headline]').innerText();
    const numbers = (text.match(/\d+/g) ?? []).map(Number);
    expect(numbers.every((n) => n <= max), `headline "${text}" exceeds the per-role maximum ${max}`).toBe(true);
  });
});

test.describe('readiness check', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/fundability/'), '/fundability/ is not built');
  });

  test('shows gaps for unticked statements, and Clear all resets', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto('/fundability/');
    const check = page.locator('we-readiness-check');
    const boxes = check.locator('input[type="checkbox"]');
    expect(await boxes.count(), 'twelve statements').toBe(12);
    await expect(check.locator('[data-rc-controls]')).toBeVisible();
    await boxes.first().check();
    await check.locator('[data-rc-show]').click();
    const result = check.locator('[data-rc-result]');
    await expect(result).not.toBeEmpty();
    await expect(result).not.toContainText(/\b\d+\s*(%|\/\s*12|out of)/i);
    await check.locator('[data-rc-reset]').click();
    await expect(boxes.first()).not.toBeChecked();
    await expect(result).toBeEmpty();
    expect(seen.thirdParty).toEqual([]);
  });

  test('nothing is persisted: no storage writes and no network requests on use', async ({ page }) => {
    await page.goto('/fundability/');
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    const check = page.locator('we-readiness-check');
    await check.locator('input[type="checkbox"]').nth(2).check();
    await check.locator('[data-rc-show]').click();
    const stored = await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length);
    expect(stored).toBe(0);
    expect(requests).toEqual([]);
  });

  test('the no-promise-of-funding statement is present', async ({ page }) => {
    await page.goto('/fundability/');
    await expect(page.locator('we-readiness-check')).toContainText('no promise of funding');
  });
});

test.describe('search', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/search/'), '/search/ is not built');
  });

  test('the Pagefind index answers a query and results are links on this site', async ({ page, baseURL }) => {
    test.skip(!existsSync('dist/pagefind/pagefind.js'), 'the Pagefind index is not in dist');
    const seen = watch(page, baseURL ?? '');
    await page.goto('/search/');
    const input = page.locator('#we-search-input');
    await expect(input).toBeVisible();
    await input.fill('program');
    await input.press('Enter');
    const results = page.locator('[data-search-results] a');
    await expect(results.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-search-status]')).not.toBeEmpty();
    const hrefs = await results.evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).origin));
    expect(new Set(hrefs).size).toBe(1);
    expect(seen.thirdParty).toEqual([]);
    expect(seen.consoleErrors).toEqual([]);
  });

  // WP-16 (code-security P2-10, P2-11). A broad query has more than one page of results; try a few until one does.
  async function searchWithManyResults(page: import('@playwright/test').Page): Promise<string> {
    const input = page.locator('#we-search-input');
    const more = page.locator('[data-search-more]');
    for (const query of ['the', 'team', 'founder', 'startup', 'product', 'program']) {
      await input.fill(query);
      await input.press('Enter');
      await expect(page.locator('[data-search-results] li').first()).toBeVisible({ timeout: 10_000 });
      if (await more.isVisible()) return query;
    }
    throw new Error('no broad query returned more than one page of results; the index looks too small for this test');
  }

  const rowLinks = (page: import('@playwright/test').Page): Promise<string[]> => page.locator('[data-search-results] li h2 a').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));

  test('a double click on Show more adds one batch, not the same batch twice', async ({ page }) => {
    test.skip(!existsSync('dist/pagefind/pagefind.js'), 'the Pagefind index is not in dist');
    await page.goto('/search/');
    await expect(page.locator('#we-search-input')).toBeVisible();
    await searchWithManyResults(page);
    expect(await rowLinks(page), 'first page').toHaveLength(10);
    await page.locator('[data-search-more]').dblclick();
    await expect.poll(async () => (await rowLinks(page)).length, { message: 'the second batch arrives' }).toBeGreaterThan(10);
    await page.waitForTimeout(500);
    const links = await rowLinks(page);
    expect(new Set(links).size, 'no result is listed twice').toBe(links.length);
    expect(links.length, 'one batch of up to ten more').toBeLessThanOrEqual(20);
  });

  test('moving <we-search> in the document does not attach its handlers a second time', async ({ page }) => {
    test.skip(!existsSync('dist/pagefind/pagefind.js'), 'the Pagefind index is not in dist');
    await page.goto('/search/');
    await expect(page.locator('#we-search-input')).toBeVisible();
    await page.evaluate(() => {
      const el = document.querySelector('we-search');
      if (el?.parentElement) el.parentElement.append(el);
    });
    const query = await searchWithManyResults(page);
    expect(await rowLinks(page), `first page of "${query}"`).toHaveLength(10);
    await page.locator('[data-search-more]').click();
    await expect.poll(async () => (await rowLinks(page)).length).toBeGreaterThan(10);
    await page.waitForTimeout(500);
    const links = await rowLinks(page);
    expect(new Set(links).size).toBe(links.length);
  });

  test('a query with no match says so and keeps the field', async ({ page }) => {
    test.skip(!existsSync('dist/pagefind/pagefind.js'), 'the Pagefind index is not in dist');
    await page.goto('/search/');
    const input = page.locator('#we-search-input');
    await input.fill('zzzqqqxxnomatch');
    await input.press('Enter');
    await expect(page.locator('[data-search-status]')).toContainText(/no results|nothing|0/i, { timeout: 10_000 });
    await expect(input).toHaveValue('zzzqqqxxnomatch');
  });

  test('the fallback page links are visible when JavaScript is off', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto('/search/');
    await expect(page.locator('.we-search__fallback a').first()).toBeVisible();
    await context.close();
  });
});

test.describe('copy as Markdown', () => {
  const target = liveRoutes.find((r) => /^\/library\/[^/]+\/$/.test(r.path));
  test.beforeEach(() => {
    test.skip(target === undefined, 'no library template route is built');
  });

  test('the button copies and announces the result', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(target?.path ?? '/');
    const button = page.locator('we-copy button').first();
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('.we-copy__status')).not.toBeEmpty();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.length).toBeGreaterThan(50);
  });

  test('a malformed target selector is reported and does not throw', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(target?.path ?? '/');
    await expect(page.locator('we-copy button').first()).toBeVisible();
    // An author-supplied selector that is not valid CSS, and no download to fall back on.
    await page.evaluate(() => {
      const el = document.createElement('we-copy');
      el.setAttribute('target', '[[not a selector');
      el.id = 'bad-selector-copy';
      document.querySelector('main')?.append(el);
    });
    const bad = page.locator('#bad-selector-copy');
    await expect(bad.locator('button')).toBeVisible();
    await bad.locator('button').click();
    await expect(bad.locator('.we-copy__status')).toContainText(/nothing to copy/i);
    expect(errors, 'no uncaught error from the click handler').toEqual([]);
  });

  test('without JavaScript the Markdown download link carries the task', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto(target?.path ?? '/');
    await expect(page.locator('a[href$=".md"]').first()).toBeVisible();
    await expect(page.locator('we-copy button')).toHaveCount(0);
    await context.close();
  });
});

test.describe('tabs', () => {
  test('once enhanced, each panel is a tabpanel and a tab stop, tied to its tab', async ({ page }) => {
    test.skip(!isBuilt('/styleguide/'), '/styleguide/ is not built (it ships only in the verify build)');
    await page.goto('/styleguide/');
    const roots = page.locator('[data-tabs][data-enhanced]');
    expect(await roots.count(), 'enhanced tab sets').toBeGreaterThan(0);
    const report = await roots.first().evaluate((root) => {
      const tabs = [...root.querySelectorAll<HTMLElement>('[role="tab"]')];
      const panels = [...root.querySelectorAll<HTMLElement>('.tabs__panel')];
      return {
        tabs: tabs.length,
        roles: panels.map((p) => p.getAttribute('role')),
        tabindex: panels.map((p) => p.getAttribute('tabindex')),
        controlled: tabs.every((t) => root.querySelector(`#${t.getAttribute('aria-controls') ?? ''}`)?.getAttribute('role') === 'tabpanel'),
      };
    });
    expect(report.roles.every((role) => role === 'tabpanel')).toBe(true);
    expect(report.tabindex.every((value) => value === '0')).toBe(true);
    expect(report.controlled, 'every aria-controls target is a tabpanel').toBe(true);
  });

  test('without JavaScript the panels stay plain labelled sections under their own headings', async ({ browser, baseURL }) => {
    test.skip(!isBuilt('/styleguide/'), '/styleguide/ is not built');
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto('/styleguide/');
    expect(await page.locator('.tabs__panel[role="tabpanel"]').count()).toBe(0);
    await expect(page.locator('.tabs__panel').first()).toBeVisible();
    await context.close();
  });
});
