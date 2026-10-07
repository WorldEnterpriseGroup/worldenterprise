import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('home', () => {
  test('renders landmarks, one h1 and a skip link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('has no serious axe violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
});

test.describe('mega menu (desktop)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1100, 'desktop only');

  test('opens by keyboard, moves focus in, and Escape returns focus', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('[data-mega-trigger]').first();
    await trigger.focus();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    const panel = page.locator('[data-mega-panel]').first();
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('ArrowDown enters the panel and ArrowRight moves between triggers', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    await triggers.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(triggers.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-mega-panel]:popover-open a').first()).toBeFocused();
  });
});

test.describe('mega menu without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1100, 'desktop only');

  test('declarative popover still opens a panel containing the hub link', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('[data-mega-trigger]').first();
    await trigger.click();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible();
    await expect(panel.locator('a.mega-panel__hub')).toBeVisible();
  });
});

test.describe('mobile drawer', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1100, 'mobile only');

  test('opens the drawer and shows grouped sections', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('[data-mobile-drawer]')).toBeVisible();
    await expect(page.locator('[data-mobile-drawer] summary').first()).toBeVisible();
  });
});

test('captures full-page screenshots for review', async ({ page }, info) => {
  await page.goto('/');
  await page.screenshot({ path: `test-results/home-${info.project.name}.png`, fullPage: true });
});

test.describe('styleguide', () => {
  test('is noindex, has no serious axe violations and is screenshotted', async ({ page }, info) => {
    await page.goto('/styleguide/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    await page.screenshot({ path: `test-results/styleguide-${info.project.name}.png`, fullPage: true });
  });

  test('tabs enhance with keyboard support', async ({ page }) => {
    await page.goto('/styleguide/');
    const first = page.getByRole('tab', { name: 'First' });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true');
  });
});
