/**
 * <we-carousel> (WP-22, #88): the island of Carousel. The track is a CSS scroll-snap list that works on its own; this adds:
 *
 * - Previous/Next buttons, disabled at the ends (no wrap-around: a list has a first and a last item);
 * - one button per item ("Item n of N", `aria-current` on the current one) for direct selection;
 * - the "Item n of N" status in a polite live region, updated after a button press or when a scroll settles;
 * - no autoplay, ever; smooth scrolling only without a reduced-motion preference (the CSS decides, the script never forces it).
 *
 * The current item is the one a button chose while it is still in view, otherwise the first item in view: so on a wide screen, where
 * the last items share the view, choosing item 7 shows "Item 7 of 7" even though the track cannot scroll it to the start.
 *
 * The pure helpers (`statusLabel`, `pickCurrent`, `visibleRange`) are exported for tests/unit/wp-22.
 */

export function statusLabel(index: number, total: number): string {
  return `Item ${index + 1} of ${total}`;
}

export interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * The first and last item at least `minShare` visible inside the view [viewStart, viewEnd). Positions are along the inline axis,
 * relative to the track's scroll origin. Returns [-1, -1] when nothing is visible.
 */
export function visibleRange(items: readonly Span[], viewStart: number, viewEnd: number, minShare = 0.6): [number, number] {
  let first = -1;
  let last = -1;
  items.forEach((item, i) => {
    const size = item.end - item.start;
    if (size <= 0) return;
    const shown = Math.min(item.end, viewEnd) - Math.max(item.start, viewStart);
    if (shown / size >= minShare) {
      if (first === -1) first = i;
      last = i;
    }
  });
  return [first, last];
}

/** Keeps `current` while it is in the visible range; otherwise the first visible item (or `current` if nothing is visible). */
export function pickCurrent(current: number, range: readonly [number, number]): number {
  const [first, last] = range;
  if (first === -1) return current;
  return current >= first && current <= last ? current : first;
}

export class WeCarousel extends HTMLElement {
  private track: HTMLElement | undefined;
  private items: HTMLElement[] = [];
  private prev: HTMLButtonElement | undefined;
  private next: HTMLButtonElement | undefined;
  private status: HTMLElement | undefined;
  private markers: HTMLButtonElement[] = [];
  private current = 0;
  /** The item a button asked for, held while a smooth scroll is still on its way to it. */
  private pending = -1;
  private frame = 0;
  private settle = 0;

  private readonly onScroll = (): void => {
    if (this.frame !== 0) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.sync(false);
    });
    // The status speaks only once the scroll has settled, not on every frame of it.
    window.clearTimeout(this.settle);
    this.settle = window.setTimeout(() => {
      // The scroll has stopped: whatever was chosen is now either in view (and stays current) or was scrolled away by the visitor.
      this.pending = -1;
      this.sync(true);
    }, 160);
  };

  connectedCallback(): void {
    const track = this.querySelector<HTMLElement>('[data-track]');
    const controls = this.querySelector<HTMLElement>('[data-controls]');
    const markerBox = this.querySelector<HTMLElement>('[data-markers]');
    const prev = this.querySelector('[data-prev]');
    const next = this.querySelector('[data-next]');
    const status = this.querySelector<HTMLElement>('[data-status]');
    if (track === null || controls === null || markerBox === null || status === null || !(prev instanceof HTMLButtonElement) || !(next instanceof HTMLButtonElement)) {
      console.warn('we-carousel: the carousel markup is incomplete; leaving the plain list');
      return;
    }
    this.items = Array.from(track.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
    if (this.items.length === 0) return;
    this.track = track;
    this.prev = prev;
    this.next = next;
    this.status = status;
    const total = this.items.length;
    this.markers = this.items.map((item, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(i + 1);
      const name = item.dataset.label ?? item.querySelector('h2, h3, h4')?.textContent?.trim() ?? '';
      button.setAttribute('aria-label', name === '' ? statusLabel(i, total) : `${statusLabel(i, total)}: ${name}`);
      button.setAttribute('aria-controls', track.id);
      button.addEventListener('click', () => this.goTo(i));
      return button;
    });
    markerBox.replaceChildren(...this.markers);
    prev.addEventListener('click', () => this.goTo(this.current - 1));
    next.addEventListener('click', () => this.goTo(this.current + 1));
    track.addEventListener('scroll', this.onScroll, { passive: true });
    controls.hidden = false;
    markerBox.hidden = false;
    this.dataset.ready = '';
    this.sync(false);
    status.textContent = statusLabel(this.current, total);
  }

  disconnectedCallback(): void {
    this.track?.removeEventListener('scroll', this.onScroll);
    window.cancelAnimationFrame(this.frame);
    window.clearTimeout(this.settle);
    this.frame = 0;
  }

  /** Scrolls item `index` to the start of the track (as far as the track allows) and makes it current. */
  goTo(index: number): void {
    const track = this.track;
    const item = this.items[index];
    if (track === undefined || item === undefined) return;
    this.current = index;
    const rtl = getComputedStyle(track).direction === 'rtl';
    const wanted = rtl ? item.offsetLeft + item.offsetWidth - track.clientWidth : item.offsetLeft;
    const left = Math.max(rtl ? -track.scrollWidth : 0, Math.min(wanted, track.scrollWidth - track.clientWidth));
    // Hold the choice through the scroll that follows; when the track is already there no scroll event comes, so nothing to hold.
    this.pending = Math.abs(left - track.scrollLeft) > 1 ? index : -1;
    // `scroll-behavior` on the track decides between smooth and instant, so reduced motion is honored by CSS alone.
    track.scrollTo({ left });
    this.render(true);
  }

  /** Re-reads which items are in view after a scroll. */
  private sync(speak: boolean): void {
    const track = this.track;
    if (track === undefined) return;
    const spans = this.items.map((item) => ({ start: item.offsetLeft, end: item.offsetLeft + item.offsetWidth }));
    const viewStart = track.scrollLeft;
    const range = visibleRange(spans, viewStart, viewStart + track.clientWidth);
    if (this.pending !== -1) {
      // Mid-flight to a chosen item: keep it current; it becomes an ordinary current item once it is in view.
      this.current = this.pending;
      if (this.pending >= range[0] && this.pending <= range[1]) this.pending = -1;
    } else {
      this.current = pickCurrent(this.current, range);
    }
    this.render(speak);
  }

  private render(speak: boolean): void {
    const total = this.items.length;
    const { prev, next } = this;
    if (prev !== undefined && next !== undefined) {
      prev.disabled = this.current <= 0;
      next.disabled = this.current >= total - 1;
      // A button that disables itself under the keyboard would drop focus to the page: hand it to the other one.
      if (prev.disabled && document.activeElement === prev) next.focus();
      if (next.disabled && document.activeElement === next) prev.focus();
    }
    this.markers.forEach((button, i) => {
      if (i === this.current) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    const text = statusLabel(this.current, total);
    if (speak && this.status !== undefined && this.status.textContent !== text) this.status.textContent = text;
  }
}

export function defineWeCarousel(): void {
  if (!customElements.get('we-carousel')) customElements.define('we-carousel', WeCarousel);
}
