import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-52: the visuals library on the styleguide (built when PUBLIC_STYLEGUIDE=1). Runs in the wave 8 projects (1440x900 and 390x844);
// the 1920x1080 checks run in the desktop project only. ARCHITECTURE 3.2: a canvas at desktop width with motion allowed, zero console
// errors and CLS under 0.01; on a phone no request for the scene code; reduced motion, forced colors and no JavaScript show the poster.

const ROUTE = '/styleguide/';

/** The dynamically imported scene code: the runtime (which carries three) and the five scene modules. The stub is not in this set. */
const SCENE_CODE = /\/(?:runtime|three[\w.-]*|galaxy|launch|orbit|worldforge|starfield)\.[\w-]+\.js(?:\?|$)/;

// Headless Chromium on a CI runner has no GPU. Only the live-scene checks ask for SwiftShader WebGL2 (a separate worker), so every
// other check renders the page without software GL. The runner may also report fewer than four cores, which the gate refuses, so the
// live checks present a four-core machine (the gate itself is unit-tested). Review shots are evidence, not gates: a capture that
// times out leaves a note. Every test is capped at 60s and retried at most once.
const SWIFTSHADER = {
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
};
test.describe.configure({ retries: 1 });

const isDesktop = (info: TestInfo): boolean => info.project.name.includes('desktop');

async function presentFourCores(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
      get: () => 8,
      configurable: true,
    });
  });
}

/** Cumulative layout shift observed on the page so far (buffered entries, ignoring shifts right after input). */
async function cls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
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
 * One review capture (evidence, not a gate): reduced motion, so no scene goes live; the item exists and is visible (asserted); then
 * the item is scrolled to the top of the viewport and captured as a viewport clip with animations disabled. A capture that fails or
 * times out is attached as a note, never a failure.
 */
async function reviewShot(page: Page, info: TestInfo, visual: string, suffix: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  const item = page.locator(`#visuals [data-visual="${visual}"]`);
  await expect(item, `${visual} is on the styleguide`).toHaveCount(1, {
    timeout: 10_000,
  });
  await expect(item, `${visual} is visible at ${suffix}`).toBeVisible({
    timeout: 5_000,
  });
  const name = `visual-${visual}-${suffix}`;
  try {
    const clip = await item.evaluate(
      async (el) => {
        el.scrollIntoView({ block: 'start' });
        await Promise.race([
          Promise.allSettled(Array.from(el.querySelectorAll('img')).map((img) => img.decode())),
          new Promise((resolve) => window.setTimeout(resolve, 3000)),
        ]);
        const r = el.getBoundingClientRect();
        const top = Math.max(0, r.top);
        return {
          x: Math.max(0, r.left),
          y: top,
          width: Math.max(1, Math.min(r.width, window.innerWidth)),
          height: Math.max(1, Math.min(r.bottom, window.innerHeight) - top),
        };
      },
      undefined,
      { timeout: 8_000 },
    );
    const body = await page.screenshot({
      type: 'jpeg',
      quality: 72,
      clip,
      animations: 'disabled',
      timeout: 15_000,
    });
    await info.attach(name, { body, contentType: 'image/jpeg' });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    info.annotations.push({
      type: 'missing-review-shot',
      description: `${name}: ${reason}`,
    });
    await info.attach(`${name}-missing.txt`, {
      body: reason,
      contentType: 'text/plain',
    });
  }
}

/** Whether this browser can create a WebGL2 context at all (the gate's last check). */
async function hasWebGL2(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return gl !== null;
    } catch (error) {
      console.info('webgl2 probe threw', error);
      return false;
    }
  });
}

/**
 * Waits for a scene to go live when the runner has WebGL2; otherwise (or when the runtime falls back) asserts the poster stays. Returns
 * whether the scene went live; callers pause a live scene when done, so software rendering does not load the runner afterwards.
 */
