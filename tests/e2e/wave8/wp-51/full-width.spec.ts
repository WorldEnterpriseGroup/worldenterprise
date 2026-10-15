import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, SMALLEST_PHONE, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from './lib/full-width.ts';

// WP-51 (issue #72, W9-4, W9-9): the wave 9 layout foundation fills a 1920x1080 screen. The content frame is 110rem with fluid gutters,
// so a representative route of each layout family uses at least 1600px of the width and starts within 160px of the left edge, while
// reading text keeps its measure. There is no 1920 project, so the viewport is set here and the spec runs once, in the desktop wave 8
// project. Desktop specs that do not test a scene emulate reduced motion (docs/wave9-contracts.md section 6).

/** One route per layout family; a route that is not built is skipped, not failed. */
const REPRESENTATIVE: readonly { readonly path: string; readonly layout: string }[] = [
  { path: '/', layout: 'HomeLayout' },
  { path: '/program/', layout: 'HubLayout' },
  { path: '/services/', layout: 'HubLayout (console hero)' },
  { path: '/about/', layout: 'MarketingLayout with a photo' },
  { path: '/investors/', layout: 'MarketingLayout' },
  { path: '/network/partners/', layout: 'MarketingLayout' },
  { path: '/insights/', layout: 'ArticleHub' },
  { path: '/apply/', layout: 'FormLayout' },
];

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

test.describe('at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'width checks run once, in the desktop wave 8 project');
  });

  for (const route of REPRESENTATIVE) {
    test(`${route.path} (${route.layout}) fills the frame, keeps its text readable and never scrolls sideways`, async ({ page }) => {
      test.skip(!isBuilt(route.path), `${route.path} is not built`);
      await page.goto(route.path);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      await expectReadableProse(page);
      await expectBandsFullBleed(page);
    });
  }

  test('the header frame widens with the content frame, so the logo and the nav line up with the page', async ({ page }) => {
    await page.goto('/');
    await expectFullWidth(page, 'header');
    const [header, main] = await page.evaluate(() =>
      ['header .container', 'main .container'].map(
        (selector) => [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect()).find((box) => box.width > 0 && box.height > 0)?.left ?? -1,
      ),
    );
    expect(header, 'the header frame is on the page').toBeGreaterThanOrEqual(0);
    expect(Math.abs((header ?? 0) - (main ?? 0)), `header frame at ${header}px, first main frame at ${main}px`).toBeLessThanOrEqual(1);
  });

  test('a MarketingLayout body uses the wide frame and holds its paragraphs to the reading measure', async ({ page }) => {
    const route = ['/network/partners/', '/investors/'].find(isBuilt);
    test.skip(route === undefined, 'no MarketingLayout route is built');
    await page.goto(route ?? '/');
    const body = page.locator('main .flow-wide').first();
    await expect(body, 'the default MarketingLayout body is .flow-wide').toBeVisible();
    const box = await body.boundingBox();
    expect(box?.width ?? 0, 'the body frame is wide').toBeGreaterThanOrEqual(1600);
    expect(await expectReadableProse(page), 'reading paragraphs were measured').toBeGreaterThan(0);
  });
});

test.describe('at 320px', () => {
  test.use({ viewport: SMALLEST_PHONE });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'one run is enough; the viewport is set here');
  });

  for (const route of REPRESENTATIVE) {
    test(`${route.path} has no horizontal scroll on the smallest phone`, async ({ page }) => {
      test.skip(!isBuilt(route.path), `${route.path} is not built`);
      await page.goto(route.path);
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalScroll(page);
    });
  }
});
