import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-49: the /tools/ hub lists the Team Composer and the two new tools, each a link that works without a script.

const HUB = '/tools/';
const TOOLS = [
  { name: 'Team Composer', route: '/tools/team-composer/' },
  { name: 'Metrics calculator', route: '/tools/metrics-calculator/' },
  { name: 'Evidence room builder', route: '/tools/evidence-room/' },
] as const;

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
      await expect(page.locator('main').getByRole('link', { name: tool.name, exact: true })).toHaveAttribute('href', new RegExp(`${tool.route}$`));
    }
    await expect(page.locator('main').getByText('WE makes no promise of funding.').first()).toBeVisible();
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('each link opens its tool', async ({ page }) => {
    for (const tool of TOOLS) {
      test.skip(!isBuilt(tool.route), `${tool.route} is not built`);
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
    await page.goto(HUB);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  });
});
