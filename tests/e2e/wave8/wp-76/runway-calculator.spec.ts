import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-76: the runway calculator. The numbers a founder types never leave the page, nothing is stored, bad entries are described and never
// become NaN or Infinity, updating a result moves nothing, it works from the keyboard alone, and the formulas stand without JavaScript.

const ROUTE = '/tools/runway-calculator/';
const ILLUSTRATION = 'An illustration from your inputs, not advice.';

const level = (page: Page) => page.locator('[data-result="level"] [data-value]');
const growing = (page: Page) => page.locator('[data-result="growing"] [data-value]');

async function fill(page: Page, values: Readonly<Record<string, string>>): Promise<void> {
  for (const [id, value] of Object.entries(values)) await page.locator(`#runway-${id}`).fill(value);
}

async function open(page: Page): Promise<void> {
  await page.goto(ROUTE);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('we-runway')).toHaveAttribute('data-enhanced', '');
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

test.describe('runway calculator (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the runway calculator route is not built');
  });

  test('the page opens empty: no value, no placeholder, two waiting results, and the illustration line on each', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const inputs = page.locator('we-runway input');
    await expect(inputs).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(inputs.nth(i)).toHaveValue('');
      await expect(inputs.nth(i)).not.toHaveAttribute('placeholder', /.*/);
      await expect(inputs.nth(i)).toBeEnabled();
    }
    await expect(level(page)).toHaveText('Waiting');
    await expect(growing(page)).toHaveText('Waiting');
    await expect(page.locator('we-runway [data-status="ready"]')).toHaveCount(0);
    await expect(page.locator('we-runway').getByText(ILLUSTRATION)).toHaveCount(2);
  });

  test('level and growing runway work out, with the working shown, and nothing reaches the address bar', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '100,000', burn: '10,000' });
    await expect(level(page)).toHaveText('10.0 months');
    await expect(page.locator('[data-result="level"] [data-detail]')).toHaveText('100,000 / 10,000 = 10.0 months, which is 10 whole months');
    await expect(growing(page)).toHaveText('Waiting');
    await fill(page, { growth: '0' });
    await expect(growing(page)).toHaveText('10.0 months');
    await fill(page, { cash: '100', burn: '10', growth: '100' });
    await expect(growing(page)).toHaveText('3.3 months');
    await expect(page.locator('[data-result="growing"] [data-detail]')).toHaveText('3 whole months use 70. 30 is left against 80 for month 4, which is 0.37 of a month. Total: 3.3 months');
    await expect(page.locator('[data-result="growing"]')).toHaveAttribute('data-status', 'ready');
    expect(new URL(page.url()).search).toBe('');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('runway is rounded down, never up', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '100000', burn: '18000' });
    await expect(level(page)).toHaveText('5.5 months');
    await fill(page, { cash: '100000', burn: '14000' });
    await expect(level(page)).toHaveText('7.1 months');
  });

  test('no request leaves the page after it has loaded, and nothing is stored, however many numbers are typed', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await open(page);
    const after: string[] = [];
    // The tool sends data with fetch, XHR, a beacon or a socket. A lazy image of the page's own header or footer is not the tool, so
    // static resource types are left out; any non-GET request is still counted.
    page.on('request', (request) => {
      if (request.method() === 'GET' && ['image', 'font', 'stylesheet', 'script', 'media'].includes(request.resourceType())) return;
      after.push(`${request.method()} ${request.url()}`);
    });
    page.on('websocket', (socket) => after.push(`websocket ${socket.url()}`));
    // With every request refused, anything the tool tried to send would also show up as a failure.
    await page.route('**/*', (route) => route.abort());
    await fill(page, { cash: '120000', burn: '15000', growth: '5' });
    await expect(level(page)).toHaveText('8.0 months');
    await page.getByRole('button', { name: 'Clear all numbers' }).click();
    await fill(page, { cash: 'abc', burn: '-5' });
    await expect(page.locator('[data-note="cash"]')).toContainText('Cash on hand: enter digits only');
    expect(after).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    const stored = await page.evaluate(() => ({ local: window.localStorage.length, session: window.sessionStorage.length, cookie: document.cookie }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: '' });
    expect(await page.context().cookies()).toEqual([]);
  });

  test('a bad entry is described next to its field and never becomes NaN or Infinity', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '100000', burn: '10000', growth: '5' });
    await expect(level(page)).toHaveText('10.0 months');
    const bad: readonly [string, string, RegExp][] = [
      ['cash', 'abc', /^Cash on hand: enter digits only/],
      ['cash', 'Infinity', /^Cash on hand: enter digits only/],
      ['cash', '1e3', /^Cash on hand: enter digits only/],
      ['burn', '-5', /^Net burn per month: enter zero or more/],
      ['growth', '101', /from 0 to 100/],
      ['cash', '5000000000000', /below one trillion/],
    ];
    const good: Readonly<Record<string, string>> = { cash: '100000', burn: '10000', growth: '5' };
    for (const [id, text, message] of bad) {
      await page.locator(`#runway-${id}`).fill(text);
      await expect(page.locator(`[data-note="${id}"]`)).toHaveText(message);
      await expect(page.locator(`#runway-${id}`)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(`[data-note="${id}"]`)).toHaveAttribute('data-error', '');
      const body = (await page.locator('we-runway').innerText()).replace(/\s+/g, ' ');
      expect(body, `${id}=${text}`).not.toMatch(/NaN|Infinity|undefined|\bnull\b/);
      await page.locator(`#runway-${id}`).fill(good[id] ?? '');
      await expect(page.locator(`#runway-${id}`)).not.toHaveAttribute('aria-invalid', 'true');
    }
  });

  test('zero net burn and zero cash are answered in words and in numbers, not with an error', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '5000', burn: '0', growth: '4' });
    await expect(level(page)).toHaveText('Not defined');
    await expect(growing(page)).toHaveText('Not defined');
    await expect(page.locator('[data-result="level"] [data-detail]')).toContainText('Net burn is 0');
    await fill(page, { cash: '0', burn: '10' });
    await expect(level(page)).toHaveText('0.0 months');
    const body = (await page.locator('we-runway').innerText()).replace(/\s+/g, ' ');
    expect(body).not.toMatch(/NaN|Infinity/);
  });

  test('a runway past the count the tool makes is stated, not shown as a number', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '1000000000000', burn: '1', growth: '1' });
    await expect(growing(page)).toHaveText('Not defined');
    await expect(page.locator('[data-result="growing"] [data-detail]')).toContainText('1,200 months');
  });

  test('the results sit in one polite status region with a name', async ({ page }) => {
    await page.goto(ROUTE);
    const regions = page.locator('we-runway [role="status"]');
    await expect(regions).toHaveCount(1);
    await expect(regions).toHaveAttribute('aria-live', 'polite');
    await expect(regions).toHaveAccessibleName('Results: runway');
    await expect(regions.locator('[data-result]')).toHaveCount(2);
  });

  test('updating the results, or showing an error, moves nothing on the page', async ({ page }) => {
    await open(page);
    await page.locator('#runway-cash').scrollIntoViewIfNeeded();
    const empty = await geometry(page);
    await fill(page, { cash: '120000', burn: '15000', growth: '5' });
    await expect(level(page)).toHaveText('8.0 months');
    expect(await geometry(page)).toEqual(empty);
    await fill(page, { cash: 'abc', growth: '120' });
    await expect(page.locator('[data-note="cash"]')).toContainText('enter digits only');
    expect(await geometry(page)).toEqual(empty);
    // A very large entry is a stated "not defined", never a broken layout, and the page still holds its place.
    await fill(page, { cash: '999,999,999,999', burn: '0.01', growth: '0' });
    await expect(level(page)).toHaveText('Not defined');
    expect(await geometry(page)).toEqual(empty);
    expect(await findOverflow(page)).toEqual([]);
  });

  test('typing is announced once it settles, not once for every key', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '120000', burn: '15000' });
    await expect(level(page)).toHaveText('8.0 months');
    await page.locator('#runway-cash').fill('');
    await expect(level(page)).toHaveText('Waiting');
    await page.evaluate(() => {
      const target = document.querySelector('[data-result="level"] [data-value]');
      const log: string[] = [];
      (window as unknown as { __runway: string[] }).__runway = log;
      if (target !== null) new MutationObserver(() => log.push(target.textContent ?? '')).observe(target, { childList: true, characterData: true, subtree: true });
    });
    await page.locator('#runway-cash').pressSequentially('240000', { delay: 40 });
    await expect(level(page)).toHaveText('16.0 months');
    const log = await page.evaluate(() => (window as unknown as { __runway: string[] }).__runway);
    expect(log.length, `runway was rewritten ${log.length} times: ${log.join(' | ')}`).toBeLessThanOrEqual(2);
  });

  test('it works from the keyboard alone: Tab through the fields, type, and clear with Enter', async ({ page }) => {
    await open(page);
    const cash = page.locator('#runway-cash');
    await cash.focus();
    await page.keyboard.type('90000');
    await page.keyboard.press('Tab');
    await expect(page.locator('#runway-burn')).toBeFocused();
    await page.keyboard.type('30000');
    await page.keyboard.press('Tab');
    await expect(page.locator('#runway-growth')).toBeFocused();
    await expect(level(page)).toHaveText('3.0 months');
    await page.keyboard.press('Tab');
    const clear = page.getByRole('button', { name: 'Clear all numbers' });
    await expect(clear).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cash).toHaveValue('');
    await expect(level(page)).toHaveText('Waiting');
  });

  test('Clear all numbers empties every field and returns every result to waiting', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '120000', burn: '15000', growth: '5' });
    await expect(level(page)).toHaveText('8.0 months');
    await page.getByRole('button', { name: 'Clear all numbers' }).click();
    for (const id of ['cash', 'burn', 'growth']) await expect(page.locator(`#runway-${id}`)).toHaveValue('');
    await expect(level(page)).toHaveText('Waiting');
    await expect(growing(page)).toHaveText('Waiting');
    await expect(page.locator('[data-result][data-status="ready"]')).toHaveCount(0);
  });

  test('the formulas, the assumptions and the methodology are on the page, and the funding sentence is there', async ({ page }) => {
    await page.goto(ROUTE);
    const table = page.locator('#formulas table');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.getByRole('row', { name: /Runway at level burn/ })).toContainText('Cash on hand divided by net burn per month, rounded down');
    await expect(table.getByRole('row', { name: /Runway with growing burn/ })).toContainText('1,200 months');
    await expect(page.getByText('Your numbers stay on this page.').first()).toBeVisible();
    await expect(page.locator('main').getByText('WE makes no promise of funding.').first()).toBeVisible();
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
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${label} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  };

  test('the empty page passes axe and nothing overflows', async ({ page }) => {
    await open(page);
    await scan(page, 'empty');
  });

  test('the filled page passes axe and nothing overflows', async ({ page }) => {
    await open(page);
    await fill(page, { cash: '120000', burn: '15000', growth: '5' });
    await expect(level(page)).toHaveText('8.0 months');
    await scan(page, 'filled');
  });

  test('the page with errors passes axe and nothing overflows', async ({ page }) => {
    await open(page);
    await fill(page, { cash: 'abc', growth: '120' });
    await expect(page.locator('[data-note="cash"]')).toContainText('enter digits only');
    await scan(page, 'errors');
  });

  test('every field is labelled, described, reachable by keyboard and at least 24px tall', async ({ page }) => {
    await open(page);
    const inputs = page.locator('we-runway input');
    for (let i = 0; i < 3; i += 1) {
      const input = inputs.nth(i);
      await expect(input).toHaveAccessibleName(/\S/);
      await expect(input).toHaveAccessibleDescription(/\S/);
      expect((await input.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe('runway calculator without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the runway calculator route is not built');
  });

  test('the formulas are the page, and the fields wait for a script instead of doing nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('#formulas table tbody tr')).toHaveCount(2);
    await expect(page.locator('#formulas')).toContainText('Cash on hand divided by net burn per month');
    // Not getByText: Playwright's text engine never looks inside <noscript>, even when the browser renders it as elements.
    await expect(page.locator('noscript .callout')).toContainText('JavaScript is off.');
    await expect(page.locator('noscript .callout')).toBeVisible();
    const inputs = page.locator('we-runway input');
    await expect(inputs).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) await expect(inputs.nth(i)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear all numbers' })).toBeDisabled();
    await expect(page.locator('we-runway').getByText(ILLUSTRATION)).toHaveCount(2);
  });
});
