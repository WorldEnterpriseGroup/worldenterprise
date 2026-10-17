import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Shared full-width assertions for wave 9 (WP-51, decision W9-9, docs/wave9-contracts.md section 7).
 *
 * A wave 9 spec lives in tests/e2e/wave8/wp-NN/**, sets `test.use({ viewport: FULL_HD, reducedMotion: 'reduce' })` and skips outside
 * the `wave8-desktop-1440x900` project. Every helper measures rendered boxes, so it follows the tokens if they change.
 */

/** The full-HD viewport the CEO direction names (1920x1080). */
export const FULL_HD = { width: 1920, height: 1080 } as const;

/** The narrowest phone width the site supports. */
export const SMALLEST_PHONE = { width: 320, height: 568 } as const;

/** The content frame is at least this wide at 1920 (110rem is 1760px; the slack covers a scrollbar and rounding). */
export const MIN_FRAME_AT_FULL_HD = 1600;

/** The content frame starts this close to the left edge at 1920 (the gutter is 80px). */
export const MAX_LEFT_OFFSET_AT_FULL_HD = 160;

/**
 * The longest reading line, in `ch` of the paragraph's own font. The reading column is 46rem; with 19px body type that is about 77ch
 * of the zero glyph, which runs wider than an average letter, so a line holds roughly 65 to 75 real characters.
 */
export const MAX_MEASURE_CH = 80;

interface Box {
  readonly what: string;
  readonly left: number;
  readonly width: number;
}

/**
 * The main content frame is the widest visible `.container` in `main` (the hero, a band or the body). At 1920 it must be at least
 * {@link MIN_FRAME_AT_FULL_HD} wide and start within {@link MAX_LEFT_OFFSET_AT_FULL_HD} of the left edge: no empty side bands.
 */
export async function expectFullWidth(page: Page, scope = 'main'): Promise<void> {
  const widest = await page.evaluate((root): Box | null => {
    const boxes = [...document.querySelectorAll(`${root} .container`)]
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0);
    if (boxes.length === 0) return null;
    const best = boxes.reduce((a, b) => (b.box.width > a.box.width ? b : a));
    return { what: `${best.el.tagName.toLowerCase()}.${String(best.el.className).split(/\s+/).join('.')}`, left: best.box.left, width: best.box.width };
  }, scope);
  expect(widest, `a visible .container inside ${scope}`).not.toBeNull();
  if (widest === null) return;
  expect(widest.width, `${scope} frame ${widest.what} is ${Math.round(widest.width)}px wide`).toBeGreaterThanOrEqual(MIN_FRAME_AT_FULL_HD);
  expect(widest.left, `${scope} frame ${widest.what} starts at ${Math.round(widest.left)}px`).toBeLessThanOrEqual(MAX_LEFT_OFFSET_AT_FULL_HD);
}

/** The page never scrolls sideways: the document is no wider than the viewport (1px tolerance for subpixel rounding). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `document is ${scroll}px wide in a ${client}px viewport`).toBeLessThanOrEqual(client + 1);
}

/**
 * Paragraphs (at any depth) and top-level lists of the reading text (`.prose`, `.container--prose`, `.flow-wide`, `.split__text`)
 * stay within {@link MAX_MEASURE_CH} of their own font, however wide the frame. Returns how many were measured, so a spec can
 * require some.
 */
export async function expectReadableProse(page: Page, maxCh = MAX_MEASURE_CH): Promise<number> {
  const result = await page.evaluate((limit) => {
    const reading = ':is(.prose, .container--prose, .flow-wide, .split__text)';
    const nodes = [...document.querySelectorAll(`main ${reading} p, main ${reading} > :is(ul, ol)`)].filter(
      (el) => el.getBoundingClientRect().width > 0 && (el.textContent ?? '').trim().length > 80,
    );
    const probe = document.createElement('span');
    probe.textContent = '0';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    const tooWide: string[] = [];
    for (const el of nodes) {
      el.append(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      if (ch <= 0) continue;
      const measure = el.getBoundingClientRect().width / ch;
      if (measure > limit + 0.5) tooWide.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}": ${measure.toFixed(1)}ch`);
    }
    return { count: nodes.length, tooWide };
  }, maxCh);
  expect(result.tooWide, `reading lines over ${maxCh}ch`).toEqual([]);
  return result.count;
}

/** Every visible `.band` runs edge to edge: its box starts at 0 and ends at the viewport's client width (1px tolerance). */
export async function expectBandsFullBleed(page: Page): Promise<number> {
  const result = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const bands = [...document.querySelectorAll('.band')].map((el) => el.getBoundingClientRect()).filter((box) => box.height > 0);
    const short = bands.filter((box) => box.left > 1 || box.right < client - 1).map((box) => `${Math.round(box.left)} to ${Math.round(box.right)} of ${client}`);
    return { count: bands.length, short };
  });
  expect(result.short, 'bands that do not span the viewport').toEqual([]);
  return result.count;
}

/** The wide screens above 1920 that the layout scales to (the 1920 design at 1.33x and 2x). */
export const WIDE_SCREENS = [
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
] as const;

/** Above 1920 the widest frame in `main` spans at least this share of the viewport: no empty side bands at any width. */
export const MIN_FRAME_SHARE_WIDE = 0.85;

/**
 * The widest visible `.container` in `scope` spans at least `share` of the viewport's client width. Returns its box, so a spec can
 * compare it with other frames.
 */
export async function expectFrameShare(page: Page, share = MIN_FRAME_SHARE_WIDE, scope = 'main'): Promise<{ left: number; width: number; client: number }> {
  const result = await page.evaluate((root) => {
    const boxes = [...document.querySelectorAll(`${root} .container`)].map((el) => el.getBoundingClientRect()).filter((box) => box.width > 0 && box.height > 0);
    const widest = boxes.reduce<DOMRect | null>((a, b) => (a === null || b.width > a.width ? b : a), null);
    return { left: widest?.left ?? -1, width: widest?.width ?? 0, client: document.documentElement.clientWidth };
  }, scope);
  expect(result.width, `${scope} frame is ${Math.round(result.width)}px of a ${result.client}px viewport`).toBeGreaterThanOrEqual(result.client * share);
  return result;
}
