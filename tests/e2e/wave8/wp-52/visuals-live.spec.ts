import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';
import { ROUTE, cls, isDesktop, liveOrPoster, presentFourCores } from './helpers.ts';

// WP-52 live scenes, desktop project only (ARCHITECTURE 3.2: a canvas at desktop width with motion allowed, zero console errors, CLS
// under 0.01). Headless Chromium on a CI runner has no GPU. This file forces SwiftShader (launch options must be set at file level) to
// prove that software GL keeps the poster: the gate asks for WebGL2 with failIfMajorPerformanceCaveat and refuses a SwiftShader, llvmpipe
// or other software renderer by name (headless Chrome hands one out without the caveat), so the main thread stays free. On a runner with a real GPU the same checks see the scene go live.
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });
test.describe.configure({ retries: 1 });

test.describe('WP-52 live scenes (desktop, software WebGL)', () => {
  test.beforeEach(({ browserName }, info) => {
    expect(browserName).toBe('chromium');
    test.skip(!isBuilt(ROUTE), 'the styleguide is built only with PUBLIC_STYLEGUIDE=1');
    test.skip(!isDesktop(info), 'scenes run on desktops only');
  });

  test('with motion allowed a scene goes live or keeps its poster, with no console errors and no layout shift', async ({
    page,
    baseURL,
  }, info) => {
    test.setTimeout(60_000);
    await presentFourCores(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const seen = watch(page, baseURL ?? '');
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
    const scene = page.locator('#visuals we-scene:not([data-static])').first();
    await scene.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    if (await liveOrPoster(page, scene, info)) {
      await expect(scene.locator('canvas.scene__canvas')).toHaveCount(1);
      await expect(scene).toHaveClass(/is-live/, { timeout: 10_000 });
      await expect(scene.locator('canvas.scene__canvas')).toHaveAttribute('aria-hidden', 'true');
      const toggle = scene.locator('.scene__toggle');
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(toggle, 'the button pauses').toHaveAttribute('aria-pressed', 'true');
      await toggle.click();
      await expect(toggle, 'and resumes').toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
    }
    expect(await cls(page)).toBeLessThan(0.01);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test.describe('at 1920x1080', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('the hero galaxy poster fills its box, and the scene goes live or keeps the poster with no console errors', async ({
      page,
      baseURL,
    }, info) => {
      test.setTimeout(60_000);
      await presentFourCores(page);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const seen = watch(page, baseURL ?? '');
      await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
      const scene = page.locator('#visuals we-scene[data-scene="galaxy"]:not([data-static])').first();
      await scene.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const frame = await scene.locator('.scene__frame').boundingBox();
      const poster = await scene.locator('img.scene__poster').boundingBox();
      expect(frame?.width ?? 0, 'the frame spans the column').toBeGreaterThan(800);
      expect(Math.abs((frame?.width ?? 0) - (poster?.width ?? -1)), 'the poster fills the frame width').toBeLessThan(2);
      expect(Math.abs((frame?.height ?? 0) - (poster?.height ?? -1)), 'the poster fills the frame height').toBeLessThan(2);
      if (await liveOrPoster(page, scene, info)) {
        const canvas = await scene.locator('canvas.scene__canvas').boundingBox();
        expect(Math.abs((frame?.width ?? 0) - (canvas?.width ?? -1)), 'the canvas fills the frame width').toBeLessThan(2);
        expect(Math.abs((frame?.height ?? 0) - (canvas?.height ?? -1)), 'the canvas fills the frame height').toBeLessThan(2);
        await scene.locator('.scene__toggle').click();
      }
      expect(await cls(page)).toBeLessThan(0.01);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
    });
  });
});
