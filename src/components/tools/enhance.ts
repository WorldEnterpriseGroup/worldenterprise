/**
 * The browser half the founder tools share. A tool is server-rendered in full, with its controls disabled, and a custom element calls
 * `enhanceForm` to enable them and to re-run its calculation as the reader types. Nothing here stores or sends anything: no storage,
 * no cookie, no request, nothing in the address bar.
 *
 * The markup contract, which the island components in this folder produce:
 *   field   `<input name="{id}">` with a note `<p data-note="{id}" data-hint="...">` that shows the hint, or the error for that entry
 *   result  `<div data-result="{id}" data-status>` holding `[data-value]` and `[data-detail]`
 */

import type { FieldIssue, ResultStatus } from './numeric.ts';

/** Typing settles for this long before the results are rewritten, so a screen reader hears the result once, not once per key. */
export const SETTLE_MS = 400;

export interface Enhanced {
  /** Re-runs the calculation now, without waiting for typing to settle. */
  readonly run: () => void;
  readonly dispose: () => void;
}

/**
 * Enables the controls of the form inside `host`, keeps the browser from submitting it, and calls `render` once now, after typing
 * settles (`input`), at once for a change that is not typing (`change` on a checkbox) and after a reset.
 */
export function enhanceForm(host: HTMLElement, render: () => void, options: { readonly settle?: boolean } = {}): Enhanced | null {
  const form = host.querySelector<HTMLFormElement>('form');
  if (form === null) return null;
  const settle = options.settle ?? true;
  let timer: number | undefined;
  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = settle ? window.setTimeout(render, SETTLE_MS) : undefined;
    if (!settle) render();
  };
  const onSubmit = (event: Event): void => event.preventDefault();
  const onReset = (): void => {
    window.clearTimeout(timer);
    window.setTimeout(render, 0);
  };
  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', schedule);
  form.addEventListener('reset', onReset);
  // The controls are rendered disabled, so a visitor without JavaScript is not handed fields that do nothing.
  form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
    control.disabled = false;
  });
  host.setAttribute('data-enhanced', '');
  render();
  return {
    run: () => {
      window.clearTimeout(timer);
      render();
    },
    dispose: () => {
      window.clearTimeout(timer);
      form.removeEventListener('submit', onSubmit);
      form.removeEventListener('input', schedule);
      form.removeEventListener('reset', onReset);
    },
  };
}

/** Marks each field with its problem, if it has one, and puts the message where its hint was. A field with none gets its hint back. */
export function showIssues(host: HTMLElement, ids: readonly string[], issues: readonly FieldIssue[], fieldFor: (id: string) => string): void {
  const byId = new Map(issues.map((issue) => [issue.id, issue.message]));
  for (const id of ids) {
    const field = host.querySelector<HTMLInputElement>(`#${fieldFor(id)}`);
    const note = host.querySelector<HTMLElement>(`[data-note="${id}"]`);
    const message = byId.get(id);
    if (field !== null) {
      if (message === undefined) field.removeAttribute('aria-invalid');
      else field.setAttribute('aria-invalid', 'true');
    }
    if (note !== null) {
      note.textContent = message ?? note.dataset.hint ?? '';
      note.toggleAttribute('data-error', message !== undefined);
    }
  }
}

/** Writes one result block. */
export function showResult(host: HTMLElement, id: string, status: ResultStatus, display: string, detail: string): void {
  const row = host.querySelector<HTMLElement>(`[data-result="${id}"]`);
  if (row === null) return;
  row.dataset.status = status;
  const value = row.querySelector<HTMLElement>('[data-value]');
  const working = row.querySelector<HTMLElement>('[data-detail]');
  if (value !== null) value.textContent = display;
  if (working !== null) working.textContent = detail;
}
