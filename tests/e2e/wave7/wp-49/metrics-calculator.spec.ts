import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-49: the metrics calculator. The numbers a founder types never leave the page, bad entries are described and never become NaN or
// Infinity, updating the results moves nothing, and the formulas stand on their own without JavaScript.

const ROUTE = '/tools/metrics-calculator/';

/** One month, as the unit tests use it. Net new MRR 1,500; revenue churn 3.0%; quick ratio 4.00; payback 5.0 months; runway 8.0 months. */
const MONTH: Readonly<Record<string, string>> = {
  startingMrr: '10,000',
  newMrr: '1500',
  expansionMrr: '500',
  contractionMrr: '200',
  churnedMrr: '300',
  acquisitionSpend: '6000',
  newCustomers: '10',
  grossMarginPct: '80',
  cash: '120000',
  monthlyBurn: '15000',
};

async function fillMonth(page: Page, values: Readonly<Record<string, string>> = MONTH): Promise<void> {
  for (const [id, value] of Object.entries(values)) await page.locator(`#calc-${id}`).fill(value);
}

function value(page: Page, metric: string) {
  return page.locator(`[data-metric="${metric}"] [data-value]`);
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
      results: [...document.querySelectorAll('.calc__result')].map(box),
      fields: [...document.querySelectorAll('.calc__field')].map(box),
    };
  });
}

