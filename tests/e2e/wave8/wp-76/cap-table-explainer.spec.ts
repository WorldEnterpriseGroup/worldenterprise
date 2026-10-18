import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { quiet, watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';
import { trackEgress } from './egress.ts';

// WP-76: the cap table explainer. The shares a founder types never leave the page, nothing is stored, bad entries are described and never
// become NaN or Infinity, updating a result moves nothing, it works from the keyboard alone, and the formulas stand without JavaScript.
// The page carries no SAFE, valuation or price content (DP-9).

const ROUTE = '/tools/cap-table-explainer/';
const ILLUSTRATION = 'An illustration from your inputs, not advice.';

const value = (page: Page, id: string) => page.locator(`[data-result="${id}"] [data-value]`);
const detail = (page: Page, id: string) => page.locator(`[data-result="${id}"] [data-detail]`);

async function fill(page: Page, values: Readonly<Record<string, string>>): Promise<void> {
  for (const [id, text] of Object.entries(values)) await page.locator(`#cap-${id}`).fill(text);
}

async function openPage(page: Page): Promise<void> {
  const network = quiet(page);
  await page.goto(ROUTE);
  await network.settled();
  await expect(page.locator('we-cap-table')).toHaveAttribute('data-enhanced', '');
}

interface Geometry {
  readonly documentHeight: number;
  readonly results: readonly { readonly top: number; readonly height: number }[];
  readonly fields: readonly { readonly top: number; readonly height: number }[];
}

/** Where the page's blocks sit now, in document coordinates. A result update must leave all of it as it was. */
function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top + window.scrollY), height: Math.round(rect.height) };
    };
    return {
      documentHeight: document.documentElement.scrollHeight,
      results: [...document.querySelectorAll('.tool-result')].map(box),
      fields: [...document.querySelectorAll('.tool-field')].map(box),
    };
  });
}

