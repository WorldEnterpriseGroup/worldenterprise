import { normalizeBase, normalizeQuery, readQuery, resolveResultUrl, resultsStatus, withQuery } from '../components/islands/we-search/query.ts';

/**
 * <we-search>: static site search over the Pagefind index that the postbuild step writes to /pagefind/ after the
 * Astro build. Pagefind is loaded at runtime from the data-pagefind attribute (it does not exist before postbuild).
 * Without JavaScript the search form stays hidden and the page shows links to the site map instead.
 */
interface PagefindData {
  readonly url: string;
  readonly excerpt: string;
  readonly meta: Readonly<Record<string, string | undefined>>;
}

interface PagefindResult {
  data(): Promise<PagefindData>;
}

interface PagefindApi {
  search(query: string): Promise<{ readonly results: readonly PagefindResult[] }>;
}

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 200;

function isPagefindApi(value: unknown): value is PagefindApi {
  return typeof value === 'object' && value !== null && typeof (value as { search?: unknown }).search === 'function';
}

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
  private base = '';
  private pending: readonly PagefindResult[] = [];
  private shown = 0;
  private serial = 0;
  private timer: number | undefined;

  connectedCallback(): void {
    const form = this.querySelector<HTMLFormElement>('form');
    const input = this.querySelector<HTMLInputElement>('input[type="search"]');
    const status = this.querySelector<HTMLElement>('[data-search-status]');
    const list = this.querySelector<HTMLOListElement>('[data-search-results]');
    const more = this.querySelector<HTMLButtonElement>('[data-search-more]');
    if (!form || !input || !status || !list || !more) {
      console.error('we-search: the expected markup is missing, search is disabled.');
      return;
    }
    this.form = form;
    this.input = input;
    this.status = status;
    this.list = list;
    this.more = more;
    this.base = normalizeBase(this.getAttribute('data-base') ?? '');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      window.clearTimeout(this.timer);
      void this.run(this.input.value, true);
    });
    input.addEventListener('input', () => {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.run(this.input.value, true), DEBOUNCE_MS);
    });
    more.addEventListener('click', () => void this.renderNext());

    void this.start();
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.timer);
  }

  private async start(): Promise<void> {
    const src = this.getAttribute('data-pagefind');
    if (src === null || src === '') {
      this.fail('The search index address is missing.');
      return;
    }
    try {
      const mod: unknown = await import(/* @vite-ignore */ src);
      if (!isPagefindApi(mod)) throw new Error('The search index module has no search function.');
      this.api = mod;
    } catch (error) {
      console.error('we-search: the Pagefind index could not be loaded.', error);
      this.fail('Search is not available right now. Use the links below to find a page.');
      return;
    }
    this.setAttribute('data-state', 'ready');
    this.form.hidden = false;
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
    const ticket = ++this.serial;
    if (updateUrl) {
      const next = `${window.location.pathname}${withQuery(window.location.search, query)}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', next);
    }
    this.list.replaceChildren();
    this.more.hidden = true;
    this.pending = [];
    this.shown = 0;
    if (query === '') {
      this.status.textContent = '';
      return;
    }
    this.status.textContent = 'Searching.';
    try {
      const response = await api.search(query);
      if (ticket !== this.serial) return;
      this.pending = response.results;
      this.status.textContent = resultsStatus(response.results.length, query);
      await this.renderNext(ticket);
    } catch (error) {
      if (ticket !== this.serial) return;
      console.error('we-search: the search request failed.', error);
      this.status.textContent = 'The search could not run. Try again, or use the links below.';
    }
  }

  private async renderNext(ticket: number = this.serial): Promise<void> {
    const batch = this.pending.slice(this.shown, this.shown + PAGE_SIZE);
    const rows = await Promise.all(batch.map((result) => result.data()));
    if (ticket !== this.serial) return;
    for (const row of rows) this.list.append(this.renderRow(row));
    this.shown += batch.length;
    this.more.hidden = this.shown >= this.pending.length;
  }

  private renderRow(data: PagefindData): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'we-search__result';
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
}

if (!customElements.get('we-search')) customElements.define('we-search', WeSearch);
