import { expect, test } from '@playwright/test';
import { ensureBudget } from '../../support/budgets.ts';
import { isBuilt, liveRoutes } from '../../support/routes.ts';
import { FULL_HD, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';
import { ALLOWED_BANDS, ALLOWED_ROUTES, expectContentExtent, measureBands, offenders } from '../wp-51/lib/content-extent.ts';

// WP-109 (issue #109): at 1920x1080 the content of every band, not only its frame, uses the width. `expectFullWidth` proves a .container
// spans the 110rem frame; this proves that what is inside it does too: a band whose text, media and cards span at least 1440px, leave
// at most 240px empty on either side and have no empty run over 160px between them. Running text keeps its reading measure (46rem, growing to 57rem with the type from 1440px) but never sits alone (a rail carries the page's contents list,
// call to action and sources beside it); cards, grids and tables span the frame; a hero without media is a two-column arrangement.

/** One route per page family, so a failure names the family. A family route that is not built fails: the e2e jobs run on the built site, so a missing page is a defect, not a reason to look away. */
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

test.describe('content extent at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  // The viewport is fixed here, so one project is enough: playwright.config.ts keeps this spec out of the mobile project instead of skipping it.

  for (const { path, family } of FAMILIES) {
    test(`${path} (${family}) uses the frame and never scrolls sideways`, async ({ page }) => {
      expect(isBuilt(path), `${path} (${family}) must be built: the e2e jobs run on the built site`).toBe(true);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      expect(await expectContentExtent(page), 'the page has bands to measure').toBeGreaterThan(0);
      await expectNoHorizontalScroll(page);
    });
  }

  // Every live route, walked in chunks of CHUNK (#49). One serial walk of all ~320 pages took 12 to 18 minutes on a loaded runner, overran
  // its budget, and each retry walked every page again, which alone used up the 1 hour job (pipelines 97297, 97500). As chunks the
  // workers share the walk, a retry repeats one chunk, and a failure names the chunk's first and last route. No route is left out.
  const CHUNK = 40;
  const allowed = new Set(ALLOWED_ROUTES.map((a) => a.path));
  const walk = liveRoutes.filter((route) => !allowed.has(route.path));
  for (let start = 0; start < walk.length; start += CHUNK) {
    const chunk = walk.slice(start, start + CHUNK);
    const label = `${chunk[0]?.path} .. ${chunk[chunk.length - 1]?.path}`;
    test(`live routes ${start + 1}-${start + chunk.length} of ${walk.length} pass the content-extent gate (${label})`, async ({ page }) => {
      // About four seconds a page on a loaded runner, plus the base budget.
      ensureBudget(45_000 + chunk.length * 4_000);
      const skip = ALLOWED_BANDS.map((a) => a.match);
      const failures: string[] = [];
      for (const route of chunk) {
        const response = await page.goto(route.path);
        if (response === null || !response.ok()) continue;
        await page.evaluate(() => document.fonts.ready);
        for (const line of offenders(await page.evaluate(measureBands), skip)) failures.push(`${route.path} ${line}`);
      }
      expect(failures, 'bands whose content does not use the frame').toEqual([]);
    });
  }

  test('the chunked walk covers every live route that is not allowlisted, once', () => {
    expect(walk.length, 'live routes to walk').toBeGreaterThan(0);
    expect(new Set(walk.map((r) => r.path)).size, 'no route twice').toBe(walk.length);
  });

  test('every allowlisted route and band names its reason', () => {
    for (const entry of [...ALLOWED_ROUTES, ...ALLOWED_BANDS]) {
      expect(entry.reason.trim().length, `${'path' in entry ? entry.path : entry.match} needs a written reason`).toBeGreaterThanOrEqual(40);
    }
  });
});
