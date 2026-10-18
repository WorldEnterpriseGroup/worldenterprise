import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { quiet, watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-49: the /tools/ hub lists the Team Composer and the tools after it, each a link that works without a script. WP-76 adds the runway
// calculator, the pricing page checker and the cap table explainer: the hub lists a tool only when its page is built, so each of those
// is checked only where its route is.

const HUB = '/tools/';
const TOOLS = [
  { name: 'Team Composer', route: '/tools/team-composer/' },
  { name: 'Metrics calculator', route: '/tools/metrics-calculator/' },
  { name: 'Evidence room builder', route: '/tools/evidence-room/' },
  { name: 'Runway calculator', route: '/tools/runway-calculator/' },
  { name: 'Pricing page checker', route: '/tools/pricing-page-checker/' },
  { name: 'Cap table explainer', route: '/tools/cap-table-explainer/' },
] as const;

// Each tool page describes itself as a WebApplication. The JSON-LD validator requires an id, a name and a url and forbids a price.
for (const tool of TOOLS.filter((t) => t.route !== '/tools/team-composer/')) {
  test(`${tool.route} carries one WebApplication node with an id, a name and a url, and no price`, async ({ page }) => {
    test.skip(!isBuilt(tool.route), `${tool.route} is not built`);
    await page.goto(tool.route);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const nodes = blocks.flatMap((block) => {
      const parsed: unknown = JSON.parse(block);
      const graph = (parsed as { '@graph'?: unknown[] })['@graph'];
      return (Array.isArray(graph) ? graph : [parsed]) as Record<string, unknown>[];
    });
    const apps = nodes.filter((node) => node['@type'] === 'WebApplication');
    expect(apps).toHaveLength(1);
    const app = apps[0] ?? {};
    expect(app['url']).toBe(`https://worldenterprise.org${tool.route}`);
    expect(app['@id']).toBe(`https://worldenterprise.org${tool.route}#app`);
    expect(String(app['name'])).not.toHaveLength(0);
    for (const key of ['offers', 'price', 'priceCurrency', 'priceSpecification']) expect(app).not.toHaveProperty(key);
  });
}

test.describe('tools hub (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(HUB), 'the tools hub is not built');
  });

  test('the hub has one h1 and links to each tool', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(HUB);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Founder tools');
    for (const tool of TOOLS) {
      const link = page.locator('main').getByRole('link', { name: tool.name, exact: true });
      if (isBuilt(tool.route)) await expect(link).toHaveAttribute('href', new RegExp(`${tool.route}$`));
      else await expect(link).toHaveCount(0);
    }
    await expect(page.locator('main').getByText('WE makes no promise of funding.').first()).toBeVisible();
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('each link opens its tool', async ({ page }) => {
    for (const tool of TOOLS.filter((t) => isBuilt(t.route))) {
      await page.goto(HUB);
      await page.locator('main').getByRole('link', { name: tool.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${tool.route}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('the hub names no price and no SAFE calculator', async ({ page }) => {
    await page.goto(HUB);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/[$€£]\s?\d/);
    expect(text).not.toMatch(/SAFE calculator/i);
  });

  test('the hub passes axe and nothing overflows', async ({ page }) => {
    const network = quiet(page);
    await page.goto(HUB);
    await network.settled();
    const results = await analyzePage(page);
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  });
});
