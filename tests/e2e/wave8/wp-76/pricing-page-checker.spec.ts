import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-76: the pricing page checker. The ticks a founder makes never leave the page, nothing is stored, the result is a count and never a
// score, ticking moves nothing, it works from the keyboard alone, and the rules stand without JavaScript.

const ROUTE = '/tools/pricing-page-checker/';
const ILLUSTRATION = 'An illustration from your inputs, not advice.';

const present = (page: Page) => page.locator('[data-result="present"] [data-value]');
const open = (page: Page) => page.locator('[data-result="open"] [data-value]');
const openDetail = (page: Page) => page.locator('[data-result="open"] [data-detail]');
const boxes = (page: Page) => page.locator('we-pricing-checker input[type="checkbox"]');

async function openPage(page: Page): Promise<void> {
  await page.goto(ROUTE);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('we-pricing-checker')).toHaveAttribute('data-enhanced', '');
}

interface Geometry {
  readonly documentHeight: number;
  readonly results: readonly { readonly top: number; readonly height: number }[];
  readonly items: readonly { readonly top: number; readonly height: number }[];
}

/** Where the page's blocks sit now, in document coordinates. A tick must leave all of it as it was. */
function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top + window.scrollY), height: Math.round(rect.height) };
    };
    return {
      documentHeight: document.documentElement.scrollHeight,
      results: [...document.querySelectorAll('.tool-result')].map(box),
      items: [...document.querySelectorAll('.pcheck__item')].map(box),
    };
  });
}

