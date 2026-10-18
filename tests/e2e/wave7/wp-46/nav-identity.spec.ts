import { expect, test } from '@playwright/test';
import { analyzePage } from '../../support/budgets.ts';

// WP-46: mega-menu identity (one tile per panel, each page once, consistent descriptions) and the mobile drawer.

test.describe('the mega panels', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop only');
  });

  test('every panel has an eyebrow naming its section, one featured tile, and lists each page once', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    const count = await triggers.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i += 1) {
      const trigger = triggers.nth(i);
      const label = ((await trigger.textContent()) ?? '').trim();
      await trigger.click();
      const panel = page.locator('[data-mega-panel]:popover-open');
      await expect(panel, `${label}: the panel opens`).toBeVisible();
      await expect(panel.locator('.mega-panel__eyebrow'), `${label}: eyebrow`).toHaveText(label);
      await expect(panel.locator('.mega-panel__featured'), `${label}: one tile`).toHaveCount(1);
      const hrefs = await panel.locator('a').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).pathname));
      // The hub of the lead and the tile may name the same page; no other page appears twice.
      const repeats = hrefs.filter((href, at) => hrefs.indexOf(href) !== at);
      expect(repeats, `${label}: pages listed more than once`).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
  });

  test('a column shows descriptions for every link or for none', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    for (let i = 0; i < (await triggers.count()); i += 1) {
      await triggers.nth(i).click();
      const panel = page.locator('[data-mega-panel]:popover-open');
      await expect(panel).toBeVisible();
      const columns = await panel.locator('.mega-panel__column').evaluateAll((sections) =>
        sections.map((section) => {
          const links = [...section.querySelectorAll('li > a')];
          return { links: links.length, described: links.filter((a) => a.querySelector('.mega-panel__desc') !== null).length };
        }),
      );
      for (const column of columns) expect([0, column.links], `a column with ${column.links} links and ${column.described} descriptions`).toContain(column.described);
      await page.keyboard.press('Escape');
    }
  });

  test('the Resources tile names a research brief and links to a page on this site', async ({ page }) => {
    await page.goto('/');
    const resources = page.locator('[data-mega-trigger]', { hasText: 'Resources' });
    await resources.click();
    const tile = page.locator('[data-mega-panel]:popover-open .mega-panel__featured');
    await expect(tile).toBeVisible();
    const cta = tile.locator('a');
    await expect(cta).toHaveAttribute('href', /\/research\//);
    await expect(tile.locator('.mega-panel__featured-title')).not.toHaveText('');
  });

  test('an open panel has no axe violation and stays inside the viewport', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-mega-trigger]').first().click();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible();
    const results = await analyzePage(page);
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    const box = await panel.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0) <= (page.viewportSize()?.height ?? 0) + 1).toBe(true);
  });
});

test.describe('the mobile drawer', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'mobile only');
  });

  test('Apply is a 48px target that stays on screen while the sections scroll, and every section link is 48px', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).tap();
    const drawer = page.locator('[data-mobile-drawer]');
    await expect(drawer).toBeVisible();
    // Open every section so the list is longer than the screen, then scroll it to the end.
    await page.evaluate(() => {
      for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-mobile-drawer] details')) details.open = true;
      const nav = document.querySelector('[data-mobile-drawer] > nav');
      if (nav) nav.scrollTop = nav.scrollHeight;
    });
    const apply = drawer.locator('.mobile-drawer__apply a');
    await expect(apply).toBeInViewport();
    const box = await apply.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(47.5);
    const viewport = page.viewportSize();
    expect((box?.y ?? 0) + (box?.height ?? 0) <= (viewport?.height ?? 0) + 1, 'Apply is inside the screen').toBe(true);
    const heights = await drawer.locator('summary, details a').evaluateAll((els) => els.filter((el) => (el as HTMLElement).checkVisibility()).map((el) => el.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(5);
    expect(Math.min(...heights), 'smallest section target').toBeGreaterThanOrEqual(47.5);
  });

  test('the open drawer has no axe violation, and Apply leads to /apply/', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).tap();
    const drawer = page.locator('[data-mobile-drawer]');
    await expect(drawer).toBeVisible();
    const results = await analyzePage(page);
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    await expect(drawer.locator('.mobile-drawer__apply a')).toHaveAttribute('href', /\/apply\/$/);
  });

  test('the drawer does not repeat Apply on the application page', async ({ page }) => {
    await page.goto('/apply/');
    await page.getByRole('button', { name: 'Menu' }).tap();
    await expect(page.locator('[data-mobile-drawer]')).toBeVisible();
    await expect(page.locator('.mobile-drawer__apply')).toHaveCount(0);
  });
});

test.describe('without JavaScript', () => {
  test('the header keeps its Search link to /search/, and no dead button shows', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');
    const link = page.locator('[data-palette-fallback]').first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /\/search\/$/);
    await expect(page.locator('button[data-palette-open]').first()).toBeHidden();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await context.close();
  });
});
