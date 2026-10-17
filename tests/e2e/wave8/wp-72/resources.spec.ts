import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-72: the rebuilt Resources hub. It lists only pages that were built, groups them by stage and by kind, and every card leads to a page
// that answers. The project sets the viewport: 1440x900 and 390x844.

const ROUTE = '/resources/';

test.describe('resources hub', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), 'the resources route is not built');
  });

  test('one h1, a start-where-you-are path and an everything-by-kind list, in heading order', async ({ page, baseURL }) => {
    const guard = watch(page, baseURL ?? '');
    await page.goto(ROUTE);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Resources');
    await expect(page.locator('main h2').first()).toHaveText('Start where you are');
    await expect(page.locator('main h2', { hasText: 'Everything, by kind' })).toHaveCount(1);
    // No heading level is skipped: every card title is an h4 under a group h3 under a section h2.
    const levels = await page.locator('main :is(h2, h3, h4)').evaluateAll((nodes) => nodes.map((n) => Number(n.tagName.slice(1))));
    levels.reduce((previous, level) => {
      expect(level - previous, `heading level ${level} follows ${previous}`).toBeLessThanOrEqual(1);
      return level;
    }, 2);
    expect(guard.consoleErrors).toEqual([]);
    expect(guard.pageErrors).toEqual([]);
    expect(guard.thirdParty).toEqual([]);
  });

  test('every group is named, and no card is empty', async ({ page }) => {
    await page.goto(ROUTE);
    const groups = page.locator('main [role="group"]');
    expect(await groups.count()).toBeGreaterThan(0);
    for (const group of await groups.all()) await expect(group).toHaveAccessibleName(/\S/);
    // One read for every card: an assertion per card is a round trip per card, and 115 of them outran the timeout on a busy runner.
    const empty = await groups.evaluateAll((nodes) =>
      nodes.flatMap((group, g) => [...group.querySelectorAll('li')].flatMap((card, c) => (card.querySelectorAll('a').length === 1 ? [] : [`group ${g + 1}, card ${c + 1}: ${card.querySelectorAll('a').length} links`]))),
    );
    expect(empty, 'cards without exactly one link').toEqual([]);
  });

  test('every card link resolves to a built page', async ({ page, request }) => {
    await page.goto(ROUTE);
    const hrefs = await page.locator('main a.card__link').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of new Set(hrefs)) {
      expect(href.startsWith('/'), `${href} is a site link`).toBe(true);
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });

  test('the stage path never lists a page twice, and a card is titled as the page it opens', async ({ page }) => {
    await page.goto(ROUTE);
    const links = page.locator('main section[aria-labelledby="resources-stage"] a.card__link');
    const cards = await links.evaluateAll((nodes) => nodes.map((a) => ({ href: (a as HTMLAnchorElement).getAttribute('href') ?? '', title: a.textContent?.trim() ?? '' })));
    expect(new Set(cards.map((c) => c.href)).size).toBe(cards.length);
    for (const card of cards.slice(0, 3)) {
      await page.goto(card.href);
      const opened = await page.evaluate(() => ({ heading: document.querySelector('h1')?.textContent?.trim() ?? '', title: document.title }));
      expect(opened.heading === card.title || opened.title.includes(card.title), `${card.href} is titled "${opened.heading}", the card says "${card.title}"`).toBe(true);
    }
  });

  test('the funding disclaimer sits with the raise stage', async ({ page }) => {
    await page.goto(ROUTE);
    const raise = page.locator('main [role="group"]', { has: page.getByRole('heading', { name: 'When you prepare to raise' }) });
    if ((await raise.count()) === 0) return;
    await expect(raise.getByText('WE makes no promise of funding.')).toBeVisible();
  });

  test('the page has no horizontal overflow and no stated duration or promise', async ({ page }) => {
    await page.goto(ROUTE);
    expect(await findOverflow(page)).toEqual([]);
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\b\d+\s*[-–]?\s*(?:days?|weeks?|months?)\b/i);
    expect(text).not.toMatch(/\b(?:free of charge|no fee|no equity|success fee|guaranteed)\b/i);
  });
});
