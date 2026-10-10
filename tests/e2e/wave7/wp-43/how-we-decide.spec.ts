import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-43: /program/how-we-decide/, the "What WE reads" aside on /apply/ and the cross-link on /contact/. Runs at 1440 and at 390.

const ROUTE = '/program/how-we-decide/';

test.beforeEach(() => {
  test.skip(!isBuilt(ROUTE), `${ROUTE} is not built`);
});

test('one h1, the five sections in order, and no skipped heading level', async ({ page, baseURL }) => {
  const seen = watch(page, baseURL ?? '');
  await page.goto(ROUTE);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('How WE decides');
  const headings = await page.locator('main h2, main h3').evaluateAll((els) => els.map((el) => ({ level: Number(el.tagName.slice(1)), text: (el.textContent ?? '').trim() })));
  const h2 = headings.filter((h) => h.level === 2).map((h) => h.text);
  expect(h2).toEqual(expect.arrayContaining(['How an application is read', 'You are a good fit if', 'WE is probably not the right fit if', 'What you can send', 'What a clear no looks like', 'What WE does not decide']));
  const order = ['How an application is read', 'You are a good fit if', 'What you can send', 'What a clear no looks like', 'What WE does not decide'].map((text) => h2.indexOf(text));
  expect(order, 'sections appear in the planned order').toEqual([...order].sort((a, b) => a - b));
  let previous = 1;
  for (const heading of headings) {
    expect(heading.level - previous, `${heading.text} skips a level`).toBeLessThanOrEqual(1);
    previous = heading.level;
  }
  expect(seen.consoleErrors).toEqual([]);
  expect(seen.pageErrors).toEqual([]);
});

test('the fit lists render exactly as /program/who-its-for/ renders them', async ({ page }) => {
  test.skip(!isBuilt('/program/who-its-for/'), '/program/who-its-for/ is not built');
  const lists = async (route: string): Promise<{ fits: string[]; notFits: string[] }> => {
    await page.goto(route);
    const fits = await page.locator('main ul.fit li').allInnerTexts();
    const notFits = await page.locator('main section.limits li').allInnerTexts();
    return { fits, notFits };
  };
  const decide = await lists(ROUTE);
  const who = await lists('/program/who-its-for/');
  expect(decide.fits).toHaveLength(5);
  expect(decide.notFits).toHaveLength(5);
  expect(decide.fits).toEqual(who.fits);
  expect(decide.notFits).toEqual(who.notFits);
});

test('"What you can send" lists the form fields under the words the form uses', async ({ page }) => {
  test.skip(!isBuilt('/apply/'), '/apply/ is not built');
  await page.goto('/apply/');
  const labels: string[] = [];
  for (const id of ['apply-name', 'apply-email', 'apply-company', 'apply-stage', 'apply-message', 'apply-seats', 'apply-package']) {
    const text = (await page.locator(`label[for="${id}"]`).first().innerText()).replace(/\s*\(required\)\s*$/, '').trim();
    labels.push(text);
  }
  await page.goto(ROUTE);
  const terms = await page.locator('main dl.decide-send dt').allInnerTexts();
  for (const label of labels) expect(terms, `the form asks "${label}"`).toContain(label);
  const stages = await page.locator('main dl.decide-send li').allInnerTexts();
  expect(stages).toEqual(expect.arrayContaining(['Validating the problem with customers', 'Building the first version']));
});

test('states no funding promise, names no time, count, price or fee, and keeps Investor Introductions off the page', async ({ page }) => {
  await page.goto(ROUTE);
  // The page body: the slot of StageLayout, without the hero, the closing band and the next-reading cards.
  // The step numbers are decoration (aria-hidden, 1 to 3), so the digit check reads the copy without them.
  const text = await page.locator('main .section > .container').first().evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.steps__index').forEach((index) => index.remove());
    return copy.innerText ?? copy.textContent ?? '';
  });
  expect(text).toContain('WE makes no promise of funding.');
  expect(text).toContain('WE does not state a response time on this site.');
  expect(text).not.toMatch(/\d/);
  expect(text).not.toMatch(/[$€£%]/);
  expect(text).not.toMatch(/\b(within|guarantee[sd]?|free of charge|no fee|no equity|no cost|for free|Investor Introductions|Demo Day)\b/i);
});

test('the links resolve and the call to action goes to the form', async ({ page, request }) => {
  await page.goto(ROUTE);
  const hrefs = await page.locator('main a[href^="/"]').evaluateAll((els) => [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))]);
  expect(hrefs).toEqual(expect.arrayContaining(['/apply/', '/program/how-it-works/', '/program/who-its-for/']));
  for (const href of hrefs.filter((h) => !h.includes('#'))) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
  await page.getByRole('link', { name: 'Apply to the program' }).first().click();
  await expect(page).toHaveURL(/\/apply\/$/);
});

test('has its own canonical URL, and no horizontal scroll at this width', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/program\/how-we-decide\/$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('axe finds nothing at WCAG 2.2 AA', async ({ page }) => {
  await page.goto(ROUTE);
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});

test('/apply/ links the page from "What WE reads", and /contact/ links it too', async ({ page }) => {
  for (const route of ['/apply/', '/contact/']) {
    test.skip(!isBuilt(route), `${route} is not built`);
    await page.goto(route);
    const link = page.locator('aside a', { hasText: 'How WE decides' }).first();
    await expect(link).toHaveAttribute('href', ROUTE);
  }
  await page.goto('/apply/');
  await expect(page.locator('aside h2', { hasText: 'What WE reads' })).toBeVisible();
  await page.locator('aside a', { hasText: 'How WE decides' }).first().click();
  await expect(page).toHaveURL(/\/program\/how-we-decide\/$/);
  await expect(page.locator('h1')).toHaveText('How WE decides');
});
