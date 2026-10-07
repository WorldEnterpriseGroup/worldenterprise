import { expect, test } from '@playwright/test';
import { isBuilt } from './support/routes.ts';

// Site shell: 404, machine routes, the development routes (when the build includes them), and the structure of the nav.

test('the 404 page renders with one h1 and is noindex', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('an unknown path answers 404 with the 404 page', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveCount(1);
});

test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body).toMatch(/User-agent:\s*\*/i);
  expect(body).toMatch(/Sitemap:\s*https:\/\/worldenterprise\.org\/sitemap-index\.xml/);
  expect(body).not.toMatch(/^Disallow:\s*\/\s*$/m);
});

test('the sitemap lists neither the styleguide, fixtures, the 404 nor noindex routes', async ({ request }) => {
  const index = await request.get('/sitemap-index.xml');
  expect(index.ok()).toBe(true);
  const res = await request.get('/sitemap-0.xml');
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body).not.toContain('/styleguide/');
  expect(body).not.toContain('fixture-');
  expect(body).not.toContain('/404');
  expect(body).not.toContain('/apply/thanks/');
  expect(body).toContain('<lastmod>');
});

test('the primary navigation is identical on every sampled page and marks the current page', async ({ page }) => {
  const sample = ['/', '/program/', '/services/', '/faq/'].filter(isBuilt);
  test.skip(sample.length < 2, 'not enough routes built');
  const navs: string[] = [];
  for (const route of sample) {
    await page.goto(route);
    const links = await page.locator('nav[aria-label="Primary"] a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    navs.push(JSON.stringify(links));
    if (route !== '/') await expect(page.locator('nav[aria-label="Primary"] [aria-current]').first()).toBeAttached();
  }
  expect(new Set(navs).size, 'primary nav links are the same on every page').toBe(1);
});

test.describe('development routes (present only in the verify build)', () => {
  test('the styleguide is noindex with one h1 when built', async ({ page }) => {
    test.skip(!isBuilt('/styleguide/'), 'styleguide is not part of this build');
    await page.goto('/styleguide/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('tabs in the styleguide enhance with keyboard support', async ({ page }) => {
    test.skip(!isBuilt('/styleguide/'), 'styleguide is not part of this build');
    await page.goto('/styleguide/');
    const first = page.getByRole('tab', { name: 'First' });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the draft fixture article is noindex when built', async ({ page }) => {
    test.skip(!isBuilt('/insights/fixture-article/'), 'fixture article is not part of this build');
    await page.goto('/insights/fixture-article/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});
