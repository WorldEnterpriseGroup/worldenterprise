import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, SMALLEST_PHONE, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';

// WP-58 (issue #79, W9-12): the sales literature. /why-it-takes-time/ (the real clock, six charts), its printable brief, the
// /who-we-work-with/ hub and the seven situation pages. Every chart is an SVG with a title and a description, carries its data as a
// table and names its source; every source line links to an entry of the page's sources ledger; the pages need no JavaScript.

const SITUATIONS = [
  'industry-insiders',
  'encore-founders',
  'repeat-builders',
  'global-founders',
  'under-backed-builders',
  'next-gen-founders',
  'restart-founders',
] as const;

const ROUTES: readonly string[] = ['/why-it-takes-time/', '/who-we-work-with/', ...SITUATIONS.map((s) => `/who-we-work-with/${s}/`)];

const HONESTY = "These figures describe all new U.S. businesses, not WE's results.";

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

/** Every image SVG on the page names itself through aria-labelledby ids that exist and hold text. */
async function expectNamedDrawings(page: Page): Promise<number> {
  const problems = await page.evaluate(() =>
    [...document.querySelectorAll('main svg[role="img"]')].flatMap((svg, i) => {
      const ids = (svg.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter((id) => id !== '');
      if (ids.length === 0) return [`svg ${i} has no aria-labelledby`];
      return ids.flatMap((id) => {
        const el = document.getElementById(id);
        return el === null || (el.textContent ?? '').trim() === '' ? [`svg ${i}: #${id} is missing or empty`] : [];
      });
    }),
  );
  expect(problems).toEqual([]);
  return page.locator('main svg[role="img"]').count();
}

/** Every in-page source link lands on an entry of the ledger. */
async function expectSourceLinksResolve(page: Page): Promise<void> {
  const dangling = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="#source-"]')]
      .map((a) => a.getAttribute('href')?.slice(1) ?? '')
      .filter((id) => document.getElementById(id) === null),
  );
  expect(dangling, 'every source line links to a ledger entry').toEqual([]);
}

test.describe('the sales pages', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of ROUTES) {
    test(`${route} has one heading, named drawings, linked sources and no axe violations`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expectNamedDrawings(page);
      await expectSourceLinksResolve(page);
      await expectNoHorizontalScroll(page);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty, 'the page contacts only the site').toEqual([]);
    });
  }

  test('/why-it-takes-time/ shows six charts, each with its data as a table, and the honesty line', async ({ page }) => {
    test.skip(!isBuilt('/why-it-takes-time/'), 'not built');
    await page.goto('/why-it-takes-time/');
    const charts = page.locator('main figure.sales-chart');
    expect(await charts.count()).toBeGreaterThanOrEqual(6);
    for (const chart of await charts.all()) {
      await expect(chart.locator('details table')).toHaveCount(1);
      await expect(chart.locator('figcaption a[href^="#source-"]').first()).toBeAttached();
    }
    await expect(page.locator('main')).toContainText(HONESTY);
    await expect(page.getByRole('link', { name: 'Get the timeline brief' }).first()).toBeVisible();
  });

  test('the hub links every situation page, and each situation page links back to the others', async ({ page }) => {
    test.skip(!isBuilt('/who-we-work-with/'), 'not built');
    await page.goto('/who-we-work-with/');
    for (const slug of SITUATIONS) await expect(page.locator(`main a[href$="/who-we-work-with/${slug}/"]`).first()).toBeAttached();
    await page.goto('/who-we-work-with/under-backed-builders/');
    await expect(page.locator('main')).toContainText('WE makes no promise of funding.');
    await expect(page.locator('main a[href$="/who-we-work-with/restart-founders/"]').first()).toBeAttached();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the no-script pass runs once, in the desktop wave 8 project');
  });

  for (const route of ['/why-it-takes-time/', '/who-we-work-with/', '/who-we-work-with/industry-insiders/']) {
    test(`${route} shows its drawings and charts with no script`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      const drawings = page.locator('main svg[role="img"]');
      expect(await drawings.count()).toBeGreaterThan(0);
      await expect(drawings.first()).toBeVisible();
      await expect(page.locator('main #sources, main [id^="source-"]').first()).toBeAttached();
    });
  }
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
      await expectBandsFullBleed(page);
    });
  }
});
