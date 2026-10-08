import type { Page } from '@playwright/test';

/**
 * Element-level overflow detector (WP-16, a11y CI gap 1, visual-brand 6.3).
 *
 * `documentElement.scrollWidth` cannot see clipped content: `.page` and `main` used to set `overflow-x: clip`, which hides
 * anything past the viewport edge from that measure and from the user. This detector measures bounding boxes instead.
 *
 * An element is an offender when its box leaves `[0, clientWidth]` (1px tolerance) and nothing makes the part outside the viewport
 * reachable. The rules, in the order they apply:
 * - Boxes under 2px, `display: none`, `visibility: hidden`, `position: fixed` and elements inside a closed popover are not content.
 * - A scroll container (`overflow-x: auto | scroll`) makes everything inside it reachable, as long as the container itself fits.
 * - `overflow: hidden | clip` is never an excuse for content, because that is exactly the blind spot: text, controls and borders
 *   cut off with no scrollbar. Decorative graphics (an `svg`, or anything `aria-hidden`) are excused only when a clipping ancestor
 *   that is not a page-frame safety net (`html`, `body`, `.page`, `main`) contains them and itself fits, so a card may crop its
 *   own hex art but a page-wide clip cannot hide a bleeding graphic.
 */
export interface Offender {
  readonly element: string;
  readonly left: number;
  readonly right: number;
  readonly viewport: number;
  readonly text: string;
  /** The nearest ancestor that clips without scrolling (a component or the page frame), when there is one. */
  readonly clippedBy: string | null;
}

export async function findOverflow(page: Page): Promise<Offender[]> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((): Offender[] => {
    const viewport = document.documentElement.clientWidth;
    const TOLERANCE = 1;
    const FRAME = (el: Element): boolean => el === document.documentElement || el === document.body || el.matches('.page, main');

    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : '';
      const classes = typeof el.className === 'string' && el.className.trim() !== '' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${classes}`;
    };

    const isInsideSvg = (el: Element): boolean => el.closest('svg') !== null && el.tagName.toLowerCase() !== 'svg';

    const inClosedPopover = (el: Element): boolean => {
      const popover = el.closest('[popover]');
      return popover !== null && !popover.matches(':popover-open');
    };

    const seen = new Set<Element>();
    const offenders: Offender[] = [];

    for (const el of document.body.querySelectorAll('*')) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'template' || tag === 'noscript' || tag === 'link' || tag === 'meta') continue;
      if (isInsideSvg(el) || inClosedPopover(el)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.display === 'contents' || style.visibility === 'hidden' || style.position === 'fixed') continue;
      const box = el.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      if (box.left >= -TOLERANCE && box.right <= viewport + TOLERANCE) continue;

      // Walk the ancestors once: find a scroll container that makes the element reachable, and the clipper that cuts it off.
      let scrolls = false;
      let hiddenByFixed = false;
      let clipper: Element | null = null;
      let frameClipper: Element | null = null;
      for (let up = el.parentElement; up !== null && up !== document.documentElement; up = up.parentElement) {
        const parentStyle = getComputedStyle(up);
        if (parentStyle.position === 'fixed') hiddenByFixed = true;
        const overflowX = parentStyle.overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          scrolls = true;
          break;
        }
        if (overflowX === 'hidden' || overflowX === 'clip') {
          if (FRAME(up)) frameClipper ??= up;
          else clipper ??= up;
        }
      }
      if (scrolls || hiddenByFixed) continue;

      const decorative = tag === 'svg' || el.closest('[aria-hidden="true"]') !== null;
      if (decorative && clipper !== null) {
        const clipBox = clipper.getBoundingClientRect();
        if (clipBox.left >= -TOLERANCE && clipBox.right <= viewport + TOLERANCE) continue;
      }

      // Report the outermost offender only: a wide row also makes every child of it wide.
      let ancestor = el.parentElement;
      let covered = false;
      while (ancestor !== null && ancestor !== document.body) {
        if (seen.has(ancestor)) {
          covered = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      seen.add(el);
      if (covered) continue;

      offenders.push({
        element: describe(el),
        left: Math.round(box.left),
        right: Math.round(box.right),
        viewport,
        text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        clippedBy: clipper !== null ? describe(clipper) : frameClipper !== null ? describe(frameClipper) : null,
      });
    }
    return offenders;
  });
}

/** One line per offender, for assertion messages. */
export function formatOffenders(offenders: readonly Offender[], limit = 6): string {
  const shown = offenders.slice(0, limit).map((o) => `${o.element} [${o.left}..${o.right} of ${o.viewport}]${o.clippedBy ? ` clipped by ${o.clippedBy}` : ''}${o.text ? ` "${o.text}"` : ''}`);
  const more = offenders.length > limit ? ` (+${offenders.length - limit} more)` : '';
  return `${shown.join('; ')}${more}`;
}
