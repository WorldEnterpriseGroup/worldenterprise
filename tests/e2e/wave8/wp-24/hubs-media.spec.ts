import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { AXE_TAGS } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, expectFullWidth, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';

// WP-24 (issue #90): media density on the hubs and tools. Every hub shows its moments (data-media-id, data-moment) in page order,
// the first two early on the page, each a captioned and credited figure; the page never scrolls sideways at 390, 1440 or 1920; with
// scripts off every moment and every filter item is still there; and the filters work from the keyboard (Tab into the radio group,
// arrow keys to choose, only the matching items stay). The routes and ids mirror HUB_MOMENTS in src/components/hubs/moments.ts.

interface Hub {
  readonly path: string;
  readonly moments: readonly string[];
  /** How many different kinds of moment the hub shows. */
  readonly kinds: number;
}

const HUBS: readonly Hub[] = [
  { path: '/insights/', moments: ['hub-insights-sky', 'hub-insights-clock', 'hub-insights-desks', 'hub-insights-reading'], kinds: 4 },
  { path: '/insights/topic/ai/', moments: ['hub-topic-sky', 'hub-topic-reading'], kinds: 2 },
  { path: '/tools/', moments: ['hub-tools-map', 'hub-tools-cards'], kinds: 2 },
  { path: '/library/', moments: ['hub-library-shelf', 'hub-library-anatomy', 'hub-library-cards'], kinds: 3 },
  { path: '/resources/', moments: ['hub-resources-matrix', 'hub-resources-formation'], kinds: 2 },
  { path: '/industries/', moments: ['hub-industries-orbit', 'hub-industries-survival', 'hub-industries-swarm'], kinds: 3 },
  { path: '/compare/', moments: ['hub-compare-horizon', 'hub-compare-odds'], kinds: 2 },
  { path: '/journey/', moments: ['hub-journey-loop', 'hub-journey-hold'], kinds: 2 },
  { path: '/founders/', moments: ['hub-founders-age', 'hub-founders-figures', 'hub-founders-situations'], kinds: 3 },
  { path: '/investors/', moments: ['hub-investors-gaps', 'hub-investors-dilution', 'hub-investors-figures'], kinds: 2 },
  { path: '/faq/', moments: ['hub-faq-map', 'hub-faq-figures'], kinds: 2 },
];

const TOOLS = ['runway-calculator', 'metrics-calculator', 'cap-table-explainer', 'evidence-room', 'pricing-page-checker', 'team-composer'];

interface Filter {
  readonly path: string;
  readonly id: string;
}

const FILTERS: readonly Filter[] = [
  { path: '/insights/', id: 'desk-filter' },
  { path: '/tools/', id: 'tool-filter' },
  { path: '/library/', id: 'kind-filter' },
  { path: '/resources/', id: 'stage-filter' },
];

const isDesktop = (info: TestInfo): boolean => info.project.name === 'wave8-desktop-1440x900';

function axeList(violations: readonly { id: string; nodes: readonly { target: readonly unknown[] }[] }[]): string[] {
  return violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** The media ids on the page, in document order. */
async function mediaIds(page: Page): Promise<string[]> {
  return page.locator('main [data-media-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-media-id') ?? ''));
}

/** How many items of a filter are rendered (not display: none). */
async function shownItems(page: Page, filter: string): Promise<number> {
  return page.locator(`#${filter} .fi-item`).evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== 'none').length);
}

for (const hub of HUBS) {
  test.describe(`media on ${hub.path}`, () => {
    test.use({ reducedMotion: 'reduce' });
    test.beforeEach(() => {
      test.skip(!isBuilt(hub.path), `${hub.path} is not built`);
    });

    test('shows its moments in order, early, captioned and of several kinds', async ({ page }) => {
      await page.goto(hub.path);
      const ids = await mediaIds(page);
      expect(ids.filter((id) => hub.moments.includes(id)), 'moments in page order').toEqual([...hub.moments]);
      expect(new Set(ids).size, 'media ids are unique on the page').toBe(ids.length);

      const kinds = await page.locator('main [data-moment]').evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-moment')))]);
      expect(kinds.length, `kinds: ${kinds.join(', ')}`).toBeGreaterThanOrEqual(hub.kinds);

      // The first two moments open by the end of the first section after the fold: within three screens of the top.
      const screen = page.viewportSize()?.height ?? 900;
      for (const id of hub.moments.slice(0, 2)) {
        const top = await page.locator(`[data-media-id="${id}"]`).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
        expect(top, `${id} starts at ${Math.round(top)}px`).toBeLessThan(screen * 3);
      }

      // Every figure moment is captioned and credited, and its drawing has a size and a text alternative.
      for (const figure of await page.locator('main figure[data-media-id]').all()) {
        const id = (await figure.getAttribute('data-media-id')) ?? '';
        await expect(figure.locator('figcaption'), id).not.toHaveCount(0);
        expect(((await figure.locator('figcaption').first().textContent()) ?? '').trim().length, `${id} caption`).toBeGreaterThan(20);
        for (const svg of await figure.locator('svg[role="img"]').all()) {
          await expect(svg, id).toHaveAttribute('width', /^\d+$/);
          await expect(svg, id).toHaveAttribute('height', /^\d+$/);
          const label = (await svg.getAttribute('aria-label')) ?? (await svg.getAttribute('aria-labelledby')) ?? '';
          expect(label.length, `${id} drawing has a text alternative`).toBeGreaterThan(0);
        }
      }
      await expectNoHorizontalScroll(page);
    });

    test('fills the frame at 1920 and passes axe', async ({ page }, info) => {
      test.skip(!isDesktop(info), 'The 1920 frame is measured once, in the desktop project');
      await page.setViewportSize(FULL_HD);
      await page.goto(hub.path);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).include('main').analyze();
      expect(axeList(results.violations)).toEqual([]);
    });
  });
}

