import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt, liveRoutes } from '../../support/routes.ts';

// WP-41: the GEO and citation layer. llms.txt, llms-full.txt, robots.txt, Markdown twins, the citation block and the facts page.
// Every test skips while the route it needs is not built, so the suite stays green while work packages merge one by one.

const NO_FUNDING = 'WE makes no promise of funding.';
const DISCLAIMER_START = 'WE is not a broker-dealer or investment adviser';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

test.describe('llms.txt and llms-full.txt', () => {
  test('llms.txt is plain text with the contract outline and both required sentences', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type'] ?? '').toMatch(/text\/plain/);
    const text = await response.text();
    expect(text.startsWith('# World Enterprise Incubator')).toBe(true);
    expect(text).toMatch(/^> .+/m);
    for (const heading of ['What WE is', 'What WE offers', 'What WE does not do', 'Published commercial facts', 'Contact']) {
      expect(text, heading).toContain(`## ${heading}`);
    }
    expect(squash(text)).toContain(NO_FUNDING);
    expect(squash(text)).toContain(DISCLAIMER_START);
  });

  test('every link in llms.txt that stays on the site resolves', async ({ request, baseURL }) => {
    const text = await (await request.get('/llms.txt')).text();
    const urls = [...text.matchAll(/\]\((https:\/\/worldenterprise\.org[^)\s]*)\)/g)].map((m) => m[1] as string);
    expect(urls.length).toBeGreaterThan(5);
    for (const url of urls) {
      const path = new URL(url).pathname;
      const response = await request.get(new URL(path, baseURL).href);
      expect(response.status(), `${url} resolves at ${path}`).toBe(200);
    }
  });

  test('llms-full.txt carries the same sentences, page blocks headed by their canonical URL, and stays under 256 KiB', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    expect(response.ok()).toBe(true);
    const text = await response.text();
    expect(squash(text)).toContain(NO_FUNDING);
    expect(squash(text)).toContain(DISCLAIMER_START);
    expect(text).toMatch(/\n---\n\nSource: https:\/\/worldenterprise\.org\/[^\s]*\n\n# /);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(262_144);
  });

  test('neither file names a price, a mailbox or a response time', async ({ request }) => {
    for (const path of ['/llms.txt', '/llms-full.txt']) {
      const text = await (await request.get(path)).text();
      expect(text, path).not.toMatch(/[$€£]\s?\d|\bUSD\b/);
      expect(text, path).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(text, path).not.toMatch(/\bwithin \d+\s*(?:hours?|business days?)\b/i);
    }
  });
});

test.describe('robots.txt', () => {
  test('names the AI crawlers and lists the sitemap, or blocks everything in a preview build', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBe(true);
    const text = await response.text();
    if (/^User-agent: \*\nDisallow: \/\n$/.test(text)) {
      expect(text, 'a preview build names no crawler and allows nothing').not.toMatch(/Allow:/);
      return;
    }
    for (const agent of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'CCBot']) {
      expect(text, agent).toMatch(new RegExp(`^User-agent: ${agent}\\nAllow: /$`, 'm'));
    }
    expect(text).not.toMatch(/Disallow:/);
    expect(text).toContain('Sitemap: https://worldenterprise.org/sitemap-index.xml');
  });
});

