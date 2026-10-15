import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, SMALLEST_PHONE, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';

// WP-33 (issue #82): /ecosystem/, the directory of outside programs founders are encouraged to join, and its eight category pages.
// The hub renders the whole directory as plain HTML; <we-ecosystem-filter> narrows it with JavaScript and says how many programs match
// in a live region; without JavaScript the category pages and anchors carry the task.

const CATEGORIES = ['accelerators', 'incubators', 'university', 'coworking', 'angels', 'sba', 'government', 'communities'] as const;
const ROUTES: readonly string[] = ['/ecosystem/', ...CATEGORIES.map((c) => `/ecosystem/${c}/`)];
const MIN_ENTRIES = 60;

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

test.describe('the ecosystem pages', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of ROUTES) {
    test(`${route} has one heading, named drawings, marked external links and no axe violations`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll('main svg[role="img"]')].filter((svg) =>
          (svg.getAttribute('aria-labelledby') ?? '').split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? '').trim() === ''),
        ).length,
      );
      expect(unnamed, 'every drawing is named').toBe(0);
      const external = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="http"]')]
          .filter((a) => new URL(a.href).origin !== location.origin)
          .filter((a) => !(a.getAttribute('rel') ?? '').split(/\s+/).includes('noopener')).length,
      );
      expect(external, 'every external link carries rel="noopener"').toBe(0);
      await expect(page.locator('main')).toContainText('no affiliation implied');
      await expectNoHorizontalScroll(page);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty, 'the page contacts only the site').toEqual([]);
    });
  }

  test('the hub lists every program and links all eight category pages', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    expect(await page.locator('[data-eco-row]').count()).toBeGreaterThanOrEqual(MIN_ENTRIES);
    for (const c of CATEGORIES) await expect(page.locator(`main a[href$="/ecosystem/${c}/"]`).first()).toBeAttached();
    await expect(page.getByRole('link', { name: 'Start a readiness review' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Talk to WE' }).first()).toBeVisible();
    await expect(page.locator('main')).toContainText('Join them. WE works alongside, for the long run.');
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  });

  test('the filter narrows the directory, announces the count and clears', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const form = page.getByRole('search', { name: 'Filter the directory' });
    await expect(form).toBeVisible();
    const total = await page.locator('[data-eco-row]').count();
    const status = page.locator('[data-eco-status]');
    await expect(status).toHaveText(`Showing all ${total} programs.`);
    await expect(status).toHaveAttribute('aria-live', 'polite');

    await form.getByLabel('Kind of program').selectOption('coworking');
    const shown = page.locator('[data-eco-row]:not([hidden])');
    const n = await shown.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(total);
    await expect(status).toHaveText(`Showing ${n} of ${total} programs.`);
    for (const row of await shown.all()) await expect(row).toHaveAttribute('data-category', 'coworking');
    await expect(page.locator('[data-eco-group]:not([hidden])')).toHaveCount(1);

    await form.getByLabel('Built for').selectOption('women');
    await expect(status).toHaveText('No program matches those choices. Clear a filter to see more.');
    await expect(page.locator('[data-eco-empty]')).toBeVisible();

    await form.getByRole('button', { name: 'Clear filters' }).click();
    await expect(status).toHaveText(`Showing all ${total} programs.`);
    await expect(page.locator('[data-eco-row]:not([hidden])')).toHaveCount(total);
  });

  test('the filter works from the keyboard', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const select = page.getByLabel('Stage of company');
    await select.focus();
    await select.selectOption('scale');
    const total = await page.locator('[data-eco-row]').count();
    expect(await page.locator('[data-eco-row]:not([hidden])').count()).toBeLessThan(total);
    await page.getByLabel('Has an online option').focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel('Has an online option')).toBeChecked();
    const rows = await page.locator('[data-eco-row]:not([hidden])').all();
    for (const row of rows) await expect(row).toHaveAttribute('data-remote', 'yes');
  });

  test('a category page lists its programs with source lines and links back to the others', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/sba/'), 'not built');
    await page.goto('/ecosystem/sba/');
    const rows = page.locator('[data-eco-row]');
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    for (const row of await rows.all()) {
      await expect(row.locator('a[rel~="noopener"]').first()).toBeAttached();
      await expect(row).toContainText('retrieved October 2026');
    }
    await expect(page.locator('main a[href$="/ecosystem/accelerators/"]').first()).toBeAttached();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the no-script pass runs once, in the desktop wave 8 project');
  });

  test('the hub shows the whole directory, the drawings and no filter form', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const rows = page.locator('[data-eco-row]');
    expect(await rows.count()).toBeGreaterThanOrEqual(MIN_ENTRIES);
    for (const row of await rows.all()) await expect(row).toBeVisible();
    await expect(page.locator('[data-eco-status]')).toHaveCount(0);
    expect(await page.locator('main svg[role="img"]').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('main svg[role="img"]').first()).toBeVisible();
  });

  test('the category links and anchors work with no script', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    await page.locator('main a[href$="/ecosystem/incubators/"]').first().click();
    await expect(page).toHaveURL(/\/ecosystem\/incubators\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Incubators');
    await page.goto('/ecosystem/#group-coworking');
    await expect(page.locator('#group-coworking')).toBeInViewport();
  });
});

test.describe('at the smallest phone', () => {
  test.use({ viewport: SMALLEST_PHONE, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the 320px pass runs once, in the desktop wave 8 project');
  });

  for (const route of ROUTES) {
    test(`${route} never scrolls sideways at 320px`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe('at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'width checks run once, in the desktop wave 8 project');
  });

  for (const route of ROUTES) {
    test(`${route} fills the frame and its bands run full bleed`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      if (route === '/ecosystem/') expect(await expectBandsFullBleed(page)).toBeGreaterThan(0);
    });
  }
});
