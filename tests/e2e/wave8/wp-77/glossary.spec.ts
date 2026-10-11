import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-77: the glossary at scale. Terms are grouped, the jump list is a keyboard-operable row of anchors, every term has a stable anchor,
// and there are no per-term pages. A "Read more" link appears only for a route that is built.

const PAGE = '/glossary/';
const GROUPS = ['Funding', 'Finance and metrics', 'Legal and contracts', 'Customers and product', 'Go-to-market', 'Product delivery', 'Team and hiring', 'AI and data', 'Security and accessibility'] as const;

test.describe('glossary (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(PAGE), 'the glossary is not built');
  });

  test('the page lists at least 80 terms, each with an anchor, and has one h1 and no console errors', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.locator('main dt').count()).toBeGreaterThanOrEqual(80);
    const ids = await page.locator('main dt').evaluateAll((nodes) => nodes.map((n) => n.id));
    expect(ids.every((id) => /^term-[a-z0-9-]+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('each topic group has a heading, in the jump list and on the page', async ({ page }) => {
    await page.goto(PAGE);
    const nav = page.getByRole('navigation', { name: 'Jump to a group of terms' });
    for (const group of GROUPS) {
      await expect(nav.getByRole('link', { name: group, exact: true }), group).toHaveCount(1);
      await expect(page.locator('main').getByRole('heading', { level: 2, name: group, exact: true }), group).toHaveCount(1);
    }
  });

  test('the jump list works from the keyboard and lands on the group heading', async ({ page }) => {
    await page.goto(PAGE);
    const link = page.getByRole('navigation', { name: 'Jump to a group of terms' }).getByRole('link', { name: 'Security and accessibility', exact: true });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#group-security-and-accessibility$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Security and accessibility', exact: true })).toBeInViewport();
  });

  test('a term anchor opens at its term, and a term has no page of its own', async ({ page }) => {
    await page.goto(`${PAGE}#term-seed-round`);
    await expect(page.locator('#term-seed-round')).toBeInViewport();
    await expect(page.locator('#term-seed-round')).toHaveText('Seed round');
    const response = await page.request.get(`${PAGE}seed-round/`);
    expect(response.status()).toBe(404);
  });

  test('a see-also link jumps to the related term on the same page', async ({ page }) => {
    await page.goto(PAGE);
    const entry = page.locator('.glossary-list__entry', { has: page.locator('#term-seed-round') });
    const link = entry.getByRole('link', { name: 'SAFE', exact: true });
    await expect(link).toHaveAttribute('href', '#term-safe');
  });

  test('a Read more link goes only to a built route', async ({ page }) => {
    await page.goto(PAGE);
    const hrefs = await page.locator('main .glossary-list__meta a:not([href^="#"])').evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href') ?? ''));
    for (const href of hrefs) expect(isBuilt(href), href).toBe(true);
  });

  test('the structured data lists every term once', async ({ page }) => {
    await page.goto(PAGE);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const nodes = blocks.flatMap((b) => {
      const parsed = JSON.parse(b) as { '@graph'?: unknown[] } | unknown[];
      return Array.isArray(parsed) ? parsed : ((parsed as { '@graph'?: unknown[] })['@graph'] ?? [parsed]);
    }) as { '@type'?: string; hasDefinedTerm?: unknown[] }[];
    const set = nodes.find((n) => n['@type'] === 'DefinedTermSet');
    expect(set?.hasDefinedTerm?.length ?? 0).toBe(await page.locator('main dt').count());
  });
});