test.describe('Markdown twins', () => {
  test('a page that advertises a twin serves it as plain Markdown that agrees with the page', async ({ page, request, baseURL }) => {
    test.skip(!isBuilt('/about/facts/'), '/about/facts/ is not built');
    await page.goto('/about/facts/');
    const alternates = page.locator('link[rel="alternate"][type="text/markdown"]');
    await expect(alternates).toHaveCount(1);
    const href = await alternates.getAttribute('href');
    expect(href).toBe('https://worldenterprise.org/about/facts.md');
    const response = await request.get(new URL('/about/facts.md', baseURL).href);
    expect(response.ok()).toBe(true);
    const markdown = await response.text();
    const h1 = (await page.locator('main h1').first().innerText()).trim();
    expect(markdown).toMatch(new RegExp(`^# ${h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    expect(markdown).toContain('Canonical URL: https://worldenterprise.org/about/facts/');
    expect(markdown, 'no JSX or frontmatter leaks into the twin').not.toMatch(/<[A-Z][A-Za-z]*[\s/>]|^---\n|^import\s/m);
    expect(squash(markdown)).toContain(NO_FUNDING);
  });

  test('every live page that advertises a twin names a twin that exists', async ({ request, baseURL }) => {
    const candidates = liveRoutes.filter((r) => r.indexable && /^\/(?:about|services|playbooks|glossary|faq)\//.test(r.path)).slice(0, 12);
    test.skip(candidates.length === 0, 'no candidate page is built');
    let advertised = 0;
    for (const route of candidates) {
      const html = await (await request.get(new URL(route.path, baseURL).href)).text();
      const tag = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => /rel="alternate"/.test(t) && /type="text\/markdown"/.test(t));
      const href = tag === undefined ? undefined : /href="([^"]+)"/.exec(tag)?.[1];
      if (href === undefined) continue;
      advertised += 1;
      const response = await request.get(new URL(new URL(href).pathname, baseURL).href);
      expect(response.status(), `${route.path} advertises ${href}`).toBe(200);
    }
    expect(advertised, 'at least one candidate advertises a twin').toBeGreaterThan(0);
  });
});

const CITED = [
  { layout: 'Article', prefix: '/insights/' },
  { layout: 'Brief', prefix: '/research/' },
  { layout: 'Playbook', prefix: '/playbooks/' },
  { layout: 'Guide', prefix: '/fundability/' },
] as const;

for (const { layout, prefix } of CITED) {
  const target = liveRoutes.find((r) => r.path.startsWith(prefix) && r.path !== prefix && /^\/[^/]+\/[^/]+\/$/.test(r.path));
  for (const viewport of VIEWPORTS) {
    test.describe(`citation block, ${layout} layout, ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });
      test.beforeEach(() => {
        test.skip(target === undefined, `no ${prefix} page is built`);
      });

      test('shows the suggested citation and copies it', async ({ page, context, browserName, baseURL }) => {
        const seen = watch(page, baseURL ?? '');
        await page.goto(target?.path ?? '/');
        const block = page.locator('[data-cite-this]');
        await expect(block).toHaveCount(1);
        await expect(block.getByRole('heading', { name: 'Cite this page' })).toBeVisible();
        const citation = block.locator('.cite-this__text');
        await expect(citation).toContainText('World Enterprise Editorial.');
        await expect(citation).toContainText(`https://worldenterprise.org${target?.path ?? ''}`);
        const button = block.locator('we-copy button');
        await expect(button).toBeVisible();
        if (browserName === 'chromium') {
          await context.grantPermissions(['clipboard-read', 'clipboard-write']);
          await button.click();
          await expect(block.locator('.we-copy__status')).not.toBeEmpty();
          const copied = squash(await page.evaluate(() => navigator.clipboard.readText()));
          expect(copied).toBe(squash(await citation.innerText()));
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
        expect(seen.consoleErrors).toEqual([]);
        expect(seen.pageErrors).toEqual([]);
        expect(seen.thirdParty).toEqual([]);
      });
    });
  }
}

test.describe('facts page', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/about/facts/'), '/about/facts/ is not built');
  });

  for (const viewport of VIEWPORTS) {
    test(`answers the questions, says no funding is promised and carries the disclaimer, ${viewport.name}`, async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/about/facts/');
      await expect(page.locator('main h1')).toHaveCount(1);
      await expect(page.locator('main h1')).toHaveText('Facts about WE');
      const questions = await page.locator('main h2').allInnerTexts();
      expect(questions).toEqual(expect.arrayContaining(['What is WE not?', 'Is Investor Introductions part of a package?']));
      const text = squash(await page.locator('main').innerText());
      expect(text).toContain(NO_FUNDING);
      expect(text).toContain(DISCLAIMER_START);
      expect(text).toContain('separate, paid add-on with a flat fee');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });
  }

  test('the page structured data is an AboutPage about the organisation and validates as JSON', async ({ page }) => {
    await page.goto('/about/facts/');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length).toBeGreaterThan(0);
    const nodes = blocks.flatMap((b) => {
      const doc = JSON.parse(b) as { '@graph'?: Record<string, unknown>[] };
      return doc['@graph'] ?? [doc as Record<string, unknown>];
    });
    const about = nodes.find((n) => n['@type'] === 'AboutPage');
    expect(about, 'an AboutPage node').toBeDefined();
    expect(about?.['about']).toEqual({ '@id': 'https://worldenterprise.org/#org' });
    const org = nodes.find((n) => n['@id'] === 'https://worldenterprise.org/#org');
    expect(org?.['sameAs']).toEqual(['https://github.com/WorldEnterpriseGroup']);
    expect(JSON.stringify(nodes)).not.toMatch(/"(?:price|priceCurrency|priceSpecification)"/);
  });
});
