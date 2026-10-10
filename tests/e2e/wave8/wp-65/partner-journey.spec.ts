import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-65: the partner journey. One spec, run at 1440 and at 390 by the wave 8 projects.
//
// Convention (main's ruling on form e2e): e2e:wave8 runs against the shared build, which has no intake endpoint, so the enquiry form is
// `disabled` there. The disabled-mode assertions are plain tests and always run: the callout, the disabled button, no mailto, the
// no-JavaScript behaviour. Every endpoint-mode case (success, 422, 429, a keyboard-only post, the native no-JavaScript post) carries the
// tag @endpoint in its title and starts by skipping unless the form's data-mode is `endpoint`; e2e:forms runs `--grep @endpoint` against
// its endpoint build, so each of them runs for real in exactly one job. The endpoint origin is mocked with page.route, so nothing
// leaves the test.

const ENQUIRE = '/network/partners/enquire/';
const THANKS = '/network/partners/enquire/thanks/';
const ROUTES = ['/network/partners/', '/network/partners/categories/', '/network/partners/how-it-works/', '/network/partners/faq/', ENQUIRE, THANKS] as const;

const ENDPOINT_ORIGIN = 'https://intake.example.test';
const ENDPOINT = `${ENDPOINT_ORIGIN}/api/intake`;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ANSWERS = {
  name: 'Test Partner',
  email: 'partner@example.org',
  company: 'Example Services Ltd',
  url: 'https://example.org',
  category: 'legal',
  offer: 'Fixed-scope incorporation reviews for early-stage founders, with the terms written down before any introduction.',
};

const form = (page: Page): Locator => page.locator('#partner-enquiry-form');
const summary = (page: Page): Locator => form(page).locator('[data-error-summary]');
const submitButton = (page: Page): Locator => form(page).locator('[data-submit]');

test.beforeEach(() => {
  test.skip(!isBuilt(ENQUIRE), `${ENQUIRE} is not built`);
});

interface Mock {
  readonly bodies: unknown[];
}

/** Answers preflights with 204 and POSTs with `respond`. Returns the JSON bodies the page sent. */
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

/** Opens the enquiry page with a controllable clock and waits for the form script to mount. Skips unless the build is in endpoint mode. */
async function openEndpointForm(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto(ENQUIRE);
  await expect(form(page)).toHaveAttribute('data-mounted', 'true');
  const mode = await form(page).getAttribute('data-mode');
  test.skip(mode !== 'endpoint', 'runs in e2e:forms');
}

/** Fills every required answer except those named in `skip`. */
async function fill(page: Page, skip: readonly ('category' | 'url')[] = []): Promise<void> {
  await form(page).locator('[name="name"]').fill(ANSWERS.name);
  await form(page).locator('[name="email"]').fill(ANSWERS.email);
  await form(page).locator('[name="company"]').fill(ANSWERS.company);
  if (!skip.includes('url')) await form(page).locator('[name="companyUrl"]').fill(ANSWERS.url);
  if (!skip.includes('category')) await form(page).locator('[name="partnerCategory"]').selectOption(ANSWERS.category);
  await form(page).locator('[name="offer"]').fill(ANSWERS.offer);
  await form(page).locator('[name="consent"]').check();
}

/** Moves the page clock past the too-fast check (3 s), then presses Send. */
async function send(page: Page): Promise<void> {
  await page.clock.fastForward(3500);
  await submitButton(page).click();
}

/** Presses Tab until `target` holds focus. Fails when it is not reached, so a keyboard trap or a missing tab stop is caught. */
async function tabTo(page: Page, target: Locator, limit = 14): Promise<void> {
  for (let presses = 0; presses < limit; presses += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`The element was not reached with ${limit} presses of Tab.`);
}

