import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { liveRoutes } from './support/routes.ts';

// Layout stability, measured the way Lighthouse and the field measure it: every layout-shift entry from the first byte until the
// page has settled, on a cold load with no input. Two checks:
// 1. every launched route stays under the CLS budget (0.1) at both viewports, and a failure names the elements that moved;
// 2. the web fonts replace the fallback fonts without moving the first screen: the position of the page's landmarks with the font
//    files blocked is compared with their position once the fonts are in.

const CLS_BUDGET = 0.1;
/** Largest distance, in CSS pixels, a landmark may move when the web fonts replace the fallbacks. */
const FONT_SWAP_TOLERANCE = 6;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ShiftRecord {
  readonly value: number;
  readonly at: number;
  readonly sources: readonly { readonly node: string; readonly from: Rect; readonly to: Rect }[];
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
    __layoutShifts?: ShiftRecord[];
  }
}

/** Starts recording layout shifts before the page's own scripts run. */
async function recordShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const records: ShiftRecord[] = [];
    window.__layoutShifts = records;
    const describe = (node: Node | null): string => {
      if (!(node instanceof Element)) return node === null ? 'removed node' : node.nodeName.toLowerCase();
      const classes = typeof node.className === 'string' && node.className !== '' ? `.${node.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      return `${node.tagName.toLowerCase()}${node.id !== '' ? `#${node.id}` : ''}${classes}`;
    };
    const rect = (r: DOMRectReadOnly): Rect => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as LayoutShiftEntry;
        if (shift.hadRecentInput) continue;
        records.push({
          value: shift.value,
          at: Math.round(shift.startTime),
          sources: shift.sources.map((s) => ({ node: describe(s.node), from: rect(s.previousRect), to: rect(s.currentRect) })),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(500);
}

const LANDMARKS = ['.site-top', '.utility-bar', '.site-header', 'main > :first-child', 'nav.breadcrumbs', 'h1', 'h1 ~ .lead', 'main > :nth-child(2)'] as const;

async function measureLandmarks(page: Page): Promise<Record<string, Rect | null>> {
  return page.evaluate((selectors) => {
    const out: Record<string, Rect | null> = {};
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el === null) {
        out[selector] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      out[selector] = { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) };
    }
    return out;
  }, LANDMARKS);
}

for (const { path: route } of liveRoutes) {
  test(`layout shift stays under ${CLS_BUDGET} on ${route}`, async ({ page }) => {
    await recordShifts(page);
    await page.goto(route, { waitUntil: 'load' });
    await settle(page);
    const shifts = await page.evaluate(() => window.__layoutShifts ?? []);
    const total = shifts.reduce((sum, s) => sum + s.value, 0);
    const detail = shifts
      .slice(0, 6)
      .map((s) => `${s.value.toFixed(3)} at ${s.at} ms: ${s.sources.slice(0, 4).map((src) => `${src.node} ${JSON.stringify(src.from)} -> ${JSON.stringify(src.to)}`).join('; ')}`)
      .join(' | ');
    expect(total, `layout shifts (${shifts.length}): ${detail}`).toBeLessThan(CLS_BUDGET);
  });
}

const FONT_SAMPLE = ['/', '/program/', '/services/', '/insights/', '/research/saas-security-baseline-year-one/', '/insights/is-your-saas-idea-a-business-or-a-feature/', '/library/one-page-problem-brief/'];

for (const route of FONT_SAMPLE.filter((r) => liveRoutes.some((live) => live.path === r))) {
  test(`web fonts replace the fallbacks without moving the first screen on ${route}`, async ({ page, context }) => {
    // The first page cannot load any font file, so it shows the fallback fonts. The second loads the real ones.
    await page.route('**/*.woff*', (request) => request.abort());
    await page.goto(route, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const before = await measureLandmarks(page);

    const loaded = await context.newPage();
    await loaded.goto(route, { waitUntil: 'load' });
    await settle(loaded);
    const after = await measureLandmarks(loaded);

    const moves = LANDMARKS.map((selector) => {
      const a = before[selector] ?? null;
      const b = after[selector] ?? null;
      return { selector, a, b, dy: a !== null && b !== null ? b.y - a.y : 0 };
    });
    const worst = Math.max(...moves.map((m) => Math.abs(m.dy)));
    const table = moves.map((m) => `${m.selector}: y ${m.a?.y ?? 'none'} -> ${m.b?.y ?? 'none'}, height ${m.a?.height ?? 'none'} -> ${m.b?.height ?? 'none'}`).join(' | ');
    expect(worst, `a landmark moved ${worst}px when the fonts loaded: ${table}`).toBeLessThanOrEqual(FONT_SWAP_TOLERANCE);
  });
}
