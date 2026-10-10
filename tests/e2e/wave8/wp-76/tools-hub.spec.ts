import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-76: the /tools/ hub is built from the route ledger. It lists the Team Composer and each tool whose page is built, links nothing that
// is not built, and names no count, so a tool that arrives later changes no sentence.

const HUB = '/tools/';
const TOOLS = [
  { name: 'Team Composer', route: '/tools/team-composer/' },
  { name: 'Metrics calculator', route: '/tools/metrics-calculator/' },
  { name: 'Evidence room builder', route: '/tools/evidence-room/' },
  { name: 'Runway calculator', route: '/tools/runway-calculator/' },
  { name: 'Pricing page checker', route: '/tools/pricing-page-checker/' },
  { name: 'Cap table explainer', route: '/tools/cap-table-explainer/' },
] as const;

test.describe('tools hub (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(HUB), 'the tools hub is not built');
  });

  test('the hub lists the Team Composer and every built tool, and links nothing that is not built', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(HUB);
    for (const tool of TOOLS) {
      const link = page.locator('main').getByRole('link', { name: tool.name, exact: true });
      if (isBuilt(tool.route)) await expect(link, tool.name).toHaveAttribute('href', new RegExp(`${tool.route}$`));
      else await expect(link, tool.name).toHaveCount(0);
    }
    await expect(page.locator('main').getByRole('link', { name: 'Team Composer', exact: true })).toHaveCount(1);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('the hub names no number of tools', async ({ page }) => {
    await page.goto(HUB);
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+) (?:free )?tools\b/i);
  });

  test('each listed tool opens, and the page it opens has one h1', async ({ page }) => {
    for (const tool of TOOLS.filter((t) => isBuilt(t.route))) {
      await page.goto(HUB);
      await page.locator('main').getByRole('link', { name: tool.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${tool.route}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });
});
