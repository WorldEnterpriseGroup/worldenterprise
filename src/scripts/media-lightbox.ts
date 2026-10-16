/**
 * <we-lightbox> (WP-22, #88): the island of LightboxGallery. It turns the gallery's links into a modal viewer built on the native
 * `<dialog>`:
 *
 * - `showModal()` makes the page behind it inert, so focus stays in the viewer (the browser's own focus trap) and Escape closes it.
 *   `closedby="any"` adds a click on the backdrop where supported; a click outside the frame does the same elsewhere.
 * - Focus moves to the close button on open and returns to the thumbnail that opened it on close.
 * - Previous and Next wrap around the set. ArrowLeft/ArrowRight and Home/End work only while focus is inside the dialog: the listener
 *   is on the dialog, never on the document.
 * - "n of N" is shown; the polite live region announces "Image n of N: caption" after each step.
 * - Any failure leaves the links as they are, so the full-size image still opens.
 *
 * The pure helpers (`stepIndex`, `positionLabel`, `announcement`, `readItem`) are exported for tests/unit/wp-22.
 */

export interface LightboxEntry {
  readonly href: string;
  readonly srcset: string | undefined;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly caption: string;
  readonly credit: string;
}

/** The index after a step of `delta` (wrapping), or the first/last for `'first'`/`'last'`. */
export function stepIndex(current: number, total: number, delta: number | 'first' | 'last'): number {
  if (total <= 0) return 0;
  if (delta === 'first') return 0;
  if (delta === 'last') return total - 1;
  return (((current + delta) % total) + total) % total;
}

export function positionLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}

export function announcement(index: number, total: number, caption: string): string {
  return `Image ${positionLabel(index, total)}: ${caption}`;
}

const positiveInt = (raw: string | undefined): number => {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** The viewer's data for one gallery link, read from its href and data attributes. */
export function readItem(link: { readonly href: string; readonly dataset: DOMStringMap }): LightboxEntry {
  const d = link.dataset;
  return {
    href: link.href,
    srcset: d.srcset === undefined || d.srcset === '' ? undefined : d.srcset,
    width: positiveInt(d.width),
    height: positiveInt(d.height),
    alt: d.alt ?? '',
    caption: d.caption ?? '',
    credit: d.credit ?? '',
  };
}

const KEY_STEPS: Readonly<Record<string, number | 'first' | 'last'>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  Home: 'first',
  End: 'last',
};

export class WeLightbox extends HTMLElement {
  private links: HTMLAnchorElement[] = [];
  private entries: LightboxEntry[] = [];
  private index = 0;
  private opener: HTMLAnchorElement | undefined;
  private parts:
    | {
        readonly dialog: HTMLDialogElement;
        readonly frame: HTMLElement;
        readonly stage: HTMLElement;
        readonly caption: HTMLElement;
        readonly credit: HTMLElement;
        readonly position: HTMLElement;
        readonly live: HTMLElement;
        readonly close: HTMLButtonElement;
      }
    | undefined;

