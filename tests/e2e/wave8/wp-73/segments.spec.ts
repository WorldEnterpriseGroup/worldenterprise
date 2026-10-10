import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-73: the eight founder segment pages (/founders/<segment>/). Runs at 1440 and at 390. Each page is skipped until its route is built.

const DIR = new URL('../../../../src/content/pages/founders/', import.meta.url);

interface SegmentFront {
  title: string;
  description: string;
  family: { slug: string; whoFor: string; challenges: unknown[] };
}

function frontOf(file: string): SegmentFront {
  const text = readFileSync(new URL(file, DIR), 'utf8');
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (front === undefined) throw new Error(`${file} has no frontmatter`);
  return parse(front) as SegmentFront;
}

const pages = readdirSync(DIR)
  .filter((name) => name.endsWith('.mdx'))
  .sort()
  .map((name) => ({ route: `/founders/${name.replace(/\.mdx$/, '')}/`, front: frontOf(name) }));

test('the eight segment pages exist as files', () => {
  expect(pages).toHaveLength(8);
});

for (const { route, front } of pages) {
  test.describe(route, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(route), `${route} is not built`);
    });

    test('one h1 that is the page title, the fixed sentence, and the sections in order without a skipped level', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(front.title);
      await expect(page.locator('main')).toContainText('This page describes a situation. It is not an eligibility rule.');
      const headings = await page.locator('main h2, main h3').evaluateAll((els) => els.map((el) => ({ level: Number(el.tagName.slice(1)), text: (el.textContent ?? '').trim() })));
      const h2 = headings.filter((h) => h.level === 2).map((h) => h.text);
      const who = h2.indexOf('Who this is for');
      const challenges = h2.indexOf('Common challenges');
      expect(who, 'Who this is for is present').toBeGreaterThanOrEqual(0);
      expect(challenges, 'Common challenges follows it').toBeGreaterThan(who);
      let previous = 1;
      for (const heading of headings) {
        expect(heading.level - previous, `${heading.text} skips a level`).toBeLessThanOrEqual(1);
        previous = heading.level;
      }
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
    });

    test('the situation and the challenges render from the frontmatter, three to five of them', async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('#seg-who')).toHaveText('Who this is for');
      await expect(page.locator('section[aria-labelledby="seg-who"]')).toContainText(front.family.whoFor);
      const items = page.locator('section[aria-labelledby="seg-challenges"] li.fitems__item');
      const count = await items.count();
      expect(count).toBe(front.family.challenges.length);
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(5);
    });

    test('names no number, amount or duration in the situation or the challenges', async ({ page }) => {
      await page.goto(route);
      const text = await page.locator('section[aria-labelledby="seg-who"], section[aria-labelledby="seg-challenges"]').evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText).join('\n'));
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/[$€£%]/);
      expect(text).not.toMatch(/\b(cohort|mentor|accelerator|perks?|guarantee[sd]?|free of charge|no fee|no equity|success fee)\b/i);
    });

    test('the reading path lists only links that resolve, and nothing when no article is tagged', async ({ page, request }) => {
      await page.goto(route);
      const cards = page.locator('section.fhub a[href]');
      const hrefs = await cards.evaluateAll((els) => [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))]);
      if (hrefs.length === 0) {
        await expect(page.locator('#seg-reading')).toHaveCount(0);
        return;
      }
      await expect(page.locator('#seg-reading')).toHaveText('Reading path');
      for (const href of hrefs) {
        expect(href, 'a reading path card links to an article').toMatch(/^\/insights\//);
        expect((await request.get(href)).status(), href).toBe(200);
      }
    });

    test('has its own description, canonical URL, og:url, and a WebPage JSON-LD block', async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', front.description);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${route}$`));
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', new RegExp(`${route}$`));
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\.avif$/);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      const types = blocks.flatMap((block) => {
        const parsed = JSON.parse(block) as { '@type'?: string; '@graph'?: { '@type'?: string }[] };
        return parsed['@graph'] !== undefined ? parsed['@graph'].map((node) => node['@type']) : [parsed['@type']];
      });
      expect(types).toContain('WebPage');
    });

    test('the one path to apply goes to /apply/, and the page makes no third-party request', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      const apply = page.locator('a[href="/apply/"]').first();
      await expect(apply).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(seen.thirdParty, 'requests that left the site while the page loaded').toEqual([]);
      await apply.click();
      await expect(page).toHaveURL(/\/apply\/$/);
    });

    test('no horizontal scroll at this width, and axe finds nothing at WCAG 2.2 AA', async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(await findOverflow(page)).toEqual([]);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}
