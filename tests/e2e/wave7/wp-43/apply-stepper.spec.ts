import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-43: the Apply stepper. One spec, run at 1440 and at 390 by the wave 7 projects. It runs against the default build, where the intake
// endpoint is unprovisioned and the form is in `disabled` mode: the stepper must work there, and the submit button must stay disabled.
// Nothing here sends a request; the endpoint-mode flows are tests/e2e/forms.spec.ts.

const ROUTE = '/apply/';
const FOUNDER = { name: 'Test Founder', email: 'founder@example.org', idea: 'A scheduling tool for small clinics.' };

const form = (page: Page): Locator => page.locator('form[data-intake-form]').first();
const status = (page: Page): Locator => form(page).locator('[data-stepper-status]');
const next = (page: Page): Locator => form(page).locator('[data-step-next]');
const back = (page: Page): Locator => form(page).locator('[data-step-back]');
const heading = (page: Page, title: string): Locator => form(page).getByRole('heading', { level: 2, name: title, exact: true });

test.beforeEach(() => {
  test.skip(!isBuilt(ROUTE), `${ROUTE} is not built`);
});

/** Opens /apply/ and waits until the script has mounted the stepper. */
async function open(page: Page, search = ''): Promise<void> {
  await page.goto(`${ROUTE}${search}`);
  await expect(form(page)).toHaveAttribute('data-mounted', 'true');
  await expect(form(page)).toHaveAttribute('data-stepper', 'on');
}

async function fillStepOne(page: Page): Promise<void> {
  await form(page).locator('#apply-name').fill(FOUNDER.name);
  await form(page).locator('#apply-email').fill(FOUNDER.email);
}

async function fillStepTwo(page: Page): Promise<void> {
  await form(page).locator('#apply-stage').selectOption('validating');
  await form(page).locator('#apply-message').fill(FOUNDER.idea);
}

async function goNext(page: Page, toStatus: string): Promise<void> {
  await next(page).click();
  await expect(status(page)).toHaveText(toStatus);
}

/** Walks from step 1 to the review with valid answers. */
async function walkToReview(page: Page): Promise<void> {
  await fillStepOne(page);
  await goNext(page, 'Step 2 of 4: About the idea');
  await fillStepTwo(page);
  await goNext(page, 'Step 3 of 4: Team and package');
  await goNext(page, 'Step 4 of 4: Review');
}

/** Presses Tab until `target` holds focus. Fails when it is not reached, so a keyboard trap or a missing tab stop is caught. */
async function tabTo(page: Page, target: Locator, key: 'Tab' | 'Shift+Tab' = 'Tab', limit = 14): Promise<void> {
  for (let presses = 0; presses < limit; presses += 1) {
    await page.keyboard.press(key);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`The element was not reached with ${limit} presses of ${key}.`);
}