test.describe('pricing page checker (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the pricing page checker route is not built');
  });

  test('the page opens with eight unticked statements, two waiting results, and the illustration line on each', async ({ page }) => {
    await openPage(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(boxes(page)).toHaveCount(8);
    for (let i = 0; i < 8; i += 1) {
      await expect(boxes(page).nth(i)).not.toBeChecked();
      await expect(boxes(page).nth(i)).toBeEnabled();
    }
    await expect(present(page)).toHaveText('Waiting');
    await expect(open(page)).toHaveText('Waiting');
    await expect(page.locator('we-pricing-checker [data-status="ready"]')).toHaveCount(0);
    await expect(page.locator('we-pricing-checker').getByText(ILLUSTRATION)).toHaveCount(2);
  });

  test('ticking works out the count and the numbers still to mark, at once, and nothing reaches the address bar', async ({ page }) => {
    await openPage(page);
    await page.getByLabel('Each plan has a one-line statement of who it is for.').check();
    await expect(present(page)).toHaveText('1 of 8');
    await expect(open(page)).toHaveText('7 of 8');
    await expect(openDetail(page)).toHaveText('Not yet marked, by numbers in the list: 2, 3, 4, 5, 6, 7, 8.');
    await page.getByLabel('A way to reach a person is visible.').check();
    await expect(present(page)).toHaveText('2 of 8');
    await expect(openDetail(page)).toHaveText('Not yet marked, by numbers in the list: 2, 3, 4, 5, 6, 8.');
    await page.getByLabel('A way to reach a person is visible.').uncheck();
    await expect(present(page)).toHaveText('1 of 8');
    expect(new URL(page.url()).search).toBe('');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('every statement ticked says the page has each item, and never calls it a pass', async ({ page }) => {
    await openPage(page);
    for (let i = 0; i < 8; i += 1) await boxes(page).nth(i).check();
    await expect(present(page)).toHaveText('8 of 8');
    await expect(open(page)).toHaveText('0 of 8');
    await expect(openDetail(page)).toHaveText('Every statement is marked true. That says the page has each item, not that it works for your buyers.');
  });

  test('no result is a score, a percent or a grade, whatever is ticked', async ({ page }) => {
    await openPage(page);
    for (let i = 0; i < 8; i += 1) {
      await boxes(page).nth(i).check();
      const text = (await page.locator('we-pricing-checker [role="status"]').innerText()).replace(/\s+/g, ' ');
      expect(text, `after ${i + 1} ticks`).not.toMatch(/%|\bpercent\b|\bgrade\b|NaN|Infinity|undefined/i);
    }
  });

  test('no request leaves the page after it has loaded, and nothing is stored, however many boxes are ticked', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await openPage(page);
    const after: string[] = [];
    // What is entered must stay in the browser. Only a same-origin GET of a static resource is let through: a lazy image of the page's
    // own header or footer is not the tool. Every other request, and any request to another origin, is counted.
    if (baseURL === undefined) throw new Error('the project sets no baseURL');
    const origin = new URL(baseURL).origin;
    page.on('request', (request) => {
      const staticAsset = ['image', 'font', 'stylesheet', 'script', 'media'].includes(request.resourceType());
      if (request.method() === 'GET' && staticAsset && new URL(request.url()).origin === origin) return;
      after.push(`${request.method()} ${request.url()}`);
    });
    page.on('websocket', (socket) => after.push(`websocket ${socket.url()}`));
    await page.route('**/*', (route) => route.abort());
    for (let i = 0; i < 8; i += 1) await boxes(page).nth(i).check();
    await expect(present(page)).toHaveText('8 of 8');
    await page.getByRole('button', { name: 'Clear all ticks' }).click();
    await expect(present(page)).toHaveText('Waiting');
    expect(after).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    const stored = await page.evaluate(() => ({ local: window.localStorage.length, session: window.sessionStorage.length, cookie: document.cookie }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: '' });
    expect(await page.context().cookies()).toEqual([]);
  });

  test('the results sit in one polite status region with a name', async ({ page }) => {
    await page.goto(ROUTE);
    const regions = page.locator('we-pricing-checker [role="status"]');
    await expect(regions).toHaveCount(1);
    await expect(regions).toHaveAttribute('aria-live', 'polite');
    await expect(regions).toHaveAccessibleName('Results: pricing page statements');
    await expect(regions.locator('[data-result]')).toHaveCount(2);
  });

  test('ticking, unticking and clearing move nothing on the page', async ({ page }) => {
    await openPage(page);
    await boxes(page).first().scrollIntoViewIfNeeded();
    const empty = await geometry(page);
    for (let i = 0; i < 8; i += 1) {
      await boxes(page).nth(i).check();
      expect(await geometry(page), `after ${i + 1} ticks`).toEqual(empty);
    }
    await page.getByRole('button', { name: 'Clear all ticks' }).click();
    await expect(present(page)).toHaveText('Waiting');
    expect(await geometry(page)).toEqual(empty);
    expect(await findOverflow(page)).toEqual([]);
  });

  test('it works from the keyboard alone: Tab to a statement, Space to tick it, Tab on to Clear all ticks', async ({ page }) => {
    await openPage(page);
    await boxes(page).first().focus();
    await page.keyboard.press('Space');
    await expect(boxes(page).first()).toBeChecked();
    await expect(present(page)).toHaveText('1 of 8');
    await page.keyboard.press('Tab');
    await expect(boxes(page).nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(present(page)).toHaveText('2 of 8');
    for (let i = 2; i < 8; i += 1) await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const clear = page.getByRole('button', { name: 'Clear all ticks' });
    await expect(clear).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(boxes(page).first()).not.toBeChecked();
    await expect(present(page)).toHaveText('Waiting');
  });

  test('Clear all ticks unticks every box and returns both results to waiting', async ({ page }) => {
    await openPage(page);
    for (let i = 0; i < 4; i += 1) await boxes(page).nth(i).check();
    await expect(present(page)).toHaveText('4 of 8');
    await page.getByRole('button', { name: 'Clear all ticks' }).click();
    for (let i = 0; i < 8; i += 1) await expect(boxes(page).nth(i)).not.toBeChecked();
    await expect(present(page)).toHaveText('Waiting');
    await expect(open(page)).toHaveText('Waiting');
    await expect(page.locator('[data-result][data-status="ready"]')).toHaveCount(0);
  });

  test('the rules, the assumptions and the methodology are on the page, and the funding sentence is there', async ({ page }) => {
    await page.goto(ROUTE);
    const table = page.locator('#formulas table');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.getByRole('row', { name: /Statements marked true/ })).toContainText('The count is not a score, a grade or a percent.');
    await expect(page.getByText('Your ticks stay on this page.').first()).toBeVisible();
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
    await openPage(page);
    await scan(page, 'empty');
  });

  test('the ticked page passes axe and nothing overflows', async ({ page }) => {
    await openPage(page);
    for (let i = 0; i < 3; i += 1) await boxes(page).nth(i).check();
    await expect(present(page)).toHaveText('3 of 8');
    await scan(page, 'ticked');
  });

  test('every statement is labelled, grouped under a legend, reachable by keyboard and at least 24px tall', async ({ page }) => {
    await openPage(page);
    await expect(page.getByRole('group', { name: 'True of my pricing page today' })).toHaveCount(1);
    for (let i = 0; i < 8; i += 1) {
      const box = boxes(page).nth(i);
      await expect(box).toHaveAccessibleName(/\S/);
      // The target is the whole row, the box and its label, which is what a click or a tap lands on.
      expect((await box.locator('xpath=..').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
  });
});

test.describe('pricing page checker without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the pricing page checker route is not built');
  });

  test('the statements and the rules are the page, and the boxes wait for a script instead of doing nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('#formulas table tbody tr')).toHaveCount(2);
    await expect(page.locator('#formulas')).toContainText('The number of statements you have ticked');
    // Not getByText: Playwright's text engine never looks inside <noscript>, even when the browser renders it as elements.
    await expect(page.locator('noscript .callout')).toContainText('JavaScript is off.');
    await expect(page.locator('noscript .callout')).toBeVisible();
    await expect(boxes(page)).toHaveCount(8);
    for (let i = 0; i < 8; i += 1) await expect(boxes(page).nth(i)).toBeDisabled();
    await expect(page.getByLabel('Each plan has a one-line statement of who it is for.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all ticks' })).toBeDisabled();
    await expect(page.locator('we-pricing-checker').getByText(ILLUSTRATION)).toHaveCount(2);
  });
});