  private readonly onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a.lightbox__link') : null;
    if (link === null || !this.contains(link)) return;
    const index = this.links.indexOf(link);
    if (index === -1 || this.parts === undefined) return;
    event.preventDefault();
    this.open(index, link);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    const step = KEY_STEPS[event.key];
    if (step === undefined || !this.parts?.dialog.open) return;
    event.preventDefault();
    this.show(stepIndex(this.index, this.entries.length, step), true);
  };

  /**
   * The viewer fills the screen, so its backdrop is rarely reachable: a click on the empty dark area around the picture (the dialog, the
   * frame or the stage itself, never the picture, caption or a button) closes it too, as `closedby="any"` does for the backdrop.
   */
  private readonly onDialogClick = (event: MouseEvent): void => {
    const p = this.parts;
    if (p !== undefined && (event.target === p.dialog || event.target === p.frame || event.target === p.stage)) p.dialog.close();
  };

  private readonly onClose = (): void => {
    this.parts?.stage.replaceChildren();
    const opener = this.opener;
    this.opener = undefined;
    if (opener?.isConnected) opener.focus();
  };

  connectedCallback(): void {
    const dialog = this.querySelector('dialog');
    if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== 'function') {
      console.warn('we-lightbox: <dialog> is missing or unsupported; the links open the images instead');
      return;
    }
    const need = <T extends Element>(selector: string, type: abstract new () => T): T => {
      const el = dialog.querySelector(selector);
      if (!(el instanceof type)) throw new Error(`the viewer has no ${selector}`);
      return el;
    };
    let prev: HTMLButtonElement;
    let next: HTMLButtonElement;
    try {
      this.parts = {
        dialog,
        frame: need('.lightbox__frame', HTMLElement),
        stage: need('[data-stage]', HTMLElement),
        caption: need('[data-caption]', HTMLElement),
        credit: need('[data-credit]', HTMLElement),
        position: need('[data-position]', HTMLElement),
        live: need('[data-live]', HTMLElement),
        close: need('[data-close]', HTMLButtonElement),
      };
      prev = need('[data-prev]', HTMLButtonElement);
      next = need('[data-next]', HTMLButtonElement);
    } catch (error) {
      this.parts = undefined;
      console.warn('we-lightbox: the viewer markup is incomplete; the links open the images instead', error);
      return;
    }
    this.links = Array.from(this.querySelectorAll<HTMLAnchorElement>('a.lightbox__link'));
    this.entries = this.links.map(readItem);
    if (this.links.length === 0) return;
    this.addEventListener('click', this.onClick);
    dialog.addEventListener('keydown', this.onKey);
    dialog.addEventListener('click', this.onDialogClick);
    dialog.addEventListener('close', this.onClose);
    prev.addEventListener('click', () => this.show(stepIndex(this.index, this.entries.length, -1), true));
    next.addEventListener('click', () => this.show(stepIndex(this.index, this.entries.length, 1), true));
    this.parts.close.addEventListener('click', () => dialog.close());
    this.dataset.ready = '';
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.onClick);
    if (this.parts?.dialog.open) this.parts.dialog.close();
  }

  private open(index: number, opener: HTMLAnchorElement): void {
    if (this.parts === undefined) return;
    this.opener = opener;
    this.show(index, false);
    try {
      this.parts.dialog.showModal();
    } catch (error) {
      console.warn('we-lightbox: the viewer could not open; following the link instead', error);
      window.location.assign(opener.href);
      return;
    }
    this.parts.close.focus();
    this.announce();
  }

  /** Puts entry `index` on the stage; with `announce`, the live region reads it out. */
  private show(index: number, announce: boolean): void {
    const parts = this.parts;
    const entry = this.entries[index];
    if (parts === undefined || entry === undefined) return;
    this.index = index;
    const img = document.createElement('img');
    img.alt = entry.alt;
    img.decoding = 'async';
    if (entry.width > 0 && entry.height > 0) {
      img.width = entry.width;
      img.height = entry.height;
    }
    if (entry.srcset !== undefined) {
      img.srcset = entry.srcset;
      img.sizes = '100vw';
    }
    img.src = entry.href;
    parts.stage.replaceChildren(img);
    parts.caption.textContent = entry.caption;
    parts.credit.textContent = entry.credit;
    parts.credit.hidden = entry.credit === '';
    parts.position.textContent = positionLabel(index, this.entries.length);
    if (announce) this.announce();
  }

  private announce(): void {
    const entry = this.entries[this.index];
    if (this.parts === undefined || entry === undefined) return;
    this.parts.live.textContent = announcement(this.index, this.entries.length, entry.caption);
  }
}

export function defineWeLightbox(): void {
  if (!customElements.get('we-lightbox')) customElements.define('we-lightbox', WeLightbox);
}
