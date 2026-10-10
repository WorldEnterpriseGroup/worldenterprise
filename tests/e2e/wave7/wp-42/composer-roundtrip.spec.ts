import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-42: the package round trip. /pricing/ links to the Composer with ?package=<id>, the Composer names the package and keeps it
// through a change, and the handoff reaches /apply/?package=<id> with the team in the fragment. Each skips while its routes are not built.

const PRICING = '/pricing/';
const COMPOSER = '/tools/team-composer/';
const BUILT = isBuilt(PRICING) && isBuilt(COMPOSER) && isBuilt('/apply/');

test.describe('composer round trip (the project sets the viewport: 1440 and 390)', () => {
  test.beforeEach(() => {
    test.skip(!BUILT, 'the pricing, composer or apply route is not built');
  });

  test('a package card opens the Composer for that package, and the handoff carries package and team to the application', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(PRICING);
    await page.locator('#package-launch').getByRole('link', { name: /Sketch the team/ }).click();
    await expect(page).toHaveURL(/\/tools\/team-composer\/\?package=launch$/);
    await page.waitForLoadState('networkidle');

    const composer = page.locator('we-team-composer');
    await expect(composer.locator('[data-package-title]')).toHaveText('Sketching for Launch');
    await expect(composer.locator('[data-package-detail]')).toContainText('Sized for:');
    await expect(composer.locator('select[name="package"]')).toHaveValue('launch');

    await composer.locator('input.composer__seats').first().fill('2');
    await expect(composer.locator('[data-headline]')).not.toContainText('No seats chosen yet');
    // The Apply button of the call-to-action band follows the form.
    await expect(page.locator('.ctaband').getByRole('link', { name: 'Apply' })).toHaveAttribute('href', /\/apply\/\?package=launch#team=/);

    await composer.getByRole('button', { name: 'Continue to Apply with this team' }).click();
    await expect(page).toHaveURL(/\/apply\/\?package=launch#team=/);
    expect(seen.consoleErrors).toEqual([]);
    // Chromium reports a skipped cross-document view transition as a page error when a page is left while its transition is pending.
    // It is the browser's notice that the site's @view-transition opt-in was skipped, not a script fault, and a chained flow triggers it.
    expect(seen.pageErrors.filter((message) => !message.includes('ViewTransition opt-in disabled'))).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('a package card opens the application for that package', async ({ page }) => {
    await page.goto(PRICING);
    await page.locator('#package-studio').getByRole('link', { name: /Start with this package/ }).click();
    await expect(page).toHaveURL(/\/apply\/\?package=studio$/);
  });

  test('changing the stage changes the banner and the address, and clearing returns to a custom plan', async ({ page }) => {
    await page.goto(COMPOSER);
    const composer = page.locator('we-team-composer');
    const title = composer.locator('[data-package-title]');
    await expect(title).toHaveText('Sketching a custom seat plan');
    await composer.locator('select[name="package"]').selectOption('accelerate');
    await expect(title).toHaveText('Sketching for Accelerate');
    await expect(page).toHaveURL(/\?package=accelerate$/);
    await composer.getByRole('button', { name: 'Clear' }).click();
    await expect(title).toHaveText('Sketching a custom seat plan');
    await expect(page).not.toHaveURL(/package=/);
  });

  test('an unknown or repeated package value is ignored', async ({ page }) => {
    for (const query of ['?package=gold', '?package=launch&package=spark', '?package=']) {
      await page.goto(`${COMPOSER}${query}`);
      const composer = page.locator('we-team-composer');
      await expect(composer.locator('[data-package-title]')).toHaveText('Sketching a custom seat plan');
      await expect(composer.locator('select[name="package"]')).toHaveValue('');
    }
  });

  test('a sketch with no stage reaches the application without a package', async ({ page }) => {
    await page.goto(COMPOSER);
    const composer = page.locator('we-team-composer');
    await composer.locator('input.composer__seats').first().fill('1');
    await composer.getByRole('button', { name: 'Continue to Apply with this team' }).click();
    await expect(page).toHaveURL(/\/apply\/#team=/);
    await expect(page).not.toHaveURL(/package=/);
  });

  test('the Composer page passes axe with a package chosen, and nothing overflows', async ({ page }) => {
    await page.goto(`${COMPOSER}?package=launch`);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(await findOverflow(page)).toEqual([]);
  });

  test('the stage select is labelled and is at least 24px tall', async ({ page }) => {
    await page.goto(COMPOSER);
    const select = page.getByLabel('Company stage (optional)');
    await expect(select).toBeVisible();
    const box = await select.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  });
});

test.describe('composer round trip without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!BUILT, 'the pricing, composer or apply route is not built');
  });

  test('the stage select is a field of the plain GET form, so the package reaches the application', async ({ page }) => {
    await page.goto(`${COMPOSER}?package=launch`);
    const form = page.locator('we-team-composer form');
    await expect(form).toHaveAttribute('method', 'get');
    await expect(form.locator('select[name="package"]')).toBeVisible();
    await form.locator('select[name="package"]').selectOption('launch');
    await form.locator('input.composer__seats').first().fill('1');
    await form.getByRole('button', { name: 'Continue to Apply with this team' }).click();
    await expect(page).toHaveURL(/\/apply\/\?(?:.*&)?package=launch(?:&|$)/);
  });

  test('the static page names the custom plan and hides the live-only controls', async ({ page }) => {
    await page.goto(COMPOSER);
    await expect(page.locator('[data-package-title]')).toHaveText('Sketching a custom seat plan');
    await expect(page.getByRole('button', { name: 'Copy team sketch' })).toBeHidden();
  });

  test('the pricing cards still link to the Composer and the application with the package', async ({ page }) => {
    await page.goto(PRICING);
    await expect(page.locator('#package-accelerate').getByRole('link', { name: /Sketch the team/ })).toHaveAttribute('href', /\/tools\/team-composer\/\?package=accelerate$/);
    await expect(page.locator('#package-accelerate').getByRole('link', { name: /Start with this package/ })).toHaveAttribute('href', /\/apply\/\?package=accelerate$/);
  });
});