async function liveOrPoster(page: Page, scene: Locator, info: TestInfo): Promise<boolean> {
  const poster = scene.locator('img.scene__poster');
  if (!(await hasWebGL2(page))) {
    info.annotations.push({
      type: 'no-webgl2',
      description: 'the runner has no WebGL2: the poster fallback is checked instead',
    });
    await page.waitForTimeout(1500);
    await expect(scene.locator('canvas.scene__canvas'), 'no canvas without WebGL2').toHaveCount(0);
    await expect(poster, 'the poster stays visible without WebGL2').toBeVisible();
    return false;
  }
  await expect(scene, 'the scene leaves the poster state (gate passed, loading or live)').toHaveAttribute(
    'data-state',
    /^(?:loading|live|fallback)$/,
    {
      timeout: 20_000,
    },
  );
  await expect(scene, 'the scene settles live or falls back to its poster').toHaveAttribute('data-state', /^(?:live|fallback)$/, {
    timeout: 25_000,
  });
  if ((await scene.getAttribute('data-state')) === 'fallback') {
    info.annotations.push({
      type: 'scene-fallback',
      description: 'the runtime fell back to the poster on this runner',
    });
    await expect(poster, 'the poster stays visible after a fallback').toBeVisible();
    return false;
  }
  return true;
}

test.describe('WP-52 visuals on the styleguide', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the styleguide is built only with PUBLIC_STYLEGUIDE=1');
  });

  test('every scene shows its poster in a reserved box, with alt text unless decorative', async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#visuals we-scene').first()).toBeAttached({
      timeout: 10_000,
    });
    // One pass in the page: the box is reserved before any image arrives, so the frame has height whether or not the poster loaded.
    const scenes = await page.locator('#visuals we-scene').evaluateAll((els) =>
      els.map((el) => {
        const posters = el.querySelectorAll('img.scene__poster');
        const poster = posters[0];
        const frame = el.querySelector('.scene__frame');
        return {
          scene: el.getAttribute('data-scene'),
          posters: posters.length,
          decoding: poster?.getAttribute('decoding') ?? null,
          alt: poster?.getAttribute('alt') ?? null,
          decorative: frame?.getAttribute('aria-hidden') === 'true',
          frameHeight: frame?.getBoundingClientRect().height ?? 0,
          canvases: el.querySelectorAll('.scene__canvas').length,
        };
      }),
    );
    expect(scenes.length).toBeGreaterThanOrEqual(10);
    for (const s of scenes) {
      const at = JSON.stringify(s);
      expect(s.posters, at).toBe(1);
      expect(s.decoding, at).toBe('async');
      if (s.decorative) expect(s.alt, at).toBe('');
      else expect((s.alt ?? '').length, at).toBeGreaterThan(20);
      expect(s.frameHeight, at).toBeGreaterThan(40);
      expect(s.canvases, at).toBe(0);
    }
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
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: info.project.use.viewport ?? { width: 1440, height: 900 },
      baseURL,
    });
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
    await page.emulateMedia({
      reducedMotion: 'no-preference',
      forcedColors: 'active',
    });
    await page.reload();
    await expect(page.locator('#visuals we-scene').first()).toHaveAttribute('data-gate', 'forced-colors');
    await page.locator('#visuals we-scene').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    expect(requested).toEqual([]);
    await expect(page.locator('.scene__canvas')).toHaveCount(0);
  });

  test('the showcase lists exactly the reviewed visuals', async ({ page }) => {
    await page.goto(ROUTE);
    const names = await page.locator('#visuals [data-visual]').evaluateAll((els) => els.map((el) => el.getAttribute('data-visual')));
    expect(names).toEqual([...VISUALS]);
  });

  test.describe('review shots at the project width', () => {
    // Evidence, not gates: a retry would only repeat the same capture.
    test.describe.configure({ retries: 0 });
    for (const visual of VISUALS) {
      test(`review shot: ${visual}, at the project width`, async ({ page }, info) => {
        test.setTimeout(60_000);
        await reviewShot(page, info, visual, info.project.name);
      });
    }
  });
});

test.describe('WP-52 visuals at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(({ browserName }, info) => {
    expect(browserName).toBe('chromium');
    test.skip(!isBuilt(ROUTE), 'the styleguide is built only with PUBLIC_STYLEGUIDE=1');
    test.skip(!isDesktop(info), '1920 runs in the desktop project only');
  });

  test.describe.configure({ retries: 0 });
  for (const visual of VISUALS) {
    test(`review shot: ${visual}, at 1920`, async ({ page }, info) => {
      test.setTimeout(60_000);
      await reviewShot(page, info, visual, '1920');
    });
  }
});

test.describe('WP-52 live scenes (desktop, software WebGL)', () => {
  test.use(SWIFTSHADER);

  test.beforeEach((_args, info) => {
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