test.describe('the six routes', () => {
  for (const route of ROUTES) {
    test(`${route} renders one h1, no mailto link, and passes axe`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty, 'the page contacts only the site').toEqual([]);
    });
  }

  test('the thanks page is noindex and promises no response time', async ({ page }) => {
    test.skip(!isBuilt(THANKS), `${THANKS} is not built`);
    await page.goto(THANKS);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const text = (await page.locator('main').innerText()).toLowerCase();
    expect(text).not.toMatch(/within \d|business days?|working days?|\bhours?\b|guarantee/);
  });

  test('the partners hub links to the enquiry, the categories, how it works and the FAQ', async ({ page }) => {
    await page.goto('/network/partners/');
    for (const path of [ENQUIRE, '/network/partners/categories/', '/network/partners/how-it-works/', '/network/partners/faq/']) {
      await expect(page.locator(`main a[href$="${path}"]`).first()).toBeVisible();
    }
  });

  test('the FAQ page carries one FAQPage JSON-LD block', async ({ page }) => {
    test.skip(!isBuilt('/network/partners/faq/'), 'the FAQ is not built');
    await page.goto('/network/partners/faq/');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    // A page's blocks may wrap their nodes in an @graph; flatten both shapes.
    const nodes = blocks.flatMap((text) => {
      const parsed = JSON.parse(text) as { '@graph'?: unknown[] };
      return Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
    }) as { '@type'?: string; mainEntity?: unknown[] }[];
    const faq = nodes.filter((node) => node['@type'] === 'FAQPage');
    expect(faq).toHaveLength(1);
    expect((faq[0]?.mainEntity ?? []).length).toBeGreaterThanOrEqual(6);
  });
});

