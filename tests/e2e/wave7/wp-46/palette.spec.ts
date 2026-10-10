import { existsSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-46: the command palette (<we-palette>). Keyboard only, roles, timing, and the guards (no third party, no console error).
// These specs are not matched by the existing Playwright projects (they match by file name at tests/e2e/*); the e2e:wave7 job that
// WP-40 wires runs them.

const OPEN_KEY = 'ControlOrMeta+k';
// The palette must be interactive within 100 ms of the first open on the CI runner. The assertion has a 3x margin (300 ms) because a
// shared runner is noisy; the measured value is attached to the report so a drift toward the limit is visible before it fails.
const BUDGET_MS = 100;
const MARGIN = 3;

test.describe('the command palette, keyboard only', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'the keyboard flows run on the desktop project; the mobile project opens it from the drawer');
  });

  test('Ctrl or Cmd plus K opens it, "pricing" finds Pricing, Enter goes there, and the new page has no palette open', async ({ page, baseURL }) => {
    test.skip(!isBuilt('/pricing/'), '/pricing/ is not built');
    const seen = watch(page, baseURL ?? '');
    await page.goto('/');
    await expect(page.locator('[data-palette-open]').first()).toBeVisible();
    await page.keyboard.press(OPEN_KEY);
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('combobox');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.type('pricing');
    const first = dialog.getByRole('option').first();
    await expect(first).toHaveAccessibleName(/Pricing/);
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id')) ?? '');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/pricing\/$/);
    await expect(page.getByRole('dialog', { name: 'Search the site' })).toBeHidden();
    expect(seen.thirdParty, 'no third-party request').toEqual([]);
    expect(seen.consoleErrors, 'no console error').toEqual([]);
    // Chrome reports a cross-document view transition that it skips under load as an error event of its own; it is not the page's.
    expect(seen.pageErrors.filter((message) => !message.startsWith('Transition was aborted')), 'no uncaught exception').toEqual([]);
  });

  test('the arrow keys wrap through the list, and Escape closes it and returns focus to the control that opened it', async ({ page }) => {
    await page.goto('/');
    const opener = page.locator('[data-palette-open]').first();
    await expect(opener).toBeVisible();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    const options = dialog.getByRole('option');
    const count = await options.count();
    expect(count, 'the empty palette lists the pages').toBeGreaterThan(5);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(options.last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('"/" opens it from the page but not from inside a field, and Tab moves from the field to Close and back', async ({ page }) => {
    test.skip(!isBuilt('/search/') || !existsSync('dist/pagefind/pagefind.js'), '/search/ or the Pagefind index is not in dist');
    await page.goto('/search/');
    const field = page.locator('#we-search-input');
    await expect(field).toBeVisible();
    await field.focus();
    await page.keyboard.type('a/b');
    await expect(field).toHaveValue('a/b');
    await expect(page.getByRole('dialog', { name: 'Search the site' })).toBeHidden();
    await field.blur();
    await page.keyboard.press('/');
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox')).toHaveValue('');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('combobox')).toBeFocused();
  });

  test('a query with no match says so in the live region and still offers the full search', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press(OPEN_KEY);
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    await page.keyboard.type('zzzqqqxx');
    await expect(dialog.getByRole('status')).toContainText(/no pages|search all|zzzqqqxx/i);
    await expect(dialog.getByRole('option', { name: /search all pages/i })).toBeVisible();
  });

  test('the open palette has the roles of a combobox over a listbox and no axe violation, and fits 720 by 450', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press(OPEN_KEY);
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toMatchAriaSnapshot(`
      - heading "Search the site" [level=2]
      - combobox "Search pages or type a page name"
      - button "Close"
      - listbox "Pages and search results"
    `);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    await page.setViewportSize({ width: 720, height: 450 });
    const box = await dialog.boundingBox();
    expect(box, 'the dialog has a box').not.toBeNull();
    expect((box?.y ?? -1) >= 0 && (box?.y ?? 0) + (box?.height ?? 0) <= 450 + 1, 'the dialog fits the short viewport').toBe(true);
    await expect(dialog.getByRole('combobox')).toBeVisible();
  });

  test('on the first open it is interactive in under 100 ms, with a 3x margin for the runner', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('[data-palette-open]').first()).toBeVisible();
    // Measured inside the page, from the key event to the moment the input has focus and the list has options. A cold open: nothing
    // has opened the palette yet in this document, and the index is not needed to show the pages. The open is synchronous, so the state
    // is read as soon as the event has been handled; the time to the next painted frame depends on the runner's rendering and is only
    // attached to the report.
    const { elapsed, painted } = await page.evaluate(
      () =>
        new Promise<{ elapsed: number; painted: number }>((resolve, reject) => {
          const input = document.querySelector<HTMLInputElement>('[data-palette-input]');
          if (input === null) {
            reject(new Error('the palette input is missing'));
            return;
          }
          const started = performance.now();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
          const interactive = document.activeElement === input && document.querySelectorAll('[data-palette-list] [role="option"]').length > 0;
          if (!interactive) {
            reject(new Error('the palette was not interactive when the key event had been handled'));
            return;
          }
          const elapsed = performance.now() - started;
          requestAnimationFrame(() => resolve({ elapsed, painted: performance.now() - started }));
        }),
    );
    testInfo.annotations.push({ type: 'first-open-ms', description: elapsed.toFixed(1) });
    testInfo.annotations.push({ type: 'first-open-painted-ms', description: painted.toFixed(1) });
    expect(elapsed, `first open took ${elapsed.toFixed(1)} ms (budget ${BUDGET_MS} ms, limit ${BUDGET_MS * MARGIN} ms)`).toBeLessThan(BUDGET_MS * MARGIN);
  });
});

test.describe('the command palette on a phone', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'mobile only');
  });

  test('the drawer has a Search entry that opens it, and Apply stays in view while the sections scroll', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).tap();
    const drawer = page.locator('[data-mobile-drawer]');
    await expect(drawer).toBeVisible();
    const apply = drawer.locator('.mobile-drawer__apply a');
    await expect(apply).toBeVisible();
    const search = drawer.locator('button[data-palette-open]');
    await expect(search).toBeVisible();
    expect((await search.boundingBox())?.height ?? 0, 'a 48px target').toBeGreaterThanOrEqual(47.5);
    await search.tap();
    const dialog = page.getByRole('dialog', { name: 'Search the site' });
    await expect(dialog).toBeVisible();
    await expect(drawer).toBeHidden();
    await expect(dialog.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
