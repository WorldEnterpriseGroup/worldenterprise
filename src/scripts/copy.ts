/**
 * <we-copy>: copy a template as Markdown, and print it. The element renders nothing until this script upgrades it,
 * and renders nothing at all when the Clipboard API is missing, so the no-JS page is simply the document plus the
 * static Markdown download.
 *
 * Attributes: source (URL of the .md file), target (CSS selector of the rendered document, used when the
 * download cannot be fetched), label, print (present: also render a Print button).
 */
const STATUS_MS = 5000;

class WeCopy extends HTMLElement {
  private markdown: string | null = null;
  private statusEl: HTMLElement | null = null;
  private timer: number | undefined;

  connectedCallback(): void {
    if (this.querySelector('button') !== null) return;
    const canCopy = typeof navigator.clipboard?.writeText === 'function';
    const canPrint = this.hasAttribute('print') && typeof window.print === 'function';
    if (!canCopy && !canPrint) return;

    const row = document.createElement('div');
    row.className = 'cluster we-copy__row';

    if (canCopy) {
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn btn--primary';
      copy.textContent = this.getAttribute('label') ?? 'Copy as Markdown';
      copy.addEventListener('click', () => void this.copy());
      row.append(copy);
      void this.prefetch();
    }
    if (canPrint) {
      const print = document.createElement('button');
      print.type = 'button';
      print.className = 'btn btn--secondary';
      print.textContent = 'Print';
      print.addEventListener('click', () => window.print());
      row.append(print);
    }

    const status = document.createElement('p');
    status.className = 'we-copy__status';
    status.setAttribute('role', 'status');
    this.statusEl = status;
    this.append(row, status);
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.timer);
  }

  /** Fetching ahead keeps the click handler synchronous enough for clipboard permission rules. */
  private async prefetch(): Promise<void> {
    const source = this.getAttribute('source');
    if (source === null) return;
    try {
      const response = await fetch(source, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${source}`);
      this.markdown = await response.text();
    } catch (error) {
      console.warn('we-copy: could not prefetch the Markdown download, the rendered text will be copied instead.', error);
    }
  }

  private fallbackText(): string {
    const selector = this.getAttribute('target');
    const target = selector === null ? null : document.querySelector<HTMLElement>(selector);
    return target?.innerText.trim() ?? '';
  }

  private async copy(): Promise<void> {
    const text = this.markdown ?? this.fallbackText();
    if (text === '') {
      this.announce('There is nothing to copy. Use the Markdown download instead.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.announce('Copied to the clipboard.');
    } catch (error) {
      console.warn('we-copy: the clipboard write was refused.', error);
      this.announce('Copying was blocked by the browser. Select the text and copy it, or use the Markdown download.');
    }
  }

  private announce(message: string): void {
    if (this.statusEl === null) return;
    this.statusEl.textContent = message;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (this.statusEl !== null) this.statusEl.textContent = '';
    }, STATUS_MS);
  }
}

if (!customElements.get('we-copy')) customElements.define('we-copy', WeCopy);