test.describe('the enquiry form with an endpoint', () => {
  test('success sends one JSON body for a partner enquiry, then opens the thanks page @endpoint', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '', [ENDPOINT_ORIGIN]);
    const mock = await mockEndpoint(page, ok);
    await openEndpointForm(page);
    await fill(page);
    await send(page);
    await expect(page).toHaveURL(new RegExp(`${THANKS}$`));
    expect(mock.bodies).toHaveLength(1);
    expect(mock.bodies[0]).toMatchObject({
      form: 'partner-enquiry',
      audience: 'partner',
      name: ANSWERS.name,
      email: ANSWERS.email,
      company: ANSWERS.company,
      companyUrl: ANSWERS.url,
      partnerCategory: ANSWERS.category,
      offer: ANSWERS.offer,
      consent: true,
      website: '',
    });
    expect((mock.bodies[0] as { requestId: string }).requestId).toMatch(UUID_V4);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.thirdParty, 'only the mocked endpoint may be contacted').toEqual([]);
  });

  test('a missing category is named in the summary and inline, focus moves to the summary, and nothing is sent @endpoint', async ({ page }) => {
    const mock = await mockEndpoint(page, ok);
    await openEndpointForm(page);
    await fill(page, ['category']);
    await send(page);
    await expect(summary(page)).toBeVisible();
    await expect(summary(page)).toBeFocused();
    await expect(summary(page)).toContainText('Choose the category that fits what you offer.');
    await expect(form(page).locator('[name="partnerCategory"]')).toHaveAttribute('aria-invalid', 'true');
    await summary(page).getByRole('link', { name: 'Choose the category that fits what you offer.' }).click();
    await expect(form(page).locator('[name="partnerCategory"]')).toBeFocused();
    expect(mock.bodies).toHaveLength(0);
  });

  test('a missing website address is named in the summary and nothing is sent @endpoint', async ({ page }) => {
    const mock = await mockEndpoint(page, ok);
    await openEndpointForm(page);
    await fill(page, ['url']);
    await send(page);
    await expect(summary(page)).toBeVisible();
    await expect(summary(page)).toContainText('website');
    await expect(form(page).locator('[name="companyUrl"]')).toHaveAttribute('aria-invalid', 'true');
    expect(mock.bodies).toHaveLength(0);
  });

  test('a website address that does not start with https:// is refused before sending @endpoint', async ({ page }) => {
    const mock = await mockEndpoint(page, ok);
    await openEndpointForm(page);
    await fill(page, ['url']);
    await form(page).locator('[name="companyUrl"]').fill('example.org');
    await send(page);
    await expect(summary(page)).toContainText('Enter a website address that starts with https://');
    expect(mock.bodies).toHaveLength(0);
  });

  test('a 422 from the server for the category is shown against the field and the answers stay @endpoint', async ({ page }) => {
    const mock = await mockEndpoint(page, (route) =>
      route.fulfill({
        status: 422,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, errors: { partnerCategory: 'Choose the category that fits what you offer.' } }),
      }),
    );
    await openEndpointForm(page);
    await fill(page);
    await send(page);
    await expect.poll(() => mock.bodies.length).toBe(1);
    await expect(summary(page)).toBeVisible();
    await expect(summary(page)).toContainText('Choose the category that fits what you offer.');
    await expect(form(page).locator('[name="offer"]')).toHaveValue(ANSWERS.offer);
    await expect(page).toHaveURL(new RegExp(`${ENQUIRE}$`));
  });

  test('a 422 from the server for the website address is shown against the field @endpoint', async ({ page }) => {
    await mockEndpoint(page, (route) =>
      route.fulfill({
        status: 422,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, errors: { companyUrl: 'Enter a website address that starts with https://' } }),
      }),
    );
    await openEndpointForm(page);
    await fill(page);
    await send(page);
    await expect(summary(page)).toContainText('Enter a website address that starts with https://');
    await expect(form(page).locator('[name="companyUrl"]')).toHaveAttribute('aria-invalid', 'true');
  });

  test('a 429 says to wait, keeps the answers, and offers no email fallback @endpoint', async ({ page }) => {
    const mock = await mockEndpoint(page, (route) =>
      route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '120', 'access-control-expose-headers': 'Retry-After' }, contentType: 'application/json', body: '{}' }),
    );
    await openEndpointForm(page);
    await fill(page);
    await send(page);
    await expect.poll(() => mock.bodies.length).toBe(1);
    await expect(summary(page)).toBeVisible();
    await expect(summary(page)).toContainText('Too many messages');
    await expect(form(page).locator('[name="offer"]')).toHaveValue(ANSWERS.offer);
    await expect(form(page).locator('[data-fallback]')).toBeHidden();
    await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
  });

  test('a retry after a failed send is the same request @endpoint', async ({ page }) => {
    let calls = 0;
    const mock = await mockEndpoint(page, (route) => {
      calls += 1;
      return calls === 1 ? route.fulfill({ status: 500, headers: CORS, body: 'boom' }) : ok(route);
    });
    await openEndpointForm(page);
    await fill(page);
    await send(page);
    await expect(summary(page)).toBeVisible();
    await submitButton(page).click();
    await expect.poll(() => mock.bodies.length).toBe(2);
    const [first, second] = mock.bodies as { requestId: string }[];
    expect(second?.requestId).toBe(first?.requestId);
  });

  test('a keyboard-only run completes and sends the form: Tab, typing, arrow keys, Space and Enter @endpoint', async ({ page }) => {
    const mock = await mockEndpoint(page, ok);
    await openEndpointForm(page);
    await form(page).locator('[name="name"]').focus();
    await page.keyboard.type(ANSWERS.name);
    for (const [field, value] of [
      ['email', ANSWERS.email],
      ['company', ANSWERS.company],
      ['companyUrl', ANSWERS.url],
    ] as const) {
      await tabTo(page, form(page).locator(`[name="${field}"]`));
      await page.keyboard.type(value);
    }
    const category = form(page).locator('[name="partnerCategory"]');
    await tabTo(page, category);
    await page.keyboard.press('ArrowDown');
    await expect(category).not.toHaveValue('');
    await tabTo(page, form(page).locator('[name="offer"]'));
    await page.keyboard.type(ANSWERS.offer);
    const consent = form(page).locator('[name="consent"]');
    await tabTo(page, consent);
    await page.keyboard.press('Space');
    await expect(consent).toBeChecked();
    await page.clock.fastForward(3500);
    await tabTo(page, submitButton(page));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${THANKS}$`));
    expect(mock.bodies).toHaveLength(1);
    expect(mock.bodies[0]).toMatchObject({ form: 'partner-enquiry', partnerCategory: expect.any(String), consent: true });
  });
});

test.describe('the enquiry form as built', () => {
  test('there is no email fallback: no mailto link, no data-mailto, no mailto mode', async ({ page }) => {
    await page.goto(ENQUIRE);
    await expect(form(page)).not.toHaveAttribute('data-mailto', /./);
    expect(await form(page).getAttribute('data-mode')).not.toBe('mailto');
    await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
    await expect(form(page).locator('[data-fallback]')).toBeHidden();
  });

  test('the disabled state says the form is not connected, keeps the button off and sends nothing', async ({ page, baseURL }) => {
    await page.goto(ENQUIRE);
    await expect(form(page)).toHaveAttribute('data-mounted', 'true');
    expect(await form(page).getAttribute('data-mode'), 'the shared e2e:wave8 build has no intake endpoint').toBe('disabled');
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') requests.push(request.url());
    });
    await expect(form(page).getByText('This form is not connected yet')).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();
    // Enter in a field must not send or navigate: the form has no action in this mode.
    await form(page).locator('[name="name"]').fill(ANSWERS.name);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${baseURL ?? ''}${ENQUIRE}`);
    expect(requests).toEqual([]);
    await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
  });

  test('a keyboard visitor can walk to every control of the form and leave it again', async ({ page }) => {
    await page.goto(ENQUIRE);
    await expect(form(page)).toHaveAttribute('data-mounted', 'true');
    await form(page).locator('[name="name"]').focus();
    for (const field of ['email', 'company', 'companyUrl', 'partnerCategory', 'offer', 'message']) {
      await tabTo(page, form(page).locator(`[name="${field}"]`));
    }
    const consent = form(page).locator('[name="consent"]');
    await tabTo(page, consent);
    // Tab leaves the checkbox for the next control and Shift+Tab comes back: the form is not a keyboard trap.
    await page.keyboard.press('Tab');
    await expect(consent).not.toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(consent).toBeFocused();
  });
});

