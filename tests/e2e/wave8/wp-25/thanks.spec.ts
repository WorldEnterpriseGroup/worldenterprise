import { expect, test, type Page } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';

// WP-25: the brief request confirmation. It reads nothing from the address, carries no call-to-action band (D-24), shows the next steps
// and onward reading, and every link on it leads to a page that exists. The e2e:wave8 job runs it at 1440x900 and 390x844.

const ROUTE = '/briefs/thanks/';
const MAIN = 'main';

/** The width the page lays out to against the viewport, so a horizontal scroll shows up as a positive overflow. */
async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('/briefs/thanks/', () => {
  test('renders the confirmation, the next steps and the onward reading with no errors and no third-party request', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);

    await expect(page.locator(`${MAIN} h1`)).toHaveCount(1);
    await expect(page.locator('#thanks-next-title')).toHaveText('What happens next');
    await expect(page.locator('.thanks-next ol > li, .thanks-next [role="list"] > li').first()).toBeVisible();
    await expect(page.locator('#thanks-onward-title')).toBeVisible();
    await expect(page.locator('.thanks-link').first()).toBeVisible();

    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('has no horizontal scroll and no element wider than the viewport', async ({ page }) => {
    await page.goto(ROUTE);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    const wide = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      return [...document.querySelectorAll('main *')]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.right > limit + 1 || box.left < -1) && !element.closest('[aria-hidden="true"]');
        })
        .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`);
    });
    expect(wide).toEqual([]);
  });

  test('carries no call-to-action band and no form (D-24)', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('[data-cta], [data-cta-ladder], [data-cta-mid], .ctaband')).toHaveCount(0);
    await expect(page.locator(`${MAIN} form`)).toHaveCount(0);
  });

  test('every link in the page body leads to a page that exists', async ({ page, request }) => {
    await page.goto(ROUTE);
    const hrefs = await page.locator(`${MAIN} a[href]`).evaluateAll((links) => [...new Set(links.map((link) => (link as HTMLAnchorElement).href))]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const target = new URL(href);
      if (target.origin !== new URL(page.url()).origin) continue;
      const response = await request.get(target.pathname);
      expect(response.status(), `${target.pathname} linked from ${ROUTE}`).toBe(200);
    }
  });

  test('outside programs sit inside the ecosystem context with the no-affiliation note', async ({ page }) => {
    await page.goto(ROUTE);
    const block = page.locator('.thanks-ecosystem');
    if ((await block.count()) === 0) test.skip(true, 'no ecosystem route is live in this build');
    await expect(block).toHaveAttribute('data-context', 'ecosystem');
    await expect(block).toContainText('no affiliation implied');
  });

  test('ignores the query string: nothing from the address is written into the page', async ({ page }) => {
    const marker = 'wp25-injected-marker';
    await page.goto(`${ROUTE}?brief=${marker}&title=${marker}`);
    const text = (await page.locator(MAIN).textContent()) ?? '';
    expect(text).not.toContain(marker);
  });

  test('passes axe at WCAG 2.2 AA', async ({ page }) => {
    await page.goto(ROUTE);
    const results = await analyzePage(page);
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([]);
  });

  test('works without JavaScript: the confirmation, steps and links render and nothing overflows', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: test.info().project.use.viewport ?? undefined });
    const page = await context.newPage();
    try {
      const response = await page.goto(ROUTE);
      expect(response?.status()).toBe(200);
      await expect(page.locator(`${MAIN} h1`)).toBeVisible();
      await expect(page.locator('#thanks-next-title')).toBeVisible();
      await expect(page.locator('.thanks-link a').first()).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});
