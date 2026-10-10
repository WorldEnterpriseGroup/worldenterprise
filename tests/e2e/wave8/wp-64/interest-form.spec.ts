import { expect, test, type Page, type Route } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-64: the investor interest form (forms contract v2, kind investor-interest) and its thank-you page.
// The e2e:wave8 job builds without PUBLIC_WE_INTAKE_API_URL, so the form is in disabled mode there and the first group asserts that honest
// state. The second group needs endpoint mode (a build with the variable set, answered by a mock) and skips otherwise; the forms job covers
// the shared script for the other kinds, and these cases cover what is specific to this kind.

const ROUTE = '/investors/interest/';
const THANKS = '/investors/interest/thanks/';
const FORM = 'form[data-intake-form][data-kind="investor-interest"]';
const ENDPOINT_ORIGIN = 'https://intake.example.test';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};

test.beforeEach(() => {
  test.skip(!isBuilt(ROUTE), `${ROUTE} is not built`);
});

test.describe('without an endpoint', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTE);
    const mode = await page.locator(FORM).getAttribute('data-mode');
    test.skip(mode !== 'disabled', 'this build has the intake connected');
  });

  test('says plainly that the form is not connected, keeps the send button off and offers no mailbox', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(ROUTE);
    const form = page.locator(FORM);
    await expect(form.getByText('This form is not connected yet')).toBeVisible();
    await expect(form.locator('[data-submit]')).toBeDisabled();
    await expect(form.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(form).not.toHaveAttribute('action', /.+/);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('the fields are labeled, the name and email are required, and nothing is sent when a visitor presses Enter', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') requests.push(request.url());
    });
    await page.goto(ROUTE);
    const form = page.locator(FORM);
    for (const name of ['name', 'email', 'company', 'companyUrl', 'investorKind', 'focus', 'message']) {
      const control = form.locator(`[name="${name}"]`);
      await expect(control).toHaveCount(1);
      const id = await control.getAttribute('id');
      await expect(form.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
    await expect(form.locator('[name="name"]')).toHaveAttribute('required', '');
    await expect(form.locator('[name="email"]')).toHaveAttribute('required', '');
    await form.locator('[name="name"]').fill('Test Investor');
    await form.locator('[name="name"]').press('Enter');
    expect(requests).toEqual([]);
  });

  test('works without JavaScript: the page, its notice and the disclaimer still show', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto(ROUTE);
    await expect(page.locator(FORM)).toBeVisible();
    await expect(page.locator(FORM).locator('[data-submit]')).toBeDisabled();
    const text = ((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('WE makes no promise of funding.');
    expect(text).toContain('Introductions are a flat-fee service.');
    await context.close();
  });

  test('the "Start the form" link lands on the form', async ({ page }) => {
    await page.goto(ROUTE);
    const jump = page.locator('a[href$="#investor-interest-form"]').first();
    await expect(jump).toBeVisible();
    await jump.click();
    await expect(page).toHaveURL(/#investor-interest-form$/);
    await expect(page.locator('#investor-interest-form')).toBeVisible();
  });
});

test.describe('with the endpoint connected (mocked)', () => {
  async function mock(page: Page, respond: (route: Route) => Promise<void>): Promise<unknown[]> {
    const bodies: unknown[] = [];
    await page.route(`${ENDPOINT_ORIGIN}/**`, async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS });
        return;
      }
      bodies.push(request.postDataJSON());
      await respond(route);
    });
    return bodies;
  }

  async function open(page: Page): Promise<void> {
    await page.clock.install();
    await page.goto(ROUTE);
    const mode = await page.locator(FORM).getAttribute('data-mode');
    test.skip(mode !== 'endpoint', 'runs in e2e:forms');
  }

  async function fill(page: Page): Promise<void> {
    const form = page.locator(FORM);
    await form.locator('[name="name"]').fill('Test Investor');
    await form.locator('[name="email"]').fill('investor@example.org');
    await form.locator('[name="focus"]').fill('Early-stage SaaS.');
    await form.locator('[name="consent"]').check();
    await page.clock.fastForward(3500);
  }

  test('@endpoint success sends one body of kind investor-interest and opens the thank-you page', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '', [ENDPOINT_ORIGIN]);
    const bodies = await mock(page, (route) => route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
    await open(page);
    await fill(page);
    await page.locator(`${FORM} [data-submit]`).click();
    await expect(page).toHaveURL(/\/investors\/interest\/thanks\/$/);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ form: 'investor-interest', email: 'investor@example.org', consent: true, website: '', focus: 'Early-stage SaaS.' });
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('@endpoint a rejected request names the problem and keeps what the visitor typed', async ({ page }) => {
    await mock(page, (route) => route.fulfill({ status: 422, headers: CORS, contentType: 'application/json', body: JSON.stringify({ ok: false, errors: { email: 'invalid' } }) }));
    await open(page);
    await fill(page);
    await page.locator(`${FORM} [data-submit]`).click();
    await expect(page).toHaveURL(/\/investors\/interest\/$/);
    await expect(page.locator(`${FORM} [name="name"]`)).toHaveValue('Test Investor');
    await expect(page.locator(`${FORM} [data-status]`)).not.toBeEmpty();
  });

  test('@endpoint a 429 gives the wait from Retry-After in minutes and keeps the answers', async ({ page }) => {
    await mock(page, (route) => route.fulfill({ status: 429, headers: { ...CORS, 'access-control-expose-headers': 'Retry-After', 'retry-after': '120' }, body: '' }));
    await open(page);
    await fill(page);
    await page.locator(`${FORM} [data-submit]`).click();
    await expect(page.locator(`${FORM} [data-error-summary]`)).toContainText('Wait 2 minutes');
    await expect(page.locator(`${FORM} [name="email"]`)).toHaveValue('investor@example.org');
  });

  test('@endpoint without JavaScript the form either posts natively or says it needs JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto(ROUTE);
    const form = page.locator(FORM);
    const mode = await form.getAttribute('data-mode');
    test.skip(mode !== 'endpoint', 'runs in e2e:forms');
    if ((await form.getAttribute('action')) !== null) {
      await expect(form.locator('[data-submit]')).toBeEnabled();
      await expect(form.locator('input[type="hidden"][name="form"]')).toHaveValue('investor-interest');
      await expect(form.locator('input[type="hidden"][name="redirect"]')).toHaveValue(/\/investors\/interest\/thanks\/$/);
    } else {
      await expect(form.locator('[data-submit]')).toBeDisabled();
      await expect(form.getByText('This form needs JavaScript')).toBeVisible();
    }
    await context.close();
  });

  test('@endpoint a visitor can complete and send the form with the keyboard alone', async ({ page }) => {
    const bodies = await mock(page, (route) => route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
    await open(page);
    const form = page.locator(FORM);
    await form.locator('[name="name"]').fill('Keyboard Investor');
    await form.locator('[name="email"]').fill('keys@example.org');
    await form.locator('[name="consent"]').focus();
    await page.keyboard.press('Space');
    await expect(form.locator('[name="consent"]')).toBeChecked();
    await page.clock.fastForward(3500);
    await form.locator('[data-submit]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/investors\/interest\/thanks\/$/);
    expect(bodies).toHaveLength(1);
  });
});

test.describe('the thank-you page', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(THANKS), `${THANKS} is not built`);
  });

  test('is not indexed, promises no reply or meeting, and links back to what is open now', async ({ page }) => {
    await page.goto(THANKS);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
    const text = ((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('WE cannot promise a meeting or a reply');
    expect(text).toContain('WE makes no promise of funding.');
    expect(text).not.toMatch(/\bwithin\b|\bshortly\b|\bsoon\b|WE will (?:reply|respond|contact)/i);
    await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
    expect(await page.locator('main a[href^="/investors/"]').count()).toBeGreaterThan(0);
  });
});
