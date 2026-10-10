import { loadPagefind } from '../components/islands/we-search/pagefind.ts';
import type { PagefindApi, PagefindData, PagefindResult } from '../components/islands/we-search/pagefind.ts';
import {
  RESULT_KINDS,
  filteredStatus,
  kindLabel,
  kindsPresent,
  normalizeBase,
  normalizeQuery,
  readQuery,
  readType,
  resolveResultUrl,
  resultKind,
  resultsStatus,
  withQuery,
  withType,
} from '../components/islands/we-search/query.ts';
import type { ResultKind } from '../components/islands/we-search/query.ts';

/**
 * <we-search>: static site search over the Pagefind index that the postbuild step writes to /pagefind/ after the
 * Astro build. Pagefind is loaded at runtime from the data-pagefind attribute (it does not exist before postbuild).
 * Without JavaScript the search form stays hidden and the page shows links to the site map instead.
 *
 * Result types: Pagefind can only be filtered by URL once a result's data is fetched, so the first HYDRATE_LIMIT results are fetched in the
 * background after the first page is on screen. The chips show the types found among them, and a chip filters that set. A search with
 * more matches than that says its filter covers the first HYDRATE_LIMIT.
 */
const PAGE_SIZE = 10;
const DEBOUNCE_MS = 200;
const HYDRATE_LIMIT = 50;
const SETTLE_MS = 400;

/** Keeps text and <mark> only. Pagefind excerpts are HTML-escaped text with <mark> around matches. */
function excerptFragment(html: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Node, into: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        into.appendChild(document.createTextNode(child.textContent ?? ''));
      } else if (child instanceof Element && child.tagName === 'MARK') {
        const mark = document.createElement('mark');
        mark.textContent = child.textContent ?? '';
        into.appendChild(mark);
      } else {
        walk(child, into);
      }
    }
  };
  walk(doc.body, fragment);
  return fragment;
}

class WeSearch extends HTMLElement {
  private api: PagefindApi | null = null;
  private form!: HTMLFormElement;
  private input!: HTMLInputElement;
  private status!: HTMLElement;
  private list!: HTMLOListElement;
  private more!: HTMLButtonElement;
  private chips!: HTMLElement;
  private base = '';
  private query = '';
  private pending: readonly PagefindResult[] = [];
  /** The data of each result already requested, by its position in `pending`. One map per search, so a stale search cannot fill the next. */
  private fetched = new Map<number, Promise<PagefindData>>();
  private filter: ResultKind | null = null;
  /** Rows of the current view that are in the list. The view is the whole result set, or the rows of one type. */
  private shown = 0;
  /** Counts searches. The background work that builds the chips belongs to one search. */
  private search = 0;
  /** Counts views (a search, or a chip). The rows that are rendered belong to one view. */
  private view = 0;
  private timer: number | undefined;
  private settling: number | undefined;
  /** A batch of rows is being fetched. A second click on "Show more" meanwhile must not start the same batch again. */
  private rendering = false;
  /** The kinds the chips were built for, so a new search with the same kinds keeps the buttons (and the focus on one). */
  private chipKey = '';
  /** Listeners are attached once. connectedCallback runs again when the element is moved (a view transition, a re-parent). */
  private initialised = false;

