/**
 * <we-sbir-checklist> (WP-34): a readiness checklist the server renders in full. The script only adds a running count and keeps the
 * ticks in the part of the address after the "#", which the browser does not send to any server: no storage, no cookie, no request.
 * Without JavaScript the boxes still tick and the list still prints; only the count is missing.
 */

/** A longer hash is not one this page wrote. */
const MAX_HASH_LENGTH = 400;

/** Keeps the known ids, once each, in checklist order. */
export function normaliseTicks(ids: Iterable<string>, known: readonly string[]): string[] {
  const wanted = new Set(ids);
  return known.filter((id) => wanted.has(id));
}

/** The hash key a list uses when its element names none. */
export const DEFAULT_KEY = 'ready';

/** Reads `#ready=problem.customer` (or the list's own key). Anything else in the hash is ignored. */
export function parseTicks(hash: string, known: readonly string[], key: string = DEFAULT_KEY): string[] {
  const body = hash.replace(/^#/, '').slice(0, MAX_HASH_LENGTH);
  for (const piece of body.split('&')) {
    const cut = piece.indexOf('=');
    if (cut === -1 || piece.slice(0, cut) !== key) continue;
    try {
      return normaliseTicks(decodeURIComponent(piece.slice(cut + 1)).split('.').map((s) => s.trim().toLowerCase()), known);
    } catch {
      return [];
    }
  }
  return [];
}

/** The pieces of a hash that are not this list's, so two lists on one page keep each other's ticks. */
function otherPieces(hash: string, key: string): string[] {
  return hash
    .replace(/^#/, '')
    .slice(0, MAX_HASH_LENGTH)
    .split('&')
    .filter((piece) => piece !== '' && piece.split('=')[0] !== key);
}

/** The whole hash after this list changes: its own piece first, the other lists' pieces after, or an empty string for none. */
export function serializeTicks(ticks: readonly string[], key: string = DEFAULT_KEY, currentHash = ''): string {
  const pieces = [...(ticks.length === 0 ? [] : [`${key}=${ticks.join('.')}`]), ...otherPieces(currentHash, key)];
  return pieces.length === 0 ? '' : `#${pieces.join('&')}`;
}

export function progressText(checked: number, total: number): string {
  return `${checked} of ${total} ${total === 1 ? 'item' : 'items'} ready.`;
}

export function defineSbirChecklist(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-sbir-checklist') !== undefined) return;

  class WeSbirChecklist extends HTMLElement {
    private boxes: HTMLInputElement[] = [];
    private status: HTMLElement | null = null;

    connectedCallback(): void {
      this.boxes = [...this.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-id]')];
      this.status = this.querySelector<HTMLElement>('[data-progress]');
      const known = this.boxes.map((b) => b.dataset['id'] ?? '');
      const ticked = new Set(parseTicks(window.location.hash, known, this.dataset['key'] ?? DEFAULT_KEY));
      for (const box of this.boxes) box.checked = ticked.has(box.dataset['id'] ?? '');
      this.addEventListener('change', this.onChange);
      this.render();
    }

    disconnectedCallback(): void {
      this.removeEventListener('change', this.onChange);
    }

    private onChange = (): void => {
      this.render();
      const known = this.boxes.map((b) => b.dataset['id'] ?? '');
      const ticked = normaliseTicks(this.boxes.filter((b) => b.checked).map((b) => b.dataset['id'] ?? ''), known);
      try {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${serializeTicks(ticked, this.dataset['key'] ?? DEFAULT_KEY, window.location.hash)}`);
      } catch (error) {
        // History can be locked in sandboxed frames. The count above still works, so the ticks just stay on this page view.
        if (!(error instanceof DOMException)) throw error;
      }
    };

    private render(): void {
      if (this.status === null) return;
      this.status.textContent = progressText(this.boxes.filter((b) => b.checked).length, this.boxes.length);
    }
  }

  customElements.define('we-sbir-checklist', WeSbirChecklist);
}
