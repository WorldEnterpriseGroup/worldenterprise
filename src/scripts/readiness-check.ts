import { collectGaps, parseAlsoRead } from '../components/islands/we-readiness-check/logic.ts';
import type { GapSource } from '../components/islands/we-readiness-check/logic.ts';

/**
 * <we-readiness-check>: progressive enhancement over a plain checklist. Nothing is stored or sent anywhere.
 * Without JavaScript the page is a working checklist with a "start here" link under every statement.
 */
class WeReadinessCheck extends HTMLElement {
  private boxes: HTMLInputElement[] = [];
  private result: HTMLElement | null = null;

  connectedCallback(): void {
    const form = this.querySelector<HTMLFormElement>('[data-rc-form]');
    const result = this.querySelector<HTMLElement>('[data-rc-result]');
    const show = this.querySelector<HTMLButtonElement>('[data-rc-show]');
    const reset = this.querySelector<HTMLButtonElement>('[data-rc-reset]');
    const controls = this.querySelector<HTMLElement>('[data-rc-controls]');
    if (!form || !result || !show || !reset || !controls) {
      console.error('we-readiness-check: expected markup is missing; leaving the plain checklist in place.');
      return;
    }
    this.result = result;
    this.boxes = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-gap-title][data-gap-href]'));
    controls.hidden = false;
    this.dataset.enhanced = '';
    show.addEventListener('click', () => this.render());
    reset.addEventListener('click', () => {
      form.reset();
      this.clear();
    });
  }

  private sources(): GapSource[] {
    return this.boxes.map((box) => ({
      id: box.id,
      title: box.dataset.gapTitle ?? '',
      href: box.dataset.gapHref ?? '',
    }));
  }

  private clear(): void {
    if (this.result) this.result.replaceChildren();
  }

  private render(): void {
    const result = this.result;
    if (!result) return;
    const confirmed = new Set(this.boxes.filter((b) => b.checked).map((b) => b.id));
    const gaps = collectGaps(this.sources(), confirmed);
    const heading = document.createElement('h3');
    heading.className = 'rc__result-title';
    const note = document.createElement('p');
    if (gaps.length === 0) {
      heading.textContent = 'No gaps marked';
      note.textContent =
        'You confirmed every statement. Before you rely on that, check each one against an artifact you could show to someone else. This is a preparation aid, not a prediction of funding.';
      result.replaceChildren(heading, note);
      return;
    }
    heading.textContent = 'Gaps to address';
    note.textContent = 'These statements are not confirmed yet. Each link is a place to start. This is a preparation aid, not a prediction of funding.';
    const list = document.createElement('ul');
    list.className = 'rc__gaps';
    for (const gap of gaps) {
      const item = document.createElement('li');
      const link = document.createElement(gap.href === '' ? 'span' : 'a');
      link.textContent = gap.title;
      if (link instanceof HTMLAnchorElement) link.href = gap.href;
      const label = this.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(gap.id)}"]`);
      const statement = document.createElement('span');
      statement.className = 'rc__gap-statement';
      statement.textContent = label?.textContent?.trim() ?? '';
      item.append(statement, link);
      const also = parseAlsoRead(this.querySelector<HTMLInputElement>(`#${CSS.escape(gap.id)}`)?.dataset.alsoRead);
      if (also.length > 0) {
        const more = document.createElement('span');
        more.className = 'rc__also';
        more.append('Also useful: ');
        also.forEach((entry, index) => {
          if (index > 0) more.append('; ');
          const anchor = document.createElement('a');
          anchor.href = entry.href;
          anchor.textContent = entry.title;
          more.append(anchor);
        });
        more.append('.');
        item.append(more);
      }
      list.append(item);
    }
    result.replaceChildren(heading, note, list);
  }
}

if (!customElements.get('we-readiness-check')) {
  customElements.define('we-readiness-check', WeReadinessCheck);
}