test.describe('with JavaScript', () => {
  test('opens on step 1 of 4: the progress list, the status line and only that step on screen', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await open(page);
    await expect(form(page).locator('[data-stepper]')).toBeVisible();
    await expect(status(page)).toHaveText('Step 1 of 4: About you');
    await expect(status(page)).toHaveAttribute('role', 'status');
    await expect(form(page).locator('[data-stepper-item]')).toHaveCount(4);
    await expect(form(page).locator('[data-stepper-item][aria-current="step"]')).toHaveCount(1);

    for (const id of ['#apply-name', '#apply-email', '#apply-company']) await expect(form(page).locator(id)).toBeVisible();
    for (const id of ['#apply-stage', '#apply-message', '#apply-seats', '#apply-package', '[name="consent"]']) await expect(form(page).locator(id)).toBeHidden();
    await expect(next(page)).toBeVisible();
    await expect(back(page)).toBeHidden();
    await expect(form(page).locator('[data-submit]')).toBeHidden();
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
  });

  test('Next on a step with problems stays put, names them in the summary and inline, and the summary links to the field', async ({ page }) => {
    await open(page);
    await next(page).click();
    const summary = form(page).locator('[data-error-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('Enter your name.');
    await expect(summary).toContainText('Enter your email address so WE can reply.');
    await expect(status(page)).toHaveText('Step 1 of 4: About you');

    const name = form(page).locator('#apply-name');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAttribute('aria-describedby', /apply-name-error/);
    await expect(form(page).locator('#apply-name-error')).toBeVisible();
    await expect(form(page).locator('#apply-name-error')).toHaveText('Enter your name.');

    await summary.getByRole('link', { name: 'Enter your name.' }).click();
    await expect(name).toBeFocused();
    await name.fill(FOUNDER.name);
    await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('a keyboard-only run reaches the review: Enter and Space act, focus lands on each step heading, nothing traps', async ({ page }) => {
    await open(page);
    // The first control is the starting point. Everything after it is Tab, typing, Enter, Space and the arrow keys.
    await form(page).locator('#apply-name').focus();
    await page.keyboard.type(FOUNDER.name);
    await page.keyboard.press('Tab');
    await expect(form(page).locator('#apply-email')).toBeFocused();
    await page.keyboard.type(FOUNDER.email);
    // Enter in a text field of an earlier step means Next.
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Step 2 of 4: About the idea');
    await expect(heading(page, 'About the idea')).toBeFocused();

    await tabTo(page, form(page).locator('#apply-stage'));
    await page.keyboard.press('ArrowDown');
    await expect(form(page).locator('#apply-stage')).toHaveValue('idea');
    await tabTo(page, form(page).locator('#apply-message'));
    await page.keyboard.type(FOUNDER.idea);
    // Enter in a textarea is a new line, not Next.
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Step 2 of 4: About the idea');
    await tabTo(page, next(page));
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Step 3 of 4: Team and package');
    await expect(heading(page, 'Team and package')).toBeFocused();

    await tabTo(page, form(page).locator('#apply-package'));
    await page.keyboard.press('ArrowDown');
    await expect(form(page).locator('#apply-package')).toHaveValue('spark');
    await tabTo(page, next(page));
    await page.keyboard.press('Space');
    await expect(status(page)).toHaveText('Step 4 of 4: Review');
    await expect(heading(page, 'Review')).toBeFocused();

    const consent = form(page).locator('[name="consent"]');
    await tabTo(page, consent);
    await page.keyboard.press('Space');
    await expect(consent).toBeChecked();
    await expect(form(page).locator('[data-review-list]')).toContainText(FOUNDER.email);
    await expect(form(page).locator('[data-review-list]')).toContainText('Spark');

    // And back again from the keyboard: Back keeps the answers.
    await tabTo(page, back(page), 'Tab', 6);
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('Step 3 of 4: Team and package');
    await expect(form(page).locator('#apply-package')).toHaveValue('spark');
  });

  test('the review lists what was entered, Change returns to that step with the answer kept, and Back keeps every answer', async ({ page }) => {
    await open(page);
    await walkToReview(page);
    const review = form(page).locator('[data-review-list]');
    await expect(review).toContainText(FOUNDER.name);
    await expect(review).toContainText(FOUNDER.email);
    await expect(review).toContainText('Validating the problem with customers');
    await expect(review).toContainText(FOUNDER.idea);
    await expect(review).toContainText('Not given');
    await expect(form(page).locator('[name="consent"]')).toBeVisible();

    await form(page).locator('[data-review-change="idea"]').click();
    await expect(status(page)).toHaveText('Step 2 of 4: About the idea');
    await expect(heading(page, 'About the idea')).toBeFocused();
    await expect(form(page).locator('#apply-stage')).toHaveValue('validating');
    await expect(form(page).locator('#apply-message')).toHaveValue(FOUNDER.idea);
    await back(page).click();
    await expect(status(page)).toHaveText('Step 1 of 4: About you');
    await expect(form(page).locator('#apply-name')).toHaveValue(FOUNDER.name);
  });

  test('the status line is a live region that follows every move', async ({ page }) => {
    await open(page);
    await expect(status(page)).toHaveAttribute('aria-live', 'polite');
    await fillStepOne(page);
    await goNext(page, 'Step 2 of 4: About the idea');
    await expect(form(page).locator('[data-stepper-item][aria-current="step"]')).toContainText('About the idea');
    await back(page).click();
    await expect(status(page)).toHaveText('Step 1 of 4: About you');
  });

  test('the package field is script-only, has no name, lists the four packages and Not sure, and shows what each is sized for', async ({ page }) => {
    await open(page);
    await fillStepOne(page);
    await goNext(page, 'Step 2 of 4: About the idea');
    await fillStepTwo(page);
    await goNext(page, 'Step 3 of 4: Team and package');
    const select = form(page).locator('#apply-package');
    await expect(select).toBeVisible();
    expect(await select.getAttribute('name'), 'a nameless select cannot be posted by the browser').toBeNull();
    expect(await select.locator('option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value))).toEqual(['', 'spark', 'launch', 'accelerate', 'studio', 'not-sure']);
    await select.selectOption('accelerate');
    await expect(form(page).locator('[data-package-fit]')).toContainText('Accelerate is sized for:');
    await goNext(page, 'Step 4 of 4: Review');
    await expect(form(page).locator('[data-review-list]')).toContainText('Accelerate');
  });

  for (const [query, expected] of [
    ['?package=launch', 'launch'],
    ['?package=Studio', 'studio'],
    ['?package=not-sure', 'not-sure'],
    ['?package=gold', ''],
    ['?package=spark&package=launch', ''],
    ['?package=', ''],
  ] as const) {
    test(`${ROUTE}${query} preselects "${expected || 'nothing'}" and never breaks the page`, async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await open(page, query);
      await fillStepOne(page);
      await goNext(page, 'Step 2 of 4: About the idea');
      await fillStepTwo(page);
      await goNext(page, 'Step 3 of 4: Team and package');
      await expect(form(page).locator('#apply-package')).toHaveValue(expected);
      expect(seen.pageErrors).toEqual([]);
    });
  }

  test('no answer or step is persisted: no storage, no cookie, nothing in the URL', async ({ page, context }) => {
    await open(page);
    await walkToReview(page);
    await form(page).locator('[name="consent"]').check();
    const stored = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
      databases: 'databases' in indexedDB ? (await indexedDB.databases()).length : 0,
      url: location.href,
    }));
    expect(stored.local).toBe(0);
    expect(stored.session).toBe(0);
    expect(stored.cookie).toBe('');
    expect(stored.databases).toBe(0);
    expect(stored.url).not.toMatch(/founder|Test|clinic/i);
    expect(await context.cookies()).toEqual([]);
    // A reload starts the form again: the stepper is memory only.
    await page.reload();
    await expect(form(page)).toHaveAttribute('data-stepper', 'on');
    await expect(status(page)).toHaveText('Step 1 of 4: About you');
    await expect(form(page).locator('#apply-name')).toHaveValue('');
  });

  test('the submit button still follows the endpoint mode: disabled in the default build, and Enter never sends from an earlier step', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') requests.push(`${request.method()} ${request.url()}`);
    });
    await open(page);
    const mode = await form(page).getAttribute('data-mode');
    await form(page).locator('#apply-name').fill(FOUNDER.name);
    await form(page).locator('#apply-email').fill(FOUNDER.email);
    await form(page).locator('#apply-email').press('Enter');
    await expect(status(page)).toHaveText('Step 2 of 4: About the idea');
    await fillStepTwo(page);
    await goNext(page, 'Step 3 of 4: Team and package');
    await goNext(page, 'Step 4 of 4: Review');
    const submit = form(page).locator('[data-submit]');
    await expect(submit).toBeVisible();
    if (mode === 'disabled') await expect(submit).toBeDisabled();
    expect(requests, 'walking the steps sends nothing').toEqual([]);
  });

  test('axe finds nothing on any step or on the review, at WCAG 2.2 AA', async ({ page }) => {
    // Six scans of the form. The page around it is scanned by the other axe specs, and a whole-page scan of the hero at 1440 took most of the budget.
    test.setTimeout(120_000);
    await open(page);
    const summarise = (violations: { id: string; nodes: { target: readonly unknown[] }[] }[]): string[] => violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const failures: string[] = [];
    const scan = async (label: string): Promise<void> => {
      const results = await new AxeBuilder({ page }).include('form[data-intake-form]').withTags(AXE_TAGS).analyze();
      failures.push(...summarise(results.violations).map((line) => `${label}: ${line}`));
    };
    await scan('step 1');
    await fillStepOne(page);
    await goNext(page, 'Step 2 of 4: About the idea');
    await scan('step 2');
    await fillStepTwo(page);
    await goNext(page, 'Step 3 of 4: Team and package');
    await scan('step 3');
    await goNext(page, 'Step 4 of 4: Review');
    await scan('review');
    await back(page).click();
    await back(page).click();
    await back(page).click();
    await form(page).locator('#apply-name').fill('');
    await next(page).click();
    await expect(form(page).locator('[data-error-summary]')).toBeVisible();
    await scan('step 1 with errors');
    expect(failures).toEqual([]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every fieldset is on the page, the stepper controls and the package select are not, and the form is still one POST form', async ({ page }) => {
    await page.goto(ROUTE);
    const f = form(page);
    await expect(f).toHaveAttribute('method', 'post');
    for (const id of ['#apply-name', '#apply-email', '#apply-company', '#apply-stage', '#apply-message', '#apply-seats', '[name="consent"]']) {
      await expect(f.locator(id)).toBeVisible();
    }
    await expect(f.locator('[data-stepper]')).toBeHidden();
    await expect(next(page)).toBeHidden();
    await expect(back(page)).toBeHidden();
    await expect(f.locator('[data-package-field]')).toBeHidden();
    await expect(f.locator('[name="package"]')).toHaveCount(0);
    await expect(f.locator('[data-review]')).toBeHidden();
    await expect(f.locator('[data-submit]')).toBeVisible();
    const mode = await f.getAttribute('data-mode');
    if (mode === 'disabled') await expect(f.locator('[data-submit]')).toBeDisabled();
  });
});

