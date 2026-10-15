import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-52: the visuals library on the styleguide (built when PUBLIC_STYLEGUIDE=1). Runs in the wave 8 projects (1440x900 and 390x844);
// the 1920x1080 checks run in the desktop project only. ARCHITECTURE 3.2: a canvas at desktop width with motion allowed, zero console
// errors and CLS under 0.01; on a phone no request for the scene code; reduced motion, forced colors and no JavaScript show the poster.

const ROUTE = '/styleguide/';

/** The dynamically imported scene code: the runtime (which carries three) and the five scene modules. The stub is not in this set. */
const SCENE_CODE = /\/(?:runtime|three[\w.-]*|galaxy|launch|orbit|worldforge|starfield)\.[\w-]+\.js(?:\?|$)/;

// Headless Chromium on a CI runner has no GPU: SwiftShader gives it WebGL2. The CI runner may also report fewer than four cores,
// which the gate refuses, so the desktop checks present a four-core machine (the gate itself is unit-tested).
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });

const isDesktop = (info: TestInfo): boolean => info.project.name.includes('desktop');

async function presentFourCores(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 8, configurable: true });
  });
}

/** Cumulative layout shift observed on the page so far (buffered entries, ignoring shifts right after input). */
async function cls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        window.setTimeout(() => {
          observer.disconnect();
          resolve(total);
        }, 300);
      }),
  );
}

/** Every showcase item, by its data-visual name. No item is hidden at any width: phones see each scene's poster. */
const VISUALS = [
  'galaxyscene',
  'launchtrajectory',
  'orbitsystem',
  'worldforge',
  'starfieldband',
  'band-and-split',
  'longhorizontimeline',
  'stattiles-and-stattile',
  'survivalcurve',
  'barchart',
  'donutchart',
  'sourcenote',
  'journeyroadmap',
  'readinessscorecard',
  'hexfield',
  'servicelineset-and-visualicon',
  'teamconstellation-and-rolecard',
] as const;

/**
 * One review capture: reduced motion (no scene goes live, so nothing animates), the item visible, its images decoded (at most 3s),
 * its box steady over half a second (an unsteady box is annotated, since it means a layout loop), then a page-coordinate clip of a
 * full-page shot with animations disabled. Each step has its own limit and message, so a slow visual names itself.
 */
async function reviewShot(page: Page, info: TestInfo, visual: string, suffix: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTE);
  const item = page.locator(`#visuals [data-visual="${visual}"]`);
  await expect(item, `${visual} is on the styleguide`).toHaveCount(1, { timeout: 10_000 });
  await expect(item, `${visual} is visible at ${suffix}`).toBeVisible({ timeout: 10_000 });
  const measure = (): Promise<{ x: number; y: number; width: number; height: number }> =>
    item.evaluate(async (el) => {
      el.scrollIntoView({ block: 'start' });
      await Promise.race([
        Promise.allSettled(Array.from(el.querySelectorAll('img')).map((img) => img.decode())),
        new Promise((resolve) => window.setTimeout(resolve, 3000)),
      ]);
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left + window.scrollX), y: Math.max(0, r.top + window.scrollY), width: Math.max(1, r.width), height: Math.max(1, Math.min(r.height, 4000)) };
    }, undefined, { timeout: 10_000 });
  const first = await measure();
  await page.waitForTimeout(500);
  const clip = await measure();
  if (Math.abs(first.height - clip.height) > 1 || Math.abs(first.width - clip.width) > 1) {
    info.annotations.push({ type: 'unsteady-layout', description: `${visual}: ${first.width}x${first.height} then ${clip.width}x${clip.height}` });
  }
  const body = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: true, clip, animations: 'disabled', timeout: 15_000 });
  await info.attach(`visual-${visual}-${suffix}`, { body, contentType: 'image/jpeg' });
}

