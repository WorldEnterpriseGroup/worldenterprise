import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';

// WP-53 (issue #74, W9-9, W9-12): the home page and the program family use the full 1920 width with multi-column visual and text
// compositions. At 1920x1080 each route fills the frame, keeps its reading text to a comfortable measure, runs its bands edge to edge
// and never scrolls sideways; its main split compositions put the picture beside the text, not under it. The spec runs once, in the
// desktop wave 8 project, with reduced motion (docs/wave9-contracts.md section 6).

const ROUTES = [
  '/',
  '/program/',
  '/program/dream/',
  '/program/build/',
  '/program/grow/',
  '/program/how-it-works/',
  '/program/dedicated-teams/',
  '/program/digital-incubation-model/',
] as const;

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

test.describe('at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'width checks run once, in the desktop wave 8 project');
  });

  for (const route of ROUTES) {
    test(`${route} fills the frame, keeps its text readable and never scrolls sideways`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      await expectReadableProse(page);
      await expectBandsFullBleed(page);
    });

    test(`${route} sets its visuals beside its text`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      const pairs = await page.locator('main .split').evaluateAll((splits) =>
        splits
          .map((split) => {
            const text = split.querySelector(':scope > .split__text');
            const media = split.querySelector(':scope > .split__media');
            if (text === null || media === null) return null;
            const t = text.getBoundingClientRect();
            const m = media.getBoundingClientRect();
            if (t.height === 0 || m.height === 0) return null;
            return { side: m.left >= t.right - 1 || m.right <= t.left + 1, what: (text.textContent ?? '').trim().slice(0, 40) };
          })
          .filter((p) => p !== null),
      );
      expect(pairs.length, `${route} has at least one text and visual composition`).toBeGreaterThan(0);
      for (const pair of pairs) expect(pair?.side, `"${pair?.what}": the visual sits beside the text`).toBe(true);
    });
  }

  test('the home hero poster is the high-priority image and the galaxy sits beside the copy', async ({ page }) => {
    test.skip(!isBuilt('/'), 'home is not built');
    await page.goto('/');
    const copy = await page.locator('.home-hero__copy').boundingBox();
    const media = await page.locator('.home-hero__media').boundingBox();
    expect(copy).not.toBeNull();
    expect(media).not.toBeNull();
    expect(media?.x ?? 0, 'the galaxy is right of the copy').toBeGreaterThanOrEqual((copy?.x ?? 0) + (copy?.width ?? 0) - 1);
    expect((media?.x ?? 0) + (media?.width ?? 0), 'the galaxy runs to the right edge').toBeGreaterThanOrEqual(FULL_HD.width - 20);
    await expect(page.locator('.home-hero img[fetchpriority="high"]')).toHaveCount(1);
  });
});
