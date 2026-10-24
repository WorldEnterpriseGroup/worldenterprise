import { expect, test } from '@playwright/test';
import { AUDIENCE_LINKS } from '../../../../src/data/cta/audiences.ts';
import { DESK_DEFINITIONS } from '../../../../src/data/desks.ts';
import { SEGMENTS } from '../../../../src/data/families.ts';
import { isOnSite, requireBuilt } from './presence.ts';

// WP-62, acceptance: the home page, the founders hub and the insights hub. The home page has an audience band directly under the hero with
// one door per live audience page; the founders hub lists the segment pages that are built and no others; the insights hub copy names the
// 14 desks. The checks use the page as it is delivered, so they hold with JavaScript off as well.

/** The pathname of a link with any preview base path taken off, compared with the ledger path it points at. */
const pointsAt = (href: string, path: string): boolean => new URL(href, 'http://localhost').pathname.endsWith(path);

function suite(): void {
  test('home: the audience band sits between the hero and the journey band, with one door for each audience page that is built', async ({ page }) => {
    requireBuilt('/');
    const open = AUDIENCE_LINKS.filter((link) => isOnSite(link.href));
    await page.goto('/');
    const band = page.locator('section[aria-labelledby="home-audience"]');
    if (open.length < 2) {
      await expect(band, 'fewer than two doors are open, so the band is not drawn').toHaveCount(0);
      return;
    }
    await expect(band).toHaveCount(1);
    await expect(band.getByRole('heading', { level: 2 })).toHaveText('Choose where to start');
    const hrefs = await band.locator('a').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length, 'two to four doors').toBeGreaterThanOrEqual(2);
    expect(hrefs.length).toBeLessThanOrEqual(4);
    expect(hrefs.length, 'one link for each audience page that is built').toBe(open.length);
    for (const link of open) expect(hrefs.some((href) => pointsAt(href, link.href)), `a door to ${link.href}`).toBe(true);

    const heroBottom = (await page.locator('h1').first().boundingBox())?.y ?? -1;
    const bandTop = (await band.boundingBox())?.y ?? -1;
    const nextTop = (await page.locator('section[aria-labelledby="home-journey"]').boundingBox())?.y ?? -1;
    expect(bandTop, 'the band is below the hero heading').toBeGreaterThan(heroBottom);
    expect(nextTop, 'the band is above the journey band').toBeGreaterThan(bandTop);
  });

  test('home: one closing band (the wave 9 band, W9-13) and no second band from the CTA system', async ({ page }) => {
    requireBuilt('/');
    await page.goto('/');
    await expect(page.locator('section[aria-labelledby="home-end-title"]')).toHaveCount(1);
    await expect(page.locator('[data-cta]')).toHaveCount(0);
    await expect(page.getByText('Ready to test your idea?')).toHaveCount(0);
  });

  test('home: the insights row names the desks, and links the desks whose page is built', async ({ page }) => {
    requireBuilt('/');
    await page.goto('/');
    const row = page.locator('section[aria-labelledby="home-insights"]');
    if ((await row.count()) === 0) return;
    const links = await row.locator('nav[aria-label="Insight desks"] a').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    const expected = DESK_DEFINITIONS.filter((desk) => isOnSite(`/insights/topic/${desk.id}/`));
    expect(links.length, 'one link for each desk page that is built').toBe(expected.length);
    for (const desk of expected) expect(links.some((href) => pointsAt(href, `/insights/topic/${desk.id}/`)), `a link to the ${desk.name} desk`).toBe(true);
  });

  test('founders hub: the segment pages that are built are listed, and no others', async ({ page }) => {
    requireBuilt('/founders/');
    await page.goto('/founders/');
    const expected = SEGMENTS.entries.filter((entry) => entry.launch && isOnSite(entry.path));
    const heading = page.locator('h2#segments-title');
    if (expected.length === 0) {
      await expect(heading, 'no segment page is built, so no heading over an empty list').toHaveCount(0);
      return;
    }
    await expect(heading).toHaveText('Find the path that fits you');
    const hrefs = await page.locator('.segments a').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length, 'one entry for each built segment').toBe(expected.length);
    for (const entry of expected) expect(hrefs.some((href) => pointsAt(href, entry.path)), `an entry for ${entry.path}`).toBe(true);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('[data-cta="end"]'), 'the hub ends with one band from the CTA system').toHaveCount(1);
    await expect(page.getByText('Ready to describe your company?')).toHaveCount(0);
  });

  test('insights hub: the copy names all 14 desks', async ({ page }) => {
    requireBuilt('/insights/');
    await page.goto('/insights/');
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(DESK_DEFINITIONS).toHaveLength(14);
    for (const desk of DESK_DEFINITIONS) expect(text, `the insights hub names the ${desk.name} desk`).toContain(desk.name);
  });
}

test.describe('with JavaScript', () => {
  suite();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  suite();
});
