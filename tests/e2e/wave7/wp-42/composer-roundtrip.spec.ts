import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-42, revised in wave 9 (W9-13, WP-54): the Composer round trip without packages. The Composer sketches roles, the call-to-action
// band follows the form, and the handoff reaches /apply/ with the team in the fragment and nothing in the query. Each skips while its
// routes are not built.

const COMPOSER = '/tools/team-composer/';
const BUILT = isBuilt(COMPOSER) && isBuilt('/apply/');

test.describe('composer round trip (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!BUILT, 'the composer or apply route is not built');
  });

  test('a sketch reaches the application with the team in the fragment', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(COMPOSER);
    await page.waitForLoadState('networkidle');
    const composer = page.locator('we-team-composer');
    await composer.locator('input.composer__seats').first().fill('2');
    await expect(composer.locator('[data-headline]')).not.toContainText('No seats chosen yet');
    // The primary link of the call-to-action band follows the form.
    await expect(page.locator('.ctaband').getByRole('link', { name: 'Start a readiness review' })).toHaveAttribute('href', /\/apply\/#team=/);

    await composer.getByRole('button', { name: 'Continue to Apply with this team' }).click();
    await expect(page).toHaveURL(/\/apply\/#team=/);
    await expect(page).not.toHaveURL(/package=/);
    expect(seen.consoleErrors).toEqual([]);
    // Chromium reports a skipped cross-document view transition as a page error when a page is left while its transition is pending.
    expect(seen.pageErrors.filter((message) => !message.includes('ViewTransition opt-in disabled'))).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('a stale ?package= link still opens the Composer, with no package control', async ({ page }) => {
    await page.goto(`${COMPOSER}?package=launch`);
    const composer = page.locator('we-team-composer');
    await expect(composer.locator('select')).toHaveCount(0);
    await expect(composer.locator('[data-headline]')).toHaveText('No seats chosen yet.');
  });

  test('the Composer page passes axe, and nothing overflows', async ({ page }) => {
    await page.goto(COMPOSER);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  });

  test('the secondary links point to How WE works, not the retired pricing page', async ({ page }) => {
    await page.goto(COMPOSER);
    await expect(page.locator('main a[href$="/pricing/"]')).toHaveCount(0);
    await expect(page.locator('main a[href$="/how-we-work/"]').first()).toBeVisible();
  });
});

test.describe('composer round trip without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!BUILT, 'the composer or apply route is not built');
  });

  test('the plain GET form carries the seats to the application', async ({ page }) => {
    await page.goto(COMPOSER);
    const form = page.locator('we-team-composer form');
    await expect(form).toHaveAttribute('method', 'get');
    await form.locator('input.composer__seats').first().fill('1');
    await form.getByRole('button', { name: 'Continue to Apply with this team' }).click();
    await expect(page).toHaveURL(/\/apply\/\?/);
    await expect(page).not.toHaveURL(/package=/);
  });

  test('the static page hides the live-only controls', async ({ page }) => {
    await page.goto(COMPOSER);
    await expect(page.getByRole('button', { name: 'Copy team sketch' })).toBeHidden();
  });
});
