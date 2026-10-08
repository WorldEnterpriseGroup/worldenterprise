import { expect, test, type Page, type Route } from '@playwright/test';
import { watch } from './support/page-guards.ts';
import { isBuilt } from './support/routes.ts';

// Form flows against a mocked intake endpoint. The forms job builds the site with PUBLIC_WE_INTAKE_API_URL=ENDPOINT, so the
// forms are in endpoint mode; page.route answers every request to that origin and nothing leaves the test. In a build without an
// endpoint these tests skip, unless E2E_REQUIRE_ENDPOINT=1 (the forms job), where a form that is not in endpoint mode fails.

const ENDPOINT_ORIGIN = 'https://intake.example.test';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};

interface Kind {
  readonly name: 'apply' | 'contact';
  readonly route: string;
}
const KINDS: readonly Kind[] = [
  { name: 'apply', route: '/apply/' },
  { name: 'contact', route: '/contact/' },
];

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

async function open(page: Page, kind: Kind, frozen = false): Promise<void> {
  await page.clock.install();
  // A frozen clock makes the fill time exactly zero, so the too-fast check is deterministic.
  if (frozen) await page.clock.setFixedTime(new Date());
  await page.goto(kind.route);
  const mode = await page.locator('form[data-intake-form]').first().getAttribute('data-mode');
  if (process.env.E2E_REQUIRE_ENDPOINT === '1') expect(mode, `${kind.route} must be in endpoint mode in the forms build`).toBe('endpoint');
  test.skip(mode !== 'endpoint', `${kind.route} is not in endpoint mode in this build`);
}

async function fillValid(page: Page, kind: Kind, how: 'pointer' | 'keyboard' = 'pointer'): Promise<void> {
  const form = page.locator('form[data-intake-form]').first();
  await form.locator('[name="name"]').fill('Test Founder');
  await form.locator('[name="email"]').fill('founder@example.org');
  if (kind.name === 'apply') await form.locator('[name="stage"]').selectOption('idea');
  else {
    await form.locator('[name="topic"]').selectOption('general');
    await form.locator('[name="message"]').fill('A short message for the team.');
  }
  const consent = form.locator('[name="consent"]');
  if (how === 'pointer') await consent.check();
  else {
    // The keyboard path: focus brings the checkbox into view natively, so no click has to find it first.
    await consent.focus();
    await page.keyboard.press('Space');
    await expect(consent).toBeChecked();
  }
}

const submit = (page: Page): Promise<void> => page.locator('form[data-intake-form] [data-submit]').first().click();
/** Moves the page clock past MIN_FILL_MS (3 s) so the too-fast check does not pause the first submit. */
const settle = (page: Page): Promise<void> => page.clock.fastForward(3500);

