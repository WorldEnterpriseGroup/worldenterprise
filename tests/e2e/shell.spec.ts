import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fileFor, isBuilt, liveRoutes } from './support/routes.ts';

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
  // Compare the listed URLs only: the XML namespaces in the file also contain "/sitemap/".
  const paths = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? '').pathname);
  expect(paths.length, 'the sitemap lists pages').toBeGreaterThan(0);
  for (const excluded of ['/styleguide/', '/apply/thanks/', '/search/', '/sitemap/']) {
    expect(paths, `${excluded} is not listed`).not.toContain(excluded);
  }
  expect(paths.filter((path) => path.includes('fixture-')), 'no fixture is listed').toEqual([]);
  expect(paths.filter((path) => path.startsWith('/404')), 'the 404 is not listed').toEqual([]);
});

test('every sampled page carries a Content-Security-Policy that blocks inline script, eval and foreign sources', async ({ page }) => {
  const sample = ['/', '/program/', '/search/', '/apply/', '/library/one-page-problem-brief/'].filter(isBuilt);
  test.skip(sample.length === 0, 'no sampled route is built');
  for (const route of sample) {
    await page.goto(route);
    const policy = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
    expect(policy, `${route} has a CSP meta tag`).not.toBeNull();
    const directives = new Map((policy ?? '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name = '', ...values] = part.split(/\s+/);
      return [name, values] as const;
    }));
    expect(directives.get('default-src'), `${route} default-src`).toEqual(["'self'"]);
    expect(directives.get('object-src'), `${route} object-src`).toEqual(["'none'"]);
    expect(directives.get('base-uri'), `${route} base-uri`).toEqual(["'self'"]);
    const scripts = directives.get('script-src') ?? [];
    expect(scripts, `${route} script-src names the site`).toContain("'self'");
    // 'wasm-unsafe-eval' (Pagefind compiles WebAssembly) is the one accepted exception and is not 'unsafe-eval'.
    expect(scripts.filter((value) => /^'unsafe-(inline|eval)'$/.test(value)), `${route} script-src has no unsafe-inline or unsafe-eval`).toEqual([]);
    // No style-attribute exception (WP-16): Astro emits no style-src-attr, so attributes fall back to style-src, which has no 'unsafe-inline'.
    expect(directives.get('style-src-attr'), `${route} has no style-src-attr exception`).toBeUndefined();
    expect(directives.get('style-src') ?? [], `${route} style-src has no unsafe-inline`).not.toContain("'unsafe-inline'");
    expect(directives.get('style-src-elem') ?? [], `${route} style elements are hashed, not inline`).not.toContain("'unsafe-inline'");
  }
});

test('no built page carries a style attribute, which the policy blocks (WP-16)', ({}, info) => {
  test.skip(info.project.name !== 'desktop-1440x900', 'static scan, once');
  test.setTimeout(120_000);
  const failures: string[] = [];
  for (const route of liveRoutes) {
    const html = readFileSync(fileFor(route.path), 'utf8');
    // An attribute named style on any start tag. Text that merely mentions it is HTML-escaped or sits outside a tag.
    for (const tag of html.matchAll(/<[a-zA-Z][^<>]*?\sstyle=("[^"]*"|'[^']*')[^<>]*>/g)) failures.push(`${route.path}: ${tag[0].slice(0, 120)}`);
  }
  expect(liveRoutes.length, 'routes scanned').toBeGreaterThan(40);
  expect(failures.slice(0, 10), `${failures.length} style attribute(s) in built pages`).toEqual([]);
});

test('sitemap entries carry lastmod', async ({ request }) => {
  const res = await request.get('/sitemap-0.xml');
  expect(await res.text()).toContain('<lastmod>');
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
});
