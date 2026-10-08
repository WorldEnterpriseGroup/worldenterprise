import { expect, test } from '@playwright/test';
import { findOverflow, formatOffenders } from './support/overflow.ts';
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
    const failures: string[] = [];
    for (const route of SAMPLE) {
      await page.goto(route);
      if ((await page.locator('h1').count()) !== 1) failures.push(`${route}: expected one h1`);
      if ((await page.locator('main#main a[href]').count()) === 0) failures.push(`${route}: main has no links`);
    }
    expect(failures).toEqual([]);
  });

  test('the mobile drawer toggle does not hide the page content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main#main')).toBeVisible();
  });

  // code-security P1-1. A form with no method submits as a GET query string, which puts the visitor's answers in the URL, the history and
  // the server log. Every built form must say method="post", and its button must be disabled unless the form posts to an https endpoint
  // natively. The forms job (tests/e2e/forms.spec.ts) proves the endpoint build; this proves the default build, where every form is off.
  test('every form is a POST form, and its button is disabled unless it posts to an https endpoint', async ({ page }) => {
    const routes = ['/apply/', '/contact/', '/newsletter/'].filter(isBuilt);
    test.skip(routes.length === 0, 'no form route is built');
    const failures: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const forms = page.locator('form[data-intake-form]');
      const count = await forms.count();
      if (count === 0) failures.push(`${route}: no intake form on a form route`);
      for (let index = 0; index < count; index += 1) {
        const form = forms.nth(index);
        const method = (await form.getAttribute('method'))?.toLowerCase() ?? null;
        const action = await form.getAttribute('action');
        const disabled = await form.locator('[data-submit]').isDisabled();
        if (method !== 'post') failures.push(`${route}: form ${index} has method "${method}", expected "post"`);
        if (action === null && !disabled) failures.push(`${route}: form ${index} has no action and an enabled submit button`);
        if (action !== null && !action.startsWith('https://')) failures.push(`${route}: form ${index} posts to "${action}", expected https`);
      }
    }
    expect(failures).toEqual([]);
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

  test('no horizontal scroll and no element outside the viewport at 720 px on any built route', async ({ page }) => {
    test.setTimeout(300_000);
    const failures: string[] = [];
    for (const route of liveRoutes) {
      await page.goto(route.path);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) failures.push(`${route.path} scrolls sideways by ${over}px`);
      const offenders = await findOverflow(page);
      if (offenders.length > 0) failures.push(`${route.path}: ${formatOffenders(offenders, 3)}`);
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
