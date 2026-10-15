import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';
import { WP55_ROUTES_1920 } from './routes-1920.ts';

// WP-55 (issue #76): About, the frameworks galaxy, the UBF planetarium and the network family at 1920x1080. Scenes are not under test
// here, so motion is reduced (docs/wave9-contracts.md section 6) and the posters with their HTML labels are what the reader gets.

test.describe('WP-55 at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'wave8-desktop-1440x900', 'desktop-only width checks');
  });

  for (const path of WP55_ROUTES_1920) {
    test(`${path} fills the frame, keeps its text readable and never scrolls sideways`, async ({ page }) => {
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      await expectReadableProse(page);
      await expectBandsFullBleed(page);
    });
  }

  test('the UBF planetarium labels all ten components and each label opens its definition', async ({ page }) => {
    test.skip(!isBuilt('/about/frameworks/ubf/'), 'the UBF page is not built');
    await page.goto('/about/frameworks/ubf/');
    const labels = page.locator('#planetarium .scene__labels a');
    await expect(labels).toHaveCount(10);
    for (const name of ['Galaxy', 'Black Hole', 'Super Nova', 'Solar System', 'Sun', 'Super Star', 'Star', 'Moon', 'Comet', 'Asteroid']) {
      await expect(page.locator('#planetarium .scene__labels'), name).toContainText(name);
    }
    const targets = await labels.evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    for (const target of targets) {
      expect(target, 'a label links inside the page').toMatch(/#ubf-[a-z-]+$/);
      await expect(page.locator(target.slice(target.indexOf('#')))).toHaveCount(1);
    }
    await expect(page.locator('#lifecycle')).toContainText('WE Dream');
    await expect(page.locator('#engagement ol > li')).not.toHaveCount(0);
  });

  test('the frameworks galaxy draws every framework as a system and links UBF', async ({ page }) => {
    test.skip(!isBuilt('/about/frameworks/'), 'the frameworks hub is not built');
    await page.goto('/about/frameworks/');
    const galaxy = page.locator('#galaxy');
    for (const name of ['UBF', 'O.R.B.I.T.A.L.', 'S.T.A.R.', 'A.N.D.R.O.I.D.', 'D.R.O.I.D.', 'Focus Shift']) await expect(galaxy, name).toContainText(name);
    if (isBuilt('/about/frameworks/ubf/')) await expect(galaxy.locator('a[href$="/about/frameworks/ubf/"]').first()).toBeVisible();
  });

  test('About tells the WE build worlds story and states that WE is not an investor', async ({ page }) => {
    test.skip(!isBuilt('/about/'), 'About is not built');
    await page.goto('/about/');
    await expect(page.locator('main h1')).toHaveText('WE build worlds');
    await expect(page.locator('main')).toContainText('WE is a services firm, not an investor.');
    await expect(page.locator('main')).toContainText('WE makes no promise of funding.');
    await expect(page.locator('#worlds')).toContainText('Droids, worlds, solar systems, galaxies.');
    await expect(page.locator('main')).not.toContainText(/accelerator|digital incubator/i);
  });
});
