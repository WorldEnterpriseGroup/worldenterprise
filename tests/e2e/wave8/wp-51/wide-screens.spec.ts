import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';
import { WIDE_SCREENS, expectBandsFullBleed, expectFrameShare, expectNoHorizontalScroll, expectReadableProse } from './lib/full-width.ts';

// WP-51 (issue #72, wave 9): screens wider than 1920. The root font size grows with the window above 1920 (--root-size), so the whole
// rem-based layout scales: a 2560 or 3840 screen shows the 1920 design at 1.33x or 2x, with the frame across at least 85% of the
// width, no sideways scroll, reading text at its measure, and a hero whose copy and visual balance across the screen. Below 1920
// nothing changes (full-width.spec.ts keeps 1920 and 320).

const ROUTES: readonly string[] = ['/', '/program/', '/about/', '/investors/', '/insights/', '/why-it-takes-time/', '/apply/'];

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

for (const viewport of WIDE_SCREENS) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, reducedMotion: 'reduce' });
    test.beforeEach(({}, info) => {
      test.skip(desktopOnly(info.project.name), 'width checks run once, in the desktop wave 8 project');
    });

    test('the root font size scales with the window: 16px at 1920 becomes width / 120', async ({ page }) => {
      await page.goto('/');
      const root = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(root).toBeCloseTo(viewport.width / 120, 0);
    });

    for (const path of ROUTES) {
      test(`${path} spans the screen, keeps its text readable and never scrolls sideways`, async ({ page }) => {
        test.skip(!isBuilt(path), `${path} is not built`);
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await expectFrameShare(page);
        await expectNoHorizontalScroll(page);
        await expectReadableProse(page);
        await expectBandsFullBleed(page);
      });
    }

    test('the header frame scales with the page and lines up with the content frame', async ({ page }) => {
      await page.goto('/');
      const header = await expectFrameShare(page, 0.85, 'header');
      const main = await expectFrameShare(page);
      expect(Math.abs(header.left - main.left), `header frame at ${header.left}px, main frame at ${main.left}px`).toBeLessThanOrEqual(1);
    });

    test('the home hero is balanced: the copy starts near the left edge and the visual reaches the right one', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const { copy, media, client } = await page.evaluate(() => {
        const box = (selector: string): { left: number; right: number } | null => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect === undefined || rect.width === 0 ? null : { left: rect.left, right: rect.right };
        };
        return { copy: box('.home-hero .split__text'), media: box('.home-hero .split__media'), client: document.documentElement.clientWidth };
      });
      expect(copy, 'the hero copy is on the page').not.toBeNull();
      expect(media, 'the hero visual is on the page').not.toBeNull();
      // At 1920 the copy sits one 80px gutter in (4%) and the visual bleeds to the edge; scaled, both stay within 10% of their edges.
      expect(copy?.left ?? client, `the copy starts at ${Math.round(copy?.left ?? 0)}px`).toBeLessThanOrEqual(client * 0.1);
      expect(media?.right ?? 0, `the visual ends at ${Math.round(media?.right ?? 0)}px`).toBeGreaterThanOrEqual(client * 0.9);
    });
  });
}
