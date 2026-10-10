import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-44, acceptance: the home page passes the fold rules at 1440x900 and 390x844 after the recomposition. The h1, the one-sentence
// promise, the Apply button and the hero image stay inside the first viewport, the hero keeps its preload and fetchpriority, and the
// band that follows the hero starts right under it and fits the width of the screen.

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
  test.skip(!existsSync('src/components/home/leave-with/LeaveWith.astro'), 'the leave-with band has not merged');
});

test('h1, promise, Apply button and hero image are inside the first viewport', async ({ page }) => {
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
  const heading = page.locator('h2#home-leave-with');
  await expect(heading).toHaveText('What you leave with');
  const box = await heading.boundingBox();
  expect(hero, 'the hero has a box').not.toBeNull();
  expect(box, 'the band heading has a box').not.toBeNull();
  const viewport = page.viewportSize()?.height ?? 0;
  expect(box?.y ?? 0, 'the band heading starts below the hero').toBeGreaterThanOrEqual((hero?.y ?? 0) + (hero?.height ?? 0) - 1);
  expect(box?.y ?? 0, 'the band heading starts within one screen of the hero').toBeLessThan((hero?.y ?? 0) + (hero?.height ?? 0) + viewport);
  // WP-62 puts the audience strip between the hero and this band, so the band is the first h2 or the one right after the strip.
  const ids = await page.locator('main h2').evaluateAll((els) => els.slice(0, 2).map((el) => el.id));
  expect(ids.includes('home-leave-with'), `the band is one of the first two h2 of the page (${ids.join(', ')})`).toBe(true);
  if (ids[0] !== 'home-leave-with') expect(ids[0], 'only the audience strip may come before the band').toBe('home-audience');
});

test('nothing on the page leaves the width of the screen', async ({ page }) => {
  await page.goto('/');
  const offenders = await findOverflow(page);
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  const scroll = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll.scroll, 'no horizontal page scroll').toBeLessThanOrEqual(scroll.client);
});