// WCAG 2.2, 2.4.11 Focus Not Obscured (Minimum). On a phone the progress bar is sticky; a focused control must never sit under it.
// 390 is the phone project's own width. 320 is the reflow width. 720 is a 1440 window at 200 percent zoom (the zoom-200 project of modes.spec).
const VIEWPORTS = [
  { name: '390 wide', width: 390, height: 844, project: 'wave7-mobile-390x844' },
  { name: '320 wide', width: 320, height: 568, project: 'wave7-desktop-1440x900' },
  { name: '720 wide, a 1440 window at 200 percent zoom', width: 720, height: 450, project: 'wave7-desktop-1440x900' },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`focus is not obscured at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('no focused control sits under the progress bar, moving forward and backward through every step', async ({ page }, info) => {
      test.skip(info.project.name !== viewport.project, `${viewport.name} runs in ${viewport.project}`);
      // Seventy-two key presses, each followed by a measurement, on a shared runner.
      test.setTimeout(120_000);
      await open(page);
      const overlaps = async (): Promise<string | null> =>
        page.evaluate(() => {
          const active = document.activeElement;
          const bar = document.querySelector<HTMLElement>('[data-stepper]');
          if (active === null || bar === null || active === document.body) return null;
          const a = active.getBoundingClientRect();
          const b = bar.getBoundingClientRect();
          const stuck = getComputedStyle(bar).position === 'sticky';
          const visible = a.bottom > 0 && a.top < window.innerHeight;
          const under = a.top < b.bottom && a.bottom > b.top;
          if (stuck && visible && under) return `${active.tagName.toLowerCase()}#${active.id} (${Math.round(a.top)} to ${Math.round(a.bottom)}) under the bar (${Math.round(b.top)} to ${Math.round(b.bottom)})`;
          return null;
        });
      const failures: string[] = [];
      const sweep = async (label: string, key: 'Tab' | 'Shift+Tab'): Promise<void> => {
        for (let presses = 0; presses < 12; presses += 1) {
          await page.keyboard.press(key);
          const found = await overlaps();
          if (found !== null) failures.push(`${label}: ${found}`);
        }
      };

      if (viewport.width <= 390) {
        // The bar is sticky on a phone, and its measured height is what the scroll margin reads.
        const sticky = await form(page).locator('[data-stepper]').evaluate((el) => getComputedStyle(el).position);
        expect(sticky).toBe('sticky');
        const heights = await form(page).evaluate((el) => ({
          variable: parseFloat(el.style.getPropertyValue('--stepper-bar-h')),
          bar: el.querySelector<HTMLElement>('[data-stepper]')?.offsetHeight ?? 0,
        }));
        expect(heights.variable).toBeCloseTo(heights.bar, 0);
      }

      await form(page).locator('#apply-name').focus();
      await sweep('step 1 forward', 'Tab');
      await sweep('step 1 backward', 'Shift+Tab');
      await fillStepOne(page);
      await next(page).click();
      await expect(status(page)).toHaveText('Step 2 of 4: About the idea');
      await sweep('step 2 forward', 'Tab');
      await sweep('step 2 backward', 'Shift+Tab');
      await fillStepTwo(page);
      await next(page).click();
      await sweep('step 3 forward', 'Tab');
      await sweep('step 3 backward', 'Shift+Tab');
      await next(page).click();
      await expect(status(page)).toHaveText('Step 4 of 4: Review');
      await sweep('review forward', 'Tab');
      await sweep('review backward', 'Shift+Tab');
      expect(failures).toEqual([]);
    });

    test('an error found at Next leaves the summary and the first bad field clear of the bar', async ({ page }, info) => {
      test.skip(info.project.name !== viewport.project, `${viewport.name} runs in ${viewport.project}`);
      await open(page);
      await next(page).click();
      const summary = form(page).locator('[data-error-summary]');
      await expect(summary).toBeFocused();
      const box = await summary.evaluate((el) => {
        const bar = document.querySelector<HTMLElement>('[data-stepper]');
        const a = el.getBoundingClientRect();
        const b = bar?.getBoundingClientRect() ?? { top: 0, bottom: 0 };
        const stuck = bar !== null && getComputedStyle(bar).position === 'sticky';
        return { top: a.top, barBottom: b.bottom, stuck };
      });
      if (box.stuck) expect(box.top).toBeGreaterThanOrEqual(box.barBottom - 1);
      await summary.getByRole('link', { name: 'Enter your name.' }).click();
      await expect(form(page).locator('#apply-name')).toBeFocused();
      const field = await form(page).locator('#apply-name').evaluate((el) => {
        const bar = document.querySelector<HTMLElement>('[data-stepper]');
        const stuck = bar !== null && getComputedStyle(bar).position === 'sticky';
        return { top: el.getBoundingClientRect().top, barBottom: bar?.getBoundingClientRect().bottom ?? 0, stuck };
      });
      if (field.stuck) expect(field.top).toBeGreaterThanOrEqual(field.barBottom - 1);
    });
  });
}
