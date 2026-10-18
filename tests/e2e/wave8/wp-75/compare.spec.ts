import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow, formatOffenders } from '../../support/overflow.ts';
import { quiet, watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-75 comparison pages, rendered half (the wording and ledger rules are tests/unit/wp-75). The hub and one sampled page get the full
// set at the desktop and the phone viewport; every page gets the structure checks. A route that is not built yet is pending and skips.

const HUB = '/compare/';
const SAMPLE = '/compare/dedicated-team-vs-agency/';
const PAGES = [
  '/compare/incubator-vs-other-programs/',
  '/compare/incubator-vs-venture-studio/',
  '/compare/dedicated-team-vs-agency/',
  '/compare/dedicated-team-vs-freelancers/',
  '/compare/build-vs-buy/',
  '/compare/onshore-vs-offshore-teams/',
  '/compare/bootstrapping-vs-outside-funding/',
] as const;

const VIEWPORTS = [
  { name: 'desktop 1440x900', width: 1440, height: 900 },
  { name: 'phone 390x844', width: 390, height: 844 },
] as const;

const CLS_BUDGET = 0.1;
const MIN_TARGET = 24;

interface LayoutShiftEntry extends PerformanceEntry {
  readonly value: number;
  readonly hadRecentInput: boolean;
}

/** Cumulative layout shift of a cold load, scored the way the field scores it (shifts after input do not count). */
async function measureCls(page: Page, route: string): Promise<number> {
  await page.addInitScript(() => {
    const holder = window as unknown as { __cls: number };
    holder.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) if (!entry.hadRecentInput) holder.__cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(route, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

for (const viewport of VIEWPORTS) {
  for (const route of [HUB, SAMPLE]) {
    test.describe(`${route} at ${viewport.name}`, () => {
      test.skip(!isBuilt(route), `${route} is not built yet`);
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('loads clean: no console error, no exception, no third-party request', async ({ page, baseURL }) => {
        const record = watch(page, baseURL ?? 'http://localhost');
        const network = quiet(page);
        await page.goto(route);
        await network.settled();
        expect(record.consoleErrors, 'console errors').toEqual([]);
        expect(record.pageErrors, 'uncaught exceptions').toEqual([]);
        expect(record.thirdParty, 'third-party requests').toEqual([]);
      });

      test('axe at WCAG 2.2 AA finds nothing', async ({ page }) => {
        const network = quiet(page);
        await page.goto(route);
        await network.settled();
        const results = await analyzePage(page);
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      });

      test('layout shift stays under the budget', async ({ page }) => {
        expect(await measureCls(page, route)).toBeLessThan(CLS_BUDGET);
      });

      test('nothing leaves the viewport sideways', async ({ page }) => {
        const network = quiet(page);
        await page.goto(route);
        await network.settled();
        const offenders = await findOverflow(page);
        expect(offenders, formatOffenders(offenders)).toEqual([]);
      });

      test('every link and button in the page body is at least 24px square', async ({ page }) => {
        const network = quiet(page);
        await page.goto(route);
        await network.settled();
        const small = await page.locator('main a[href], main button').evaluateAll(
          (els, min) =>
            els
              .map((el) => ({ el, box: el.getBoundingClientRect(), inline: getComputedStyle(el).display === 'inline' }))
              // An inline link inside a sentence is exempt under WCAG 2.5.8; every other target is measured.
              .filter(({ box, inline }) => box.width > 0 && box.height > 0 && !inline && (box.width < min || box.height < min))
              .map(({ el, box }) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`),
          MIN_TARGET,
        );
        expect(small).toEqual([]);
      });
    });
  }
}

test.describe(`${HUB} hub`, () => {
  test.skip(!isBuilt(HUB), `${HUB} is not built yet`);

  test('one h1 and links into the comparisons, with descriptive text', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.locator('h1')).toHaveCount(1);
    // The hub lists a comparison once its route is live; a card for the page that carries the blocked word shows its label alone.
    const built = PAGES.filter((route) => isBuilt(route));
    expect(await page.locator('main a[href^="/compare/"]').count()).toBeGreaterThanOrEqual(built.length > 0 ? 1 : 0);
    const vague = await page.locator('main a[href^="/compare/"]').evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()).filter((text) => /^(click here|read more|more|here)$/i.test(text)));
    expect(vague).toEqual([]);
  });
});

for (const route of PAGES) {
  test.describe(route, () => {
    test.skip(!isBuilt(route), `${route} is not built yet`);

    test('one h1, the headings in order, the side by side table and two sides of equal width', async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      const h2 = await page.locator('main h2').allTextContents();
      expect(h2.map((t) => t.trim())).toEqual(expect.arrayContaining(['Where WE sits', 'WE is probably not the right fit if', 'Side by side', 'Questions to ask', 'Where each fits', 'Definitions']));
      const table = page.locator('main table');
      await expect(table).toHaveCount(1);
      await expect(table.locator('caption')).not.toHaveText('');
      const headers = await table.locator('thead th').count();
      expect(headers, 'a question column and two side columns').toBe(3);
      const widths = await table.locator('thead th').evaluateAll((els) => els.slice(1).map((el) => el.getBoundingClientRect().width));
      expect(Math.abs((widths[0] ?? 0) - (widths[1] ?? 1)), 'the two side columns are the same width').toBeLessThanOrEqual(2);
    });

    test('the sources list is present and every source link leaves the page by a plain link', async ({ page }) => {
      await page.goto(route);
      const links = page.locator('main a[href^="https://"]');
      expect(await links.count()).toBeGreaterThanOrEqual(2);
      const hosts = await links.evaluateAll((els) => els.map((el) => new URL(el.getAttribute('href') ?? '').hostname));
      for (const host of hosts) expect(host, 'a source host is government, standards or university').toMatch(/\.(?:gov|edu|eu)$|\.(?:gov|ac)\.uk$|^(?:ico\.org\.uk|nist\.gov)$/);
    });
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const route of [HUB, ...PAGES]) {
    test(`${route} shows its content, table and sources with scripts off`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built yet`);
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
      if (route === HUB) return;
      await expect(page.locator('main table')).toBeVisible();
      await expect(page.locator('main table tbody tr').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Definitions' })).toBeVisible();
    });
  }
});
