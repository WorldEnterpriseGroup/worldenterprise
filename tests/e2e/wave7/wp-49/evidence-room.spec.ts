import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { quiet, watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-49: the evidence room builder. The checklist is the page without JavaScript; with it, the stage filter, the ticks and the copy
// and print actions work, and the only place the state lives is the part of the address after the "#" (DP-13).

const ROUTE = '/tools/evidence-room/';

function box(page: Page, code: string) {
  return page.locator(`we-evidence-room input[data-code="${code}"]`);
}

test.describe('evidence room (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the evidence room route is not built');
  });

  test('ticks and the stage live in the address, survive a reload, and open the same list from a shared link', async ({ page }) => {
    const network = quiet(page);
    await page.goto(ROUTE);
    await network.settled();
    await expect(page.locator('we-evidence-room')).toHaveAttribute('data-enhanced', '');
    await expect(page).not.toHaveURL(/#/);
    await box(page, '1b').check();
    await box(page, '1a').check();
    await expect(page).toHaveURL(/#done=1a\.1b$/);
    await page.getByRole('radio', { name: 'First product' }).check();
    await expect(page).toHaveURL(/#stage=first-product&done=1a\.1b$/);

    await page.reload();
    await expect(box(page, '1a')).toBeChecked();
    await expect(box(page, '1b')).toBeChecked();
    await expect(box(page, '1c')).not.toBeChecked();
    await expect(page.getByRole('radio', { name: 'First product' })).toBeChecked();

    // A shared link, opened cold in the same tab.
    await page.goto('about:blank');
    await page.goto(`${ROUTE}#stage=idea-or-prototype&done=r1.1a`);
    await expect(page.getByRole('radio', { name: 'Idea or prototype' })).toBeChecked();
    await expect(box(page, 'r1')).toBeChecked();
    await expect(box(page, '1a')).toBeChecked();
    await expect(page.locator('[data-progress]')).toHaveText(/^2 of \d+ items checked\.$/);

    await box(page, '1a').uncheck();
    await box(page, 'r1').uncheck();
    await page.getByRole('radio', { name: 'All items' }).check();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('a stage hides the items suggested for later stages, and a folder with nothing left disappears', async ({ page }) => {
    const network = quiet(page);
    await page.goto(ROUTE);
    await network.settled();
    const shown = page.locator('we-evidence-room [data-item]:not([hidden])');
    const all = await shown.count();
    await page.getByRole('radio', { name: 'Idea or prototype' }).check();
    const early = await shown.count();
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(all);
    await expect(page.locator('[data-item="9a"]')).toBeHidden();
    await expect(page.locator('[data-group="updates"]')).toBeHidden();
    await expect(page.locator('[data-item="1a"]')).toBeVisible();
    await page.getByRole('radio', { name: 'First product' }).check();
    const middle = await shown.count();
    expect(middle).toBeGreaterThan(early);
    expect(middle).toBeLessThan(all);
    await page.getByRole('radio', { name: 'Early customer evidence' }).check();
    await expect(page.locator('[data-item="9a"]')).toBeVisible();
    await page.getByRole('radio', { name: 'All items' }).check();
    expect(await shown.count()).toBe(all);
  });

  test('a tick on an item a stage hides is kept, and comes back with the stage', async ({ page }) => {
    const network = quiet(page);
    await page.goto(ROUTE);
    await network.settled();
    await box(page, '9a').check();
    await page.getByRole('radio', { name: 'Idea or prototype' }).check();
    await expect(page).toHaveURL(/done=9a/);
    await expect(page.locator('[data-progress]')).toHaveText(/^0 of /);
    await page.getByRole('radio', { name: 'All items' }).check();
    await expect(box(page, '9a')).toBeChecked();
    await expect(page.locator('[data-progress]')).toHaveText(/^1 of /);
  });

  test('an in-page anchor, such as the skip link, does not clear the ticks, and a bad hash is ignored', async ({ page }) => {
    const network = quiet(page);
    await page.goto(ROUTE);
    await network.settled();
    await box(page, '2a').check();
    await page.evaluate(() => {
      window.location.hash = 'main';
    });
    await expect(box(page, '2a')).toBeChecked();
    await page.goto(`${ROUTE}#stage=nonsense&done=zz.2a..%E0%A4%A`);
    await expect(page.getByRole('radio', { name: 'All items' })).toBeChecked();
    await expect(page.locator('[data-progress]')).toHaveText(/^\d+ of \d+ items checked\.$/);
  });

  test('Clear all ticks empties the list and the address, and keeps the stage', async ({ page }) => {
    const network = quiet(page);
    await page.goto(`${ROUTE}#stage=first-product&done=1a.1b.2a`);
    await network.settled();
    await expect(box(page, '2a')).toBeChecked();
    await page.getByRole('button', { name: 'Clear all ticks' }).click();
    await expect(box(page, '2a')).not.toBeChecked();
    await expect(page).toHaveURL(/#stage=first-product$/);
    await expect(page.locator('[data-message]')).toHaveText('All ticks cleared.');
  });

  test('Copy as Markdown puts the shown list, with the ticks, on the clipboard', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL ?? '' });
    const network = quiet(page);
    await page.goto(`${ROUTE}#stage=idea-or-prototype&done=1a`);
    await network.settled();
    await page.getByRole('button', { name: 'Copy as Markdown' }).click();
    await expect(page.locator('[data-message]')).toHaveText('Copied the checklist as Markdown.');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^# Evidence room checklist\n/);
    expect(text).toContain('Showing: Idea or prototype and earlier stages.');
    expect(text).toContain('- [x] Formation documents\n');
    expect(text).toContain('- [ ] Founder agreements\n');
    expect(text).not.toContain('Your dated investor updates');
    expect(text).toContain('WE makes no promise of funding.');
  });

  test('when the clipboard refuses, the Markdown is shown to copy by hand', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) }, configurable: true });
    });
    const network = quiet(page);
    await page.goto(`${ROUTE}#done=1a`);
    await network.settled();
    await page.getByRole('button', { name: 'Copy as Markdown' }).click();
    await expect(page.locator('[data-message]')).toContainText('Could not copy automatically (blocked)');
    await expect(page.locator('[data-fallback]')).toHaveJSProperty('open', true);
    await expect(page.locator('[data-markdown]')).toHaveValue(/- \[x\] Formation documents/);
  });

  test('Print calls the browser print, and on paper the controls are gone and the list stays', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    const network = quiet(page);
    await page.goto(`${ROUTE}#done=1a`);
    await network.settled();
    await page.getByRole('button', { name: 'Print this list' }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'Print this list' })).toBeHidden();
    await expect(page.locator('[data-item="1a"]')).toBeVisible();
    await expect(box(page, '1a')).toBeChecked();
  });

  test('nothing is stored and no request leaves the page after it has loaded', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    const network = quiet(page);
    await page.goto(ROUTE);
    await network.settled();
    const after: string[] = [];
    page.on('request', (request) => after.push(`${request.method()} ${request.url()}`));
    await box(page, '1a').check();
    await page.getByRole('radio', { name: 'First product' }).check();
    await page.getByRole('button', { name: 'Clear all ticks' }).click();
    expect(after).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    const stored = await page.evaluate(() => ({ local: window.localStorage.length, session: window.sessionStorage.length, cookie: document.cookie }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: '' });
  });

  test('ticking and filtering change no layout above the list', async ({ page }) => {
    const network = quiet(page);
    await page.goto(ROUTE);
    await network.settled();
    const top = () => page.evaluate(() => Math.round((document.querySelector('.evroom__controls')?.getBoundingClientRect().height ?? 0) + (document.querySelector('.evroom__group')?.getBoundingClientRect().top ?? 0) + window.scrollY));
    const before = await top();
    await box(page, '1a').check();
    await page.getByRole('radio', { name: 'First product' }).check();
    await page.getByRole('button', { name: 'Clear all ticks' }).click();
    await expect(page.locator('[data-message]')).toHaveText('All ticks cleared.');
    expect(await top()).toBe(before);
  });

  test('the funding statement is on the page, and the page names no Investor Introductions add-on', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('main').getByText('WE makes no promise of funding.').first()).toBeVisible();
    expect(await page.locator('main').innerText()).not.toMatch(/investor introductions/i);
    await expect(page.locator('we-evidence-room').getByText('a suggestion, not an investor requirement')).toBeVisible();
  });

  test('every item has a labelled checkbox in a row of at least 24px, and the stage group is a labelled radio group', async ({ page }) => {
    const network = quiet(page);
    await page.goto(ROUTE);
    await network.settled();
    const boxes = page.locator('we-evidence-room input[data-code]');
    const count = await boxes.count();
    expect(count).toBeGreaterThan(40);
    for (const index of [0, Math.floor(count / 2), count - 1]) {
      const input = boxes.nth(index);
      await expect(input).toHaveAccessibleName(/\S/);
      // The target is the whole row: the box and its label both toggle it.
      const rect = await input.locator('xpath=..').boundingBox();
      expect(rect?.width ?? 0).toBeGreaterThanOrEqual(24);
      expect(rect?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
    await expect(page.getByRole('group', { name: /Show the items suggested for your stage/ })).toBeVisible();
    await expect(page.locator('we-evidence-room').getByRole('radio')).toHaveCount(4);
  });

  test('the page passes axe, with a stage chosen and items ticked, and nothing overflows', async ({ page }) => {
    const network = quiet(page);
    await page.goto(`${ROUTE}#stage=first-product&done=1a.r3.s2`);
    await network.settled();
    const results = await analyzePage(page);
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  });
});

test.describe('evidence room without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the evidence room route is not built');
  });

  test('the whole checklist is on the page and can be ticked and printed; the script-only controls wait', async ({ page }) => {
    await page.goto(ROUTE);
    // Not getByText: Playwright's text engine never looks inside <noscript>, even when the browser renders it as elements.
    await expect(page.locator('noscript .callout')).toContainText('JavaScript is off.');
    await expect(page.locator('noscript .callout')).toBeVisible();
    expect(await page.locator('we-evidence-room input[data-code]').count()).toBeGreaterThan(40);
    await expect(page.locator('we-evidence-room [data-item][hidden]')).toHaveCount(0);
    await expect(box(page, '1a')).toBeEnabled();
    await box(page, '1a').check();
    await expect(box(page, '1a')).toBeChecked();
    for (const name of ['Copy as Markdown', 'Print this list', 'Clear all ticks']) await expect(page.getByRole('button', { name })).toBeDisabled();
    await expect(page.locator('we-evidence-room').getByRole('radio').first()).toBeDisabled();
    await expect(page.locator('[data-group="company"]')).toContainText('Formation documents');
    await expect(page.locator('[data-group="readiness"]')).toContainText('A one-page problem brief');
  });
});
