import { expect, test } from '@playwright/test';
import { isBuilt, liveRoutes } from './support/routes.ts';

// One spec, three projects: no-js (JavaScript disabled), forced-colors (Windows high contrast emulation) and zoom-200
// (720 CSS pixels wide, which is a 1440 px window at 200 percent). The assertions that apply depend on the project.

const SAMPLE = ['/', '/program/', '/services/', '/insights/', '/faq/'].filter(isBuilt);

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
});

test.describe('no-js', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'no-js', 'no-js project only');
  });

  test('the declarative popover opens a panel that contains the hub link', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-mega-trigger]').first().click();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible();
    await expect(panel.locator('a.mega-panel__hub')).toBeVisible();
  });

  test('content and links render without JavaScript', async ({ page }) => {
    for (const route of SAMPLE) {
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main#main a').first()).toBeVisible();
    }
  });

  test('the mobile drawer toggle does not hide the page content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main#main')).toBeVisible();
  });
});

test.describe('forced-colors', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'forced-colors', 'forced-colors project only');
  });

  test('emulation is active and the menu trigger and focus ring stay visible', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const trigger = page.locator('[data-mega-trigger]').first();
    await trigger.focus();
    const outline = await trigger.evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
    const border = await page.locator('[data-mega-panel]:popover-open').evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(border, 'panel has a visible edge in forced colors').not.toBe('none');
  });

  test('primary buttons keep a visible boundary', async ({ page }) => {
    await page.goto('/');
    const button = page.locator('a.btn--primary').first();
    await expect(button).toBeVisible();
    const style = await button.evaluate((el) => getComputedStyle(el).borderTopStyle);
    expect(style).not.toBe('none');
  });
});

test.describe('zoom-200', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'zoom-200', 'zoom-200 project only');
  });

  test('no horizontal scroll at 720 px on any built route', async ({ page }) => {
    const failures: string[] = [];
    for (const route of liveRoutes) {
      await page.goto(route.path);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) failures.push(`${route.path} overflows by ${over}px`);
    }
    expect(failures).toEqual([]);
  });

  test('navigation remains operable at 200 percent', async ({ page }) => {
    await page.goto('/');
    const drawerButton = page.getByRole('button', { name: 'Menu' });
    if (await drawerButton.isVisible()) {
      await drawerButton.click();
      await expect(page.locator('[data-mobile-drawer]')).toBeVisible();
    } else {
      await page.locator('[data-mega-trigger]').first().click();
      await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
    }
  });
});
