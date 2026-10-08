import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { isBuilt, liveRoutes } from './support/routes.ts';

// Above the fold (wp-01 request): on the home page the h1, the one-sentence promise, the Apply button and the hero image
// are inside the first viewport (100dvh) at 1440x900 and 390x844. Every other route shows its h1 inside the first viewport.

test('home: h1, promise, Apply button and hero image are inside the first viewport', async ({ page }) => {
  test.skip(!isBuilt('/'), 'home is not built');
  test.skip(!existsSync('src/components/home/HomeHero.astro'), 'the home hero (WP-01) has not merged yet');
  await page.goto('/');
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const height = viewport?.height ?? 0;
  const hero = page.locator('.home-hero');
  const parts: Record<string, ReturnType<typeof page.locator>> = {
    h1: hero.locator('h1#home-title'),
    promise: hero.locator('.lead'),
    apply: hero.locator('a.btn--primary'),
    image: hero.locator('img[fetchpriority="high"]'),
  };
  for (const [name, locator] of Object.entries(parts)) {
    await expect(locator.first(), `${name} is visible`).toBeVisible();
    const box = await locator.first().boundingBox();
    expect(box, `${name} has a box`).not.toBeNull();
    expect((box?.y ?? 0) >= 0, `${name} starts inside the viewport`).toBe(true);
    expect((box?.y ?? 0) + (box?.height ?? 0), `${name} ends inside ${height}px`).toBeLessThanOrEqual(height + 1);
  }
  await expect(parts.apply.first()).toHaveAttribute('href', /\/apply\/$/);
  await expect(parts.image.first()).not.toHaveAttribute('loading', 'lazy');
});

for (const { path: route } of liveRoutes) {
  test(`h1 is inside the first viewport on ${route}`, async ({ page }) => {
    await page.goto(route);
    const box = await page.locator('h1').first().boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    expect(box, 'h1 has a box').not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0), `h1 bottom edge against the ${height}px fold`).toBeLessThanOrEqual(height);
  });
}

// Heroes (WP-17): every page opens with the hero its template calls for, holds one h1, and keeps its primary action
// (Apply, talk to WE, download, jump to the tool) inside the first viewport, below the fixed mobile Apply bar when one is showing.

/** The hero modes each template may open with. A page that names a photo or art gets the editorial hero, otherwise it gets the compact one. */
const HERO_MODES: Readonly<Record<string, readonly string[]>> = {
  HubLayout: ['editorial', 'console'],
  StageLayout: ['editorial'],
  ServiceLayout: ['editorial'],
  PlaybookLayout: ['editorial'],
  MarketingLayout: ['editorial', 'compact'],
  ToolLayout: ['editorial', 'compact'],
  FormLayout: ['editorial', 'compact'],
  GuideLayout: ['compact'],
  ArticleHub: ['compact'],
  TemplateLayout: ['compact'],
  ReferenceLayout: ['compact'],
  LegalLayout: ['compact'],
  ArticleLayout: ['article'],
  BriefLayout: ['article'],
};

/** Templates whose pages always carry a primary action. */
const PRIMARY_LAYOUTS: ReadonlySet<string> = new Set(['HubLayout', 'StageLayout', 'ServiceLayout', 'PlaybookLayout']);

/** Single pages that carry a primary action whatever their template. */
const PRIMARY_ROUTES: ReadonlySet<string> = new Set([
  '/about/',
  '/press/',
  '/founders/',
  '/investors/',
  '/network/operators/',
  '/apply/',
  '/contact/',
  '/pricing/',
  '/tools/team-composer/',
]);

/** The two hubs that open on the night-blue console hero. */
const CONSOLE_ROUTES: readonly string[] = ['/services/', '/network/'];

/** The bottom edge of the first viewport that a visitor can use: the fixed mobile Apply bar covers the strip beneath it. */
async function usableFold(page: Page): Promise<number> {
  const height = page.viewportSize()?.height ?? 0;
  const bar = page.locator('.mobile-apply');
  const barHeight = (await bar.isVisible()) ? ((await bar.boundingBox())?.height ?? 0) : 0;
  return height - barHeight;
}

for (const { path: route, layout } of liveRoutes) {
  const modes = HERO_MODES[layout];
  if (modes === undefined) continue;

  test(`one h1, inside one ${modes.join(' or ')} hero, on ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1'), 'the page has one h1').toHaveCount(1);
    const heroes = page.locator('[data-hero]');
    await expect(heroes, 'the page has one hero').toHaveCount(1);
    await expect(heroes.locator('h1'), 'the h1 belongs to the hero').toHaveCount(1);
    const mode = await heroes.first().getAttribute('data-hero');
    expect(modes, `the ${layout} hero mode (${mode ?? 'none'})`).toContain(mode);
    if (CONSOLE_ROUTES.includes(route)) expect(mode, `${route} opens on the console hero`).toBe('console');
  });

  test(`the primary action is inside the first viewport on ${route}`, async ({ page }) => {
    await page.goto(route);
    const primary = page.locator('[data-hero] [data-hero-action="primary"]');
    const required = PRIMARY_LAYOUTS.has(layout) || PRIMARY_ROUTES.has(route);
    if (!required && (await primary.count()) === 0) return;
    await expect(primary, 'the hero has one primary action').toHaveCount(1);
    await expect(primary).toBeVisible();
    await expect(primary, 'the primary action goes somewhere').toHaveAttribute('href', /\S/);
    const box = await primary.boundingBox();
    expect(box, 'the primary action has a box').not.toBeNull();
    const fold = await usableFold(page);
    expect((box?.y ?? 0) >= 0, 'the primary action starts inside the viewport').toBe(true);
    expect((box?.y ?? 0) + (box?.height ?? 0), `the primary action ends inside ${fold}px`).toBeLessThanOrEqual(fold);
  });
}
