import { expect, test, type Page } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, SMALLEST_PHONE, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';

// WP-35 (issue #84): /data/, "The long game, in data", and its four report pages. Every chart is named, carries its data as a table,
// names its source and its retrieval date; every page ends with its sources list; the pages need no JavaScript.

const ROUTES: readonly string[] = ['/data/', '/data/survival/', '/data/formation/', '/data/who-starts/', '/data/years-to-milestones/'];
const HONESTY = "These figures describe all new U.S. businesses, not WE's results.";
const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

async function expectNamedDrawings(page: Page): Promise<void> {
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
}

async function expectSourceLinksResolve(page: Page): Promise<void> {
  const dangling = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="#source-"]')]
      .map((a) => a.getAttribute('href')?.slice(1) ?? '')
      .filter((id) => document.getElementById(id) === null),
  );
  expect(dangling, 'every source line links to a sources entry').toEqual([]);
}

test.describe('the data pages', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of ROUTES) {
    test(`${route} has one heading, named charts with tables, linked sources and no axe violations`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expectNamedDrawings(page);
      await expectSourceLinksResolve(page);
      const figures = page.locator('main figure.dv');
      expect(await figures.count()).toBeGreaterThanOrEqual(route === '/data/years-to-milestones/' ? 1 : 3);
      for (const figure of await figures.all()) {
        await expect(figure.locator('details table')).toHaveCount(1);
        await expect(figure.locator('.source-note a[href^="https://"]').first()).toBeAttached();
        await expect(figure).toContainText('Retrieved 2026-10-15');
      }
      await expect(page.locator('main')).toContainText(HONESTY);
      await expect(page.locator('main [id^="source-"]').first()).toBeAttached();
      await expectNoHorizontalScroll(page);
      const results = await analyzePage(page);
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty, 'the page contacts only the site').toEqual([]);
    });
  }

  test('/data/ names the longevity thesis and offers both calls to action', async ({ page }) => {
    test.skip(!isBuilt('/data/'), 'not built');
    await page.goto('/data/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The long game, in data');
    await expect(page.getByRole('link', { name: 'See how long it really takes' }).first()).toHaveAttribute('href', /\/why-it-takes-time\/$/);
    await expect(page.getByRole('link', { name: 'Start a readiness review' }).first()).toHaveAttribute('href', /\/apply\/$/);
    for (const child of ROUTES.slice(1)) await expect(page.locator(`main a[href$="${child}"]`).first()).toBeAttached();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the no-script pass runs once, in the desktop wave 8 project');
  });

  for (const route of ['/data/', '/data/survival/']) {
    test(`${route} shows its charts and tables with no script`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      const drawings = page.locator('main svg[role="img"]');
      expect(await drawings.count()).toBeGreaterThan(0);
      await expect(drawings.first()).toBeVisible();
      await expect(page.locator('main [id^="source-"]').first()).toBeAttached();
      expect(await page.locator('main details table').count()).toBeGreaterThan(0);
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
