import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS } from './support/page-guards.ts';
import { isBuilt, liveRoutes } from './support/routes.ts';

// axe-core at WCAG 2.2 AA on every built route, and again with the mega menu open (desktop) or the drawer open (mobile).
// All impacts fail; there is no allow list, so a violation is fixed at its owner.

interface Violation {
  readonly id: string;
  readonly impact?: string | null;
  readonly nodes: readonly { target: readonly unknown[] }[];
}
const summarise = (violations: readonly Violation[]): string[] => violations.map((v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

for (const { path: route } of liveRoutes) {
  test(`axe ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(summarise(results.violations)).toEqual([]);
  });
}

test('axe with the navigation open', async ({ page, isMobile }) => {
  test.skip(!isBuilt('/'), 'home is not built');
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('[data-mobile-drawer]')).toBeVisible();
  } else {
    await page.locator('[data-mega-trigger]').first().click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
  }
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(summarise(results.violations)).toEqual([]);
});

test('axe on every mega menu panel', async ({ page, isMobile }) => {
  test.skip(isMobile || !isBuilt('/'), 'desktop only');
  await page.goto('/');
  const count = await page.locator('[data-mega-trigger]').count();
  const failures: string[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.locator('[data-mega-trigger]').nth(i).click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    failures.push(...summarise(results.violations).map((line) => `panel ${i}: ${line}`));
    await page.keyboard.press('Escape');
  }
  expect(failures).toEqual([]);
});
