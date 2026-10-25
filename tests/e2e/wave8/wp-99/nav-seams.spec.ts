import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow, formatOffenders } from '../../support/overflow.ts';
import { watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// #49 seams, rendered half (the data half is tests/unit/wp-99/seams.test.ts and scripts/lib/wave8/seams.mjs). Navigation from the
// header and the drawer, the home audience strip, the insights desk list, the segment reading list, and one page of every family at
// both viewports. Nothing here skips: a link that points at an unbuilt page is a failure.

const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;

/** Path of a same-site link, without query or fragment; null for an external or non-page target. */
function pagePath(href: string): string | null {
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  const url = new URL(href, 'http://site.invalid');
  if (url.origin !== 'http://site.invalid') return null;
  return url.pathname;
}

async function hrefsIn(page: Page, selector: string): Promise<string[]> {
  return page.locator(`${selector} a[href]`).evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
}

function expectBuilt(hrefs: readonly string[], where: string): void {
  const missing: string[] = [];
  for (const href of hrefs) {
    const path = pagePath(href);
    if (path === null) continue;
    const built = path.endsWith('.txt') || path.endsWith('.xml') || path.endsWith('.json') ? true : isBuilt(path.endsWith('/') ? path : `${path}/`);
    if (!built) missing.push(href);
  }
  expect(missing, `${where}: links to pages that are not built`).toEqual([]);
}

test.describe('desktop header at 1440x900', () => {
  test.use({ viewport: DESKTOP });

  test('every mega panel opens from the keyboard, closes on Escape, returns focus, and lists only built pages', async ({ page, baseURL }) => {
    const record = watch(page, baseURL ?? 'http://localhost');
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    const count = await triggers.count();
    expect(count, 'the header has mega-menu sections').toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const trigger = triggers.nth(i);
      const label = (await trigger.textContent())?.trim() ?? `trigger ${i}`;
      await trigger.focus();
      await page.keyboard.press('Enter');
      const panel = page.locator('[data-mega-panel]:popover-open');
      await expect(panel, `${label}: Enter opens its panel`).toHaveCount(1);
      expectBuilt(await hrefsIn(page, '[data-mega-panel]:popover-open'), `${label} panel`);
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-mega-panel]:popover-open'), `${label}: Escape closes the panel`).toHaveCount(0);
      await expect(trigger, `${label}: focus returns to the trigger`).toBeFocused();
    }
    expect(record.pageErrors, 'uncaught exceptions').toEqual([]);
  });

  test('exactly one primary section is marked as current on a page inside it', async ({ page }) => {
    await page.goto('/insights/');
    const current = page.locator('[data-mega-trigger][aria-current="true"], .mega-nav__link[aria-current]');
    expect(await current.count(), 'sections marked current on /insights/').toBe(1);
  });
});

test.describe('phone drawer at 390x844', () => {
  test.use({ viewport: PHONE });

  test('the Menu button opens the drawer, every link in it is built, and Escape closes it', async ({ page, baseURL }) => {
    const record = watch(page, baseURL ?? 'http://localhost');
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Menu', exact: true });
    await toggle.click();
    await expect(page.locator('[data-mobile-drawer]:popover-open'), 'the drawer opens').toHaveCount(1);
    expectBuilt(await hrefsIn(page, '[data-mobile-drawer]'), 'mobile drawer');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-mobile-drawer]:popover-open'), 'Escape closes the drawer').toHaveCount(0);
    expect(record.pageErrors, 'uncaught exceptions').toEqual([]);
  });
});

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`seams at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('the home audience strip has four links, all built', async ({ page }) => {
      await page.goto('/');
      const hrefs = await hrefsIn(page, 'nav[aria-label="Starting points by audience"]');
      expect(hrefs, 'audience strip links').toHaveLength(4);
      expectBuilt(hrefs, 'home audience strip');
    });

    test('/insights/ lists fourteen desks, each a built topic page', async ({ page }) => {
      await page.goto('/insights/');
      const hrefs = await hrefsIn(page, 'nav[aria-label="Insight desks"]');
      expect(hrefs, 'desk links').toHaveLength(14);
      for (const href of hrefs) expect(href).toMatch(/\/insights\/topic\/[a-z0-9-]+\/$/);
      expectBuilt(hrefs, 'insight desks');
    });

    test('a segment page has a reading list of built pages', async ({ page }) => {
      await page.goto('/founders/solo-founders/');
      const hrefs = await hrefsIn(page, '#seg-reading');
      expect(hrefs.length, 'reading list links on /founders/solo-founders/').toBeGreaterThan(0);
      expectBuilt(hrefs, '/founders/solo-founders/ reading list');
    });
  });
}

const FAMILY_SAMPLES = [
  '/',
  '/founders/',
  '/founders/solo-founders/',
  '/industries/',
  '/compare/',
  '/journey/',
  '/playbooks/',
  '/playbooks/set-up-the-company/',
  '/insights/',
  '/briefs/',
  '/investors/',
  '/network/partners/',
  '/tools/team-composer/',
  '/faq/',
] as const;

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`family samples at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    for (const route of FAMILY_SAMPLES) {
      test(`${route} loads clean and does not overflow`, async ({ page, baseURL }) => {
        expect(isBuilt(route), `${route} must be built`).toBe(true);
        const record = watch(page, baseURL ?? 'http://localhost');
        const response = await page.goto(route);
        expect(response?.status(), `${route} status`).toBe(200);
        const offenders = await findOverflow(page);
        expect(offenders, `${route} overflow: ${formatOffenders(offenders)}`).toEqual([]);
        expect(record.consoleErrors, 'console errors').toEqual([]);
        expect(record.pageErrors, 'uncaught exceptions').toEqual([]);
        expect(record.thirdParty, 'third-party requests').toEqual([]);
      });
    }
  });
}
