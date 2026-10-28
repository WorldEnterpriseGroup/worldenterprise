import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt, liveRoutes } from '../../support/routes.ts';

// #49: what a visitor sees on the static build that has no intake endpoint (verify:static). Since 2026-10-28 the apply and contact pages
// fall back to their confirmed mailbox (an alias of info@, RELEASE.md section 6), so they render in mailto mode with the address in the
// page. Every other launched form route (investor interest, partner enquiry and the briefs) has no mailbox fallback, so it must say, in the
// page, that it is not connected, and its send button must be off. The release gate fails on those thirteen routes
// (scripts/lib/release-gate.mjs); this is the rendered half. Nothing here skips: a route the ledger launches but dist lacks is a failure.

const MAILTO_ROUTES = ['/apply/', '/contact/'] as const;
const FIXED_FORM_ROUTES = [...MAILTO_ROUTES, '/investors/interest/', '/network/partners/enquire/'] as const;
const DISABLED_FIXED_ROUTES = ['/investors/interest/', '/network/partners/enquire/'] as const;
const BRIEF_PAGE = /^\/briefs\/(?!thanks\/)[^/]+\/$/;

const briefRoutes = liveRoutes.map((r) => r.path).filter((path) => BRIEF_PAGE.test(path));
const formRoutes = [...FIXED_FORM_ROUTES, ...briefRoutes];
const disabledRoutes = [...DISABLED_FIXED_ROUTES, ...briefRoutes];

const VIEWPORTS = [
  { name: 'desktop 1440x900', width: 1440, height: 900 },
  { name: 'phone 390x844', width: 390, height: 844 },
] as const;

test('the ledger launches the four fixed form routes and at least one brief page, all built', () => {
  expect(briefRoutes.length, 'launched brief pages found in the ledger').toBeGreaterThan(0);
  for (const route of formRoutes) expect(isBuilt(route), `${route} is launched and must be built`).toBe(true);
});

test('/newsletter/ is not built while its endpoint is unset', () => {
  expect(isBuilt('/newsletter/'), '/newsletter/ must stay launch:false until PUBLIC_WE_NEWSLETTER_API_URL is set').toBe(false);
});

for (const viewport of VIEWPORTS) {
  test.describe(`disabled forms at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of MAILTO_ROUTES) {
      test(`${route} falls back to the confirmed mailbox`, async ({ page, baseURL }) => {
        const record = watch(page, baseURL ?? 'http://localhost');
        const response = await page.goto(route);
        expect(response?.status(), `${route} status`).toBe(200);
        const form = page.locator('form[data-intake-form]');
        await expect(form, `${route} has exactly one intake form`).toHaveCount(1);
        await expect(form).toHaveAttribute('data-mode', 'mailto');
        await expect(form).toHaveAttribute('data-mailto', /^(apply|hello)@worldenterprise\.org$/);
        await expect(form.getByText('This form is not connected yet')).toHaveCount(0);
        await expect(form.locator('[data-submit]')).toHaveCount(1);
        expect(record.pageErrors, 'uncaught exceptions').toEqual([]);
        expect(record.thirdParty, 'third-party requests').toEqual([]);
      });
    }

    for (const route of disabledRoutes) {
      test(`${route} is disabled and says so`, async ({ page, baseURL }) => {
        const record = watch(page, baseURL ?? 'http://localhost');
        const response = await page.goto(route);
        expect(response?.status(), `${route} status`).toBe(200);
        const form = page.locator('form[data-intake-form]');
        await expect(form, `${route} has exactly one intake form`).toHaveCount(1);
        await expect(form).toHaveAttribute('data-mode', 'disabled');
        await expect(form.getByText('This form is not connected yet')).toBeVisible();
        const submit = form.locator('[data-submit]');
        await expect(submit).toHaveCount(1);
        await expect(submit, 'the send button stays off until the endpoint is connected').toBeDisabled();
        expect(record.pageErrors, 'uncaught exceptions').toEqual([]);
        expect(record.thirdParty, 'third-party requests').toEqual([]);
      });
    }
  });
}