test.describe('metrics calculator (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the metrics calculator route is not built');
  });

  test('a full month works out, with the working shown, and the numbers never reach the address bar', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('we-calc')).toHaveAttribute('data-enhanced', '');
    await fillMonth(page);
    await expect(value(page, 'netNewMrr')).toHaveText('1,500');
    await expect(value(page, 'revenueChurn')).toHaveText('3.0%');
    await expect(value(page, 'nrr')).toHaveText('100.0%');
    await expect(value(page, 'quickRatio')).toHaveText('4.00');
    await expect(value(page, 'cac')).toHaveText('600');
    await expect(value(page, 'cacPayback')).toHaveText('5.0 months');
    await expect(value(page, 'ltv')).toHaveText('3,880');
    await expect(value(page, 'runway')).toHaveText('8.0 months');
    await expect(page.locator('[data-metric="cac"] [data-detail]')).toHaveText('6,000 / 10 = 600');
    expect(new URL(page.url()).search).toBe('');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('no request leaves the page after it has loaded, however many numbers are typed', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    const after: string[] = [];
    page.on('request', (request) => after.push(`${request.method()} ${request.url()}`));
    page.on('websocket', (socket) => after.push(`websocket ${socket.url()}`));
    await fillMonth(page);
    await expect(value(page, 'runway')).toHaveText('8.0 months');
    await page.getByRole('button', { name: 'Clear all numbers' }).click();
    await fillMonth(page, { cash: 'abc', monthlyBurn: '-5' });
    await expect(page.locator('[data-note="cash"]')).toContainText('Cash on hand: enter a number');
    expect(after).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    const stored = await page.evaluate(() => ({ local: window.localStorage.length, session: window.sessionStorage.length, cookie: document.cookie }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: '' });
  });

  test('a bad entry is described next to its field and never becomes NaN or Infinity', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    await fillMonth(page);
    await expect(value(page, 'runway')).toHaveText('8.0 months');
    const bad: readonly [string, string, RegExp][] = [
      ['cash', 'abc', /Cash on hand: enter a number such as/],
      ['cash', 'Infinity', /Cash on hand: enter a number/],
      ['monthlyBurn', '-5', /Net burn per month: enter zero or more/],
      ['newCustomers', '2.5', /whole number/],
      ['grossMarginPct', '120', /from 0 to 100/],
      ['cash', '5000000000000', /below one trillion/],
    ];
    for (const [id, text, message] of bad) {
      await page.locator(`#calc-${id}`).fill(text);
      await expect(page.locator(`[data-note="${id}"]`)).toHaveText(message);
      await expect(page.locator(`#calc-${id}`)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(`[data-note="${id}"]`)).toHaveAttribute('data-error', '');
      const body = (await page.locator('we-calc').innerText()).replace(/\s+/g, ' ');
      expect(body, `${id}=${text}`).not.toMatch(/NaN|Infinity|undefined|\bnull\b/);
      await page.locator(`#calc-${id}`).fill(MONTH[id] ?? '');
      await expect(page.locator(`#calc-${id}`)).not.toHaveAttribute('aria-invalid', 'true');
    }
  });

  test('zero and negative months are answered in words, not with an error', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    await fillMonth(page, { ...MONTH, churnedMrr: '0', contractionMrr: '0' });
    await expect(value(page, 'ltv')).toHaveText('Not defined');
    await expect(page.locator('[data-metric="ltv"] [data-detail]')).toContainText('never lost');
    await expect(value(page, 'quickRatio')).toHaveText('Not defined');
    await fillMonth(page, { ...MONTH, newMrr: '0', expansionMrr: '0', contractionMrr: '100', churnedMrr: '200' });
    await expect(value(page, 'netNewMrr')).toHaveText('-300');
    await fillMonth(page, { ...MONTH, monthlyBurn: '0' });
    await expect(value(page, 'runway')).toHaveText('Not defined');
    const body = (await page.locator('we-calc').innerText()).replace(/\s+/g, ' ');
    expect(body).not.toMatch(/NaN|Infinity/);
  });

  test('the results sit in role=status regions, one for each group', async ({ page }) => {
    await page.goto(ROUTE);
    const regions = page.locator('we-calc [role="status"]');
    await expect(regions).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(regions.nth(i)).toHaveAttribute('aria-live', 'polite');
      await expect(regions.nth(i)).toHaveAccessibleName(/^Results: /);
    }
  });

  test('updating the results, or showing an error, moves nothing on the page', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    await page.locator('#calc-startingMrr').scrollIntoViewIfNeeded();
    const empty = await geometry(page);
    await fillMonth(page);
    await expect(value(page, 'runway')).toHaveText('8.0 months');
    expect(await geometry(page)).toEqual(empty);
    await fillMonth(page, { cash: 'abc', churnedMrr: '99999', newCustomers: '2.5', grossMarginPct: '120' });
    await expect(page.locator('[data-note="cash"]')).toContainText('enter a number');
    expect(await geometry(page)).toEqual(empty);
    await fillMonth(page, { startingMrr: '999,999,999,999', newMrr: '999,999,999,999', cash: '999,999,999,999', acquisitionSpend: '999,999,999,999' });
    await expect(value(page, 'netNewMrr')).not.toHaveText('Waiting');
  });

  test('typing is announced once it settles, not once for every key', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    await fillMonth(page);
    await expect(value(page, 'runway')).toHaveText('8.0 months');
    await page.locator('#calc-cash').fill('');
    await expect(value(page, 'runway')).toHaveText('Waiting');
    await page.evaluate(() => {
      const target = document.querySelector('[data-metric="runway"] [data-value]');
      const log: string[] = [];
      (window as unknown as { __runway: string[] }).__runway = log;
      if (target !== null) new MutationObserver(() => log.push(target.textContent ?? '')).observe(target, { childList: true, characterData: true, subtree: true });
    });
    await page.locator('#calc-cash').pressSequentially('240000', { delay: 40 });
    await expect(value(page, 'runway')).toHaveText('16.0 months');
    const log = await page.evaluate(() => (window as unknown as { __runway: string[] }).__runway);
    expect(log.length, `runway was rewritten ${log.length} times: ${log.join(' | ')}`).toBeLessThanOrEqual(2);
  });

  test('Clear all numbers empties every field and returns every result to waiting', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    await fillMonth(page);
    await expect(value(page, 'runway')).toHaveText('8.0 months');
    await page.getByRole('button', { name: 'Clear all numbers' }).click();
    for (const id of Object.keys(MONTH)) await expect(page.locator(`#calc-${id}`)).toHaveValue('');
    await expect(value(page, 'runway')).toHaveText('Waiting');
    await expect(page.locator('[data-metric][data-status="ready"]')).toHaveCount(0);
  });

  test('the formulas, the assumptions and the methodology are on the page, with the brief named as the source', async ({ page }) => {
    await page.goto(ROUTE);
    const table = page.locator('#formulas table');
    await expect(table.locator('tbody tr')).toHaveCount(9);
    await expect(table.getByRole('row', { name: /Customer acquisition cost/ })).toContainText('MCC / CA');
    await expect(table.getByRole('row', { name: /Net revenue retention/ })).toContainText('Beginning recurring revenue');
    await expect(table.getByRole('row', { name: /Runway/ })).toContainText(/a convention/i);
    await expect(page.getByText('Your numbers stay on this page.').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /research brief on SaaS metrics definitions/ })).toHaveAttribute('href', /\/research\/early-stage-saas-metrics-definitions\/$/);
    await expect(page.locator('main').getByText('WE makes no promise of funding.').first()).toBeVisible();
  });

  test('the page passes axe empty, filled and with errors, and nothing overflows', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${label} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    };
    await scan('empty');
    await fillMonth(page);
    await expect(value(page, 'runway')).toHaveText('8.0 months');
    await scan('filled');
    await fillMonth(page, { cash: 'abc', grossMarginPct: '120' });
    await expect(page.locator('[data-note="cash"]')).toContainText('enter a number');
    await scan('errors');
    expect(await findOverflow(page)).toEqual([]);
  });

  test('every field is labelled, reachable by keyboard, and at least 24px tall', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    const inputs = page.locator('we-calc input');
    await expect(inputs).toHaveCount(10);
    for (let i = 0; i < 10; i += 1) {
      const input = inputs.nth(i);
      await expect(input).toBeEnabled();
      await expect(input).toHaveAccessibleName(/\S/);
      await expect(input).toHaveAccessibleDescription(/\S/);
      expect((await input.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
    await inputs.first().focus();
    await page.keyboard.press('Tab');
    await expect(inputs.nth(1)).toBeFocused();
  });

  test('the page carries a script-hashed Content-Security-Policy with no inline script exception', async ({ page }) => {
    await page.goto(ROUTE);
    const policy = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
    expect(policy).not.toBeNull();
    const directives = new Map((policy ?? '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name = '', ...values] = part.split(/\s+/);
      return [name, values] as const;
    }));
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('script-src') ?? []).not.toContain("'unsafe-inline'");
    expect(directives.get('script-src') ?? []).not.toContain("'unsafe-eval'");
    expect(directives.get('connect-src') ?? directives.get('default-src')).toEqual(["'self'"]);
  });
});

test.describe('metrics calculator without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the metrics calculator route is not built');
  });

  test('the formulas are the page, and the fields wait for a script instead of doing nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('#formulas table tbody tr')).toHaveCount(9);
    await expect(page.locator('#formulas')).toContainText('(Churned MRR / Starting MRR) x 100');
    await expect(page.getByText('JavaScript is off.')).toBeVisible();
    const inputs = page.locator('we-calc input');
    await expect(inputs).toHaveCount(10);
    for (let i = 0; i < 10; i += 1) await expect(inputs.nth(i)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear all numbers' })).toBeDisabled();
  });
});
