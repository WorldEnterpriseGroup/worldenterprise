import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';

// WP-44, recomposed by WP-53 (issue #74, W9-12): the home page tells the long-horizon story. The galaxy hero leads with the readiness
// review; then the journey (Dream, Build, Grow on the business clock), the real clock with public figures and their honesty line, the
// team WE steers (unpriced), the Universal Business Framework, the seven situations, the latest insights and the closing band with the
// no-funding line. There is no packages teaser, no seat language, no price and no link to the retired pricing page.

const SECTION_ORDER = [
  'WE Dream. WE Build. WE Grow.',
  'A company takes years. WE is set up for the years.',
  'A team inside your company, steered by WE.',
  'One map, from a Star to a Galaxy.',
  'Built around the people who build companies.',
  'Latest insights',
  'Where is your company on the clock?',
] as const;

const HONESTY = "These figures describe all new U.S. businesses, not WE's results.";

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
});

test('the sections follow the planned order under one h1', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1'), 'one h1').toHaveCount(1);
  await expect(page.locator('h1#home-title')).toHaveText('WE build worlds.');
  const headings = (await page.locator('main h2').allTextContents()).map((t) => t.trim());
  const planned = headings.filter((h) => (SECTION_ORDER as readonly string[]).includes(h));
  const present = SECTION_ORDER.filter((title) => planned.includes(title));
  expect(planned, 'the planned sections, in page order').toEqual(present);
  for (const title of SECTION_ORDER.filter((t) => t !== 'Latest insights')) expect(headings, `"${title}" is on the page`).toContain(title);
});

test('the hero leads with the readiness review and the long-horizon line', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.home-hero');
  await expect(hero.locator('.lead')).toHaveText('Long-horizon business incubation and consulting, paced to the years a company really takes.');
  const primary = hero.locator('a[data-hero-action="primary"]');
  await expect(primary).toHaveText('Start a readiness review');
  await expect(primary).toHaveAttribute('href', /\/apply\/$/);
});

test('the journey shows Dream, Build and Grow, each linking its stage page, with the honesty line under the clock', async ({ page }) => {
  await page.goto('/');
  const band = page.locator('section[aria-labelledby="home-journey"]');
  const stages = band.locator('.home-journey__stage');
  await expect(stages).toHaveCount(3);
  for (const [i, name] of ['Dream', 'Build', 'Grow'].entries()) {
    await expect(stages.nth(i).getByRole('link', { name, exact: true })).toHaveAttribute('href', new RegExp(`/program/${name.toLowerCase()}/$`));
    expect(await stages.nth(i).locator('.home-journey__keeps li').count(), `${name} lists what the company keeps`).toBeGreaterThan(0);
  }
  await expect(band.getByText(HONESTY)).toBeVisible();
});

test('the clock band shows three public figures, a survival chart and the honesty line', async ({ page }) => {
  await page.goto('/');
  const band = page.locator('section[aria-labelledby="home-clock-title"]');
  const grid = band.locator('.stat-tiles__grid > *');
  await expect(grid.first()).toBeVisible();
  const tiles = await grid.count();
  expect(tiles, 'two or three stat tiles').toBeGreaterThanOrEqual(2);
  expect(tiles).toBeLessThanOrEqual(3);
  await expect(band.locator('figure.survival')).toBeVisible();
  await expect(band.getByText(HONESTY)).toBeVisible();
});

test('the team band draws the roles WE steers and names no seat, price or package', async ({ page }) => {
  await page.goto('/');
  const band = page.locator('section[aria-labelledby="home-team-title"]');
  await expect(band.locator('svg, figure').first()).toBeVisible();
  const text = (await band.innerText()).replace(/\s+/g, ' ');
  expect(text).not.toMatch(/\bseats?\b/i);
  expect(text).not.toMatch(/[$€£]\s?\d|\bUSD\b|\bper (?:month|seat|hour)\b/i);
});

test('who WE works with shows the seven situations', async ({ page }) => {
  await page.goto('/');
  const band = page.locator('section[aria-labelledby="home-who-title"]');
  await expect(band.locator('.home-who__card')).toHaveCount(7);
});

test('the page has no packages teaser, no seat language, no price and no link to the retired pricing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section[aria-labelledby="home-packages"]'), 'no packages teaser').toHaveCount(0);
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(text).not.toMatch(/\b(?:Spark|Accelerate|Studio)\b/);
  expect(text).not.toMatch(/\bseats?\b/i);
  expect(text).not.toMatch(/[$€£]\s?\d|\bUSD\b/);
  expect(text).not.toMatch(/\b(?:accelerator|cohort|mentor|alumni|demo day)\b/i);
  await expect(page.locator('main a[href*="/pricing/"]'), 'no pricing link').toHaveCount(0);
});

test('the closing band repeats the readiness review and carries the no-funding line', async ({ page }) => {
  await page.goto('/');
  const end = page.locator('section[aria-labelledby="home-end-title"]');
  await expect(end.getByText('WE makes no promise of funding.')).toBeVisible();
  await expect(end.getByRole('link', { name: 'Start a readiness review' })).toHaveAttribute('href', /\/apply\/$/);
});

test('the bands under the hero render at once and the insights band defers its rendering', async ({ page }) => {
  await page.goto('/');
  const cv = (selector: string): Promise<string> => page.locator(selector).first().evaluate((el) => getComputedStyle(el).contentVisibility);
  expect(await cv('.home-hero'), 'the hero renders at once').toBe('visible');
  expect(await cv('section[aria-labelledby="home-journey"]'), 'the band under the hero renders at once').toBe('visible');
  if ((await page.locator('section[aria-labelledby="home-insights"]').count()) > 0) {
    expect(await cv('section[aria-labelledby="home-insights"]'), 'the insights band defers').toBe('auto');
  }
});
