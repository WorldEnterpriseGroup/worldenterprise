import { loadPagefind } from '../components/islands/we-search/pagefind.ts';
import type { PagefindApi } from '../components/islands/we-search/pagefind.ts';
import { kindLabel, normalizeBase, normalizeQuery, resolveResultUrl, resultKind } from '../components/islands/we-search/query.ts';
import { groupCommands, highlight, rankCommands } from '../components/islands/we-palette/match.ts';
import { parseCommands } from '../components/nav/commands.ts';
import type { PaletteCommand } from '../components/nav/commands.ts';

/**
 * <we-palette>: the command palette. A modal <dialog> opened by Ctrl or Cmd plus K, by "/" (outside a field) and by any
 * [data-palette-open] button. The list of pages is read from data-commands (built at build time from the navigation and the route
 * state, so it never names a page that does not exist); the visitor's words filter it locally and instantly. Page matches from the
 * Pagefind index are added after a short pause, loaded the way <we-search> loads it. Nothing leaves the site: no third-party request.
 *
 * Roles: the input is a combobox that controls a listbox and points at the active option with aria-activedescendant. Options are
 * links (role="option") so a result still opens in a new tab on request; Enter activates the active one. The dialog is modal, so the
 * browser traps focus inside it and returns it to the opener on close.
 */
const DEBOUNCE_MS = 120;
const MIN_PAGEFIND_QUERY = 2;
const MAX_PAGE_RESULTS = 6;

interface FoundPage {
  readonly title: string;
  readonly url: string;
}

interface OptionModel {
  readonly id: string;
  readonly element: HTMLAnchorElement;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}

class WePalette extends HTMLElement {
  private dialog!: HTMLDialogElement;
  private input!: HTMLInputElement;
  private list!: HTMLElement;
  private note!: HTMLElement;
  private status!: HTMLElement;
  private base = '';
  private searchUrl = '/search/';
  private commands: readonly PaletteCommand[] = [];
  private options: OptionModel[] = [];
  private active = -1;
  private found: readonly FoundPage[] = [];
  private serial = 0;
  private timer: number | undefined;
  /** Listeners on the dialog are attached once; the document listeners follow the element in and out of the page. */
  private initialised = false;

