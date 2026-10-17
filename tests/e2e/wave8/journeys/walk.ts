import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { watch, type Watch } from '../../support/page-guards.ts';
import { liveRoutes, pendingRoutes } from '../../support/routes.ts';
import {
  FORM_ANSWERS,
  MAILTO_FORMS,
  MAX_CLICK_DEPTH,
  depthFromHome,
  planWalk,
  type ActionRef,
  type ClickTake,
  type JourneyMap,
  type LinkRef,
  type Step,
  type SubmitTake,
} from './maps.ts';

// WP-90: walks a customer-journey map in a browser by clicking visible links. After the first page there is no goto.
//
// Convention (the wave 8 forms ruling, see tests/e2e/wave8/wp-65): e2e:wave8 builds with no intake endpoint, so every form is disabled
// there. The plain journey test therefore walks to the form, proves its disabled state and says which later steps it did not reach. The
// full journey, with the endpoint answered by page.route, carries the tag @endpoint in its title and skips itself unless the form's
// data-mode is `endpoint`; e2e:forms runs `--grep @endpoint` against its endpoint build, so each runs for real in exactly one job.

const ENDPOINT_ORIGIN = 'https://intake.example.test';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};
const NOT_CONNECTED = 'This form is not connected yet';

const live = new Set(liveRoutes.map((r) => r.path));
const pending = new Set(pendingRoutes.map((r) => r.path));

/** Why a path is not walkable, or undefined when it is launched and built. */
function reasonFor(path: string): string | undefined {
  if (live.has(path)) return undefined;
  if (pending.has(path)) return 'launched but not built in this build';
  return 'not a launched route (launch: false, a cut page)';
}

const pathOf = (page: Page): string => new URL(page.url()).pathname;

/** The link a visitor sees: found by role and visible text inside the page's main region, never by class. */
function linkFor(page: Page, link: LinkRef): Locator {
  return page.locator('main').getByRole('link', { name: link.name, exact: link.exact ?? true });
}

/** Fails when the link is not on the page. This is the check that a removed forward link breaks the suite. */
export async function requireLink(page: Page, link: LinkRef, what: string): Promise<Locator> {
  const found = linkFor(page, link);
  if ((await found.count()) === 0) {
    throw new Error(`Missing ${what}: no link named "${link.name}" on ${pathOf(page)}. A visitor cannot reach ${link.href} from here.`);
  }
  const first = found.first();
  const target = await first.evaluate((a) => (a as HTMLAnchorElement).pathname);
  expect(target, `${what} "${link.name}" on ${pathOf(page)} must lead to ${link.href}`).toBe(link.href);
  return first;
}

/** Every step: the URL, one h1, a way forward, the page's primary and secondary actions, and no console error, page error or third party. */
async function assertStep(page: Page, step: Step, seen: Watch): Promise<void> {
  await expect(page, `the visitor must be on ${step.page}`).toHaveURL((url) => url.pathname === step.page);
  await expect(page.getByRole('heading', { level: 1 }), `${step.page} has exactly one h1`).toHaveCount(1);
  for (const action of step.also ?? []) await requireLink(page, action as ActionRef, `the ${action.kind} action`);
  const forward = await page.locator('main a[href]').evaluateAll((anchors, here) => {
    return anchors.filter((a) => {
      const anchor = a as HTMLAnchorElement;
      return anchor.origin === location.origin && anchor.pathname !== here && !anchor.getAttribute('href')?.startsWith('#');
    }).length;
  }, new URL(page.url()).pathname);
  expect(forward, `${step.page} is a dead end: its main region links to no other page`).toBeGreaterThan(0);
  expect(seen.consoleErrors, `console errors on ${step.page}`).toEqual([]);
  expect(seen.pageErrors, `page errors on ${step.page}`).toEqual([]);
  expect(seen.thirdParty, `${step.page} contacts only the site`).toEqual([]);
}

const formOf = (page: Page, kind: SubmitTake['form']): Locator => page.locator(`form[data-intake-form][data-kind="${kind}"]`);