  connectedCallback(): void {
    if (this.initialised) return;
    const form = this.querySelector<HTMLFormElement>('form');
    const input = this.querySelector<HTMLInputElement>('input[type="search"]');
    const status = this.querySelector<HTMLElement>('[data-search-status]');
    const list = this.querySelector<HTMLOListElement>('[data-search-results]');
    const more = this.querySelector<HTMLButtonElement>('[data-search-more]');
    const chips = this.querySelector<HTMLElement>('[data-search-chips]');
    if (!form || !input || !status || !list || !more || !chips) {
      console.error('we-search: the expected markup is missing, search is disabled.');
      return;
    }
    this.form = form;
    this.input = input;
    this.status = status;
    this.list = list;
    this.more = more;
    this.chips = chips;
    this.base = normalizeBase(this.getAttribute('data-base') ?? '');
    this.initialised = true;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      window.clearTimeout(this.timer);
      void this.run(this.input.value, true);
    });
    input.addEventListener('input', () => {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.run(this.input.value, true), DEBOUNCE_MS);
    });
    more.addEventListener('click', () => {
      this.renderNext().catch((error: unknown) => {
        console.error('we-search: more results could not be loaded.', error);
        this.status.textContent = 'More results could not be loaded. Try again.';
      });
    });
    chips.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-kind]') : null;
      if (button === null || !chips.contains(button)) return;
      const value = button.getAttribute('data-kind') ?? '';
      this.choose(RESULT_KINDS.find((row) => row.id === value)?.id ?? null);
    });

    void this.start();
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.timer);
    window.clearTimeout(this.settling);
    if (this.initialised) this.list.removeAttribute('data-settling');
  }

  private async start(): Promise<void> {
    try {
      this.api = await loadPagefind(this.getAttribute('data-pagefind'));
    } catch (error) {
      console.error('we-search: the Pagefind index could not be loaded.', error);
      this.fail('Search is not available right now. Use the links below to find a page.');
      return;
    }
    this.setAttribute('data-state', 'ready');
    this.form.hidden = false;
    this.filter = readType(window.location.search);
    const initial = readQuery(window.location.search);
    if (initial !== '') {
      this.input.value = initial;
      await this.run(initial, false);
    }
  }

  private fail(message: string): void {
    this.setAttribute('data-state', 'error');
    this.status.textContent = message;
  }

  private async run(raw: string, updateUrl: boolean): Promise<void> {
    const api = this.api;
    if (api === null) return;
    const query = normalizeQuery(raw);
    const search = ++this.search;
    const view = ++this.view;
    if (updateUrl) this.replaceSearch((current) => withQuery(current, query));
    this.query = query;
    this.pending = [];
    this.fetched = new Map();
    this.list.replaceChildren();
    this.more.hidden = true;
    this.shown = 0;
    this.rendering = false;
    if (query === '') {
      this.showChips([]);
      this.status.textContent = '';
      return;
    }
    this.status.textContent = 'Searching.';
    try {
      const response = await api.search(query);
      if (view !== this.view) return;
      this.pending = response.results;
      await this.present(view);
      if (view !== this.view) return;
      void this.readTypes(search);
    } catch (error) {
      if (view !== this.view) return;
      console.error('we-search: the search request failed.', error);
      this.status.textContent = 'The search could not run. Try again, or use the links below.';
    }
  }

  /** Fetches the data of one result once; a failed fetch is forgotten so that the next attempt starts again. */
  private row(index: number): Promise<PagefindData> {
    const cache = this.fetched;
    const known = cache.get(index);
    if (known !== undefined) return known;
    const result = this.pending[index];
    if (result === undefined) return Promise.reject(new Error(`There is no search result at position ${index}.`));
    const fetching = result.data();
    cache.set(index, fetching);
    fetching.catch(() => cache.delete(index));
    return fetching;
  }

  private rowsUpTo(end: number): Promise<PagefindData[]> {
    return Promise.all(Array.from({ length: end }, (_, index) => this.row(index)));
  }

  /** The first HYDRATE_LIMIT results, with their data. */
  private hydrate(): Promise<PagefindData[]> {
    return this.rowsUpTo(Math.min(this.pending.length, HYDRATE_LIMIT));
  }

  /** Puts the status line and the first batch of the current view on screen: every result, or the results of the chosen type. */
  private async present(view: number): Promise<void> {
    this.list.replaceChildren();
    this.more.hidden = true;
    this.shown = 0;
    this.rendering = false;
    const filter = this.filter;
    if (filter === null) {
      this.status.textContent = resultsStatus(this.pending.length, this.query);
    } else {
      this.status.textContent = 'Filtering.';
      const rows = await this.hydrate();
      if (view !== this.view) return;
      const covered = this.pending.length > HYDRATE_LIMIT ? ` The filter covers the first ${HYDRATE_LIMIT} matches.` : '';
      this.status.textContent = `${filteredStatus(this.matching(rows, filter).length, this.query, filter)}${covered}`;
    }
    await this.renderNext(view);
  }

  private matching(rows: readonly PagefindData[], filter: ResultKind): PagefindData[] {
    return rows.filter((row) => resultKind(row.url, this.base) === filter);
  }

  /**
   * Appends the next batch of rows. `shown` only moves once the rows are in the list, so a failed fetch can be retried, and `rendering`
   * keeps a double click from fetching and appending the same batch twice (the second click is a no-op until the first batch is in).
   */
  private async renderNext(view: number = this.view): Promise<void> {
    if (this.rendering) return;
    this.rendering = true;
    try {
      const filter = this.filter;
      let batch: PagefindData[];
      let total: number;
      if (filter === null) {
        total = this.pending.length;
        const end = Math.min(this.shown + PAGE_SIZE, total);
        if (end <= this.shown) return;
        batch = (await this.rowsUpTo(end)).slice(this.shown);
      } else {
        const matches = this.matching(await this.hydrate(), filter);
        total = matches.length;
        batch = matches.slice(this.shown, this.shown + PAGE_SIZE);
      }
      if (view !== this.view) return;
      const settle = this.shown > 0;
      for (const row of batch) this.list.append(this.renderRow(row));
      this.shown += batch.length;
      if (settle) this.settle();
      this.more.hidden = this.shown >= total;
    } finally {
      // A newer view has already reset the flag for its own batches; only the batch that still owns it may release it.
      if (view === this.view) this.rendering = false;
    }
  }

  /**
   * After "Show more" the new rows move the button and put result links where the pointer was. A double click's second click would
   * open one of them, so the list ignores the pointer for SETTLE_MS (see the stylesheet).
   */
  private settle(): void {
    this.list.setAttribute('data-settling', '');
    window.clearTimeout(this.settling);
    this.settling = window.setTimeout(() => this.list.removeAttribute('data-settling'), SETTLE_MS);
  }

  private renderRow(data: PagefindData): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'we-search__result';
    const kind = resultKind(data.url, this.base);
    if (kind !== null) {
      const badge = document.createElement('p');
      badge.className = 'we-search__kind';
      badge.textContent = kindLabel(kind);
      item.append(badge);
    }
    const heading = document.createElement('h2');
    heading.className = 'we-search__title';
    const link = document.createElement('a');
    link.href = resolveResultUrl(data.url, this.base);
    link.textContent = data.meta['title'] ?? data.url;
    heading.append(link);
    const excerpt = document.createElement('p');
    excerpt.append(excerptFragment(data.excerpt));
    item.append(heading, excerpt);
    return item;
  }

  /** Reads the types among the first results, after the first page is on screen, and shows the chips for them. */
  private async readTypes(search: number): Promise<void> {
    try {
      const rows = await this.hydrate();
      if (search !== this.search) return;
      this.showChips(kindsPresent(rows.map((row) => row.url), this.base));
    } catch (error) {
      console.warn('we-search: the result types could not be read, so the type filter is not shown.', error);
    }
  }

  /**
   * Builds the chip row: "All" and one toggle button per kind. A single kind is not a choice, so the row is shown for two or more, and
   * always while a filter is on, so the visitor can turn it off. The chosen kind is listed even when this search has none of it.
   */
  private showChips(present: readonly ResultKind[]): void {
    const kinds = RESULT_KINDS.filter((row) => present.includes(row.id) || row.id === this.filter).map((row) => row.id);
    if (kinds.length === 0 || (kinds.length < 2 && this.filter === null)) {
      this.chips.hidden = true;
      this.chips.replaceChildren();
      this.chipKey = '';
      return;
    }
    const key = kinds.join(',');
    if (key !== this.chipKey) {
      this.chipKey = key;
      const buttons = [{ id: '', label: 'All' }, ...RESULT_KINDS.filter((row) => kinds.includes(row.id))].map((row) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'we-search__chip';
        button.setAttribute('data-kind', row.id);
        button.textContent = row.label;
        return button;
      });
      this.chips.replaceChildren(...buttons);
    }
    this.syncChips();
    this.chips.hidden = false;
  }

  private syncChips(): void {
    for (const button of this.chips.querySelectorAll<HTMLButtonElement>('button[data-kind]')) {
      button.setAttribute('aria-pressed', String((button.getAttribute('data-kind') ?? '') === (this.filter ?? '')));
    }
  }

  private choose(kind: ResultKind | null): void {
    if (kind === this.filter) return;
    this.filter = kind;
    this.replaceSearch((current) => withType(current, kind));
    this.syncChips();
    const view = ++this.view;
    this.present(view).catch((error: unknown) => {
      if (view !== this.view) return;
      console.error('we-search: the results could not be filtered.', error);
      this.status.textContent = 'The results could not be filtered. Try again.';
    });
  }

  private replaceSearch(next: (current: string) => string): void {
    const url = `${window.location.pathname}${next(window.location.search)}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
  }
}

if (!customElements.get('we-search')) customElements.define('we-search', WeSearch);