test.describe('tool schematics', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const slug of TOOLS) {
    test(`/tools/${slug}/ draws what it computes above the tool`, async ({ page }) => {
      const path = `/tools/${slug}/`;
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      const schematic = page.locator(`figure[data-media-id="hub-tool-${slug}"]`);
      await expect(schematic).toHaveCount(1);
      await expect(schematic).toHaveAttribute('data-moment', 'diagram');
      await expect(schematic.locator('figcaption')).not.toHaveCount(0);
      // The schematic is HTML (inputs, working, results as lists) around the tool's glyph, so it reads and zooms like text.
      await expect(schematic.locator('svg')).not.toHaveCount(0);
      expect(await schematic.locator('li').count(), 'listed inputs and results').toBeGreaterThanOrEqual(2);
      const schematicTop = await schematic.evaluate((el) => el.getBoundingClientRect().top);
      const toolTop = await page.locator('main form, main [data-controls]').first().evaluate((el) => el.getBoundingClientRect().top);
      expect(schematicTop, 'the schematic comes before the tool').toBeLessThan(toolTop);
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe('with scripts off', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });

  for (const hub of HUBS) {
    test(`${hub.path} keeps every moment`, async ({ page }) => {
      test.skip(!isBuilt(hub.path), `${hub.path} is not built`);
      await page.goto(hub.path);
      const ids = await mediaIds(page);
      expect(ids.filter((id) => hub.moments.includes(id))).toEqual([...hub.moments]);
      for (const id of hub.moments) await expect(page.locator(`[data-media-id="${id}"]`), id).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }

  for (const f of FILTERS) {
    test(`${f.path} shows every item of ${f.id} and the filter still works`, async ({ page }) => {
      test.skip(!isBuilt(f.path), `${f.path} is not built`);
      await page.goto(f.path);
      const items = page.locator(`#${f.id} .fi-item`);
      const total = await items.count();
      expect(total, 'items under the filter').toBeGreaterThan(1);
      expect(await shownItems(page, f.id)).toBe(total);
      // The filter is CSS alone, so choosing an option works without a script too.
      await page.locator(`#${f.id} input[type="radio"]`).nth(1).check();
      const shown = await shownItems(page, f.id);
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(total);
    });
  }
});

test.describe('filters from the keyboard', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const f of FILTERS) {
    test(`${f.path} ${f.id}: Tab in, arrow to choose, All restores`, async ({ page }) => {
      test.skip(!isBuilt(f.path), `${f.path} is not built`);
      await page.goto(f.path);
      const radios = page.locator(`#${f.id} input[type="radio"]`);
      const total = await page.locator(`#${f.id} .fi-item`).count();
      await expect(radios.first()).toBeChecked();

      // Focus the control just before the group, then Tab: the checked radio ("All") takes focus.
      await radios.first().evaluate((el) => {
        // Only controls a reader can reach: the data tables inside closed <details> are skipped by Tab, so they are skipped here.
        const all = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex="0"]')].filter(
          (c) => c === el || (c.checkVisibility() && !(c instanceof HTMLInputElement && c.type === 'radio' && c.name === (el as HTMLInputElement).name)),
        );
        const before = all[all.indexOf(el) - 1];
        if (before === undefined) throw new Error('no focusable element before the filter');
        before.focus();
      });
      await page.keyboard.press('Tab');
      await expect(radios.first()).toBeFocused();

      await page.keyboard.press('ArrowRight');
      await expect(radios.nth(1)).toBeChecked();
      await expect(radios.nth(1)).toBeFocused();
      const value = (await radios.nth(1).getAttribute('value')) ?? '';
      const shown = await shownItems(page, f.id);
      expect(shown, `items shown for ${value}`).toBeGreaterThan(0);
      expect(shown).toBeLessThan(total);
      // Every item still shown belongs to the chosen group.
      const slot = await radios.nth(1).evaluate((el) => [...el.classList].find((c) => /^fi__input--\d+$/.test(c))?.replace('fi__input--', 'fi-') ?? '');
      const outside = await page
        .locator(`#${f.id} .fi-item`)
        .evaluateAll((els, s) => els.filter((el) => getComputedStyle(el).display !== 'none' && !el.classList.contains(s)).length, slot);
      expect(outside, `shown items outside ${slot}`).toBe(0);

      await page.keyboard.press('ArrowLeft');
      await expect(radios.first()).toBeChecked();
      expect(await shownItems(page, f.id)).toBe(total);
      await expectNoHorizontalScroll(page);
    });
  }
});
