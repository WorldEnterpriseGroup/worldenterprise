import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, SMALLEST_PHONE, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';

// WP-34 (issue #83, wave 10): /sbir-sttr/ and its three child pages. Each page opens with a dated authorization status, every chart is an
// SVG image with a title and description that carries its data as a table and names its source, source links land on a ledger entry,
// and the pages work without JavaScript. The 1920 pass runs once, in the desktop wave 8 project.

const HUB = '/sbir-sttr/';
const ROUTES = [HUB, '/sbir-sttr/phases/', '/sbir-sttr/agencies/', '/sbir-sttr/prepare/'] as const;
const CHARTED: readonly string[] = [HUB, '/sbir-sttr/phases/', '/sbir-sttr/agencies/'];

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

test.describe('the SBIR and STTR guide', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of ROUTES) {
    test(`${route} has one heading, a dated status, linked sources and no axe violations`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const status = page.locator('main .sbir-status');
      await expect(status).toBeVisible();
      await expect(status.locator('time[datetime]').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
      await expect(status).toContainText('September 30, 2031');
      await expect(page.locator('main')).toContainText('sbir.gov');
      const dangling = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="#source-"]')]
          .map((a) => a.getAttribute('href')?.slice(1) ?? '')
          .filter((id) => document.getElementById(id) === null),
      );
      expect(dangling, 'every source line links to a ledger entry').toEqual([]);
      await expectNoHorizontalScroll(page);
      const results = await analyzePage(page);
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty, 'the page contacts only the site').toEqual([]);
    });
  }

  for (const route of CHARTED) {
    test(`${route} gives every chart a name, a source line and its data as a table`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      const figures = page.locator('main figure.sbir-fig');
      expect(await figures.count()).toBeGreaterThanOrEqual(1);
      for (const figure of await figures.all()) {
        await expect(figure.locator('figcaption a[href^="#source-"]').first()).toBeAttached();
        await expect(figure.locator('details table')).toHaveCount(1);
        expect(await figure.locator('details table tbody tr').count()).toBeGreaterThan(1);
        const named = await figure.evaluate((el) =>
          [...el.querySelectorAll('svg[role="img"]')].every((svg) => {
            const ids = (svg.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter((id) => id !== '');
            return ids.length > 0 && ids.every((id) => (document.getElementById(id)?.textContent ?? '').trim() !== '');
          }),
        );
        expect(named, 'every drawing in the figure is named').toBe(true);
      }
    });
  }

  test('the hub links the three child pages and keeps WE out of the agency role', async ({ page }) => {
    test.skip(!isBuilt(HUB), 'not built');
    await page.goto(HUB);
    for (const child of ROUTES.slice(1)) await expect(page.locator(`main a[href$="${child}"]`).first()).toBeAttached();
    await expect(page.getByRole('link', { name: 'Start a readiness review' }).first()).toHaveAttribute('href', /\/apply\/$/);
    await expect(page.getByRole('link', { name: 'Talk to WE' }).first()).toBeVisible();
    await expect(page.locator('main')).toContainText('WE is not an agency');
    await expect(page.locator('main')).toContainText('WE makes no promise of funding.');
  });

  test('the prepare checklists tick, count and keep their ticks in the address', async ({ page }) => {
    test.skip(!isBuilt('/sbir-sttr/prepare/'), 'not built');
    await page.goto('/sbir-sttr/prepare/');
    const lists = page.locator('we-sbir-checklist');
    await expect(lists).toHaveCount(2);
    const ready = lists.nth(1);
    await ready.locator('input[type="checkbox"]').first().check();
    await expect(ready.locator('[data-progress]')).toContainText('1 of');
    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/ready=/);
    await lists.nth(0).locator('input[type="checkbox"]').first().check();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/eligible=.*&ready=|ready=.*&eligible=/);
    await page.reload();
    await expect(lists.nth(1).locator('input[type="checkbox"]').first()).toBeChecked();
    await expect(lists.nth(0).locator('input[type="checkbox"]').first()).toBeChecked();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the no-script pass runs once, in the desktop wave 8 project');
  });

  for (const route of ROUTES) {
    test(`${route} shows its status, drawings and sources with no script`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await expect(page.locator('main .sbir-status')).toBeVisible();
      if (CHARTED.includes(route)) {
        const drawings = page.locator('main svg[role="img"]');
        expect(await drawings.count()).toBeGreaterThan(0);
        await expect(page.locator('main figure.sbir-fig details table').first()).toBeAttached();
      }
      await expect(page.locator('main [id^="source-"]').first()).toBeAttached();
    });
  }

  test('the prepare checklists are real checkboxes without script', async ({ page }) => {
    test.skip(!isBuilt('/sbir-sttr/prepare/'), 'not built');
    await page.goto('/sbir-sttr/prepare/');
    const box = page.locator('we-sbir-checklist input[type="checkbox"]').first();
    await box.check();
    await expect(box).toBeChecked();
    await expect(page.locator('main ol li').first()).toBeAttached();
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
    test(`${route} fills the frame, keeps its text readable and its bands full bleed`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      await expectReadableProse(page);
      expect(await expectBandsFullBleed(page)).toBeGreaterThan(0);
    });
  }
});