/** The disabled variant: the form says plainly that it cannot be sent, keeps the button off and offers a mailto only on contact and apply. */
async function assertDisabledForm(page: Page, take: SubmitTake): Promise<void> {
  const form = formOf(page, take.form);
  await expect(form, `${take.form} form on ${pathOf(page)}`).toHaveCount(1);
  const mode = await form.getAttribute('data-mode');
  if (MAILTO_FORMS.includes(take.form)) {
    expect(['disabled', 'mailto'], `mode of the ${take.form} form`).toContain(mode);
  } else {
    expect(mode, `the ${take.form} form has no mailto fallback, so with no endpoint it is disabled`).toBe('disabled');
    await expect(page.locator('main a[href^="mailto:"]'), `${take.form} offers no mailto link`).toHaveCount(0);
    await expect(form).not.toHaveAttribute('data-mailto', /./);
  }
  if (mode === 'disabled') {
    await expect(form).toContainText(NOT_CONNECTED);
    await expect(form.locator('[data-submit]')).toBeDisabled();
    await expect(form).not.toHaveAttribute('action', /.+/);
  }
}

async function fillForm(page: Page, take: SubmitTake): Promise<void> {
  const form = formOf(page, take.form);
  const answers = FORM_ANSWERS[take.form];
  // The Apply form is a stepper when JavaScript runs: the answers are given step by step and the consent box is on the last step.
  const stepped = take.form === 'apply' && (await form.getAttribute('data-stepper')) === 'on';
  const next = form.locator('[data-step-next]');
  const text = Object.entries(answers.text);
  for (const [name, value] of text.slice(0, 2)) await form.locator(`[name="${name}"]`).fill(value);
  if (stepped) await next.click();
  for (const [name, value] of text.slice(2)) await form.locator(`[name="${name}"]`).fill(value);
  for (const [name, value] of Object.entries(answers.select)) await form.locator(`[name="${name}"]`).selectOption(value);
  if (stepped) {
    await next.click();
    await next.click();
  }
  await form.locator('[name="consent"]').check();
  // Past the 3 second fill check, so the first submit is not paused as too fast.
  await page.clock.fastForward(3500);
}

