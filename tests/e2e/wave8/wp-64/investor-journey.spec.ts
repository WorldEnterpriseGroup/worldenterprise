import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-64: the investor journey. The hub, the five information pages, the interest form and its thank-you page. Runs at 1440 and at 390.
// Nothing here depends on a portfolio: src/content/portfolio holds no entry, so the showcase shows its one fixed sentence.

const FUNDING = 'WE makes no promise of funding.';
const DISCLAIMER = 'Introductions are a flat-fee service.';
const DISCLAIMER_FULL = 'Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.';

interface Journey {
  readonly route: string;
  readonly h1: RegExp;
  /** The page names the paid add-on, so it carries the verbatim disclaimer. */
  readonly names: boolean;
}

const PAGES: readonly Journey[] = [
  { route: '/investors/', h1: /Meet the companies WE incubates/, names: true },
  { route: '/investors/meet-startups/', h1: /./, names: true },
  { route: '/investors/what-you-can-see/', h1: /./, names: false },
  { route: '/investors/readiness-criteria/', h1: /./, names: true },
  { route: '/investors/showcase-format/', h1: /./, names: false },
  { route: '/investors/faq/', h1: /./, names: true },
  { route: '/investors/interest/', h1: /./, names: true },
];

for (const entry of PAGES) {
  test.describe(entry.route, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(entry.route), `${entry.route} is not built`);
    });

    test('one h1, no skipped heading level, no console error and no third-party request', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.goto(entry.route);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(entry.h1);
      const levels = await page.locator('main h1, main h2, main h3, main h4').evaluateAll((els) => els.map((el) => ({ level: Number(el.tagName.slice(1)), text: (el.textContent ?? '').trim() })));
      let previous = 1;
      for (const heading of levels) {
        expect(heading.level - previous, `${heading.text} skips a level`).toBeLessThanOrEqual(1);
        previous = heading.level;
      }
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });

    test('states that WE makes no promise of funding, and carries the disclaimer where the add-on is named', async ({ page }) => {
      await page.goto(entry.route);
      const text = ((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ');
      expect(text).toContain(FUNDING);
      if (entry.names) expect(text).toContain(DISCLAIMER);
      // The disclaimer is the owner's verbatim sentence and says "takes no fee or stake tied to any investment". Anywhere else the words are banned.
      const outsideDisclaimer = text.split(DISCLAIMER_FULL).join(' ');
      expect(outsideDisclaimer).not.toMatch(/success fee|no fee|no equity|no stake|free of charge/i);
      expect(text).not.toMatch(/investor network|our investors|portfolio companies/i);
    });

    test('has no axe violation at WCAG 2.2 AA', async ({ page }) => {
      await page.goto(entry.route);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  });
}

test.describe('the hub', () => {
  const ROUTE = '/investors/';
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), `${ROUTE} is not built`);
  });

  test('says it is not an offer of securities, and that the fee does not depend on a closing', async ({ page }) => {
    await page.goto(ROUTE);
    const text = ((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Not an offer of securities');
    expect(text).toContain('The fee does not depend on whether any investment closes.');
  });

  test('with no consented company, the showcase shows only its fixed sentence', async ({ page }) => {
    await page.goto(ROUTE);
    const showcase = page.locator('[data-showcase]');
    await expect(showcase).toHaveCount(1);
    const mode = await showcase.getAttribute('data-showcase');
    if (mode === 'empty') {
      await expect(showcase).toHaveText("No company is listed yet. WE lists a company here only with its founder's written consent.");
      await expect(page.locator('ul[data-showcase="list"]')).toHaveCount(0);
    } else {
      // A consented record exists: every card shows a name, and a link only when it is an http or https address.
      const cards = page.locator('ul[data-showcase="list"] > li');
      expect(await cards.count()).toBeGreaterThan(0);
      for (const href of await page.locator('ul[data-showcase="list"] a').evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))) {
        expect(href).toMatch(/^https?:\/\//);
      }
    }
  });

  test('the primary call to action opens the interest form', async ({ page }) => {
    test.skip(!isBuilt('/investors/interest/'), '/investors/interest/ is not built');
    await page.goto(ROUTE);
    const ask = page.locator('main a', { hasText: 'Ask to meet a company' }).first();
    await expect(ask).toHaveAttribute('href', /\/investors\/interest\/$/);
    await ask.click();
    await expect(page).toHaveURL(/\/investors\/interest\/$/);
  });
});

test.describe('the pages link to each other', () => {
  test('every link to another investor page resolves to a built page', async ({ page }) => {
    const seen = new Set<string>();
    for (const entry of PAGES.filter((p) => isBuilt(p.route))) {
      await page.goto(entry.route);
      const hrefs = await page.locator('main a[href^="/investors/"]').evaluateAll((els) => els.map((el) => (el.getAttribute('href') ?? '').split('#')[0] ?? ''));
      for (const href of hrefs) seen.add(href);
    }
    for (const href of seen) expect(isBuilt(href), `${href} is linked and not built`).toBe(true);
  });
});
