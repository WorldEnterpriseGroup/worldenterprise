/**
 * <we-ecosystem-filter>: filters the directory of /ecosystem/ by kind, stage, group and remote access. The server renders the whole
 * directory as grouped lists, and a <template> with the filter form. Without JavaScript the template stays inert and the page is the
 * full directory plus the category pages. With JavaScript the form is shown, rows are hidden or shown, and a status line (a live
 * region) says how many programs match.
 *
 * Rows: `[data-eco-row]` with data-category, data-stages (space separated), data-audiences (space separated), data-remote ("yes"/"no").
 * Groups: `[data-eco-group]` sections, hidden when none of their rows match.
 * Attributes of the element: data-total (number of rows), data-all-text, data-some-text, data-none-text (templates with {shown} and
 * {total}). Texts come from the server so that the copy stays in one place.
 */
interface Criteria {
  category: string;
  stage: string;
  audience: string;
  remote: boolean;
}

const ANY = 'any';

function tokens(value: string | undefined): readonly string[] {
  return value === undefined || value === '' ? [] : value.split(/\s+/);
}

function fill(template: string | null, shown: number, total: number, fallback: string): string {
  return (template ?? fallback).replace('{shown}', String(shown)).replace('{total}', String(total));
}

class WeEcosystemFilter extends HTMLElement {
  private rows: HTMLElement[] = [];
  private groups: HTMLElement[] = [];
  private status: HTMLElement | null = null;
  private empty: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;
  private ready = false;

  connectedCallback(): void {
    if (this.ready) return;
    const template = this.querySelector<HTMLTemplateElement>('template[data-eco-form]');
    if (template === null) return;
    this.rows = Array.from(this.querySelectorAll<HTMLElement>('[data-eco-row]'));
    this.groups = Array.from(this.querySelectorAll<HTMLElement>('[data-eco-group]'));
    if (this.rows.length === 0) return;

    const fragment = template.content.cloneNode(true) as DocumentFragment;
    this.form = fragment.querySelector('form');
    this.status = fragment.querySelector<HTMLElement>('[data-eco-status]');
    this.empty = fragment.querySelector<HTMLElement>('[data-eco-empty]');
    if (this.form === null || this.status === null) return;

    this.form.addEventListener('change', () => this.apply());
    this.form.addEventListener('submit', (event) => event.preventDefault());
    this.form.addEventListener('reset', () => window.setTimeout(() => this.apply(), 0));
    template.before(fragment);
    this.ready = true;
    this.setAttribute('data-ready', '');
    this.apply();
  }

  private criteria(): Criteria {
    const data = this.form === null ? new FormData() : new FormData(this.form);
    const read = (name: string): string => {
      const value = data.get(name);
      return typeof value === 'string' && value !== '' ? value : ANY;
    };
    return { category: read('category'), stage: read('stage'), audience: read('audience'), remote: data.get('remote') === 'yes' };
  }

  private rowFits(row: HTMLElement, c: Criteria): boolean {
    if (c.category !== ANY && row.dataset.category !== c.category) return false;
    if (c.stage !== ANY && !tokens(row.dataset.stages).includes(c.stage)) return false;
    if (c.audience !== ANY && !tokens(row.dataset.audiences).includes(c.audience)) return false;
    if (c.remote && row.dataset.remote !== 'yes') return false;
    return true;
  }

  private apply(): void {
    const c = this.criteria();
    let shown = 0;
    for (const row of this.rows) {
      const ok = this.rowFits(row, c);
      row.hidden = !ok;
      if (ok) shown += 1;
    }
    for (const group of this.groups) {
      group.hidden = !group.querySelector('[data-eco-row]:not([hidden])');
    }
    const total = this.rows.length;
    const filtered = c.category !== ANY || c.stage !== ANY || c.audience !== ANY || c.remote;
    if (this.status !== null) {
      this.status.textContent =
        shown === 0
          ? this.getAttribute('data-none-text') ?? 'No program matches.'
          : filtered
            ? fill(this.getAttribute('data-some-text'), shown, total, 'Showing {shown} of {total} programs.')
            : fill(this.getAttribute('data-all-text'), shown, total, 'Showing all {total} programs.');
    }
    if (this.empty !== null) this.empty.hidden = shown !== 0;
  }
}

if (!customElements.get('we-ecosystem-filter')) customElements.define('we-ecosystem-filter', WeEcosystemFilter);