/** Answers preflights with 204 and POSTs with 200, and returns the JSON bodies the page sent. */
async function mockEndpoint(page: Page): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.route(`${ENDPOINT_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    bodies.push(request.postDataJSON());
    await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  return bodies;
}

/** Records the steps a walk skipped in the test report and on stdout, so a cut page is reported and never silently dropped. */
function reportSkipped(audience: string, skipped: readonly { page: string; reason: string }[], extra: string[] = []): void {
  const lines = [...skipped.map((s) => `${s.page}: ${s.reason}`), ...extra];
  for (const line of lines) {
    test.info().annotations.push({ type: 'skipped-step', description: line });
    console.log(`[journey:${audience}] skipped step ${line}`);
  }
}

type Mode = 'disabled' | 'endpoint';

interface Outcome {
  readonly clicks: number;
  /** The path of the first conversion page, with the number of clicks it took to reach. */
  readonly conversionClicks?: number;
}

/** Walks the planned steps from the entry page by clicking only. Returns the click count, to the conversion page and in all. */
async function walk(page: Page, map: JourneyMap, mode: Mode, seen: Watch, bodies: unknown[]): Promise<Outcome> {
  const plan = planWalk(map, reasonFor);
  reportSkipped(map.audience, plan.skipped);
  expect(plan.steps.length, `the entry page ${map.steps[0]?.page ?? ''} of the ${map.audience} map must be live`).toBeGreaterThan(0);

  let clicks = 0;
  let conversionClicks: number | undefined;
  const entry = plan.steps[0] as Step;
  await page.goto(entry.page);
  for (const [index, step] of plan.steps.entries()) {
    await assertStep(page, step, seen);
    if (step.stage === 'conversion' && conversionClicks === undefined) conversionClicks = clicks;
    const take = step.take;
    if (take === undefined) break;
    if (take.kind === 'submit') {
      if (mode === 'disabled') {
        await assertDisabledForm(page, take);
        const unreached = plan.steps.slice(index + 1).map((s) => `${s.page}: needs an intake endpoint, walked by the @endpoint journey in e2e:forms`);
        reportSkipped(map.audience, [], unreached);
        break;
      }
      const form = formOf(page, take.form);
      const actual = await form.getAttribute('data-mode');
      test.skip(actual !== 'endpoint', 'runs in e2e:forms');
      await fillForm(page, take);
      await form.locator('[data-submit]').click();
      await expect(page).toHaveURL((url) => url.pathname === take.thanks);
      expect(bodies.length, 'one request reached the mocked endpoint').toBe(1);
      expect(bodies[0]).toMatchObject({ form: take.form, consent: true, website: '' });
      bodies.length = 0;
      continue;
    }
    // A link whose destination is a skipped step is not clicked: the page before a cut page drops that link (contracts 11.3 rule 5).
    const next = plan.steps[index + 1];
    if (next === undefined) break;
    const link = await requireLink(page, take as ClickTake, `the ${take.kind} link`);
    await link.click();
    clicks += 1;
  }
  return { clicks, ...(conversionClicks !== undefined ? { conversionClicks } : {}) };
}

/** Registers the journey tests of one audience. Call it at the top level of a spec file. */
export function runJourney(map: JourneyMap): void {
  const entry = map.steps[0]?.page ?? '/';

  test.describe(`customer journey: ${map.audience}`, () => {
    test(`walks the ${map.audience} map by clicking only and ends at the form's disabled state`, async ({ page, baseURL }) => {
      test.skip(reasonFor(entry) !== undefined, `the entry page ${entry} is not live`);
      const seen = watch(page, baseURL ?? '');
      const outcome = await walk(page, map, 'disabled', seen, []);
      if (outcome.conversionClicks !== undefined) {
        expect(outcome.conversionClicks, `clicks from ${entry} to the form`).toBeLessThanOrEqual(MAX_CLICK_DEPTH);
      }
    });

    test(`walks the whole ${map.audience} map to the thanks page and beyond with a mocked endpoint @endpoint`, async ({ page, baseURL }) => {
      test.skip(reasonFor(entry) !== undefined, `the entry page ${entry} is not live`);
      const seen = watch(page, baseURL ?? '', [ENDPOINT_ORIGIN]);
      const bodies = await mockEndpoint(page);
      await page.clock.install();
      const outcome = await walk(page, map, 'endpoint', seen, bodies);
      expect(outcome.clicks, 'the walk clicked at least once').toBeGreaterThan(0);
    });

    test(`a visitor reaches the ${map.audience} entry page from the home page and the form is at most ${MAX_CLICK_DEPTH} navigations away`, async ({ page, baseURL }) => {
      test.skip(reasonFor('/') !== undefined, 'the home page is not live');
      const seen = watch(page, baseURL ?? '');
      await page.goto('/');
      if (map.homeDoor === undefined) {
        expect(entry, 'a map with no home door starts on the home page').toBe('/');
      } else {
        const found = linkFor(page, map.homeDoor);
        if ((await found.count()) === 0) {
          reportSkipped(map.audience, [], [`/: the home page has no "${map.homeDoor.name}" door yet (the audience strip of WP-62, #42)`]);
          test.skip(true, 'the home page has no audience strip yet');
        }
        const door = await requireLink(page, map.homeDoor, 'the home door');
        await door.click();
        await expect(page).toHaveURL((url) => url.pathname === entry);
      }
      expect(depthFromHome(map) ?? 0, 'navigations from the home page to the form').toBeLessThanOrEqual(MAX_CLICK_DEPTH);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });

    test(`the suite fails when a forward link is removed from the ${map.audience} map`, async ({ page }) => {
      test.skip(reasonFor(entry) !== undefined, `the entry page ${entry} is not live`);
      const first = map.steps[0];
      const take = first?.take;
      test.skip(take === undefined || take.kind === 'submit', 'the first step takes no link');
      if (take === undefined || take.kind === 'submit') return;
      await page.goto(entry);
      // The deliberately broken fixture: every anchor the step would click is removed from the page.
      await linkFor(page, take).evaluateAll((anchors) => anchors.forEach((a) => a.remove()));
      await expect(requireLink(page, take, `the ${take.kind} link`)).rejects.toThrow(/Missing .* no link named/);
    });
  });
}
