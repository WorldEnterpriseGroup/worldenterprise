import { expect, test } from '@playwright/test';
import { ensureBudget } from '../../support/budgets.ts';
import { isBuilt, liveRoutes } from '../../support/routes.ts';
import { FULL_HD, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';
import { ALLOWED_BANDS, ALLOWED_ROUTES, expectContentExtent, measureBands, offenders } from '../wp-51/lib/content-extent.ts';

// WP-109 (issue #109): at 1920x1080 the content of every band, not only its frame, uses the width. `expectFullWidth` proves a .container
// spans the 110rem frame; this proves that what is inside it does too: a band whose text, media and cards span at least 1440px, leave
// at most 240px empty on either side and have no empty run over 160px between them. Running text keeps its reading measure (46rem, growing to 57rem with the type from 1440px) but never sits alone (a rail carries the page's contents list,
// call to action and sources beside it); cards, grids and tables span the frame; a hero without media is a two-column arrangement.

/** One route per page family, so a failure names the family. A route that is not built is skipped, not failed. */
const FAMILIES: readonly { readonly path: string; readonly family: string }[] = [
  { path: '/', family: 'home' },
  { path: '/program/', family: 'program hub' },
  { path: '/program/how-it-works/', family: 'program page with a longevity band and fact band' },
  { path: '/pricing/', family: 'tool page' },
  { path: '/founders/', family: 'founders hub' },
  { path: '/founders/first-time-founders/', family: 'segment page' },
  { path: '/industries/fintech/', family: 'industry page' },
  { path: '/about/brand-story/', family: 'marketing prose with a rail' },
  { path: '/fundability/investor-readiness-checklist/', family: 'guide' },
  { path: '/compare/build-vs-buy/', family: 'comparison' },
  { path: '/legal/privacy/', family: 'legal' },
  { path: '/playbooks/build-and-ship-v1/', family: 'playbook' },
  { path: '/library/customer-interview-guide/', family: 'library template' },
  { path: '/briefs/real-timeline/', family: 'brief squeeze page' },
  { path: '/research/', family: 'research hub' },
  { path: '/ecosystem/', family: 'ecosystem (console hero)' },
  { path: '/who-we-work-with/encore-founders/', family: 'situation page' },
  { path: '/why-it-takes-time/', family: 'sales stations' },
  { path: '/press/', family: 'press' },
  { path: '/data/formation/', family: 'data page' },
];

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

test.describe('content extent at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'width checks run once, in the desktop wave 8 project');
  });

  for (const { path, family } of FAMILIES) {
    test(`${path} (${family}) uses the frame and never scrolls sideways`, async ({ page }) => {
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      expect(await expectContentExtent(page), 'the page has bands to measure').toBeGreaterThan(0);
      await expectNoHorizontalScroll(page);
    });
  }

  test('every live route passes the content-extent gate', async ({ page }) => {
    // The walk is 320 pages at about two seconds each on a loaded runner, past the 3 minute cap of budgetForItems, so it asks for its own size.
    ensureBudget(Math.max(180_000, liveRoutes.length * 3_000));
    const allowed = new Set(ALLOWED_ROUTES.map((a) => a.path));
    const skip = ALLOWED_BANDS.map((a) => a.match);
    const failures: string[] = [];
    for (const route of liveRoutes) {
      if (allowed.has(route.path)) continue;
      const response = await page.goto(route.path);
      if (response === null || !response.ok()) continue;
      await page.evaluate(() => document.fonts.ready);
      for (const line of offenders(await page.evaluate(measureBands), skip)) failures.push(`${route.path} ${line}`);
    }
    expect(failures, 'bands whose content does not use the frame').toEqual([]);
  });

  test('every allowlisted route and band names its reason', () => {
    for (const entry of [...ALLOWED_ROUTES, ...ALLOWED_BANDS]) {
      expect(entry.reason.trim().length, `${'path' in entry ? entry.path : entry.match} needs a written reason`).toBeGreaterThanOrEqual(40);
    }
  });
});
