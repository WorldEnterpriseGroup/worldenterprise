import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { liveRoutes } from './support/routes.ts';

// Layout stability, measured the way Lighthouse and the field measure it: every layout-shift entry from the first byte until the
// page has settled, on a cold load with no input. Two checks:
// 1. every launched route stays under the CLS budget (0.1) at both viewports, and a failure names the elements that moved;
// 2. the web fonts replace the fallback fonts without moving the first screen: the position of the page's landmarks with the font
//    files blocked is compared with their position once the fonts are in;
// 3. the routes the Lighthouse budget covers hold still at Lighthouse's own phone (412 x 823, scale 1.75, mobile viewport rules), and a
//    failure names the elements that moved between the first layout and the settled page.

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

interface Lighthouserc {
  readonly candidates: readonly string[];
  readonly maxRoutes: number;
}

function lighthouseRoutes(): string[] {
  const config = JSON.parse(readFileSync('lighthouserc.json', 'utf8')) as Lighthouserc;
  const live = new Set(liveRoutes.map((r) => r.path));
  return config.candidates.filter((c) => live.has(c)).slice(0, config.maxRoutes);
}

test.describe('at the Lighthouse phone', () => {
  test.use({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });

  for (const route of lighthouseRoutes()) {
    test(`layout shift stays under ${CLS_BUDGET} on ${route}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile-390x844', 'Lighthouse measures a phone, so the desktop project has nothing to add.');
      await recordShifts(page);
      await page.goto(route, { waitUntil: 'load' });
      await settle(page);
      const report = await page.evaluate(() => {
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
      const total = report.shifts.reduce((sum, s) => sum + s.value, 0);
      const detail = report.shifts
        .slice(0, 4)
        .map((s) => `${s.value.toFixed(3)} at ${s.at} ms: ${s.sources.slice(0, 5).map((src) => `${src.node} ${JSON.stringify(src.from)} -> ${JSON.stringify(src.to)}`).join('; ')}`)
        .join(' | ');
      expect(
        total,
        `layout shifts (${report.shifts.length}): ${detail}\nmoved between the first layout and the settled page: ${report.moved.join(' | ')}\nfonts at first layout: ${report.fonts.join(', ')}`,
      ).toBeLessThan(CLS_BUDGET);
    });
  }
});