for (const kind of KINDS) {
  test.describe(`${kind.name} form`, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(kind.route), `${kind.route} is not built`);
    });

    test('success sends one JSON body and finishes', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '', [ENDPOINT_ORIGIN]);
      const mock = await mockEndpoint(page, ok);
      await open(page, kind);
      await fillValid(page, kind);
      await settle(page);
      await submit(page);
      if (kind.name === 'apply') await expect(page).toHaveURL(/\/apply\/thanks\/$/);
      else await expect(page.locator('form[data-intake-form] [data-status]')).toContainText('Thank you');
      expect(mock.bodies).toHaveLength(1);
      expect(mock.bodies[0]).toMatchObject({ form: kind.name, email: 'founder@example.org', consent: true, website: '' });
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.thirdParty, 'only the mocked endpoint may be contacted').toEqual([]);
    });

    test('client validation names the problems and sends nothing', async ({ page }) => {
      const mock = await mockEndpoint(page, ok);
      await open(page, kind);
      await settle(page);
      await submit(page);
      const summary = page.locator('form[data-intake-form] [data-error-summary]');
      await expect(summary).toBeVisible();
      await expect(summary).toBeFocused();
      await expect(summary.locator('li').first()).toBeVisible();
      expect(mock.bodies).toHaveLength(0);
    });

    test('a 400 with field errors shows them next to the fields', async ({ page }) => {
      await mockEndpoint(page, (route) =>
        route.fulfill({ status: 400, headers: CORS, contentType: 'application/json', body: JSON.stringify({ errors: { email: 'That address was rejected by the server.' } }) }),
      );
      await open(page, kind);
      await fillValid(page, kind);
      await settle(page);
      await submit(page);
      const summary = page.locator('form[data-intake-form] [data-error-summary]');
      await expect(summary).toContainText('That address was rejected by the server.');
      await expect(page.locator('form[data-intake-form] [name="email"]')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('form[data-intake-form] [name="name"]')).toHaveValue('Test Founder');
    });

    test('a request that never answers times out after 15 seconds and keeps the answers', async ({ page }) => {
      await mockEndpoint(page, () => new Promise<void>(() => undefined));
      await open(page, kind);
      await fillValid(page, kind);
      await settle(page);
      await submit(page);
      await expect(page.locator('form[data-intake-form]')).toHaveAttribute('aria-busy', 'true');
      await page.clock.fastForward(15_500);
      const summary = page.locator('form[data-intake-form] [data-error-summary]');
      await expect(summary).toBeVisible();
      await expect(summary).toContainText('took too long');
      await expect(page.locator('form[data-intake-form] [name="email"]')).toHaveValue('founder@example.org');
    });

    test('a server error shows a plain message', async ({ page }) => {
      await mockEndpoint(page, (route) => route.fulfill({ status: 500, headers: CORS, body: 'boom' }));
      await open(page, kind);
      await fillValid(page, kind);
      await settle(page);
      await submit(page);
      await expect(page.locator('form[data-intake-form] [data-error-summary]')).toContainText('Something went wrong on our side');
    });

    test('a filled honeypot is dropped silently: nothing is sent and the visitor sees success', async ({ page }) => {
      const mock = await mockEndpoint(page, ok);
      await open(page, kind);
      await fillValid(page, kind);
      await page.locator('form[data-intake-form] input[name="website"]').evaluate((el) => {
        (el as HTMLInputElement).value = 'https://spam.example';
      });
      await settle(page);
      await submit(page);
      if (kind.name === 'apply') await expect(page).toHaveURL(/\/apply\/thanks\/$/);
      else await expect(page.locator('form[data-intake-form] [data-status]')).toContainText('Thank you');
      expect(mock.bodies).toHaveLength(0);
    });

    test('the honeypot is not reachable by people', async ({ page }) => {
      await open(page, kind);
      const hp = page.locator('form[data-intake-form] .hp');
      await expect(hp).toHaveAttribute('inert', '');
      await expect(hp.locator('input')).toHaveAttribute('tabindex', '-1');
    });

    test('a submit under three seconds is paused once, the second goes through', async ({ page }) => {
      const mock = await mockEndpoint(page, ok);
      await open(page, kind, true);
      await fillValid(page, kind);
      await submit(page);
      await expect(page.locator('form[data-intake-form] [data-status]')).toContainText('That was quick');
      expect(mock.bodies).toHaveLength(0);
      await submit(page);
      await expect.poll(() => mock.bodies.length).toBe(1);
    });
  });
}

