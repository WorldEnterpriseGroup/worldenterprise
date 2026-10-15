import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-44, recomposed by WP-53 (issue #74): the home page passes the fold rules at 1440x900 and 390x844. The h1, the one-sentence
// promise, the readiness review button and the galaxy poster (the LCP image) stay inside the first viewport, the poster keeps its
// preload and fetchpriority, and the journey band that follows the hero starts right under it and fits the width of the screen.

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
});

test('h1, promise, readiness review button and hero poster are inside the first viewport', async ({ page }) => {
  await page.goto('/');
  const height = page.viewportSize()?.height ?? 0;
  const hero = page.locator('.home-hero');
  const parts = {
    h1: hero.locator('h1#home-title'),
    promise: hero.locator('.lead'),
    apply: hero.locator('a.btn--primary'),
    image: hero.locator('img[fetchpriority="high"]'),
  };
  for (const [name, locator] of Object.entries(parts)) {
    await expect(locator.first(), `${name} is visible`).toBeVisible();
    const box = await locator.first().boundingBox();
    expect(box, `${name} has a box`).not.toBeNull();
    expect(box?.y ?? -1, `${name} starts inside the viewport`).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0), `${name} ends inside ${height}px`).toBeLessThanOrEqual(height + 1);
  }
});

test('the hero image keeps its preload and its fetchpriority, and is not lazy', async ({ page }) => {
  await page.goto('/');
  const preloads = page.locator('head link[rel="preload"][as="image"]');
  await expect(preloads, 'one image is preloaded').toHaveCount(1);
  await expect(preloads.first()).toHaveAttribute('fetchpriority', 'high');
  const preloaded = await preloads.first().getAttribute('imagesrcset');
  const image = page.locator('.home-hero img[fetchpriority="high"]');
  await expect(image).toHaveCount(1);
  await expect(image).not.toHaveAttribute('loading', 'lazy');
  expect(await image.getAttribute('srcset'), 'the preload and the rendered hero image name the same srcset').toBe(preloaded);
});

test('the band under the hero is the first section of the page body and opens right under the hero', async ({ page }) => {
  await page.goto('/');
  const hero = await page.locator('.home-hero').boundingBox();
  const heading = page.locator('h2#home-journey');
  await expect(heading).toHaveText('WE Dream. WE Build. WE Grow.');
  const box = await heading.boundingBox();
  expect(hero, 'the hero has a box').not.toBeNull();
  expect(box, 'the band heading has a box').not.toBeNull();
  const viewport = page.viewportSize()?.height ?? 0;
  expect(box?.y ?? 0, 'the band heading starts below the hero').toBeGreaterThanOrEqual((hero?.y ?? 0) + (hero?.height ?? 0) - 1);
  expect(box?.y ?? 0, 'the band heading starts within one screen of the hero').toBeLessThan((hero?.y ?? 0) + (hero?.height ?? 0) + viewport);
  const firstH2 = await page.locator('main h2').first().getAttribute('id');
  expect(firstH2, 'the first h2 of the page is the band').toBe('home-journey');
});

test('nothing on the page leaves the width of the screen', async ({ page }) => {
  await page.goto('/');
  const offenders = await findOverflow(page);
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  const scroll = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll.scroll, 'no horizontal page scroll').toBeLessThanOrEqual(scroll.client);
});
