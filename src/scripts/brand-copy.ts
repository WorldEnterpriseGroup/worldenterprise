/**
 * <we-brand-copy>: copy a short block of brand text (the boilerplate, a list of token names) with one button. Progressive
 * enhancement: without JavaScript the text is plain, selectable page content and the hint under it says how to copy it.
 * The element stores nothing (no cookies, no web storage) and sends nothing anywhere.
 *
 * Attributes: data-text (the exact string to copy; defaults to the visible text of the source block), data-label (the button name).
 * Children: [data-copy-source] holds the visible text, [data-copy-hint] is the no-JavaScript instruction.
 *
 * Where the Clipboard API is missing or refuses the write, the button selects the text instead and says how to copy the selection.
 */
const STATUS_MS = 6000;

type Outcome = 'copied' | 'selected' | 'empty';

export interface CopyEnvironment {
  readonly clipboard: { writeText(text: string): Promise<void> } | undefined;
  select(node: Node): boolean;
}

/**
 * Copies `text` through the Clipboard API, or selects `source` when the API is missing or refuses. Pure over its environment so a
 * unit test can drive both paths. A refused write is reported through `onRefused`, never swallowed.
 */
export async function copyOrSelect(
  text: string,
  source: Node | null,
  env: CopyEnvironment,
  onRefused: (error: unknown) => void,
): Promise<Outcome> {
  if (text === '') return 'empty';
  if (env.clipboard !== undefined) {
    try {
      await env.clipboard.writeText(text);
      return 'copied';
    } catch (error) {
      onRefused(error);
    }
  }
  return source !== null && env.select(source) ? 'selected' : 'empty';
}

export const MESSAGES: Readonly<Record<Outcome, string>> = {
  copied: 'Copied to the clipboard.',
  selected: 'The text is selected. Press Control+C, or Command+C on a Mac, to copy it.',
  empty: 'There is nothing to copy here.',
};

/** Replaces the no-JavaScript hint once the button exists. */
export const HINT_WITH_BUTTON = 'Use the button, or select the text and copy it.';

function browserEnvironment(): CopyEnvironment {
  return {
    clipboard: typeof navigator.clipboard?.writeText === 'function' ? navigator.clipboard : undefined,
    select(node: Node): boolean {
      const selection = window.getSelection();
      if (selection === null) return false;
      selection.removeAllRanges();
      selection.selectAllChildren(node);
      return true;
    },
  };
}

/** Defines the element. A function, so importing this module in a test (no DOM) does not touch `HTMLElement`. */
export function defineBrandCopy(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-brand-copy') !== undefined) return;

  class WeBrandCopy extends HTMLElement {
    private statusEl: HTMLElement | null = null;
    private timer: number | undefined;

    connectedCallback(): void {
      if (this.querySelector('button') !== null) return;
      const source = this.querySelector('[data-copy-source]');
      if (source === null) {
        console.warn('we-brand-copy: no [data-copy-source] block, so there is nothing to offer a button for.');
        return;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--secondary';
      button.textContent = this.getAttribute('data-label') ?? 'Copy';
      button.addEventListener('click', () => void this.run(source));

      const status = document.createElement('p');
      status.className = 'we-brand-copy__status';
      status.setAttribute('aria-live', 'polite');
      this.statusEl = status;

      const hint = this.querySelector('[data-copy-hint]');
      if (hint !== null) hint.textContent = HINT_WITH_BUTTON;
      this.append(button, status);
    }

    disconnectedCallback(): void {
      window.clearTimeout(this.timer);
    }

    private async run(source: Element): Promise<void> {
      const text = this.getAttribute('data-text') ?? (source as HTMLElement).innerText.trim();
      const outcome = await copyOrSelect(text, source, browserEnvironment(), (error) => {
        console.warn('we-brand-copy: the clipboard write was refused, selecting the text instead.', error);
      });
      this.announce(MESSAGES[outcome]);
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

  customElements.define('we-brand-copy', WeBrandCopy);
}

defineBrandCopy();
