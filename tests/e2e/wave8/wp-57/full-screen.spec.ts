import { test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, expectFullWidth, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';

// WP-57 (issue #78, wave 9 close): full-screen regression over the key routes of the redesigned site. The 110rem frame with fluid
// gutters (W9-9) must hold on every page a visitor is likely to land on, not only on one route per layout family (WP-51 covers that
// sample). At 1920x1080 each route fills the width without large side gutters and never scrolls sideways. There is no 1920 project, so
// the viewport is set here and the spec runs once, in the desktop wave 8 project. A route that is not built is skipped, not failed.

/** The key routes: the sales path, the explainers, the hubs and one detail page of each content family. */
const KEY_ROUTES: readonly string[] = [
  '/',
  '/how-we-work/',
  '/why-it-takes-time/',
  '/who-we-work-with/',
  '/about/',
  '/about/frameworks/',
  '/about/manifesto/',
  '/program/',
  '/services/',
  '/industries/',
  '/founders/',
  '/investors/',
  '/network/partners/',
  '/insights/',
  '/insights/what-a-dedicated-team-seat-is-and-is-not/',
  '/research/',
  '/playbooks/',
  '/compare/',
  '/faq/',
  '/glossary/',
  '/press/',
  '/contact/',
  '/apply/',
];

test.describe('key routes at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'wave8-desktop-1440x900', 'the full-screen check runs once, in the desktop wave 8 project');
  });

  for (const route of KEY_ROUTES) {
    test(`${route} spans the screen without side gutters and never scrolls sideways`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalScroll(page);
      await expectFullWidth(page);
    });
  }
});
