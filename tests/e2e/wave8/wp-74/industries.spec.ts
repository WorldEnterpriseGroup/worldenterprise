import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-74: the seven industry pages and the /industries/ hub. Runs at 1440 and at 390 (projects wave8-desktop and wave8-mobile).

const VERTICALS = ['fintech', 'healthtech', 'edtech', 'climate-tech', 'legaltech', 'logistics', 'proptech'] as const;
const HUB = '/industries/';
const SEAT_SCOPE_HEADING = "What WE's teams can and cannot build";
const TEMPLATE_H2 = ['Who buys and who decides', 'The regulatory and standards perimeter', 'Questions about data handling', 'The sales cycle'];

for (const slug of VERTICALS) {
  const route = `/industries/${slug}/`;

  test.describe(route, () => {
    test.beforeEach(() => {
      test.skip(!isBuilt(route), `${route} is not built`);
    });

    test('one h1, the template sections in order, the seat scope and no skipped heading level', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      const headings = await page.locator('main h2, main h3').evaluateAll((els) => els.map((el) => ({ level: Number(el.tagName.slice(1)), text: (el.textContent ?? '').trim() })));
      const h2 = headings.filter((h) => h.level === 2).map((h) => h.text);
      expect(h2).toEqual(expect.arrayContaining([...TEMPLATE_H2, 'Sources', SEAT_SCOPE_HEADING]));
      const order = TEMPLATE_H2.map((text) => h2.indexOf(text));
      expect(order, 'sections appear in the template order').toEqual([...order].sort((a, b) => a - b));
      let previous = 1;
      for (const heading of headings) {
        expect(heading.level - previous, `${heading.text} skips a level`).toBeLessThanOrEqual(1);
        previous = heading.level;
      }
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });

    test('each perimeter item shows its jurisdiction, the date it was read and a numbered link to a government or standards source', async ({ page }) => {
      await page.goto(route);
      const perimeter = page.locator('main section', { has: page.getByRole('heading', { name: 'The regulatory and standards perimeter' }) });
      // The perimeter links point into the Sources list on the same page; each target is a government or standards source.
      const links = perimeter.locator('a[href^="#source-"]');
      const count = await links.count();
      expect(count).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < count; i += 1) {
        const link = links.nth(i);
        await expect(link).toHaveText(/^Source \d+:/);
        const anchor = ((await link.getAttribute('href')) ?? '').slice(1);
        const external = page.locator(`li[id="${anchor}"] a[href^="https://"]`);
        await expect(external, `${anchor} lists its source`).toHaveCount(1);
        const host = new URL((await external.getAttribute('href')) ?? '').hostname;
        expect(host, 'a primary source host').toMatch(/(?:\.gov|\.europa\.eu|law\.cornell\.edu)$/);
      }
      await expect(perimeter).toContainText(/As of /);
    });

    test('the seat scope names the five limits and the page claims no certification, price or client', async ({ page }) => {
      await page.goto(route);
      const scope = page.locator('section.seat-scope');
      await expect(scope).toHaveCount(1);
      await expect(scope.locator('li')).toHaveCount(7);
      await expect(scope).toContainText('does not run a live service');
      await expect(scope).toContainText('does not store or process restricted or regulated data');
      await expect(scope).toContainText('no assurance');
      await expect(scope).toContainText('does not give legal, tax, accounting, insurance or compliance advice');
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      expect(text).not.toMatch(/[$€£]|%/);
      expect(text).not.toMatch(/\b(?:success fee|no fee|no equity|free of charge)\b/i);
    });

    test('the page reads the same with JavaScript off', async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const page = await context.newPage();
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('section.seat-scope li')).toHaveCount(7);
      await context.close();
    });

    test('axe finds no violation and no touch target is under 24 pixels', async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations).toEqual([]);
      const small = await page.locator('main a, main button').evaluateAll((els) =>
        els
          .map((el) => ({ el, box: el.getBoundingClientRect(), inline: getComputedStyle(el).display === 'inline' }))
          .filter(({ box, inline }) => box.width > 0 && !inline && (box.width < 24 || box.height < 24))
          .map(({ el }) => (el.textContent ?? '').trim()),
      );
      expect(small, 'targets under 24x24').toEqual([]);
    });
  });
}

test.describe(HUB, () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(HUB), `${HUB} is not built`);
  });

  test('the hub has one h1, lists the seven industries in registry order and carries the seat scope', async ({ page, baseURL }) => {
    const seen = watch(page, baseURL ?? '');
    await page.goto(HUB);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Industry considerations');
    const hrefs = await page.locator('main a[href^="/industries/"]').evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
    const listed = VERTICALS.map((slug) => hrefs.indexOf(`/industries/${slug}/`));
    for (const [i, index] of listed.entries()) expect(index, `${VERTICALS[i]} is linked from the hub`).toBeGreaterThanOrEqual(0);
    expect(listed, 'the registry order').toEqual([...listed].sort((a, b) => a - b));
    await expect(page.locator('section.seat-scope li')).toHaveCount(7);
    expect(seen.consoleErrors).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.thirdParty).toEqual([]);
  });

  test('axe finds no violation on the hub', async ({ page }) => {
    await page.goto(HUB);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
