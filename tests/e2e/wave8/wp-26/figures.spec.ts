import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { budgetForItems } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';
import { expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';

// WP-26 (issue #92): every /insights/ article shows sourced figures under "In the data". One article per figure, so every figure in
// src/data/insight-figures/figures.ts renders here at least once (the unit tests in tests/unit/wp-26 prove every article is registered).
// Each figure has a caption, a data table in the table frame, a source link and its retrieval date; the drawings are named; the section
// needs no script; and no page scrolls sideways at 1920, 1440, 390 or 320 pixels.

/** [figure id, kind, article slug]: the first article that shows each figure. */
const FIGURES: readonly (readonly [string, string, string])[] = [
  ['bds-exit-by-firm-age', 'bars', 'product-management-for-a-first-saas-roles-backlog-and-decisions'],
  ['bds-jobs-by-firm-age', 'bars', 'mapping-the-alternatives-a-customer-already-uses'],
  ['bds-firms-by-size', 'bars', 'build-versus-buy-for-auth-billing-and-email'],
  ['bds-startups-by-year', 'line', 'is-your-saas-idea-a-business-or-a-feature'],
  ['bed-information-survival-2015', 'line', 'a-boring-first-technology-stack'],
  ['bds-exit-health-care', 'bars', 'healthtech-saas-considerations-before-you-build'],
  ['bds-exit-finance', 'bars', 'fintech-saas-considerations-before-you-build'],
  ['bds-exit-education', 'bars', 'edtech-saas-considerations-before-you-build'],
  ['bds-exit-professional', 'bars', 'government-software-considerations-for-selling-to-the-public-sector'],
  ['bds-exit-information', 'bars', 'security-software-considerations-before-you-build'],
  ['bds-exit-administrative', 'bars', 'hr-and-recruiting-software-considerations-before-you-build'],
  ['bds-exit-utilities', 'bars', 'climate-tech-software-considerations-before-you-build'],
  ['btos-ai-use', 'line', 'ai-regulation-for-a-small-saas-company-what-to-ask-counsel'],
  ['btos-ai-by-sector', 'bars', 'ai-features-and-customer-data-what-to-decide-first'],
  ['nist-ai-rmf-core', 'bars', 'ai-regulation-for-a-small-saas-company-what-to-ask-counsel'],
  ['owasp-llm-top-10-2025', 'rank', 'evaluating-an-llm-feature-before-you-ship-it'],
  ['bls-tenure-by-age', 'bars', 'an-operating-rhythm-for-a-remote-offshore-team'],
  ['bls-alternative-arrangements', 'bars', 'paying-a-first-team-before-funding-the-options-and-what-each-risks'],
  ['carta-round-gaps', 'bars', 'evidence-over-narrative-what-diligence-actually-tests'],
  ['carta-round-ages', 'bars', 'choosing-the-right-first-investors-for-a-saas-company'],
  ['carta-dilution', 'bars', 'questions-to-ask-your-counsel-before-you-sign'],
  ['waffle-2015', 'waffle', 'kill-criteria-deciding-in-advance-when-to-stop'],
  ['waffle-2021-applications', 'waffle', 'fake-door-and-concierge-tests'],
  ['slope-payroll', 'slope', 'cutting-an-mvp-the-cut-line-test'],
  ['slope-sectors', 'slope', 'customer-discovery-interviews-without-false-positives'],
  ['ridgeline-exits', 'ridgeline', 'onboarding-is-acquisition-time-to-first-value'],
  ['range-founder-age', 'range', 'spinning-a-product-out-of-an-employer-what-to-settle-first'],
  ['area-age-share', 'area', 'three-ways-to-start-an-idea-a-skill-a-lived-problem'],
];
const route = (slug: string): string => `/insights/${slug}/`;
const ROUTES = [...new Set(FIGURES.map(([, , slug]) => route(slug)))];
/** One article per kind of drawing: the width checks run on these. */
const BY_KIND = [...new Map(FIGURES.map(([, kind, slug]) => [kind, route(slug)])).values()];
/** Articles whose figures WP-38 placed inline: the layout adds no section to them. */
const INLINE = ['/insights/the-longevity-paradox-sprint-weekly-endure-for-a-decade/', '/insights/the-time-between-funding-rounds-what-carta-data-reports/'];
const HONESTY = 'These figures describe U.S. businesses in general, not WE’s results.';
const WIDTHS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
] as const;
const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

