import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Content-extent gate (WP-109, issue #109). `expectFullWidth` only proves that a `.container` spans the 110rem frame; it cannot see
 * where the content lands inside it, so a 736px reading column in a 1760px frame passed. This gate measures the content itself.
 *
 * At 1920x1080 every band that is a direct child of `<main>` (a hero, a section, a band, a toc) must have content whose union spans
 * at least {@link MIN_CONTENT_SPAN}px and leaves at most {@link MAX_SIDE_GAP}px empty on either side of the viewport. Content is the
 * rendered text and the media a reader can perceive: text lines, images, video, canvas, tables and form controls, and a visual
 * (an svg, an image) that is large enough to be the art of the band, at least {@link MIN_VISUAL_WIDTH}px wide, as the WP-52 visuals
 * library and the emblems of WP-56 are, and a card: a painted box up to 640px wide that holds text. Text that is `aria-hidden`, anything marked `data-decorative` (starfields, ornament) and a
 * small svg that is `aria-hidden` (an icon, a bullet) never count, so ornament does not pass for content; the space has to carry
 * content or the layout has to use the width.
 */

/** The content of a band spans at least this much of the 1920px viewport (the issue's "1440px"). */
export const MIN_CONTENT_SPAN = 1440;

/** A visual counts as the art of a band from this width on, whether or not it is hidden from assistive technology. */
export const MIN_VISUAL_WIDTH = 240;

/** The content of a band leaves at most this much empty between it and either viewport edge. */
export const MAX_SIDE_GAP = 240;

/**
 * The widest empty run allowed inside a band, between its leftmost and rightmost content (WP-109 follow-up). The outer extent alone
 * cannot see a title at the left edge and its lead at the right edge with 900px of nothing between them, so the gate also projects the
 * band's content onto the x-axis and fails on the largest uncovered gap. The widest grid gap in the tokens is --sp-8 (4rem, 64px), so
 * 160px is two gaps and a ragged line end: room for a gutter between columns, none for a column's worth of nothing.
 */
export const MAX_INTERNAL_GAP = 160;

export interface BandExtent {
  /** A readable name for the band: tag, classes and its first heading. */
  readonly name: string;
  /** Height of the band, in px. */
  readonly height: number;
  /** Empty space between the viewport's left edge and the leftmost content. */
  readonly left: number;
  /** Empty space between the rightmost content and the viewport's right edge. */
  readonly right: number;
  /** Width of the union of the band's content. */
  readonly span: number;
  /** The largest horizontal run, in px, between the leftmost and rightmost content that no content covers. */
  readonly gap: number;
  /** Where that run starts, in px from the viewport's left edge (the run ends at `gapAt + gap`). */
  readonly gapAt: number;
}

/**
 * Runs inside the page (it is serialised into the browser, so it must not reference anything outside its own body). Returns one entry
 * per band of `main` that has content.
 */
export function measureBands(): BandExtent[] {
  const W = document.documentElement.clientWidth;
  const visible = (el: Element): boolean => {
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const hidden = (el: Element): boolean => el.closest('[aria-hidden="true"], [data-decorative], script, style, noscript, template') !== null;
  const ornament = (el: Element): boolean => el.closest('[data-decorative], script, style, noscript, template') !== null;
  const minVisual = 240;
  const label = (el: Element): string => {
    const cls = typeof el.className === 'string' && el.className.trim() !== '' ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    const heading = el.querySelector('h1, h2, h3')?.textContent?.trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls}${heading ? ` "${heading}"` : ''}`;
  };
  // A card is a small painted unit (a tile, a chip, a link card) that holds text: its box is content, so a grid of cards that fills the
  // frame counts to its last edge even when the words in the last card stop short of it. A wide panel does not count by its box, only
  // by what is in it, so a 1760px card with two lines at the left does not pass.
  const MAX_CARD = 640;
  const isCard = (el: Element): boolean => {
    const box = el.getBoundingClientRect();
    if (box.width < 48 || box.width > MAX_CARD || box.height < 24 || (el.textContent ?? '').trim() === '') return false;
    if (!visible(el) || hidden(el)) return false;
    const cs = getComputedStyle(el);
    const border = ['Top', 'Right', 'Bottom', 'Left'].some((side) => Number.parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none');
    const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    return border || fill;
  };
  const MEDIA = new Set(['IMG', 'VIDEO', 'CANVAS', 'IFRAME', 'INPUT', 'SELECT', 'TEXTAREA', 'TABLE', 'svg']);
  const extent = (root: Element): { l: number; r: number; gap: number; gapAt: number } | null => {
    let l = Number.POSITIVE_INFINITY;
    let r = Number.NEGATIVE_INFINITY;
    // The x-intervals of what is really painted: line boxes, media and cards. A block's own box (the extension that makes wrapped text
    // count to its column edge) is not painted content, so it does not close a gap.
    const solid: Array<[number, number]> = [];
    const add = (box: DOMRect, paints = true): void => {
      if (box.width <= 0 || box.height <= 0 || box.right <= 0 || box.left >= W) return;
      l = Math.min(l, Math.max(0, box.left));
      r = Math.max(r, Math.min(W, box.right));
      if (paints) solid.push([Math.max(0, box.left), Math.min(W, box.right)]);
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if ((node.textContent ?? '').trim() === '' || parent === null || !visible(parent) || hidden(parent)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = [...range.getClientRects()];
        for (const box of lines) add(box);
        // Text that wraps fills its block: the ragged end of its lines is how text sets, not empty space. A block of wrapped text counts
        // to its own right edge (its box, less padding), so a paragraph in a wide column is measured by the column it fills, and a
        // paragraph held to a narrow measure is measured by that narrow box. A single line counts to where it ends.
        if (new Set(lines.map((box) => Math.round(box.top))).size > 1) {
          let block: Element | null = parent;
          while (block !== null && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
          if (block !== null && block !== root) {
            const box = block.getBoundingClientRect();
            const pad = Number.parseFloat(getComputedStyle(block).paddingRight) || 0;
            add(new DOMRect(box.left, box.top, box.width - pad, box.height), false);
          }
        }
      } else if (node instanceof Element && isCard(node)) {
        add(node.getBoundingClientRect());
      } else if (node instanceof Element && MEDIA.has(node.tagName)) {
        if (!visible(node) || ornament(node)) continue;
        const box = node.getBoundingClientRect();
        // A visual hidden from assistive technology still counts when it is big enough to be the band's art.
        if (hidden(node) && box.width < minVisual) continue;
        if (node.tagName === 'svg' && box.width < 48) continue;
        add(box);
      }
    }
    if (!Number.isFinite(l)) return null;
    solid.sort((a, b) => a[0] - b[0]);
    let gap = 0;
    let gapAt = 0;
    let reach = solid.length > 0 ? solid[0][1] : 0;
    for (const [from, to] of solid) {
      if (from - reach > gap) {
        gap = from - reach;
        gapAt = reach;
      }
      reach = Math.max(reach, to);
    }
    return { l, r, gap, gapAt };
  };
  const main = document.querySelector('main');
  if (main === null) return [];
  // A layout may wrap its bands in one element; look through a single full-width wrapper.
  let bands = [...main.children];
  if (bands.length <= 2) bands = bands.flatMap((child) => (child.children.length > 1 && child.getBoundingClientRect().width > W * 0.9 ? [...child.children] : [child]));
  // An article wraps its hero, body and related band in one element: the bands are what is inside it.
  bands = bands.flatMap((band) => (band.tagName === 'ARTICLE' && band.children.length > 1 ? [...band.children] : [band]));
  const found: BandExtent[] = [];
  for (const band of bands) {
    const box = band.getBoundingClientRect();
    if (box.height < 20 || !visible(band) || hidden(band)) continue;
    const e = extent(band);
    if (e === null) continue;
    found.push({ name: label(band), height: Math.round(box.height), left: Math.round(e.l), right: Math.round(W - e.r), span: Math.round(e.r - e.l), gap: Math.round(e.gap), gapAt: Math.round(e.gapAt) });
  }
  return found;
}

/** A band that fails the gate, with the reason in numbers. */
export function offenders(bands: readonly BandExtent[], allow: readonly string[] = []): string[] {
  return bands
    .filter((b) => (b.span < MIN_CONTENT_SPAN || b.left > MAX_SIDE_GAP || b.right > MAX_SIDE_GAP || b.gap > MAX_INTERNAL_GAP) && !allow.some((a) => b.name.includes(a)))
    .map((b) => `${b.name}: content ${b.span}px wide, ${b.left}px empty on the left, ${b.right}px empty on the right, widest internal gap ${b.gap}px at x=${b.gapAt}`);
}

/**
 * Bands the gate does not judge, matched by a substring of the band's name (tag, classes, first heading). Every entry carries the
 * reason, and a new entry needs a reviewer to accept that reason: the default answer to a failure is to fix the layout.
 */
export const ALLOWED_BANDS: ReadonlyArray<{ readonly match: string; readonly reason: string }> = [];

/**
 * Routes the gate does not judge, with the reason. A route is here only when its layout is deliberately not a page of the site's
 * content frame; a page that merely fails the gate is fixed, not listed.
 */
export const ALLOWED_ROUTES: ReadonlyArray<{ readonly path: string; readonly reason: string }> = [
  {
    path: '/this-page-does-not-exist/',
    reason: 'The 404 page is one centred notice (a heading, a sentence and a button) so that a reader who lands on it sees one thing; there is no content for a second column to carry.',
  },
  {
    path: '/styleguide/',
    reason: 'The style guide is a developer reference that shows one component at a time on a bare canvas; it is a development route that scripts/audit-seo.mjs always marks noindex, and not a reader-facing page.',
  },
];

/** Asserts the content-extent gate for the page at the current viewport (1920x1080 in the WP-109 spec). */
export async function expectContentExtent(page: Page, allow: readonly string[] = []): Promise<number> {
  const bands = await page.evaluate(measureBands);
  const skip = [...ALLOWED_BANDS.map((a) => a.match), ...allow];
  expect(offenders(bands, skip), `bands whose content does not use the frame (min span ${MIN_CONTENT_SPAN}px, max side gap ${MAX_SIDE_GAP}px)`).toEqual([]);
  return bands.length;
}
