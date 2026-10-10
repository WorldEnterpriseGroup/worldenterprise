import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-63: the gated executive briefs. The squeeze page asks for a name and an email address, sends one brief-request body and opens
// /briefs/thanks/. The brief text is never on any page, so no case here looks for it.
//
// Two modes. The e2e:wave8 job builds the site with no intake endpoint, so the form is disabled and the cases under "no endpoint" run
// there. The cases under "endpoint mode" need a build with PUBLIC_WE_INTAKE_API_URL set, the way the forms job builds, and skip in any
// other build; with E2E_REQUIRE_ENDPOINT=1 (the forms job) a form that is not in endpoint mode fails instead. The page.route mock answers
// every request to the endpoint origin, so nothing leaves the test.

const ENDPOINT_ORIGIN = 'https://intake.example.test';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const BRIEFS = [
  { id: 'funding-paths', route: '/briefs/funding-paths/' },
  { id: 'company-setup', route: '/briefs/company-setup/' },
  { id: 'ai-native-build', route: '/briefs/ai-native-build/' },
] as const;
const FORM = 'form[data-intake-form]';

interface Mock {
  readonly bodies: unknown[];
}

/** Answers preflights with 204 and POSTs with `respond`. Returns the bodies the page sent. */
async function mockEndpoint(page: Page, respond: (route: Route) => Promise<void>): Promise<Mock> {
  const mock: Mock = { bodies: [] };
  await page.route(`${ENDPOINT_ORIGIN}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    mock.bodies.push(request.postDataJSON());
    await respond(route);
  });
  return mock;
}

const ok = (route: Route): Promise<void> => route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ ok: true }) });

/** Opens a squeeze page and skips unless it is built and, for the endpoint cases, the form is in endpoint mode. */
async function open(page: Page, route: string, mode: 'endpoint' | 'disabled'): Promise<Locator> {
  test.skip(!isBuilt(route), `${route} is not built`);
  await page.clock.install();
  await page.goto(route);
  const form = page.locator(FORM).first();
  const actual = await form.getAttribute('data-mode');
  if (mode === 'endpoint' && process.env.E2E_REQUIRE_ENDPOINT === '1') expect(actual, `${route} must be in endpoint mode in the forms build`).toBe('endpoint');
  test.skip(actual !== mode, `${route} is in ${actual ?? 'no'} mode in this build, this case needs ${mode}`);
  return form;
}

async function fillRequired(form: Locator): Promise<void> {
  await form.locator('[name="name"]').fill('Test Founder');
  await form.locator('[name="email"]').fill('founder@example.org');
}

/** Moves the page clock past the 3 second fill check, so the first submit is not paused as too fast. */
const settle = (page: Page): Promise<void> => page.clock.fastForward(3500);
const submit = (page: Page): Promise<void> => page.locator(`${FORM} [data-submit]`).first().click();

test.describe('endpoint mode', () => {
  for (const brief of BRIEFS) {
    test.describe(`${brief.id}`, () => {
      test('success sends one brief-request body with the brief id and opens the thanks page', async ({ page, baseURL }) => {
        const seen = watch(page, baseURL ?? '', [ENDPOINT_ORIGIN]);
        const mock = await mockEndpoint(page, ok);
        const form = await open(page, brief.route, 'endpoint');
        await fillRequired(form);
        await form.locator('[name="consent"]').check();
        await settle(page);
        await submit(page);
        await expect(page).toHaveURL(/\/briefs\/thanks\/$/);
        expect(mock.bodies).toHaveLength(1);
        expect(mock.bodies[0]).toMatchObject({ form: 'brief-request', briefId: brief.id, email: 'founder@example.org', consent: true, website: '', audience: 'startup' });
        expect((mock.bodies[0] as { requestId: string }).requestId).toMatch(UUID_V4);
        expect(seen.consoleErrors).toEqual([]);
        expect(seen.thirdParty, 'only the mocked endpoint may be contacted').toEqual([]);
      });

      test('a 422 shows the server message next to the field and keeps the answers', async ({ page }) => {
        await mockEndpoint(page, (route) =>
          route.fulfill({ status: 422, headers: CORS, contentType: 'application/json', body: JSON.stringify({ errors: { email: 'That address was rejected by the server.' } }) }),
        );
        const form = await open(page, brief.route, 'endpoint');
        await fillRequired(form);
        await form.locator('[name="consent"]').check();
        await settle(page);
        await submit(page);
        await expect(form.locator('[data-error-summary]')).toContainText('That address was rejected by the server.');
        await expect(form.locator('[name="email"]')).toHaveAttribute('aria-invalid', 'true');
        await expect(form.locator('[name="name"]')).toHaveValue('Test Founder');
        await expect(page).not.toHaveURL(/\/briefs\/thanks\/$/);
      });

      test('a 429 gives the wait from Retry-After in minutes and keeps the answers', async ({ page }) => {
        await mockEndpoint(page, (route) => route.fulfill({ status: 429, headers: { ...CORS, 'access-control-expose-headers': 'Retry-After', 'retry-after': '120' }, body: '' }));
        const form = await open(page, brief.route, 'endpoint');
        await fillRequired(form);
        await form.locator('[name="consent"]').check();
        await settle(page);
        await submit(page);
        await expect(form.locator('[data-error-summary]')).toContainText('Wait 2 minutes');
        await expect(form.locator('[name="email"]')).toHaveValue('founder@example.org');
        await expect(page).not.toHaveURL(/\/briefs\/thanks\/$/);
      });
    });
  }

  test('keyboard only: the form is filled, consented and sent without the pointer', async ({ page }) => {
    const mock = await mockEndpoint(page, ok);
    const form = await open(page, BRIEFS[0].route, 'endpoint');
    await form.locator('[name="name"]').focus();
    await page.keyboard.type('Test Founder');
    await page.keyboard.press('Tab');
    await expect(form.locator('[name="email"]')).toBeFocused();
    await page.keyboard.type('founder@example.org');
    // The consent box is focused directly, which also brings it into view; Space is the only key a checkbox answers to.
    await form.locator('[name="consent"]').focus();
    await page.keyboard.press('Space');
    await expect(form.locator('[name="consent"]')).toBeChecked();
    await settle(page);
    await form.locator('[data-submit]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/briefs\/thanks\/$/);
    expect(mock.bodies).toHaveLength(1);
    expect(mock.bodies[0]).toMatchObject({ form: 'brief-request', briefId: BRIEFS[0].id, consent: true });
  });

  test('keyboard only: a send with nothing filled moves focus to the error summary and sends nothing', async ({ page }) => {
    const mock = await mockEndpoint(page, ok);
    const form = await open(page, BRIEFS[0].route, 'endpoint');
    await settle(page);
    await form.locator('[data-submit]').focus();
    await page.keyboard.press('Enter');
    const summary = form.locator('[data-error-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    expect(mock.bodies).toHaveLength(0);
  });

  test.describe('without JavaScript', () => {
    // Reduced motion switches smooth scrolling off, which keeps Playwright's click scrolling from stalling with scripting off.
    test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });

    test('the native post goes form-encoded to the endpoint and never builds a query string', async ({ page }) => {
      test.skip(!isBuilt(BRIEFS[0].route), `${BRIEFS[0].route} is not built`);
      const seen: { method: string; url: string; contentType: string; body: string }[] = [];
      await page.route(`${ENDPOINT_ORIGIN}/**`, async (route) => {
        const request = route.request();
        seen.push({ method: request.method(), url: request.url(), contentType: request.headers()['content-type'] ?? '', body: request.postData() ?? '' });
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>received</title><p>received</p>' });
      });
      await page.goto(BRIEFS[0].route);
      const form = page.locator(FORM).first();
      const mode = await form.getAttribute('data-mode');
      if (process.env.E2E_REQUIRE_ENDPOINT === '1') expect(mode, `${BRIEFS[0].route} must be in endpoint mode in the forms build`).toBe('endpoint');
      test.skip(mode !== 'endpoint', `${BRIEFS[0].route} is not in endpoint mode in this build`);

      await expect(form).toHaveAttribute('method', 'post');
      await expect(form).toHaveAttribute('action', `${ENDPOINT_ORIGIN}/api/intake`);
      await form.locator('[name="name"]').fill('Test Founder');
      await form.locator('[name="email"]').fill('founder@example.org');
      await form.locator('[name="consent"]').focus();
      await page.keyboard.press('Space');
      await form.locator('[data-submit]').focus();
      await page.keyboard.press('Enter');
      await expect.poll(() => seen.length).toBe(1);

      const [request] = seen;
      expect(request?.method).toBe('POST');
      expect(request?.url, 'no query string on the endpoint URL').toBe(`${ENDPOINT_ORIGIN}/api/intake`);
      expect(request?.contentType).toContain('application/x-www-form-urlencoded');
      const fields = new URLSearchParams(request?.body ?? '');
      expect(fields.get('form')).toBe('brief-request');
      expect(fields.get('briefId')).toBe(BRIEFS[0].id);
      expect(fields.get('email')).toBe('founder@example.org');
      expect(fields.get('consent')).toBe('on');
      expect(fields.get('redirect'), 'the server returns the visitor to the thanks page').toMatch(/\/briefs\/thanks\/$/);
    });
  });
});

test.describe('no endpoint', () => {
  for (const brief of BRIEFS) {
    test(`${brief.route} says plainly that requests are not being accepted and offers no mailbox`, async ({ page }) => {
      const form = await open(page, brief.route, 'disabled');
      const note = page.locator('[data-brief-not-accepting]');
      await expect(note).toBeVisible();
      await expect(note).toContainText('not accepting brief requests');
      await expect(form.locator('[data-submit]')).toBeDisabled();
      expect(await page.locator('a[href^="mailto:"]').count(), 'a brief request has no mailbox fallback').toBe(0);
      await expect(form).not.toHaveAttribute('data-mailto', /./);
    });
  }

  test('the squeeze page promises nothing about timing and never calls the brief free', async ({ page }) => {
    await open(page, BRIEFS[0].route, 'disabled');
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\bfree\b|\bexclusive\b|download now/i);
    expect(text).not.toMatch(/\bwithin \d+|\binstantly\b|\bimmediately\b|\bminutes\b|\bhours\b/i);
  });
});

test.describe('the pages around the form, in any build', () => {
  test('the hub is indexable and lists the briefs without sending the visitor anywhere off the site', async ({ page, baseURL }) => {
    test.skip(!isBuilt('/briefs/'), '/briefs/ is not built');
    const seen = watch(page, baseURL ?? '', []);
    await page.goto('/briefs/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    for (const brief of BRIEFS) await expect(page.locator(`a[href$="${brief.route}"]`).first()).toBeVisible();
    expect(seen.thirdParty).toEqual([]);
  });

  test('the thanks page is noindex, reads nothing from the query string and links onward', async ({ page }) => {
    test.skip(!isBuilt('/briefs/thanks/'), '/briefs/thanks/ is not built');
    await page.goto('/briefs/thanks/?brief=funding-paths&email=founder%40example.org');
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    const text = await page.locator('main').innerText();
    expect(text).not.toContain('founder@example.org');
    expect(text).not.toContain('funding-paths');
  });

  test('the no-JavaScript path lands on the thanks page: it renders with scripting off', async ({ browser }) => {
    test.skip(!isBuilt('/briefs/thanks/'), '/briefs/thanks/ is not built');
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const response = await page.goto('/briefs/thanks/');
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('a squeeze page keeps the brief text out of the document: no more than the abstract and the outline', async ({ page }) => {
    test.skip(!isBuilt(BRIEFS[0].route), `${BRIEFS[0].route} is not built`);
    await page.goto(BRIEFS[0].route);
    const words = (await page.locator('main').innerText()).split(/\s+/).filter(Boolean).length;
    expect(words, 'a squeeze page is an abstract, an outline and a form, never the brief').toBeLessThan(1500);
  });
});
