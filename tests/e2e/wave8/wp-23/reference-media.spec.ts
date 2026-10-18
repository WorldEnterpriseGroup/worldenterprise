import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { analyzePage } from '../../support/budgets.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';

// WP-23 (issue #89): media density on the reference families. Each hub shows at least six media moments (charts, diagrams, covers,
// scenes, stat bands) and each child page at least three. Every chart carries its data as a table and a source line. The routes are
// checked in both wave 8 projects (1440 and 390) for counts, tables, axe and sideways scroll, and once at 1920x1080 for the full-screen
// layout. A route that is not built is skipped, not failed.

const GUIDES = [
  'investor-readiness-checklist',
  'data-room',
  'safe-explained',
  'investor-updates',
  'term-sheet-checklist',
  'security-questionnaire-answers',
  'pricing-experiments',
  'customer-interview-synthesis',
] as const;
const REPORTS = ['saas-security-baseline-year-one', 'accessibility-as-a-launch-requirement', 'dedicated-team-agency-or-freelancers', 'early-stage-saas-metrics-definitions'] as const;
const BRIEFS = [
  'funding-paths',
  'company-setup',
  'ai-native-build',
  'first-100-customers',
  'pre-seed-evidence-pack',
  'first-hires',
  'early-stage-diligence',
  'ai-company-diligence',
  'partnering-with-founders',
  'corporate-spinouts',
  'real-timeline',
] as const;

const PLAYBOOKS = [
  'validate-the-problem',
  'design-the-product',
  'set-up-the-company',
  'build-and-ship-v1',
  'hire-your-first-team-member',
  'price-your-first-saas-product',
  'earn-your-first-customers',
  'run-your-first-outbound-sequence',
  'build-repeatable-growth',
  'prepare-for-investor-conversations',
] as const;

/** Route and the fewest media moments it may show. */
const ROUTES: readonly (readonly [string, number])[] = [
  ['/fundability/', 6],
  ...GUIDES.map((slug) => [`/fundability/${slug}/`, 3] as const),
  ['/research/', 6],
  ...REPORTS.map((slug) => [`/research/${slug}/`, 4] as const),
  ['/briefs/', 6],
  ...BRIEFS.map((id) => [`/briefs/${id}/`, 3] as const),
  ['/playbooks/', 6],
  ...PLAYBOOKS.map((slug) => [`/playbooks/${slug}/`, 3] as const),
];

async function open(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.evaluate(() => document.fonts.ready);
}

for (const [route, min] of ROUTES) {
  test.describe(route, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(route), `${route} is not built`);
    });

    test(`shows at least ${min} media moments, each chart with a table and a source, and never scrolls sideways`, async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await open(page, route);
      const moments = page.locator('main [data-moment]');
      expect(await moments.count(), 'media moments').toBeGreaterThanOrEqual(min);
      const ids = await moments.evaluateAll((els) => els.map((el) => el.getAttribute('data-media-id') ?? ''));
      expect(new Set(ids).size, 'each moment has its own id').toBe(ids.length);

      const charts = page.locator('main [data-moment="chart"]');
      const chartCount = await charts.count();
      for (let i = 0; i < chartCount; i += 1) {
        const chart = charts.nth(i);
        const id = await chart.getAttribute('data-media-id');
        await expect(chart.locator('table'), `${id} has its data table`).toHaveCount(1);
        expect(await chart.locator('table tbody tr').count(), `${id} table has rows`).toBeGreaterThan(0);
        await expect(chart.locator('.source-note a[href^="https://"]').first(), `${id} links its source`).toBeAttached();
      }

      await expectNoHorizontalScroll(page);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });

    test('axe finds no violation', async ({ page }) => {
      await open(page, route);
      const results = await analyzePage(page);
      expect(results.violations).toEqual([]);
    });
  });
}

test.describe('reference routes at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'wave8-desktop-1440x900', 'the full-screen check runs once, in the desktop wave 8 project');
  });

  for (const [route] of ROUTES) {
    test(`${route} fills the screen, keeps the reading measure and never scrolls sideways`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await open(page, route);
      await expectNoHorizontalScroll(page);
      await expectFullWidth(page);
      await expectReadableProse(page);
      expect(await expectBandsFullBleed(page), 'media bands').toBeGreaterThan(0);
    });
  }
});