// Without JavaScript (code-security P1-1). A form with no method submits as a GET query string, which puts the visitor's name, email
// and message in the URL, the browser history and the server log. planForm (src/data/forms.ts) therefore makes every form
// method="post" and ships the button disabled unless the browser can POST to the endpoint. The endpoint origin is also the proof that
// the CSP form-action list carries it: a refused form post never reaches page.route.
test.describe('without JavaScript', () => {
  // Reduced motion also switches smooth scrolling off (src/styles/motion.css). With scripting off and html { scroll-behavior: smooth },
  // Playwright's click scrolling never settled the consent checkbox inside the viewport in CI (pipeline 64252: "element is outside of
  // the viewport" until the 45 s timeout), and the form contract under test has nothing to do with motion. The two forms are filled
  // and sent from the keyboard as well, which is the path a no-JavaScript visitor on a screen reader takes.
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });

  interface Seen {
    readonly method: string;
    readonly url: string;
    readonly contentType: string;
    readonly body: string;
  }

  for (const kind of KINDS) {
    test(`${kind.route} posts form-encoded fields to the endpoint and never builds a query string`, async ({ page }) => {
      test.skip(!isBuilt(kind.route), `${kind.route} is not built`);
      const seen: Seen[] = [];
      await page.route(`${ENDPOINT_ORIGIN}/**`, async (route) => {
        const request = route.request();
        seen.push({ method: request.method(), url: request.url(), contentType: request.headers()['content-type'] ?? '', body: request.postData() ?? '' });
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>received</title><p>received</p>' });
      });
      await page.goto(kind.route);
      const form = page.locator('form[data-intake-form]').first();
      const mode = await form.getAttribute('data-mode');
      if (process.env.E2E_REQUIRE_ENDPOINT === '1') expect(mode, `${kind.route} must be in endpoint mode in the forms build`).toBe('endpoint');
      test.skip(mode !== 'endpoint', `${kind.route} is not in endpoint mode in this build`);

      await expect(form).toHaveAttribute('method', 'post');
      await expect(form).toHaveAttribute('action', `${ENDPOINT_ORIGIN}/api/intake`);
      await expect(form.locator('[data-submit]')).toBeEnabled();

      await fillValid(page, kind, 'keyboard');
      await form.locator('[data-submit]').focus();
      await page.keyboard.press('Enter');
      await expect.poll(() => seen.length).toBe(1);

      const [request] = seen;
      expect(request?.method).toBe('POST');
      expect(request?.url, 'no query string on the endpoint URL').toBe(`${ENDPOINT_ORIGIN}/api/intake`);
      expect(request?.contentType).toContain('application/x-www-form-urlencoded');
      const fields = new URLSearchParams(request?.body ?? '');
      expect(fields.get('form')).toBe(kind.name);
      expect(fields.get('email')).toBe('founder@example.org');
      expect(fields.get('consent')).toBe('on');
      expect(fields.get('website')).toBe('');
      if (kind.name === 'apply') expect(fields.get('redirect')).toMatch(/\/apply\/thanks\/$/);
    });
  }

  test('the newsletter form cannot post without JavaScript: the button is disabled, the method is post and a note says why', async ({ page }) => {
    test.skip(!isBuilt('/newsletter/'), '/newsletter/ is not built');
    const requests: string[] = [];
    page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));
    await page.goto('/newsletter/');
    const form = page.locator('form[data-intake-form]').first();
    const mode = await form.getAttribute('data-mode');
    if (process.env.E2E_REQUIRE_ENDPOINT === '1') expect(mode, '/newsletter/ must be in endpoint mode in the forms build').toBe('endpoint');
    test.skip(mode !== 'endpoint', '/newsletter/ is not in endpoint mode in this build');

    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).not.toHaveAttribute('action', /./);
    await expect(form.locator('[data-submit]')).toBeDisabled();
    // Not getByText: Playwright's text engine never looks inside <noscript>, even when the browser renders it as elements.
    await expect(form.locator('noscript .callout__title')).toHaveText('This form needs JavaScript');
    await expect(form.locator('noscript .callout__title')).toBeVisible();

    const before = page.url();
    await form.locator('[name="email"]').fill('founder@example.org');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('load');
    expect(page.url(), 'Enter in a field must not submit a form whose button is disabled').toBe(before);
    expect(requests.filter((entry) => entry.includes('?') || entry.includes(ENDPOINT_ORIGIN))).toEqual([]);
  });
});

test.describe('with JavaScript', () => {
  test('the newsletter button, disabled in the markup, is enabled once the form script has mounted', async ({ page }) => {
    test.skip(!isBuilt('/newsletter/'), '/newsletter/ is not built');
    await page.goto('/newsletter/');
    const form = page.locator('form[data-intake-form]').first();
    const mode = await form.getAttribute('data-mode');
    test.skip(mode !== 'endpoint', '/newsletter/ is not in endpoint mode in this build');
    await expect(form).toHaveAttribute('data-mounted', 'true');
    await expect(form.locator('[data-submit]')).toBeEnabled();
  });
});
