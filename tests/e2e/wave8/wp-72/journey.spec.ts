import { expect, test } from '@playwright/test';
import { PROGRAM_STEPS } from '../../../../src/components/program/steps.ts';
import { findOverflow } from '../../support/overflow.ts';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-72: the four customer-journey pages. They are a sequence with no durations; the program's five step titles appear in order; each
// page links forward and the links answer. They render through the WP-71 family template, so a route that is not built is skipped.
// The project sets the viewport: 1440x900 and 390x844.

const PAGES = ['/journey/', '/journey/after-you-apply/', '/journey/first-months/', '/journey/onboarding-checklist/'] as const;
const FORWARD: Readonly<Record<string, string>> = {
  '/journey/': '/journey/after-you-apply/',
  '/journey/after-you-apply/': '/journey/first-months/',
  '/journey/first-months/': '/journey/onboarding-checklist/',
  '/journey/onboarding-checklist/': '/tools/',
};
const DURATION = /\b\d+\s*[-–]?\s*(?:hours?|days?|weeks?|months?|quarters?|years?)\b|\b30\s*[/-]\s*60\s*[/-]\s*90\b/i;
const PROMISE = /\b(?:free of charge|no fee|no equity|success fee|guaranteed|perks?|accelerator|cohort|mentors?)\b/i;

for (const route of PAGES) {
  test.describe(`journey page ${route}`, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(route), `${route} is not built (the family template has not merged)`);
    });

    test('one h1, no console errors, no third-party request, no horizontal overflow', async ({ page, baseURL }) => {
      const guard = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(guard.consoleErrors).toEqual([]);
      expect(guard.pageErrors).toEqual([]);
      expect(guard.thirdParty).toEqual([]);
      expect(await findOverflow(page)).toEqual([]);
    });

    test('states no duration and makes no promise', async ({ page }) => {
      await page.goto(route);
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      expect(text).not.toMatch(DURATION);
      expect(text).not.toMatch(PROMISE);
    });

    test('links forward, and every link in the page answers', async ({ page, request }) => {
      await page.goto(route);
      const hrefs = await page.locator('main a[href^="/"]').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
      expect(hrefs, `${route} links to ${FORWARD[route]}`).toContain(FORWARD[route]);
      for (const href of new Set(hrefs.map((h) => h.replace(/#.*$/, '')).filter((h) => h !== ''))) {
        const response = await request.get(href);
        expect(response.status(), href).toBe(200);
      }
    });
  });
}

test.describe('the five steps and the walk', () => {
  test('first-months shows the program step titles in order', async ({ page }) => {
    test.skip(!isBuilt('/journey/first-months/'), 'not built');
    await page.goto('/journey/first-months/');
    const headings = await page.locator('main :is(h2, h3)').allTextContents();
    let at = -1;
    for (const step of PROGRAM_STEPS) {
      const next = headings.findIndex((text, index) => index > at && text.trim() === step.title);
      expect(next, `${step.title} appears after the previous step title`).toBeGreaterThan(at);
      at = next;
    }
  });

  test('the whole journey is walked by clicking the forward link, with no goto after the first page', async ({ page }) => {
    test.skip(!PAGES.every((route) => isBuilt(route)), 'the journey is not fully built');
    await page.goto('/journey/');
    for (const route of PAGES) {
      await expect(page).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}$`));
      const target = FORWARD[route] ?? '';
      if (route === PAGES[PAGES.length - 1]) break;
      await page.locator(`main a[href="${target}"]`).first().click();
    }
  });

  test('the onboarding checklist lists its items as a list, and each linked item opens a page', async ({ page, request }) => {
    test.skip(!isBuilt('/journey/onboarding-checklist/'), 'not built');
    await page.goto('/journey/onboarding-checklist/');
    const items = page.locator('main li');
    expect(await items.count()).toBeGreaterThanOrEqual(8);
    const hrefs = await page.locator('main li a[href^="/"]').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    for (const href of new Set(hrefs)) expect((await request.get(href)).status(), href).toBe(200);
  });
});
