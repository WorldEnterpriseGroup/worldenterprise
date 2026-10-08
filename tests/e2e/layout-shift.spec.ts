import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { liveRoutes } from './support/routes.ts';

// Layout stability, measured the way Lighthouse and the field measure it: every layout-shift entry from the first byte until the
// page has settled, on a cold load with no input. Three checks on every launched route:
// 1. a plain load stays under the CLS budget (0.1) at both viewports, and a failure names the elements that moved;
// 2. the same load with the web font files held back until after the first paint, then released, so the swap from the fallback fonts
//    happens as it does on a cold visit (Lighthouse sees it 90 ms in). The shifts the swap causes are scored by Chromium itself;
// 3. the same swap at Lighthouse's own phone (412 x 823, scale 1.75, mobile viewport rules). A trailing item that fits one line in
//    one font and wraps in the other flips only at some widths, so the second phone width catches what 390 does not.
// A failure lists the shifts and the elements that moved between the first layout and the settled page.

const CLS_BUDGET = 0.1;

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

interface Box {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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

interface ShiftReport {
  readonly shifts: readonly ShiftRecord[];
  readonly moved: readonly string[];
  readonly fonts: readonly string[];
}

declare global {
  interface Window {
    __layoutShifts?: ShiftRecord[];
    /** Every element of <main> at DOMContentLoaded, before the web fonts could replace the fallbacks. */
    __firstLayout?: Box[];
    /** `family weight style: status` of each declared font face at DOMContentLoaded. */
    __firstFonts?: string[];
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
    document.addEventListener('DOMContentLoaded', () => {
      window.__firstLayout = [...document.querySelectorAll('main *')].slice(0, 2500).map((el) => {
        const r = el.getBoundingClientRect();
        return { name: describe(el), x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      });
      window.__firstFonts = [...document.fonts].map((f) => `${f.family.replace(/-[0-9a-f]{16}/, '')} ${f.weight} ${f.style}: ${f.status}`);
    });
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

/** The recorded shifts, the elements of the first viewport that moved since the first layout, and the font states at that layout. */
async function readReport(page: Page): Promise<ShiftReport> {
  return page.evaluate(() => {
    const settled = [...document.querySelectorAll('main *')].slice(0, 2500).map((el) => el.getBoundingClientRect());
    const first = window.__firstLayout ?? [];
    const viewportHeight = window.innerHeight;
    const moved = first
      .map((box, i) => {
        const now = settled[i];
        return now === undefined ? null : { box, dx: Math.round(now.x - box.x), dy: Math.round(now.y - box.y), dh: Math.round(now.height - box.height), nowY: Math.round(now.y) };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .filter((m) => (m.box.y < viewportHeight || m.nowY < viewportHeight) && Math.max(Math.abs(m.dx), Math.abs(m.dy)) >= 4)
      .sort((a, b) => Math.max(Math.abs(b.dx), Math.abs(b.dy)) - Math.max(Math.abs(a.dx), Math.abs(a.dy)))
      .slice(0, 10)
      .map((m) => `${m.box.name} y ${m.box.y} -> ${m.nowY} (${m.dy >= 0 ? '+' : ''}${m.dy}), x ${m.dx >= 0 ? '+' : ''}${m.dx}, height ${m.dh >= 0 ? '+' : ''}${m.dh}`);
    return { shifts: window.__layoutShifts ?? [], moved, fonts: window.__firstFonts ?? [] };
  });
}

/**
 * Loads a route with every font file held back until the page has painted with the fallback fonts, then releases them and waits for
 * the page to settle. This is the swap a cold visit makes, made deterministic: a fast local server otherwise delivers the fonts
 * before the first paint and nothing moves.
 */
async function loadWithLateFonts(page: Page, route: string): Promise<ShiftReport> {
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
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.waitForTimeout(250);
  } finally {
    release();
  }
  await settle(page);
  return readReport(page);
}

function describeShifts(report: ShiftReport): string {
  const detail = report.shifts
    .slice(0, 4)
    .map((s) => `${s.value.toFixed(3)} at ${s.at} ms: ${s.sources.slice(0, 5).map((src) => `${src.node} ${JSON.stringify(src.from)} -> ${JSON.stringify(src.to)}`).join('; ')}`)
    .join(' | ');
  return `layout shifts (${report.shifts.length}): ${detail}\nmoved between the first layout and the settled page: ${report.moved.join(' | ')}\nfonts at first layout: ${report.fonts.join(', ')}`;
}

const total = (report: ShiftReport): number => report.shifts.reduce((sum, s) => sum + s.value, 0);

for (const { path: route } of liveRoutes) {
  test(`layout shift stays under ${CLS_BUDGET} on ${route}`, async ({ page }) => {
    await recordShifts(page);
    await page.goto(route, { waitUntil: 'load' });
    await settle(page);
    const report = await readReport(page);
    expect(total(report), describeShifts(report)).toBeLessThan(CLS_BUDGET);
  });

  test(`layout shift stays under ${CLS_BUDGET} when the web fonts arrive after the first paint on ${route}`, async ({ page }) => {
    const report = await loadWithLateFonts(page, route);
    expect(total(report), describeShifts(report)).toBeLessThan(CLS_BUDGET);
  });
}

test.describe('at the Lighthouse phone', () => {
  test.use({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });

  for (const { path: route } of liveRoutes) {
    test(`layout shift stays under ${CLS_BUDGET} when the web fonts arrive after the first paint on ${route}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile-390x844', 'Lighthouse measures a phone, so the desktop project has nothing to add.');
      const report = await loadWithLateFonts(page, route);
      expect(total(report), describeShifts(report)).toBeLessThan(CLS_BUDGET);
    });
  }
});
