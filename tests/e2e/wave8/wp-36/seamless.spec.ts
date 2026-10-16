import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';
import { watch } from '../../support/page-guards.ts';
import { ROUTE, cls } from '../wp-52/helpers.ts';

// WP-36: seamless scenes on the styleguide (built when PUBLIC_STYLEGUIDE=1). Desktop project (1920x1080) only.
// No canvas box, poster with JavaScript off and with reduced motion, cross-document view transitions in the CSS, no console errors,
// stable layout and no scene code fetched for a visitor who is not eligible.

test.describe.configure({ retries: 1 });

test.beforeEach(({}, info) => {
  test.skip(!info.project.name.includes('desktop'), 'checked at 1920x1080 in the desktop project');
  test.skip(!isBuilt(ROUTE), 'the styleguide is built only with PUBLIC_STYLEGUIDE=1');
});

const SCENE_CODE = /\/(?:runtime|three[\w.-]*|galaxy|launch|orbit|worldforge|accretion|starfield)\.[\w-]+\.js(?:\?|$)/;

test('a feathered scene has no border, no shadow and a mask on its frame', async ({ page, baseURL }) => {
  const guard = watch(page, baseURL ?? '');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
  const frames = page.locator('.scene--feather .scene__frame');
  expect(await frames.count()).toBeGreaterThan(0);
  const styles = await frames.first().evaluate((el) => {
    const s = getComputedStyle(el);
    const mask = s.maskImage || s.webkitMaskImage;
    return {
      border: ['Top', 'Right', 'Bottom', 'Left'].map((side) => s.getPropertyValue(`border-${side.toLowerCase()}-width`)),
      shadow: s.boxShadow,
      outline: s.outlineStyle,
      mask,
    };
  });
  expect(styles.border.every((w) => w === '0px')).toBe(true);
  expect(styles.shadow).toBe('none');
  expect(styles.outline).toBe('none');
  expect(styles.mask).not.toBe('none');
  expect(guard.consoleErrors, guard.consoleErrors.join('\n')).toEqual([]);
  expect(guard.pageErrors, guard.pageErrors.join('\n')).toEqual([]);
});

test('with JavaScript off every scene shows its poster and nothing else', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1920, height: 1080 }, baseURL });
  const page = await context.newPage();
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
  const scenes = page.locator('.scene');
  expect(await scenes.count()).toBeGreaterThan(0);
  expect(await page.locator('canvas.scene__canvas').count()).toBe(0);
  expect(await page.locator('.scene picture img, .scene img').count()).toBeGreaterThan(0);
  await context.close();
});

test('with reduced motion no scene code is requested and the poster stays', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (SCENE_CODE.test(request.url())) scripts.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(ROUTE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  expect(scripts).toEqual([]);
  expect(await page.locator('canvas.scene__canvas').count()).toBe(0);
});

test('layout is stable while scenes sit as posters (CLS under 0.01)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(ROUTE, { waitUntil: 'load' });
  expect(await cls(page)).toBeLessThan(0.01);
});

test('cross-document view transitions are declared and gated on motion', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
  const css = await page.evaluate(async () => {
    const out: string[] = [];
    for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
      const href = (link as HTMLLinkElement).href;
      const res = await fetch(href);
      out.push(await res.text());
    }
    for (const style of Array.from(document.querySelectorAll('style'))) out.push(style.textContent ?? '');
    return out.join('\n');
  });
  expect(css).toMatch(/@view-transition\s*\{[^}]*navigation\s*:\s*auto/);
  expect(css).toMatch(/prefers-reduced-motion/);
});