async function expectNamedDrawings(page: Page): Promise<void> {
  const problems = await page.evaluate(() =>
    [...document.querySelectorAll('[data-insight-figures] svg[role="img"]')].flatMap((svg, i) => {
      const ids = (svg.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter((id) => id !== '');
      if (ids.length === 0) return [`svg ${i} has no aria-labelledby`];
      return ids.flatMap((id) => {
        const el = document.getElementById(id);
        return el === null || (el.textContent ?? '').trim() === '' ? [`svg ${i}: #${id} is missing or empty`] : [];
      });
    }),
  );
  expect(problems).toEqual([]);
}

test.describe('insight figures', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const [id, kind, slug] of FIGURES) {
    test(`${id} (${kind}) renders on ${slug} with a caption, a framed table and its source`, async ({ page }) => {
      test.skip(!isBuilt(route(slug)), `${route(slug)} is not built`);
      await page.goto(route(slug));
      const section = page.locator('main [data-insight-figures]');
      await expect(section).toHaveCount(1);
      await expect(section.getByRole('heading', { level: 2, name: 'In the data' })).toBeVisible();
      await expect(section).toContainText(HONESTY);
      const figure = section.locator(`figure#${id}`);
      await expect(figure).toHaveCount(1);
      await expect(figure).toBeVisible();
      await expect(figure.locator('figcaption')).not.toBeEmpty();
      await expect(figure.locator('.dv__caption')).not.toBeEmpty();
      await expect(figure.locator('svg[role="img"], ol')).not.toHaveCount(0);
      const frame = figure.locator('details .table-wrap');
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute('tabindex', '0');
      await expect(frame).toHaveAttribute('aria-label', /\S/);
      await expect(frame.locator('table caption')).not.toBeEmpty();
      expect(await frame.locator('tbody tr').count()).toBeGreaterThanOrEqual(2);
      await expect(figure.locator('.source-note a[href^="https://"]').first()).toBeAttached();
      await expect(figure).toContainText(/Retrieved 2026-10-1[56]\./);
      await figure.locator('details summary').click();
      await expect(frame).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  for (const path of ROUTES) {
    test(`${path}: named drawings, the section before the sources, unique table names, no axe violations, no third party`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(path), `${path} is not built`);
      const seen = watch(page, baseURL ?? '');
      await page.goto(path);
      await expectNamedDrawings(page);
      const order = await page.evaluate(() => {
        const s = document.querySelector('[data-insight-figures]');
        const sources = [...document.querySelectorAll('main h2')].find((h) => /^Sources$/i.test((h.textContent ?? '').trim()));
        return s !== null && sources !== undefined ? Boolean(s.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
      });
      expect(order, 'In the data comes before the sources list').not.toBe(false);
      const names = await page.locator('main .table-wrap').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      expect(new Set(names).size, `table names repeat: ${names.join(' | ')}`).toBe(names.length);
      const results = await new AxeBuilder({ page }).include('[data-insight-figures]').withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty, 'the page contacts only the site').toEqual([]);
    });
  }

  test('the insights index and the inline-figure articles carry no figure section', async ({ page }) => {
    for (const path of ['/insights/', ...INLINE]) {
      if (!isBuilt(path)) continue;
      await page.goto(path);
      await expect(page.locator('[data-insight-figures]'), path).toHaveCount(0);
    }
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the no-script pass runs once, in the desktop wave 8 project');
  });

  for (const path of BY_KIND) {
    test(`${path} draws its figures with no script`, async ({ page }) => {
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      const figures = page.locator('[data-insight-figures] figure.dv');
      expect(await figures.count()).toBeGreaterThanOrEqual(1);
      await expect(figures.first()).toBeVisible();
      expect(await page.locator('[data-insight-figures] details table').count()).toBeGreaterThanOrEqual(1);
    });
  }
});

test.describe('at every width', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the width pass sets its own viewports, so it runs once, in the desktop wave 8 project');
  });

  for (const path of BY_KIND) {
    test(`${path} never scrolls sideways at 1920, 1440, 390 or 320 pixels, with every table open`, async ({ page }) => {
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      const summaries = await page.locator('[data-insight-figures] details summary').all();
      budgetForItems(summaries.length + WIDTHS.length * 2, 1_000);
      for (const summary of summaries) await summary.click();
      for (const size of WIDTHS) {
        await page.setViewportSize(size);
        await expectNoHorizontalScroll(page);
        const overflow = await page.locator('[data-insight-figures] figure').evaluateAll((els) =>
          els.filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.id),
        );
        expect(overflow, `figures wider than ${size.width}px`).toEqual([]);
      }
    });
  }
});
