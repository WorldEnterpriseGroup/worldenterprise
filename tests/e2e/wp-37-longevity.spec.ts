import { expect, test } from '@playwright/test';
import { isBuilt } from './support/routes.ts';
import { FULL_HD, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll } from './wave8/wp-51/lib/full-width.ts';

// WP-37 (issue #86, wave 10): the longevity narrative ("Move fast every week. Build for the decade.") on the home page, the program
// pages, /how-we-work/, /why-it-takes-time/ and /who-we-work-with/ with its situation pages; the inclusive ecosystem, SBIR and STTR
// and data moments that link to /ecosystem/, /sbir-sttr/ and /data/ (each rendered only once its route is built).

const SITUATIONS = [
  'industry-insiders',
  'encore-founders',
  'repeat-builders',
  'global-founders',
  'under-backed-builders',
  'next-gen-founders',
  'restart-founders',
] as const;

const HEADLINE = 'Move fast every week. Build for the decade.';

const HUBS: readonly string[] = ['/', '/program/', '/how-we-work/', '/why-it-takes-time/', '/who-we-work-with/'];
const SUBPAGES: readonly string[] = [
  '/program/dream/',
  '/program/build/',
  '/program/grow/',
  '/program/how-it-works/',
  '/program/dedicated-teams/',
  '/program/digital-incubation-model/',
  '/program/how-we-decide/',
  '/program/who-its-for/',
  ...SITUATIONS.map((s) => `/who-we-work-with/${s}/`),
];
const ALL: readonly string[] = [...HUBS, ...SUBPAGES];

test.describe('the longevity band', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of ALL) {
    test(`${route} carries the longevity band, with both halves and a named heading`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      const band = page.locator('section#longevity');
      await expect(band).toHaveCount(1);
      await expect(band.getByRole('heading', { level: 2, name: HEADLINE })).toBeVisible();
      await expect(band.getByRole('heading', { level: 3, name: 'Fast, and written down.' })).toBeVisible();
      await expect(band.getByRole('heading', { level: 3, name: /Patient, because the odds turn slowly/ })).toBeVisible();
      await expect(band.locator('.longevity__step')).toHaveCount(4);
      await expect(band).toHaveAttribute('aria-labelledby', 'longevity-title');
    });
  }

  for (const route of ['/', '/program/', '/how-we-work/']) {
    test(`${route} draws the long-horizon track with sourced survival gates`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      const track = page.locator('section#longevity .longevity__track');
      await expect(track).toHaveCount(1);
      await expect(track.getByText('77.9% still operating').first()).toBeAttached();
      await expect(track.locator('a[href^="https://"]').first()).toBeAttached();
    });
  }

  test('the primary call to action on the home page is still "Start a readiness review"', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Start a readiness review' }).first()).toHaveAttribute('href', /\/apply\/$/);
  });
});

test.describe('the ecosystem, SBIR and STTR, and data moments', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of HUBS) {
    test(`${route}: every link to the new routes resolves, and each band appears exactly when its route is built`, async ({ page, request }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      for (const [selector, target] of [
        ['section#join', '/ecosystem/'],
        ['section#sbir', '/sbir-sttr/'],
        ['section#data-teaser', '/data/'],
      ] as const) {
        const band = page.locator(selector);
        if (!isBuilt(target)) {
          await expect(band, `${selector} stays out until ${target} exists`).toHaveCount(0);
          continue;
        }
        await expect(band).toHaveCount(1);
        const link = band.locator(`a[href$="${target}"]`).first();
        await expect(link).toBeVisible();
        const response = await request.get(new URL((await link.getAttribute('href')) ?? '', page.url()).toString());
        expect(response.status(), `${target} responds`).toBe(200);
      }
      // No page links an ecosystem route that is not built.
      const hrefs = await page.locator('main a[href]').evaluateAll((els) => els.map((a) => a.getAttribute('href') ?? ''));
      for (const target of ['/ecosystem/', '/sbir-sttr/', '/data/']) {
        if (!isBuilt(target)) expect(hrefs.filter((h) => h.endsWith(target)), `no link to the unbuilt ${target}`).toEqual([]);
      }
    });
  }

  test('the ecosystem band says WE is independent of the programs it names, and promises no award', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), '/ecosystem/ is not built');
    await page.goto('/');
    await expect(page.locator('section#join')).toContainText('No affiliation or endorsement is implied');
    if (isBuilt('/sbir-sttr/')) await expect(page.locator('section#sbir')).toContainText('cannot promise an award');
  });

  for (const slug of SITUATIONS) {
    test(`/who-we-work-with/${slug}/ points to programs that fit, and to SBIR and STTR`, async ({ page }) => {
      const route = `/who-we-work-with/${slug}/`;
      test.skip(!isBuilt(route) || !isBuilt('/ecosystem/'), 'the page or /ecosystem/ is not built');
      await page.goto(route);
      const programs = page.locator('section#programs');
      await expect(programs).toHaveCount(1);
      expect(await programs.locator('li').count()).toBeGreaterThanOrEqual(3);
      await expect(programs.locator('a[href$="/ecosystem/"]')).toBeVisible();
      if (isBuilt('/sbir-sttr/')) await expect(programs.locator('a[href$="/sbir-sttr/"]')).toBeVisible();
    });
  }

  test('the hub matrix is a real table: a row per situation, headers in both directions', async ({ page }) => {
    test.skip(!isBuilt('/who-we-work-with/') || !isBuilt('/ecosystem/'), 'the hub or /ecosystem/ is not built');
    await page.goto('/who-we-work-with/');
    const table = page.locator('#where-to-look table');
    await expect(table.locator('tbody tr')).toHaveCount(SITUATIONS.length);
    await expect(table.locator('tbody th[scope="row"] a')).toHaveCount(SITUATIONS.length);
    expect(await table.locator('thead th[scope="col"]').count()).toBeGreaterThanOrEqual(4);
  });
});

test.describe('at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });

  for (const route of HUBS) {
    test(`${route} fills the frame and its new bands run full bleed`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectBandsFullBleed(page);
      await expectNoHorizontalScroll(page);
      const band = page.locator('section#longevity');
      const box = await band.boundingBox();
      expect(box?.width ?? 0, 'the longevity band spans the viewport').toBeGreaterThanOrEqual(FULL_HD.width - 20);
    });
  }
});
