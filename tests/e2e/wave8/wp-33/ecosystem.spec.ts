import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, SMALLEST_PHONE, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';

// WP-33 (issue #82): /ecosystem/, the directory of outside programs founders are encouraged to join, and its eight category pages.
// The hub renders the whole directory as plain HTML; <we-ecosystem-filter> narrows it with JavaScript and says how many programs match
// in a live region; without JavaScript the category pages and anchors carry the task.
// Issue #93: each category previews three compact rows and keeps its full list in a native <details>, so the hub stays near the
// length of the home page on a phone (it was 55,192 px at 390 px) while every program, anchor and filter hook stays in the DOM.

const CATEGORIES = ['launch-programs', 'incubators', 'university', 'coworking', 'angels', 'sba', 'government', 'communities'] as const;
const ROUTES: readonly string[] = ['/ecosystem/', ...CATEGORIES.map((c) => `/ecosystem/${c}/`)];
const MIN_ENTRIES = 60;
const PREVIEW = 3;
/** The hub at 390 px measured 20,052 px after issue #93 (55,192 before; the home page is 21,655). */
const PHONE_HEIGHT_BUDGET = 24_000;

const desktopOnly = (name: string): boolean => name !== 'wave8-desktop-1440x900';

test.describe('the ecosystem pages', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const route of ROUTES) {
    test(`${route} has one heading, named drawings, marked external links and no axe violations`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      // The hub renders all 60+ programs at once; axe over that DOM outlasts the 45 s default on the CPU-starved runner.
      if (route === '/ecosystem/') test.setTimeout(90_000);
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll('main svg[role="img"]')].filter((svg) =>
          (svg.getAttribute('aria-labelledby') ?? '').split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? '').trim() === ''),
        ).length,
      );
      expect(unnamed, 'every drawing is named').toBe(0);
      const external = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="http"]')]
          .filter((a) => new URL(a.href).origin !== location.origin)
          .filter((a) => !(a.getAttribute('rel') ?? '').split(/\s+/).includes('noopener')).length,
      );
      expect(external, 'every external link carries rel="noopener"').toBe(0);
      await expect(page.locator('main')).toContainText('no affiliation implied');
      await expectNoHorizontalScroll(page);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty, 'the page contacts only the site').toEqual([]);
    });
  }

  test('the hub lists every program and links all eight category pages', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    expect(await page.locator('[data-eco-row]').count()).toBeGreaterThanOrEqual(MIN_ENTRIES);
    for (const c of CATEGORIES) await expect(page.locator(`main a[href$="/ecosystem/${c}/"]`).first()).toBeAttached();
    await expect(page.getByRole('link', { name: 'Start a readiness review' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Talk to WE' }).first()).toBeVisible();
    await expect(page.locator('main')).toContainText('Join them. WE works alongside, for the long run.');
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  });

  test('each category previews three compact rows and folds its full list into a native disclosure', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const groups = page.locator('[data-eco-group]');
    await expect(groups).toHaveCount(CATEGORIES.length);
    for (const c of CATEGORIES) {
      const group = page.locator(`#group-${c}`);
      const all = group.locator('details[data-eco-more]');
      const rows = all.locator('[data-eco-row]');
      const n = await rows.count();
      expect(n, `${c}: more programs than the preview`).toBeGreaterThan(PREVIEW);
      await expect(group.getByRole('heading', { level: 3 })).toContainText(`(${n})`);
      await expect(all).not.toHaveAttribute('open', '');
      await expect(all.locator('summary')).toHaveText(new RegExp(`^All ${n} `));
      const preview = group.locator('[data-eco-preview] .eco-row');
      await expect(preview).toHaveCount(PREVIEW);
      await expect(preview.first()).toBeVisible();
      await expect(preview.locator('dl')).toHaveCount(0);
      await expect(group.locator('[data-eco-preview] [data-eco-row]')).toHaveCount(0);
      await expect(rows.first()).toBeHidden();
      await expect(group.locator(`a[href$="/ecosystem/${c}/"]`).first()).toBeVisible();
    }
    const coworking = page.locator('#group-coworking details[data-eco-more]');
    await coworking.locator('summary').click();
    await expect(coworking).toHaveAttribute('open', '');
    for (const row of await coworking.locator('[data-eco-row]').all()) {
      await expect(row).toBeVisible();
      await expect(row.locator('dl')).toBeAttached();
    }
  });

  test('the "How to choose" table sits in a focusable, named scroll region', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const frame = page.getByRole('region', { name: 'Table: how to choose a kind of program' });
    await expect(frame).toHaveClass(/\btable-wrap\b/);
    await expect(frame).toHaveAttribute('tabindex', '0');
    await expect(frame.locator('table')).toHaveCount(1);
    await frame.focus();
    await expect(frame).toBeFocused();
  });

  test('a link to a program inside a folded list opens the list, on load and on hashchange', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const deep = page.locator('#group-angels details[data-eco-more] [data-eco-row]').nth(PREVIEW + 1).locator('[id^="p-"]');
    const id = await deep.getAttribute('id');
    expect(id).not.toBeNull();
    await page.goto(`/ecosystem/#${id}`);
    await expect(page.locator('#group-angels details[data-eco-more]')).toHaveAttribute('open', '');
    await expect(page.locator(`#${id}`)).toBeInViewport();

    const other = page.locator('#group-sba details[data-eco-more]');
    const target = await other.locator('[data-eco-row]').last().locator('[id^="p-"]').getAttribute('id');
    expect(target).not.toBeNull();
    await expect(other).not.toHaveAttribute('open', '');
    await page.evaluate((hash) => {
      location.hash = hash;
    }, `#${target}`);
    await expect(other).toHaveAttribute('open', '');
    await expect(page.locator(`#${target}`)).toBeInViewport();
  });

  test('the filter narrows the directory, announces the count and clears', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const form = page.getByRole('search', { name: 'Filter the directory' });
    await expect(form).toBeVisible();
    const total = await page.locator('[data-eco-row]').count();
    const status = page.locator('[data-eco-status]');
    await expect(status).toHaveText(`Showing all ${total} programs.`);
    await expect(status).toHaveAttribute('aria-live', 'polite');

    await form.getByLabel('Kind of program', { exact: true }).selectOption('coworking');
    const shown = page.locator('[data-eco-row]:not([hidden])');
    const n = await shown.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(total);
    await expect(status).toHaveText(`Showing ${n} of ${total} programs.`);
    for (const row of await shown.all()) {
      await expect(row).toHaveAttribute('data-category', 'coworking');
      await expect(row).toBeVisible();
    }
    await expect(page.locator('[data-eco-group]:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#group-coworking details[data-eco-more]')).toHaveAttribute('open', '');
    await expect(page.locator('#group-coworking [data-eco-preview]')).toBeHidden();

    await form.getByLabel('Built for', { exact: true }).selectOption('women');
    await expect(status).toHaveText('No program matches those choices. Clear a filter to see more.');
    await expect(page.locator('[data-eco-empty]')).toBeVisible();

    await form.getByRole('button', { name: 'Clear filters' }).click();
    await expect(status).toHaveText(`Showing all ${total} programs.`);
    await expect(page.locator('[data-eco-row]:not([hidden])')).toHaveCount(total);
    // The lists the filter opened fold again, and the previews come back.
    await expect(page.locator('details[data-eco-more][open]')).toHaveCount(0);
    await expect(page.locator('#group-coworking [data-eco-preview]')).toBeVisible();
  });

  test('a list the reader opened stays open when the filters clear', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const incubators = page.locator('#group-incubators details[data-eco-more]');
    await incubators.locator('summary').click();
    await expect(incubators).toHaveAttribute('open', '');
    const form = page.getByRole('search', { name: 'Filter the directory' });
    await form.getByLabel('Has an online option', { exact: true }).check();
    await expect(page.locator('[data-eco-group]:not([hidden]) details[data-eco-more]:not([open])')).toHaveCount(0);
    await form.getByRole('button', { name: 'Clear filters' }).click();
    await expect(incubators).toHaveAttribute('open', '');
    await expect(page.locator('details[data-eco-more][open]')).toHaveCount(1);
  });

  test('the filter works from the keyboard', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const select = page.getByLabel('Stage of company', { exact: true });
    await select.focus();
    await select.selectOption('scale');
    const total = await page.locator('[data-eco-row]').count();
    expect(await page.locator('[data-eco-row]:not([hidden])').count()).toBeLessThan(total);
    await page.getByLabel('Has an online option', { exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel('Has an online option', { exact: true })).toBeChecked();
    const rows = await page.locator('[data-eco-row]:not([hidden])').all();
    for (const row of rows) {
      await expect(row).toHaveAttribute('data-remote', 'yes');
      await expect(row).toBeVisible();
    }
  });

  test('a category page lists its programs with source lines and links back to the others', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/sba/'), 'not built');
    await page.goto('/ecosystem/sba/');
    const rows = page.locator('[data-eco-row]');
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    for (const row of await rows.all()) {
      await expect(row.locator('a[rel~="noopener"]').first()).toBeAttached();
      await expect(row).toContainText('retrieved October 2026');
    }
    await expect(page.locator('main a[href$="/ecosystem/launch-programs/"]').first()).toBeAttached();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the no-script pass runs once, in the desktop wave 8 project');
  });

  test('the hub holds the whole directory behind native disclosures, the drawings and no filter form', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    const rows = page.locator('[data-eco-row]');
    expect(await rows.count()).toBeGreaterThanOrEqual(MIN_ENTRIES);
    await expect(page.locator('[data-eco-preview] .eco-row').first()).toBeVisible();
    // <details> needs no script: opening every list shows every program.
    for (const summary of await page.locator('details[data-eco-more] > summary').all()) await summary.click();
    for (const row of await rows.all()) await expect(row).toBeVisible();
    await expect(page.locator('[data-eco-status]')).toHaveCount(0);
    expect(await page.locator('main svg[role="img"]').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('main svg[role="img"]').first()).toBeVisible();
  });

  test('the category links and anchors work with no script', async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    await page.locator('main a[href$="/ecosystem/incubators/"]').first().click();
    await expect(page).toHaveURL(/\/ecosystem\/incubators\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Incubators');
    await page.goto('/ecosystem/#group-coworking');
    await expect(page.locator('#group-coworking')).toBeInViewport();
  });
});

test.describe('at a 390px phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the height budget runs once, in the desktop wave 8 project');
  });

  test(`/ecosystem/ stays under ${PHONE_HEIGHT_BUDGET} px tall`, async ({ page }) => {
    test.skip(!isBuilt('/ecosystem/'), 'not built');
    await page.goto('/ecosystem/');
    await page.evaluate(() => document.fonts.ready);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height, `the hub is ${height} px tall at 390 px`).toBeLessThan(PHONE_HEIGHT_BUDGET);
  });
});

test.describe('at the smallest phone', () => {
  test.use({ viewport: SMALLEST_PHONE, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'the 320px pass runs once, in the desktop wave 8 project');
  });

  for (const route of ROUTES) {
    test(`${route} never scrolls sideways at 320px`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe('at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(desktopOnly(info.project.name), 'width checks run once, in the desktop wave 8 project');
  });

  for (const route of ROUTES) {
    test(`${route} fills the frame and its bands run full bleed`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      if (route === '/ecosystem/') expect(await expectBandsFullBleed(page)).toBeGreaterThan(0);
    });
  }
});