test.describe('without JavaScript', () => {
  // Reduced motion switches smooth scrolling off, so a click never waits on a scroll that has no script to settle it.
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });

  test('the disabled form cannot be sent: it posts nowhere, its button is off, a note says why and no mailto link appears', async ({ page }) => {
    await page.goto(ENQUIRE);
    await expect(form(page)).toHaveAttribute('method', 'post');
    expect(await form(page).getAttribute('data-mode'), 'the shared e2e:wave8 build has no intake endpoint').toBe('disabled');
    await expect(form(page)).not.toHaveAttribute('action', /./);
    await expect(submitButton(page)).toBeDisabled();
    await expect(form(page).getByText('This form is not connected yet')).toBeVisible();
    await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
    // Every control has its label in the markup, so the page is usable without a script.
    for (const field of ['name', 'email', 'company', 'url', 'category', 'offer']) {
      await expect(form(page).locator(`label[for="partner-enquiry-${field}"]`)).toHaveCount(1);
    }
  });

  test('the content pages read without a script', async ({ page }) => {
    for (const route of ROUTES) {
      if (!isBuilt(route)) continue;
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('the connected form posts form-encoded fields to the endpoint and never builds a query string @endpoint', async ({ page }) => {
    const seen: { method: string; url: string; contentType: string; body: string }[] = [];
    await page.route(`${ENDPOINT_ORIGIN}/**`, async (route) => {
      const request = route.request();
      seen.push({ method: request.method(), url: request.url(), contentType: request.headers()['content-type'] ?? '', body: request.postData() ?? '' });
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>received</title><p>received</p>' });
    });
    await page.goto(ENQUIRE);
    const mode = await form(page).getAttribute('data-mode');
    test.skip(mode !== 'endpoint', 'runs in e2e:forms');

    await expect(form(page)).toHaveAttribute('method', 'post');
    await expect(form(page)).toHaveAttribute('action', ENDPOINT);
    await expect(submitButton(page)).toBeEnabled();
    await form(page).locator('[name="name"]').fill(ANSWERS.name);
    await form(page).locator('[name="email"]').fill(ANSWERS.email);
    await form(page).locator('[name="company"]').fill(ANSWERS.company);
    await form(page).locator('[name="companyUrl"]').fill(ANSWERS.url);
    await form(page).locator('[name="partnerCategory"]').selectOption(ANSWERS.category);
    await form(page).locator('[name="offer"]').fill(ANSWERS.offer);
    const consent = form(page).locator('[name="consent"]');
    await consent.focus();
    await page.keyboard.press('Space');
    await expect(consent).toBeChecked();
    await submitButton(page).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => seen.length).toBe(1);

    const [request] = seen;
    expect(request?.method).toBe('POST');
    expect(request?.url, 'no query string on the endpoint URL').toBe(ENDPOINT);
    expect(request?.contentType).toContain('application/x-www-form-urlencoded');
    const fields = new URLSearchParams(request?.body ?? '');
    expect(fields.get('form')).toBe('partner-enquiry');
    expect(fields.get('audience')).toBe('partner');
    expect(fields.get('partnerCategory')).toBe(ANSWERS.category);
    expect(fields.get('companyUrl')).toBe(ANSWERS.url);
    expect(fields.get('consent')).toBe('on');
    expect(fields.get('website')).toBe('');
    expect(fields.get('requestId'), 'a native post carries an empty id and the server generates one').toBe('');
    expect(fields.get('redirect')).toMatch(/\/network\/partners\/enquire\/thanks\/$/);
  });
});
