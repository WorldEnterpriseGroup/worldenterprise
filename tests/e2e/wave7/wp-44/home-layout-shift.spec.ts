import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';

// WP-44, acceptance: cumulative layout shift on the home page stays under 0.1. The recomposition defers rendering of every band below the
// first (content-visibility: auto, with the remembered intrinsic size of .section--defer), so a band can change height the first time it
// is rendered. The shared layout-shift spec loads the page and waits; it never scrolls, so it cannot see that. This one reads the page the
// way a visitor does: it records every shift from the first byte, scrolls the whole page down in screen-sized steps and back up, and
// scores the sum. A failure lists each shift with the elements that moved.

const CLS_BUDGET = 0.1;

interface ShiftRecord {
  readonly value: number;
  readonly at: number;
  readonly sources: readonly string[];
}

interface LayoutShiftSource {
  readonly node: Node | null;
  readonly previousRect: DOMRectReadOnly;
  readonly currentRect: DOMRectReadOnly;
}

interface LayoutShiftEntry extends PerformanceEntry {
  readonly value: number;
  readonly hadRecentInput: boolean;
  readonly sources: readonly LayoutShiftSource[];
}

declare global {
  interface Window {
    __homeShifts?: ShiftRecord[];
  }
}

async function recordShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const records: ShiftRecord[] = [];
    window.__homeShifts = records;
    const name = (node: Node | null): string => {
      if (!(node instanceof Element)) return node === null ? 'removed node' : node.nodeName.toLowerCase();
      const classes = typeof node.className === 'string' && node.className !== '' ? `.${node.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      return `${node.tagName.toLowerCase()}${node.id !== '' ? `#${node.id}` : ''}${classes}`;
    };
    const box = (r: DOMRectReadOnly): string => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as LayoutShiftEntry;
        if (shift.hadRecentInput) continue;
        records.push({
          value: shift.value,
          at: Math.round(shift.startTime),
          sources: shift.sources.slice(0, 5).map((s) => `${name(s.node)} ${box(s.previousRect)} -> ${box(s.currentRect)}`),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

/** Scrolls to the bottom one viewport at a time, pausing so each deferred band renders, then back to the top. */
async function scrollThrough(page: Page): Promise<void> {
  const step = Math.max(200, Math.round((page.viewportSize()?.height ?? 800) * 0.8));
  let y = 0;
  for (let i = 0; i < 80; i += 1) {
    const done = await page.evaluate((to) => {
      window.scrollTo(0, to);
      return to + window.innerHeight >= document.documentElement.scrollHeight - 2;
    }, y);
    await page.waitForTimeout(120);
    if (done) break;
    y += step;
  }
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function report(page: Page): Promise<{ total: number; detail: string }> {
  const shifts = await page.evaluate(() => window.__homeShifts ?? []);
  const total = shifts.reduce((sum, s) => sum + s.value, 0);
  const detail = shifts
    .slice(0, 6)
    .map((s) => `${s.value.toFixed(3)} at ${s.at} ms: ${s.sources.join('; ')}`)
    .join(' | ');
  return { total, detail: `layout shifts (${shifts.length}), total ${total.toFixed(3)}: ${detail}` };
}

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
});

test(`layout shift stays under ${CLS_BUDGET} on a plain load`, async ({ page }) => {
  await recordShifts(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(500);
  const { total, detail } = await report(page);
  expect(total, detail).toBeLessThan(CLS_BUDGET);
});

test(`layout shift stays under ${CLS_BUDGET} while the visitor scrolls the whole page and back`, async ({ page }) => {
  await recordShifts(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await scrollThrough(page);
  const { total, detail } = await report(page);
  expect(total, detail).toBeLessThan(CLS_BUDGET);
});

test(`layout shift stays under ${CLS_BUDGET} when the web fonts arrive after the first paint and the visitor then scrolls`, async ({ page }) => {
  await recordShifts(page);
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*.woff*', async (fontRequest) => {
    await released;
    await fontRequest.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.waitForTimeout(250);
  } finally {
    release();
  }
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await scrollThrough(page);
  const { total, detail } = await report(page);
  expect(total, detail).toBeLessThan(CLS_BUDGET);
});
