import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';

// The hero action row must not depend on font metrics. A pair of buttons that fits on one line under the fallback font and wraps under
// the web font adds a row after the first paint and pushes the hero down (CLS 0.14 on /program/how-it-works/ at Lighthouse's 412 px
// phone, demo pipeline 65145). The row is laid out by the width of its container (hero.css, `@container hero-actions`), so its box,
// and the top of each button, are the same before and after the fonts arrive. The first test is the failing case (412 px, the two
// pages the brief names); the second sweeps the widths between a small phone and a desktop column with the widest label pair on the
// site, the one with the least slack.

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ActionRow {
  readonly row: Box;
  /** Vertical offset of each action from the top of the row, in document order. */
  readonly tops: readonly number[];
  readonly fonts: readonly string[];
}

const PHONE = { width: 412, height: 823 } as const;
const PAGES = [
  { route: '/program/how-it-works/', note: 'the page that failed on demo, a hero with a primary and a secondary action' },
  { route: '/founders/', note: 'a compact hero, statement variant' },
] as const;
const SWEEP_WIDTHS = [320, 360, 390, 412, 480, 540, 600, 672, 700, 768, 900, 1100] as const;
/** The widest pair of hero labels on the site: "Apply to the program" and "Read the readiness checklist". */
const WIDEST_PAIR_ROUTE = '/program/grow/';

const round = (n: number): number => Math.round(n * 100) / 100;

async function readRow(page: Page): Promise<ActionRow> {
  return page.evaluate(() => {
    const row = document.querySelector('.hero__actions-row');
    if (!(row instanceof HTMLElement)) throw new Error('the page has no .hero__actions-row');
    const r = row.getBoundingClientRect();
    const tops = [...row.children].map((child) => child.getBoundingClientRect().top - r.top);
    return {
      row: { x: r.x, y: r.y, width: r.width, height: r.height },
      tops,
      fonts: [...document.fonts].map((f) => `${f.family.replace(/-[0-9a-f]{16}/, '')} ${f.weight}: ${f.status}`),
    };
  });
}

/**
 * Loads `route` at `width` with every font file held back, measures the action row on the fallback fonts, releases the fonts, waits for
 * them to be applied and measures again.
 */
async function measureAcrossFontSwap(context: BrowserContext, route: string, width: number): Promise<{ before: ActionRow; after: ActionRow }> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width, height: PHONE.height });
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/*.woff*', async (fontRequest) => {
      await released;
      await fontRequest.continue();
    });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const before = await readRow(page);
    release();
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(500);
    const after = await readRow(page);
    return { before, after };
  } finally {
    await page.close();
  }
}

function expectSameRow(label: string, { before, after }: { before: ActionRow; after: ActionRow }): void {
  const detail = `${label}\nbefore the fonts: ${JSON.stringify(before.row)} tops ${JSON.stringify(before.tops)} [${before.fonts.join(', ')}]\nafter the fonts: ${JSON.stringify(after.row)} tops ${JSON.stringify(after.tops)} [${after.fonts.join(', ')}]`;
  expect(after.fonts.some((f) => f.endsWith(': loaded')), `the web fonts never arrived, so the swap was not exercised\n${detail}`).toBe(true);
  expect(before.fonts.some((f) => f.endsWith(': loaded')), `a web font had already loaded at the first measurement\n${detail}`).toBe(false);
  expect(after.row.height, `${detail}\n(row height)`).toBe(before.row.height);
  expect(after.row.y, `${detail}\n(row top)`).toBe(before.row.y);
  expect(after.row.x, `${detail}\n(row left)`).toBe(before.row.x);
  expect(after.row.width, `${detail}\n(row width)`).toBe(before.row.width);
  expect(after.tops.map(round), `${detail}\n(action tops)`).toEqual(before.tops.map(round));
}

test.describe('the hero action row does not depend on font metrics', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'mobile-390x844', 'The phone project carries the check; the desktop project would repeat the same loads.');
  });

  for (const { route, note } of PAGES) {
    test(`the action row has the same box before and after the web fonts arrive at 412 px on ${route}`, async ({ context }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      expectSameRow(`${route} (${note}) at ${PHONE.width} px`, await measureAcrossFontSwap(context, route, PHONE.width));
    });
  }

  test(`the widest label pair keeps its row from 320 px to a desktop column on ${WIDEST_PAIR_ROUTE}`, async ({ context }) => {
    test.skip(!isBuilt(WIDEST_PAIR_ROUTE), `${WIDEST_PAIR_ROUTE} is not built`);
    for (const width of SWEEP_WIDTHS) {
      expectSameRow(`${WIDEST_PAIR_ROUTE} at ${width} px`, await measureAcrossFontSwap(context, WIDEST_PAIR_ROUTE, width));
    }
  });
});
