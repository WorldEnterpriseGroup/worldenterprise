import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-87: the guides, the templates and the readiness check's extra reading. A page that is not built yet is skipped, never failed, and a
// link to a page that is not built must not appear.

const NEW_GUIDES = [
  { slug: 'term-sheet-checklist', title: 'Term sheet checklist' },
  { slug: 'security-questionnaire-answers', title: 'Security questionnaire answers' },
  { slug: 'pricing-experiments', title: 'Pricing experiments' },
  { slug: 'customer-interview-synthesis', title: 'Customer interview synthesis' },
] as const;

const NEW_TEMPLATES = [
  'landing-page-brief',
  'pricing-page-checklist',
  'job-description-template',
  'outreach-sequence-worksheet',
  'interview-synthesis-sheet',
  'decision-log',
] as const;

const EXAMPLE_LABEL = 'Illustrative example, not a real company';

test.describe('fundability hub', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/fundability/'), '/fundability/ is not built');
  });

  test('lists each new guide that is built, links nothing that is not built, and names no count of guides', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto('/fundability/');
    for (const guide of NEW_GUIDES) {
      const route = `/fundability/${guide.slug}/`;
      const link = page.locator('main a[href$="' + route + '"]');
      if (isBuilt(route)) expect(await link.count(), route).toBeGreaterThan(0);
      else await expect(link, route).toHaveCount(0);
    }
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\b(?:four|five|six|seven|eight|nine|ten|\d+) guides\b/i);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('axe finds nothing at WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/fundability/');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe('readiness check extra reading', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/fundability/'), '/fundability/ is not built');
  });

  test('a gap shows the extra reading under it, every link of it is built, and the first place to start is unchanged', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto('/fundability/');
    const check = page.locator('we-readiness-check');
    const boxes = check.locator('input[type="checkbox"]');
    expect(await boxes.count(), 'twelve statements').toBe(12);
    await check.locator('[data-rc-show]').click();
    const result = check.locator('[data-rc-result]');
    const gaps = result.locator('li');
    expect(await gaps.count(), 'every statement is a gap when none is ticked').toBe(12);
    await expect(result).not.toContainText(/\b\d+\s*(%|\/\s*12|out of)/i);

    const also = result.locator('.rc__also');
    expect(await also.count(), 'at least one gap carries extra reading').toBeGreaterThan(0);
    const hrefs = await also.locator('a').evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(isBuilt(href), `${href} is linked from the readiness check but is not built`).toBe(true);
    await expect(also.first()).toContainText('Also useful:');

    // Ticking a statement removes its gap and its extra reading with it.
    const before = await also.count();
    await boxes.first().check();
    await check.locator('[data-rc-show]').click();
    expect(await result.locator('li').count()).toBe(11);
    expect(await also.count()).toBeLessThanOrEqual(before);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('without the script the same links are in the page, and the statements are unchanged', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto('/fundability/');
    const check = page.locator('we-readiness-check');
    expect(await check.locator('input[type="checkbox"]').count()).toBe(12);
    const hrefs = await check.locator('.rc__start a').evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(12);
    for (const href of hrefs) expect(isBuilt(href), `${href} is linked from the readiness check but is not built`).toBe(true);
    await context.close();
  });
});

test.describe('library index', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/library/'), '/library/ is not built');
  });

  test('lists each new template that is built, and links nothing that is not built', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto('/library/');
    for (const slug of NEW_TEMPLATES) {
      const route = `/library/${slug}/`;
      const link = page.locator('main a[href$="' + route + '"]');
      if (isBuilt(route)) expect(await link.count(), route).toBeGreaterThan(0);
      else await expect(link, route).toHaveCount(0);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('axe finds nothing at WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/library/');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

for (const guide of NEW_GUIDES) {
  const route = `/fundability/${guide.slug}/`;
  test.describe(`guide ${route}`, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(route), `${route} is not built`);
    });

    test('has one h1, an About the evidence section, a Sources list, the no-funding statement, the labeled example and no HowTo data', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 2, name: 'About the evidence' })).toHaveCount(1);
      await expect(page.locator('main')).toContainText('no promise of funding');
      await expect(page.locator('main')).toContainText(EXAMPLE_LABEL);
      const sources = page.locator('main a[href^="https://"]');
      expect(await sources.count(), 'the outside sources are linked').toBeGreaterThan(1);
      const types = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ''));
      for (const raw of types) expect(raw).not.toContain('HowTo');
      // Wave 11 (WP-23, #89) adds media to the guides: every image in main is either described or decorative (alt="" or aria-hidden),
      // has explicit dimensions, and loads lazily when it starts below the first viewport.
      const images = await page.locator('main img').evaluateAll((els) =>
        els.map((el) => ({
          src: el.getAttribute('src') ?? '',
          alt: el.getAttribute('alt'),
          hidden: el.getAttribute('aria-hidden') === 'true',
          width: el.getAttribute('width'),
          height: el.getAttribute('height'),
          loading: el.getAttribute('loading'),
          below: el.getBoundingClientRect().top + window.scrollY > window.innerHeight,
        })),
      );
      for (const img of images) {
        expect(img.alt !== null || img.hidden, `${img.src} has an alt attribute or is hidden`).toBe(true);
        expect(Number(img.width), `${img.src} has a width`).toBeGreaterThan(0);
        expect(Number(img.height), `${img.src} has a height`).toBeGreaterThan(0);
        if (img.below) expect(img.loading, `${img.src} below the fold loads lazily`).toBe('lazy');
      }
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });

    test('has a Markdown twin', async ({ request }) => {
      const response = await request.get(`/fundability/${guide.slug}.md`);
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).toContain(`# ${guide.title}`);
    });

    test('axe finds nothing at WCAG 2.2 AA', async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  });
}

for (const slug of NEW_TEMPLATES) {
  const route = `/library/${slug}/`;
  test.describe(`template ${route}`, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(route), `${route} is not built`);
    });

    test('has one h1 and numbered sections, and loads nothing from outside the site', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const headings = await page.locator('main h2').allInnerTexts();
      expect(headings.some((h) => /^1\.\s/.test(h.trim())), 'sections are numbered from 1').toBe(true);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });
  });
}

test.describe('worked examples in templates carry the exact label', () => {
  for (const slug of ['interview-synthesis-sheet', 'decision-log'] as const) {
    test(`/library/${slug}/`, async ({ page }) => {
      test.skip(!isBuilt(`/library/${slug}/`), `/library/${slug}/ is not built`);
      await page.goto(`/library/${slug}/`);
      await expect(page.locator('main')).toContainText(EXAMPLE_LABEL);
    });
  }
});
