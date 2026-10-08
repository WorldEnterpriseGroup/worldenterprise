import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { findOverflow, formatOffenders } from './support/overflow.ts';
import { fileFor, isBuilt, liveRoutes } from './support/routes.ts';

// Layout fit (WP-16). The earlier overflow checks compared documentElement.scrollWidth with clientWidth, and `.page` and `main` clipped
// horizontal overflow, so content could be cut off at the viewport edge and still measure as zero overflow. These tests measure the
// bounding box of every element against the viewport instead (tests/e2e/support/overflow.ts). They run at 1440, 390 and 320 CSS pixels
// (320 is the WCAG 1.4.10 reflow width).

for (const { path: route } of liveRoutes) {
  test(`fits the viewport ${route}`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'load' });
    expect(response?.status(), 'HTTP status').toBe(200);
    const width = page.viewportSize()?.width;

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scroll, `document scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);

    const offenders = await findOverflow(page);
    expect(offenders, `elements outside the ${width}px viewport: ${formatOffenders(offenders)}`).toEqual([]);
  });
}

test('the page frame does not clip sideways overflow', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => {
    const read = (selector: string): string | null => {
      const el = document.querySelector(selector);
      return el === null ? null : getComputedStyle(el).overflowX;
    };
    return { page: read('.page'), main: read('main#main'), body: read('body') };
  });
  // overflow-x: clip on these is what hid clipped tables and forms from every earlier overflow test.
  for (const [name, value] of Object.entries(overflow)) {
    expect(['clip', 'hidden'], `${name} must not clip horizontally`).not.toContain(value);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// Tables scroll inside a labelled, focusable frame instead of being clipped.

const withTables = liveRoutes.filter((route) => /<table\b/.test(readFileSync(fileFor(route.path), 'utf8')));

test('every table in the built pages sits in a focusable, named scroll region with a unique name', ({}, info) => {
  test.skip(info.project.name !== 'desktop-1440x900', 'static scan, once');
  expect(withTables.length, 'routes with tables').toBeGreaterThan(10);
  const failures: string[] = [];
  for (const route of withTables) {
    const html = readFileSync(fileFor(route.path), 'utf8');
    const tables = html.match(/<table\b/g)?.length ?? 0;
    const frames = [...html.matchAll(/<div\b[^>]*\bclass="table-wrap"[^>]*>/g)].map((m) => m[0]);
    if (frames.length !== tables) failures.push(`${route.path}: ${tables} table(s) but ${frames.length} .table-wrap frame(s)`);
    const labels: string[] = [];
    for (const tag of frames) {
      if (!/\btabindex="0"/.test(tag)) failures.push(`${route.path}: frame without tabindex="0"`);
      if (!/\brole="region"/.test(tag)) failures.push(`${route.path}: frame without role="region"`);
      const label = /\baria-label="([^"]*)"/.exec(tag)?.[1] ?? '';
      if (label.trim() === '') failures.push(`${route.path}: frame without an aria-label`);
      labels.push(label);
    }
    if (new Set(labels).size !== labels.length) failures.push(`${route.path}: region names repeat (${labels.join(' | ')})`);
  }
  expect(failures).toEqual([]);
});

test('tables that are wider than the column scroll, and the keyboard can scroll them', async ({ page }, info) => {
  test.skip(!['mobile-390x844', 'mobile-320x568'].includes(info.project.name), 'phone widths only');
  test.setTimeout(180_000);
  let scrollingFrames = 0;
  const failures: string[] = [];
  for (const route of withTables) {
    await page.goto(route.path);
    const frames = page.locator('.table-wrap');
    const count = await frames.count();
    for (let index = 0; index < count; index += 1) {
      const frame = frames.nth(index);
      const measure = await frame.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, overflowX: getComputedStyle(el).overflowX, right: el.getBoundingClientRect().right, viewport: document.documentElement.clientWidth }));
      if (measure.right > measure.viewport + 1) failures.push(`${route.path}: frame ${index + 1} ends at ${Math.round(measure.right)} of ${measure.viewport}`);
      if (!['auto', 'scroll'].includes(measure.overflowX)) failures.push(`${route.path}: frame ${index + 1} has overflow-x ${measure.overflowX}`);
      if (measure.scroll > measure.client + 1) {
        scrollingFrames += 1;
        if (scrollingFrames <= 3) {
          await frame.focus();
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => frame.evaluate((el) => el.scrollLeft), { message: `${route.path}: ArrowRight scrolls frame ${index + 1}` }).toBeGreaterThan(0);
        }
      }
    }
  }
  expect(failures).toEqual([]);
  expect(scrollingFrames, 'at least one table is wider than a phone column, otherwise this test proves nothing').toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------------------------------------------------------
// Forms fit the column (visual-brand P0-1b).

for (const route of ['/apply/', '/contact/'].filter(isBuilt)) {
  test(`every control of ${route} stays inside the column`, async ({ page }) => {
    await page.goto(route);
    const viewport = page.viewportSize()?.width ?? 0;
    const boxes = await page.evaluate(() => {
      const gutter = parseFloat(getComputedStyle(document.querySelector('main .container') ?? document.body).marginLeft);
      const describe = (el: Element): string => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${(el as HTMLInputElement).name ? `[${(el as HTMLInputElement).name}]` : ''}`;
      return {
        gutter,
        viewport: document.documentElement.clientWidth,
        items: [...document.querySelectorAll('main form :is(input, select, textarea, fieldset, .field, button)')].filter((el) => el.getBoundingClientRect().width > 0 && el.closest('[hidden], .hp') === null).map((el) => ({ name: describe(el), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })),
      };
    });
    expect(boxes.items.length, 'form controls found').toBeGreaterThan(3);
    const tooWide = boxes.items.filter((item) => item.right > boxes.viewport - boxes.gutter + 1 || item.left < boxes.gutter - 1);
    expect(tooWide, `controls outside the ${viewport}px column (gutter ${boxes.gutter}px)`).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// /insights/ rows (visual-brand P0-2).

