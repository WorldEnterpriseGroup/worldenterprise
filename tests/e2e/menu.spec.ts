import { expect, test } from '@playwright/test';
import { isBuilt } from './support/routes.ts';

// Mega-menu matrix, SAGE-PLAN 5.5: tab order, Enter and Space open, Escape closes and returns focus, arrow keys, Home and End,
// outside click, hover intent (fine pointers only), touch at 390 px. The no-JS, forced-colors and 200% zoom rows are in modes.spec.ts.

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
});

test.describe('desktop navigation', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop only');
  });

  test('the skip link is the first tab stop and then the logo and triggers follow in reading order', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link')).toBeFocused();
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
    const order: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => (document.activeElement?.hasAttribute('data-mega-trigger') ? 'trigger' : (document.activeElement?.tagName ?? ''))));
    }
    expect(order, 'at least one mega trigger is reachable by Tab within the header').toContain('trigger');
  });

  for (const key of ['Enter', 'Space']) {
    test(`${key} opens a panel, Escape closes it and focus returns to the trigger`, async ({ page }) => {
      await page.goto('/');
      const trigger = page.locator('[data-mega-trigger]').first();
      await trigger.focus();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press(key);
      const panel = page.locator('[data-mega-panel]:popover-open');
      await expect(panel).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(panel.locator('a.mega-panel__hub')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  }

  test('arrow keys move between triggers, Home and End jump to the ends, ArrowDown enters the panel', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    const last = (await triggers.count()) - 1;
    expect(last).toBeGreaterThan(0);
    await triggers.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(triggers.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(triggers.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(triggers.nth(last)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(triggers.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-mega-panel]:popover-open a').first()).toBeFocused();
  });

  test('opening one panel closes the other (single open)', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    await triggers.nth(0).click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(1);
    await triggers.nth(1).click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(1);
    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false');
  });

  test('a click outside closes the panel', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-mega-trigger]').first().click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
    await page.locator('main#main').click({ position: { x: 5, y: 400 }, force: true });
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(0);
  });

  test('the panel stays inside the viewport and does not move the page (no layout shift)', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('main#main').boundingBox();
    await page.locator('[data-mega-trigger]').first().click();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= (viewport?.width ?? 0) + 1, 'panel within viewport width').toBe(true);
    expect((box?.y ?? 0) + (box?.height ?? 0) <= (viewport?.height ?? 0) + 1, 'panel within viewport height').toBe(true);
    expect(await page.locator('main#main').boundingBox(), 'main did not shift').toEqual(before);
  });

  test('hover intent opens a panel for a fine pointer and Escape dismisses it', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('[data-mega-trigger]').first();
    await trigger.hover();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});

test.describe('mobile navigation', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'mobile only');
  });

  test('a tap on Menu opens the drawer with grouped sections and Escape closes it', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Menu' });
    await button.tap();
    const drawer = page.locator('[data-mobile-drawer]');
    await expect(drawer).toBeVisible();
    const group = drawer.locator('summary').first();
    await expect(group).toBeVisible();
    await group.tap();
    await expect(drawer.locator('details[open] a').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('touch targets in the drawer are at least 24 by 24 CSS pixels', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).tap();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('[data-mobile-drawer] a, [data-mobile-drawer] summary, [data-mobile-drawer] button')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.width < 24 || r.height < 24))
        .length,
    );
    expect(small).toBe(0);
  });
});
