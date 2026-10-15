import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, SMALLEST_PHONE, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';

// WP-54 (issue #75, W9-13): /how-we-work/ replaces /pricing/. The page is drawn, not listed: full-bleed bands, a phase timeline to
// scale, a twelve-month strip, the cadence and the team constellation. It fills a 1920x1080 screen, reads at phone width and keeps
// every required sentence. Runs in the wave 8 projects (1440x900 and 390x844); the 1920 and 320 checks run once, in the desktop project.

const ROUTE = '/how-we-work/';
const BUILT = isBuilt(ROUTE);
const isDesktop = (info: TestInfo): boolean => info.project.name.includes('desktop');

test.describe('How WE works', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(() => {
    test.skip(!BUILT, `${ROUTE} is not built`);
  });

  test('the page carries the sections, the required texts and the calls to action, and no price or package', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(ROUTE);
    await expect(page.locator('h1')).toHaveText(/How WE works/);
    for (const id of ['before', 'start', 'phases', 'team', 'cadence', 'paid', 'ending', 'not']) await expect(page.locator(`#${id}`)).toBeAttached();
    const main = page.locator('main');
    await expect(main).toContainText('WE makes no promise of funding.');
    await expect(main).toContainText(
      'Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.',
    );
    await expect(main).toContainText('The fee does not depend on whether any investment closes.');
    await expect(main).toContainText('WE is paid for work already done, never in advance of it.');
    await expect(main).toContainText('Default initial term: six months. Default; your agreement sets the real terms.');
    await expect(main).toContainText("These figures describe all new U.S. businesses, not WE's results.");
    const text = (await main.innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\$\s?\d|\bper seat\b|\b(Spark|Accelerate|Studio)\b|\bcohort|\baccelerator\b|\bfree\b|belongs to your company/i);
    await expect(main.getByRole('link', { name: 'Start a readiness review' }).first()).toHaveAttribute('href', /\/apply\/$/);
    await expect(main.getByRole('link', { name: 'Talk to WE' }).first()).toHaveAttribute('href', /\/contact\/$/);
    await expect(main.locator('a[href$="/pricing/"]')).toHaveCount(0);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('the visuals are there: twelve open months, five phases, the scale, four rhythms and the team', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('.hww-months__grid > li')).toHaveCount(12);
    await expect(page.locator('.hww-phase__name')).toHaveText(['Ignite', 'Build', 'Launch', 'Grow', 'Orbit']);
    await expect(page.locator('.hww-cadence > li')).toHaveCount(4);
    await expect(page.locator('#team')).toContainText('Delivery Lead');
    await expect(page.locator('#team')).toContainText('Technical Lead');
    await expect(page.locator('#team')).toContainText('Executive Sponsor');
  });

  test('the timeline is to scale on a wide screen: Build is twice Ignite and Grow four times', async ({ page }, info) => {
    test.skip(!isDesktop(info), 'the scale row shows on wide screens');
    await page.goto(ROUTE);
    const bars = page.locator('.hww-scale__bars > *');
    await expect(bars).toHaveCount(5);
    const widths = await bars.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    const [ignite = 0, build = 0, launch = 0, grow = 0] = widths;
    expect(ignite).toBeGreaterThan(0);
    expect(Math.abs(build / ignite - 2)).toBeLessThan(0.15);
    expect(Math.abs(launch / ignite - 3)).toBeLessThan(0.2);
    expect(Math.abs(grow / ignite - 4)).toBeLessThan(0.25);
  });

  test('the page passes axe and nothing overflows', async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  });
});

test.describe('How WE works at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(!BUILT, `${ROUTE} is not built`);
    test.skip(!isDesktop(info), 'width checks run once, in the desktop project');
  });

  test('fills the frame, bleeds its bands, keeps its text readable and never scrolls sideways', async ({ page }) => {
    await page.goto(ROUTE);
    await page.evaluate(() => document.fonts.ready);
    await expectFullWidth(page);
    await expectNoHorizontalScroll(page);
    await expectReadableProse(page);
    expect(await expectBandsFullBleed(page)).toBeGreaterThanOrEqual(6);
  });
});

test.describe('How WE works on the smallest phone', () => {
  test.use({ viewport: SMALLEST_PHONE, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(!BUILT, `${ROUTE} is not built`);
    test.skip(!isDesktop(info), 'one run is enough; the viewport is set here');
  });

  test('has no horizontal scroll and keeps every phase readable', async ({ page }) => {
    await page.goto(ROUTE);
    await page.evaluate(() => document.fonts.ready);
    await expectNoHorizontalScroll(page);
    expect(await findOverflow(page)).toEqual([]);
    await expect(page.locator('.hww-phase__name').first()).toBeVisible();
  });
});

test.describe('the retired pricing page', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt('/pricing/'), '/pricing/ is not built');
  });

  test('is noindex and points to How WE works, with no package or price', async ({ page }) => {
    await page.goto('/pricing/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('main a[href$="/how-we-work/"]').first()).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\$\s?\d|\b(Spark|Accelerate|Studio)\b|per seat/i);
  });
});