test('every article card of the /insights/ rows is on the page from 768px up, and the phone row keeps its peek', async ({ page }) => {
  test.skip(!isBuilt('/insights/'), '/insights/ is not built');
  await page.goto('/insights/');
  const viewport = page.viewportSize()?.width ?? 0;
  const lists = await page.evaluate(() =>
    [...document.querySelectorAll('.desk-rail__list')].map((list) => ({
      overflowX: getComputedStyle(list).overflowX,
      scrollable: list.scrollWidth > list.clientWidth + 1,
      cards: [...list.querySelectorAll('.desk-rail__item')].map((item) => {
        const box = item.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      }),
    })),
  );
  expect(lists.length, 'desk rails on /insights/').toBeGreaterThanOrEqual(4);
  for (const list of lists) {
    expect(list.cards.length, 'cards in the rail').toBeGreaterThanOrEqual(4);
    if (viewport >= 768) {
      expect(list.scrollable, 'a rail at this width does not scroll sideways').toBe(false);
      for (const card of list.cards) {
        expect(card.left, 'card starts inside the viewport').toBeGreaterThanOrEqual(-1);
        expect(card.right, 'card ends inside the viewport').toBeLessThanOrEqual(viewport + 1);
        expect(card.width, 'card is wide enough to read').toBeGreaterThan(200);
      }
    } else {
      expect(list.overflowX, 'the phone row scrolls').toBe('auto');
      const first = list.cards[0];
      expect(first?.right, 'the first card is fully on screen').toBeLessThanOrEqual(viewport + 1);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// Header and body share one left edge (visual-brand P0-4).

test('the page header and the first body block start at the same x on every route that has a page header', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440x900', 'edges differ only where the viewport is wider than the column');
  test.setTimeout(240_000);
  const failures: string[] = [];
  let checked = 0;
  for (const route of liveRoutes) {
    await page.goto(route.path);
    const edges = await page.evaluate(() => {
      const header = document.querySelector('main .page-header');
      const h1 = document.querySelector('main h1');
      if (header === null || h1 === null) return null;
      const first = [...document.querySelectorAll('main .container')].find(
        (el) => !header.contains(el) && Boolean(header.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && el.getBoundingClientRect().height > 0,
      );
      if (first === undefined) return null;
      return { h1: h1.getBoundingClientRect().left, body: first.getBoundingClientRect().left, bodyClass: first.className };
    });
    if (edges === null) continue;
    checked += 1;
    if (Math.abs(edges.h1 - edges.body) > 1) failures.push(`${route.path}: h1 at ${Math.round(edges.h1)}, body (${edges.bodyClass}) at ${Math.round(edges.body)}`);
  }
  expect(checked, 'routes with a page header').toBeGreaterThan(40);
  expect(failures).toEqual([]);
});