  connectedCallback(): void {
    if (!this.initialised && !this.init()) return;
    document.addEventListener('keydown', this.onDocumentKeydown);
    document.addEventListener('click', this.onDocumentClick);
    window.addEventListener('pagehide', this.onPageHide);
    this.reveal();
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.timer);
    document.removeEventListener('keydown', this.onDocumentKeydown);
    document.removeEventListener('click', this.onDocumentClick);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  /** Returns false, and leaves the header links in place, when the markup is not what the script expects. */
  private init(): boolean {
    const dialog = this.querySelector<HTMLDialogElement>('[data-palette-dialog]');
    const input = this.querySelector<HTMLInputElement>('[data-palette-input]');
    const list = this.querySelector<HTMLElement>('[data-palette-list]');
    const note = this.querySelector<HTMLElement>('[data-palette-note]');
    const status = this.querySelector<HTMLElement>('[data-palette-status]');
    if (!dialog || !input || !list || !note || !status || typeof dialog.showModal !== 'function') {
      console.error('we-palette: the expected markup is missing, the palette is disabled.');
      return false;
    }
    this.dialog = dialog;
    this.input = input;
    this.list = list;
    this.note = note;
    this.status = status;
    this.base = normalizeBase(this.getAttribute('data-base') ?? '');
    this.searchUrl = resolveResultUrl(this.getAttribute('data-search-url') ?? '/search/', this.base);
    this.commands = parseCommands(this.getAttribute('data-commands'), (reason) => console.error(`we-palette: ${reason}, the list is empty.`));
    this.initialised = true;

    input.addEventListener('input', () => this.onInput());
    input.addEventListener('keydown', (event) => this.onInputKeydown(event));
    list.addEventListener('pointermove', (event) => this.onPointerMove(event));
    // A plain click on an option follows its link; the palette closes so a page restored from the history never shows it open. A click
    // that asks for a new tab or window leaves the palette where it is.
    list.addEventListener('click', (event) => {
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) this.dialog.close();
    });
    // The dialog fills its own box, so a click that lands on the dialog itself is a click on the backdrop.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      window.clearTimeout(this.timer);
      this.serial += 1;
      this.input.setAttribute('aria-expanded', 'false');
    });
    this.querySelector<HTMLElement>('[data-palette-close]')?.addEventListener('click', () => dialog.close());
    return true;
  }

  /** The buttons that open the palette stay hidden, and the links they stand in for stay visible, until there is a palette to open. */
  private reveal(): void {
    for (const button of document.querySelectorAll<HTMLElement>('[data-palette-open]')) button.hidden = false;
    for (const link of document.querySelectorAll<HTMLElement>('[data-palette-fallback]')) link.hidden = true;
  }

  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) return;
    const key = event.key.toLowerCase();
    if (key === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      if (this.dialog.open) this.dialog.close();
      else this.open();
      return;
    }
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat && !this.dialog.open && !isEditable(event.target)) {
      event.preventDefault();
      this.open();
    }
  };

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-palette-open]') === null) return;
    event.preventDefault();
    this.open();
  };

  private readonly onPageHide = (): void => {
    if (this.dialog.open) this.dialog.close();
  };

  open(): void {
    if (this.dialog.open) {
      this.input.focus();
      return;
    }
    // A mega panel or the drawer is a popover over the page. Closing it first keeps the drawer from pulling focus back out of the dialog.
    for (const popover of document.querySelectorAll<HTMLElement>(':popover-open')) popover.hidePopover();
    this.input.value = '';
    this.found = [];
    this.note.hidden = true;
    this.dialog.showModal();
    this.input.setAttribute('aria-expanded', 'true');
    this.render('');
    this.announce('');
    this.input.focus();
    // After the list is on screen: the index is not needed to show or filter the pages. A failed load is reported when the visitor
    // searches (searchIndex), so here it only clears the cached promise and the next search tries again.
    this.ensureIndex().catch(() => {
      this.api = null;
    });
  }

  private api: Promise<PagefindApi> | null = null;

  private ensureIndex(): Promise<PagefindApi> {
    this.api ??= loadPagefind(this.getAttribute('data-pagefind'));
    return this.api;
  }

  private onInput(): void {
    const query = normalizeQuery(this.input.value);
    this.found = [];
    this.render(query);
    window.clearTimeout(this.timer);
    const ticket = ++this.serial;
    if (query.length < MIN_PAGEFIND_QUERY) {
      this.announce(query);
      return;
    }
    this.timer = window.setTimeout(() => void this.searchIndex(query, ticket), DEBOUNCE_MS);
  }

  private async searchIndex(query: string, ticket: number): Promise<void> {
    try {
      const api = await this.ensureIndex();
      const response = await api.search(query);
      if (ticket !== this.serial) return;
      const rows = await Promise.all(response.results.slice(0, MAX_PAGE_RESULTS * 2).map((result) => result.data()));
      if (ticket !== this.serial) return;
      const known = new Set(this.commands.map((command) => resolveResultUrl(command.href, this.base)));
      this.found = rows
        .map((row) => ({ title: row.meta['title'] ?? row.url, url: resolveResultUrl(row.url, this.base) }))
        .filter((row) => !known.has(row.url))
        .slice(0, MAX_PAGE_RESULTS);
      this.note.hidden = true;
      this.render(query, true);
      this.announce(query);
    } catch (error) {
      if (ticket !== this.serial) return;
      this.api = null;
      console.warn('we-palette: page search is not available.', error);
      this.note.textContent = 'Page search is not available right now. The pages above are still listed.';
      this.note.hidden = false;
      this.announce(query);
    }
  }

  private onInputKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.activate();
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!(event.target instanceof Element)) return;
    const option = event.target.closest<HTMLElement>('[role="option"]');
    if (option === null) return;
    const index = this.options.findIndex((candidate) => candidate.element === option);
    if (index !== -1 && index !== this.active) this.select(index, false);
  }

  private move(step: number): void {
    const count = this.options.length;
    if (count === 0) return;
    this.select(this.active < 0 ? (step > 0 ? 0 : count - 1) : (this.active + step + count) % count, true);
  }

  private select(index: number, scroll: boolean): void {
    const previous = this.options[this.active];
    if (previous) previous.element.setAttribute('aria-selected', 'false');
    this.active = index;
    const next = this.options[index];
    if (!next) {
      this.input.removeAttribute('aria-activedescendant');
      return;
    }
    next.element.setAttribute('aria-selected', 'true');
    this.input.setAttribute('aria-activedescendant', next.id);
    if (scroll) next.element.scrollIntoView({ block: 'nearest' });
  }

  /** Enter opens the active option. A click on a link is left to the browser, so a modified click works as it does anywhere. */
  private activate(): void {
    const option = this.options[this.active];
    if (!option) return;
    this.dialog.close();
    option.element.click();
  }

  private makeOption(id: string, href: string, label: string, query: string, hint?: string, kind?: string): OptionModel {
    const element = document.createElement('a');
    element.id = id;
    element.className = 'we-palette__option';
    element.setAttribute('role', 'option');
    element.setAttribute('aria-selected', 'false');
    element.tabIndex = -1;
    element.href = href;
    const name = document.createElement('span');
    name.className = 'we-palette__label';
    for (const part of highlight(label, query)) {
      if (part.match) {
        const mark = document.createElement('mark');
        mark.textContent = part.text;
        name.append(mark);
      } else {
        name.append(document.createTextNode(part.text));
      }
    }
    element.append(name);
    if (kind !== undefined) element.append(text('span', 'we-palette__kind', kind));
    if (hint !== undefined && hint !== '') element.append(text('span', 'we-palette__hint', hint));
    return { id, element };
  }

  private group(name: string, members: readonly OptionModel[]): HTMLElement {
    const group = document.createElement('div');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', name);
    const label = text('div', 'we-palette__group-label', name);
    label.setAttribute('aria-hidden', 'true');
    group.append(label, ...members.map((member) => member.element));
    return group;
  }

  /**
   * Draws the list for `query`: the matching pages in groups, then the page matches found in the index, then, for a query, one option
   * that opens the full search. The active option stays on the same destination across a redraw when it is still there.
   */
  private render(query: string, keepActive = false): void {
    const keep = keepActive ? this.options[this.active]?.element.getAttribute('href') : null;
    const ranked = rankCommands(this.commands, query);
    const groups = groupCommands(ranked, query);
    const options: OptionModel[] = [];
    const nodes: HTMLElement[] = [];
    let counter = 0;
    const next = (): string => `we-palette-option-${counter++}`;

    for (const group of groups) {
      const members = group.commands.map((command) => this.makeOption(next(), resolveResultUrl(command.href, this.base), command.label, query, command.hint));
      options.push(...members);
      nodes.push(this.group(group.name, members));
    }

    if (this.found.length > 0) {
      const members = this.found.map((page) => {
        const kind = resultKind(page.url, this.base);
        return this.makeOption(next(), page.url, page.title, query, undefined, kind === null ? undefined : kindLabel(kind));
      });
      options.push(...members);
      nodes.push(this.group('From the search index', members));
    }

    if (query !== '') {
      const all = this.makeOption(next(), `${this.searchUrl}?q=${encodeURIComponent(query)}`, `Search all pages for “${query}”`, '');
      options.push(all);
      nodes.push(this.group('Search', [all]));
    }

    this.list.replaceChildren(...nodes);
    this.options = options;
    this.active = -1;
    this.input.setAttribute('aria-expanded', options.length > 0 ? 'true' : 'false');
    const keptIndex = keep === null || keep === undefined ? -1 : options.findIndex((option) => option.element.getAttribute('href') === keep);
    this.select(keptIndex >= 0 ? keptIndex : options.length > 0 ? 0 : -1, false);
    if (!keepActive) this.list.scrollTop = 0;
  }

  /** The live region says how many pages match, once per settled change and not on every keystroke's intermediate list. */
  private announce(query: string): void {
    const pages = this.options.length - (query === '' ? 0 : 1);
    if (query === '') this.status.textContent = `${pages} pages. Type to filter.`;
    else if (pages <= 0) this.status.textContent = `No pages match “${query}”. Press Enter to search all pages.`;
    else this.status.textContent = pages === 1 ? `1 page matches “${query}”.` : `${pages} pages match “${query}”.`;
  }
}

if (!customElements.get('we-palette')) customElements.define('we-palette', WePalette);
