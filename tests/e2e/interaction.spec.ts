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

  test('without JavaScript the Markdown download link carries the task', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto(target?.path ?? '/');
    await expect(page.locator('a[href$=".md"]').first()).toBeVisible();
    await expect(page.locator('we-copy button')).toHaveCount(0);
    await context.close();
  });
});