test.describe('cap table explainer (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the cap table explainer route is not built');
  });

  test('the page opens empty: no value, no placeholder, four waiting results, and the illustration line on each', async ({ page }) => {
    await openPage(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const inputs = page.locator('we-cap-table input');
    await expect(inputs).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(inputs.nth(i)).toHaveValue('');
      await expect(inputs.nth(i)).not.toHaveAttribute('placeholder', /.*/);
      await expect(inputs.nth(i)).toBeEnabled();
    }
    for (const id of ['before', 'after', 'change', 'total']) await expect(value(page, id)).toHaveText('Waiting');
    await expect(page.locator('we-cap-table [data-status="ready"]')).toHaveCount(0);
    await expect(page.locator('we-cap-table').getByText(ILLUSTRATION)).toHaveCount(4);
  });

  test('ownership today appears with two holdings, and the rest wait for the new shares', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: '1,000', others: '3,000' });
    await expect(value(page, 'before')).toHaveText('25.00%');
    await expect(detail(page, 'before')).toHaveText('1,000 / 4,000 = 25.00%');
    await expect(value(page, 'after')).toHaveText('Waiting');
    await expect(detail(page, 'after')).toHaveText('Enter New shares to issue to see this.');
  });

  test('issuing shares works out ownership after, the change and the total, with the working shown, and nothing reaches the address bar', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: '1000', others: '3000', issue: '1000' });
    await expect(value(page, 'after')).toHaveText('20.00%');
    await expect(detail(page, 'after')).toHaveText('1,000 / 5,000 = 20.00%');
    await expect(value(page, 'change')).toHaveText('-5.00 points');
    await expect(detail(page, 'change')).toHaveText('From 25.00% to 20.00%, worked from the unrounded figures.');
    await expect(value(page, 'total')).toHaveText('5,000');
    await expect(detail(page, 'total')).toHaveText('1,000 + 3,000 + 1,000 = 5,000');
    await expect(page.locator('[data-result="after"]')).toHaveAttribute('data-status', 'ready');
    expect(new URL(page.url()).search).toBe('');
    expect(new URL(page.url()).hash).toBe('');
    await fill(page, { issue: '0' });
    await expect(value(page, 'change')).toHaveText('0.00 points');
  });

  test('no request leaves the page after it has loaded, and nothing is stored, however many numbers are typed', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await openPage(page);
    const after = await trackEgress(page, baseURL);
    await fill(page, { yours: '1000', others: '3000', issue: '500' });
    await expect(value(page, 'after')).toHaveText('22.22%');
    await page.getByRole('button', { name: 'Clear all numbers' }).click();
    await fill(page, { yours: 'abc', others: '-5' });
    await expect(page.locator('[data-note="yours"]')).toContainText('Shares you hold: enter digits only');
    expect(after).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    const stored = await page.evaluate(() => ({ local: window.localStorage.length, session: window.sessionStorage.length, cookie: document.cookie }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: '' });
    expect(await page.context().cookies()).toEqual([]);
  });

  test('a bad entry is described next to its field and never becomes NaN or Infinity', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: '100', others: '300', issue: '50' });
    await expect(value(page, 'before')).toHaveText('25.00%');
    const bad: readonly [string, string, RegExp][] = [
      ['yours', 'abc', /^Shares you hold: enter digits only/],
      ['yours', 'Infinity', /^Shares you hold: enter digits only/],
      ['yours', '1e3', /^Shares you hold: enter digits only/],
      ['others', '-5', /^Other shares already issued: enter zero or more/],
      ['issue', '2.5', /^New shares to issue: enter a whole number/],
      ['yours', '5000000000000', /below one trillion/],
    ];
    const good: Readonly<Record<string, string>> = { yours: '100', others: '300', issue: '50' };
    for (const [id, text, message] of bad) {
      await page.locator(`#cap-${id}`).fill(text);
      await expect(page.locator(`[data-note="${id}"]`)).toHaveText(message);
      await expect(page.locator(`#cap-${id}`)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(`[data-note="${id}"]`)).toHaveAttribute('data-error', '');
      const body = (await page.locator('we-cap-table').innerText()).replace(/\s+/g, ' ');
      expect(body, `${id}=${text}`).not.toMatch(/NaN|Infinity|undefined|\bnull\b/);
      await page.locator(`#cap-${id}`).fill(good[id] ?? '');
      await expect(page.locator(`#cap-${id}`)).not.toHaveAttribute('aria-invalid', 'true');
    }
  });

  test('an empty cap table and a first issue are answered in words and in numbers, not with an error', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: '0', others: '0', issue: '0' });
    await expect(value(page, 'before')).toHaveText('Not defined');
    await expect(detail(page, 'before')).toContainText('No shares are issued today');
    await expect(value(page, 'total')).toHaveText('0');
    await fill(page, { issue: '10' });
    await expect(value(page, 'after')).toHaveText('0.00%');
    await expect(value(page, 'change')).toHaveText('Not defined');
    const body = (await page.locator('we-cap-table').innerText()).replace(/\s+/g, ' ');
    expect(body).not.toMatch(/NaN|Infinity/);
  });

  test('the results sit in one polite status region with a name', async ({ page }) => {
    await page.goto(ROUTE);
    const regions = page.locator('we-cap-table [role="status"]');
    await expect(regions).toHaveCount(1);
    await expect(regions).toHaveAttribute('aria-live', 'polite');
    await expect(regions).toHaveAccessibleName('Results: ownership');
    await expect(regions.locator('[data-result]')).toHaveCount(4);
  });

  test('updating the results, or showing an error, moves nothing on the page', async ({ page }) => {
    await openPage(page);
    await page.locator('#cap-yours').scrollIntoViewIfNeeded();
    const empty = await geometry(page);
    await fill(page, { yours: '1000', others: '3000', issue: '1000' });
    await expect(value(page, 'after')).toHaveText('20.00%');
    expect(await geometry(page)).toEqual(empty);
    await fill(page, { yours: 'abc', issue: '1.5' });
    await expect(page.locator('[data-note="yours"]')).toContainText('enter digits only');
    expect(await geometry(page)).toEqual(empty);
    // The largest entries still give a result inside its own block, and never a broken layout.
    await fill(page, { yours: '999,999,999,999', others: '999,999,999,999', issue: '999,999,999,999' });
    await expect(value(page, 'total')).toHaveText('2,999,999,999,997');
    expect(await geometry(page)).toEqual(empty);
    expect(await findOverflow(page)).toEqual([]);
  });

  test('typing is announced once it settles, not once for every key', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: '1000', others: '3000' });
    await expect(value(page, 'before')).toHaveText('25.00%');
    await page.locator('#cap-yours').fill('');
    await expect(value(page, 'before')).toHaveText('Waiting');
    await page.evaluate(() => {
      const target = document.querySelector('[data-result="before"] [data-value]');
      const log: string[] = [];
      (window as unknown as { __cap: string[] }).__cap = log;
      if (target !== null) new MutationObserver(() => log.push(target.textContent ?? '')).observe(target, { childList: true, characterData: true, subtree: true });
    });
    await page.locator('#cap-yours').pressSequentially('2000', { delay: 40 });
    await expect(value(page, 'before')).toHaveText('40.00%');
    const log = await page.evaluate(() => (window as unknown as { __cap: string[] }).__cap);
    expect(log.length, `ownership was rewritten ${log.length} times: ${log.join(' | ')}`).toBeLessThanOrEqual(2);
  });

  test('it works from the keyboard alone: Tab through the fields, type, and clear with Enter', async ({ page }) => {
    await openPage(page);
    await page.locator('#cap-yours').focus();
    await page.keyboard.type('900');
    await page.keyboard.press('Tab');
    await expect(page.locator('#cap-others')).toBeFocused();
    await page.keyboard.type('2700');
    await page.keyboard.press('Tab');
    await expect(page.locator('#cap-issue')).toBeFocused();
    await expect(value(page, 'before')).toHaveText('25.00%');
    await page.keyboard.press('Tab');
    const clear = page.getByRole('button', { name: 'Clear all numbers' });
    await expect(clear).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#cap-yours')).toHaveValue('');
    await expect(value(page, 'before')).toHaveText('Waiting');
  });

  test('Clear all numbers empties every field and returns every result to waiting', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: '1000', others: '3000', issue: '1000' });
    await expect(value(page, 'after')).toHaveText('20.00%');
    await page.getByRole('button', { name: 'Clear all numbers' }).click();
    for (const id of ['yours', 'others', 'issue']) await expect(page.locator(`#cap-${id}`)).toHaveValue('');
    for (const id of ['before', 'after', 'change', 'total']) await expect(value(page, id)).toHaveText('Waiting');
    await expect(page.locator('[data-result][data-status="ready"]')).toHaveCount(0);
  });

  test('the formulas, the assumptions and the methodology are on the page, and the funding sentence is there', async ({ page }) => {
    await page.goto(ROUTE);
    const table = page.locator('#formulas table');
    await expect(table.locator('tbody tr')).toHaveCount(4);
    await expect(table.getByRole('row', { name: /Your ownership today/ })).toContainText('Shares you hold divided by all issued shares');
    await expect(page.getByText('Your numbers stay on this page.').first()).toBeVisible();
    await expect(page.locator('main').getByText('WE makes no promise of funding.').first()).toBeVisible();
  });

  test('the page has no SAFE, valuation, discount or price content', async ({ page }) => {
    await page.goto(ROUTE);
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\bSAFEs?\b|valuation|discount|convertible note|[$€£]\s?\d/i);
  });

  test('the page carries one WebApplication node with an id, a name and a url, and no price', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const nodes = blocks.flatMap((block) => {
      const parsed: unknown = JSON.parse(block);
      const graph = (parsed as { '@graph'?: unknown[] })['@graph'];
      return (Array.isArray(graph) ? graph : [parsed]) as Record<string, unknown>[];
    });
    const apps = nodes.filter((node) => node['@type'] === 'WebApplication');
    expect(apps).toHaveLength(1);
    const app = apps[0] ?? {};
    expect(app['url']).toBe(`https://worldenterprise.org${ROUTE}`);
    expect(app['@id']).toBe(`https://worldenterprise.org${ROUTE}#app`);
    for (const key of ['offers', 'price', 'priceCurrency', 'priceSpecification']) expect(app).not.toHaveProperty(key);
  });

  // One test per state, so each has its own time budget: a full axe scan is slow on a loaded runner.
  const scan = async (page: Page, label: string): Promise<void> => {
    const results = await analyzePage(page);
    expect(results.violations.map((v) => `${label} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  };

  test('the empty page passes axe and nothing overflows', async ({ page }) => {
    await openPage(page);
    await scan(page, 'empty');
  });

  test('the filled page passes axe and nothing overflows', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: '1000', others: '3000', issue: '1000' });
    await expect(value(page, 'after')).toHaveText('20.00%');
    await scan(page, 'filled');
  });

  test('the page with errors passes axe and nothing overflows', async ({ page }) => {
    await openPage(page);
    await fill(page, { yours: 'abc', issue: '1.5' });
    await expect(page.locator('[data-note="yours"]')).toContainText('enter digits only');
    await scan(page, 'errors');
  });

  test('every field is labelled, described, reachable by keyboard and at least 24px tall', async ({ page }) => {
    await openPage(page);
    const inputs = page.locator('we-cap-table input');
    for (let i = 0; i < 3; i += 1) {
      const input = inputs.nth(i);
      await expect(input).toHaveAccessibleName(/\S/);
      await expect(input).toHaveAccessibleDescription(/\S/);
      expect((await input.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe('cap table explainer without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the cap table explainer route is not built');
  });

  test('the formulas are the page, and the fields wait for a script instead of doing nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('#formulas table tbody tr')).toHaveCount(4);
    await expect(page.locator('#formulas')).toContainText('Shares you hold divided by all issued shares');
    // Not getByText: Playwright's text engine never looks inside <noscript>, even when the browser renders it as elements.
    await expect(page.locator('noscript .callout')).toContainText('JavaScript is off.');
    await expect(page.locator('noscript .callout')).toBeVisible();
    const inputs = page.locator('we-cap-table input');
    await expect(inputs).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) await expect(inputs.nth(i)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear all numbers' })).toBeDisabled();
    await expect(page.locator('we-cap-table').getByText(ILLUSTRATION)).toHaveCount(4);
  });
});
