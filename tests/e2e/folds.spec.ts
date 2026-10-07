import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
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