test.describe('WP-52 visuals on the styleguide', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the styleguide is built only with PUBLIC_STYLEGUIDE=1');
  });

  test('every scene shows its poster in a reserved box, with alt text unless decorative', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE);
    const scenes = page.locator('#visuals we-scene');
    expect(await scenes.count()).toBeGreaterThanOrEqual(10);
    for (const scene of await scenes.all()) {
      const poster = scene.locator('img.scene__poster');
      await expect(poster).toHaveCount(1);
      await expect(poster).toHaveAttribute('decoding', 'async');
      const alt = await poster.getAttribute('alt');
      const decorative = (await scene.locator('.scene__frame[aria-hidden="true"]').count()) === 1;
      if (decorative) expect(alt).toBe('');
      else expect((alt ?? '').length).toBeGreaterThan(20);
      // The box is reserved before the image arrives: the frame has height whether or not the poster has loaded.
      const box = await scene.locator('.scene__frame').boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(40);
    }
    await expect(page.locator('#visuals .scene__canvas')).toHaveCount(0);
  });

  test('scene labels are real HTML: station links, lists and a pause control that is a button', async ({ page }) => {
    await page.goto(ROUTE);
    const launch = page.locator('#visuals we-scene[data-scene="launch"]').first();
    for (const stage of ['dream', 'build', 'grow']) {
      await expect(launch.locator(`.scene__labels a[href$="/program/${stage}/"]`)).toHaveCount(1);
    }
    await expect(page.locator('#visuals we-scene[data-scene="orbit"]').first().locator('.scene__labels li')).toHaveCount(7);
    await expect(page.locator('#visuals .scene__toggle').first()).toHaveAttribute('type', 'button');
    const ubf = page.locator('#visuals we-scene[data-scene="orbit"]').filter({ hasText: 'Super Nova' });
    await expect(ubf.locator('.scene__labels li')).toHaveCount(10);
  });

  test('Band and Split render the wave 9 layout markup', async ({ page }) => {
    await page.goto(ROUTE);
    const band = page.locator('#visuals section.band.band--deep');
    await expect(band).toHaveCount(1);
    await expect(band).toHaveAttribute('aria-labelledby', 'h-vs-split');
    await expect(band.locator(':scope > .band__scene svg')).toHaveCount(1);
    const split = band.locator(':scope > .container > .split');
    await expect(split.locator(':scope > .split__text h4')).toHaveText('Every company is its own world.');
    await expect(split.locator(':scope > .split__media we-scene[data-scene="worldforge"]')).toHaveCount(1);
  });

  test('charts carry their figures as text and a source link', async ({ page }) => {
    await page.goto(ROUTE);
    const survival = page.locator('#visuals figure.survival');
    await expect(survival.locator('table tbody tr')).toHaveCount(11);
    await expect(survival.locator('.source-note a[href^="https://"]')).toHaveCount(1);
    await expect(page.locator('#visuals figure.bar-chart table tbody tr')).toHaveCount(6);
    await expect(page.locator('#visuals .donut__legend li')).toHaveCount(3);
    await expect(page.locator('#visuals .stat-tiles__sources li a[href^="https://"]').first()).toBeVisible();
    const timeline = page.locator('#visuals figure.tl');
    await expect(timeline.locator('.tl__list > li')).toHaveCount(6);
    await expect(timeline.locator('.tl__sources li')).not.toHaveCount(0);
    await expect(timeline).not.toContainText(/\b20 years\b/);
  });

  test('the journey, scorecard and team visuals render without prices', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('#visuals .journey__phase')).toHaveCount(3);
    await expect(page.locator('#visuals .scorecard')).toContainText('Illustration only');
    await expect(page.locator('#visuals .constellation__role')).toHaveCount(7);
    await expect(page.locator('#visuals')).not.toContainText(/[$€£]\s?\d/);
  });

  test('nothing in the visuals section overflows the viewport', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE);
    const offenders = await findOverflow(page);
    expect(offenders, JSON.stringify(offenders.slice(0, 5), null, 2)).toEqual([]);
  });

  test('with JavaScript off every scene is its poster', async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport ?? { width: 1440, height: 900 }, baseURL });
    try {
      const page = await context.newPage();
      await page.goto(ROUTE);
      const first = page.locator('#visuals we-scene img.scene__poster').first();
      await first.scrollIntoViewIfNeeded();
      await expect(first).toBeVisible();
      await expect(page.locator('.scene__canvas')).toHaveCount(0);
      await expect(page.locator('#visuals .scene__toggle').first()).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('on a phone the scene code is never requested', async ({ page }, info) => {
    test.skip(isDesktop(info), 'phone check');
    const requested: string[] = [];
    page.on('request', (request) => {
      if (SCENE_CODE.test(request.url())) requested.push(request.url());
    });
    await page.goto(ROUTE);
    await page.mouse.wheel(0, 4000);
    await page.locator('#visuals we-scene').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(requested).toEqual([]);
    await expect(page.locator('.scene__canvas')).toHaveCount(0);
    await expect(page.locator('#visuals we-scene').first()).toHaveAttribute('data-gate', 'media');
  });

  test('reduced motion and forced colors keep the poster on a desktop', async ({ page }, info) => {
    test.skip(!isDesktop(info), 'desktop check');
    await presentFourCores(page);
    const requested: string[] = [];
    page.on('request', (request) => {
      if (SCENE_CODE.test(request.url())) requested.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE);
    await expect(page.locator('#visuals we-scene').first()).toHaveAttribute('data-gate', 'media');
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
    await page.reload();
    await expect(page.locator('#visuals we-scene').first()).toHaveAttribute('data-gate', 'forced-colors');
    await page.locator('#visuals we-scene').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    expect(requested).toEqual([]);
    await expect(page.locator('.scene__canvas')).toHaveCount(0);
  });

  test('on a desktop with motion allowed the scene goes live with no console errors and no layout shift', async ({ page, baseURL }, info) => {
    test.skip(!isDesktop(info), 'desktop check');
    test.setTimeout(90_000);
    await presentFourCores(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const seen = watch(page, baseURL ?? '');
    await page.goto(ROUTE);
    const scene = page.locator('#visuals we-scene:not([data-static])').first();
    await scene.scrollIntoViewIfNeeded();
    await expect(scene).toHaveAttribute('data-state', 'live', { timeout: 30_000 });
    await expect(scene.locator('canvas.scene__canvas')).toHaveCount(1);
    await expect(scene).toHaveClass(/is-live/, { timeout: 30_000 });
    await expect(scene.locator('canvas.scene__canvas')).toHaveAttribute('aria-hidden', 'true');

    const toggle = scene.locator('.scene__toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    expect(await cls(page)).toBeLessThan(0.01);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
    await info.attach('visuals-live-1440', { body: await scene.screenshot(), contentType: 'image/png' });
  });

  test('the showcase lists exactly the reviewed visuals', async ({ page }) => {
    await page.goto(ROUTE);
    const names = await page.locator('#visuals [data-visual]').evaluateAll((els) => els.map((el) => el.getAttribute('data-visual')));
    expect(names).toEqual([...VISUALS]);
  });

  for (const visual of VISUALS) {
    test(`review shot: ${visual}, at the project width`, async ({ page }, info) => {
      test.setTimeout(60_000);
      await reviewShot(page, info, visual, info.project.name);
    });
  }
});

test.describe('WP-52 visuals at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(({ browserName }, info) => {
    expect(browserName).toBe('chromium');
    test.skip(!isBuilt(ROUTE), 'the styleguide is built only with PUBLIC_STYLEGUIDE=1');
    test.skip(!isDesktop(info), '1920 runs in the desktop project only');
  });

  test('the hero galaxy goes live at 1920 with no console errors, and the posters fill their boxes', async ({ page, baseURL }, info) => {
    test.setTimeout(90_000);
    await presentFourCores(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const seen = watch(page, baseURL ?? '');
    await page.goto(ROUTE);
    const scene = page.locator('#visuals we-scene[data-scene="galaxy"]:not([data-static])').first();
    await scene.scrollIntoViewIfNeeded();
    await expect(scene).toHaveAttribute('data-state', 'live', { timeout: 30_000 });
    await expect(scene).toHaveClass(/is-live/, { timeout: 30_000 });
    const frame = await scene.locator('.scene__frame').boundingBox();
    const canvas = await scene.locator('canvas.scene__canvas').boundingBox();
    expect(Math.abs((frame?.width ?? 0) - (canvas?.width ?? -1))).toBeLessThan(2);
    expect(Math.abs((frame?.height ?? 0) - (canvas?.height ?? -1))).toBeLessThan(2);
    expect(await cls(page)).toBeLessThan(0.01);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    await info.attach('galaxy-live-1920', { body: await scene.screenshot(), contentType: 'image/png' });
  });

  for (const visual of VISUALS) {
    test(`review shot: ${visual}, at 1920`, async ({ page }, info) => {
      test.setTimeout(60_000);
      await reviewShot(page, info, visual, '1920');
    });
  }
});
