/**
 * Evidence room. The first half is pure logic (the state in the address bar, what is shown at a stage, progress and the Markdown
 * copy) and runs under `node --test`. The second half defines the `<we-evidence-room>` custom element, which enhances a checklist the
 * server already rendered in full. The only place the state lives is the part of the address after the `#`: there is no storage, no
 * cookie and no request (DP-13).
 */

import { EVIDENCE_GROUPS, EVIDENCE_ITEMS, isShownAt, isStageFilter, itemByCode, itemsInGroup, stageName } from '../components/islands/we-evidence-room/items.ts';
import type { EvidenceItem, StageFilter } from '../components/islands/we-evidence-room/items.ts';

export interface RoomState {
  readonly stage: StageFilter;
  /** Codes of the items ticked, each once, in checklist order. Includes items the stage filter hides. */
  readonly done: readonly string[];
}

export const EMPTY_STATE: RoomState = { stage: 'all', done: [] };

/** A longer hash is not one this page wrote. Reading it would only cost time. */
const MAX_HASH_LENGTH = 2000;

/** Keeps the known codes, once each, in checklist order. Unknown codes are dropped. */
export function normaliseDone(codes: Iterable<string>): string[] {
  const wanted = new Set<string>();
  for (const code of codes) {
    if (itemByCode(code) !== undefined) wanted.add(code);
  }
  return EVIDENCE_ITEMS.filter((item) => wanted.has(item.code)).map((item) => item.code);
}

/** True when the hash is one this page wrote. An in-page anchor such as the skip link's `#main` is not, and must not clear the ticks. */
export function isStateHash(hash: string): boolean {
  return /^#?(.*&)?(stage|done)=/.test(hash);
}

/**
 * Reads `#stage=first-product&done=1a.1b.r3`. Tolerant: a hash that is not this page's (an in-page anchor, say), an unknown stage, an
 * unknown code, a bad escape or any stray piece is ignored, and what remains is used.
 */
export function parseState(hash: string): RoomState {
  const body = hash.replace(/^#/, '').slice(0, MAX_HASH_LENGTH);
  let stage: StageFilter = 'all';
  let done: string[] = [];
  for (const piece of body.split('&')) {
    const cut = piece.indexOf('=');
    if (cut === -1) continue;
    const key = piece.slice(0, cut);
    let value: string;
    try {
      value = decodeURIComponent(piece.slice(cut + 1));
    } catch {
      continue;
    }
    if (key === 'stage') {
      const wanted = value.trim().toLowerCase();
      if (isStageFilter(wanted)) stage = wanted;
    } else if (key === 'done') {
      done = normaliseDone(value.split('.').map((code) => code.trim().toLowerCase()));
    }
  }
  return { stage, done };
}

/** The hash for a state, or an empty string for the starting state, so a fresh page keeps a clean address. */
export function serializeState(state: RoomState): string {
  const parts: string[] = [];
  if (state.stage !== 'all') parts.push(`stage=${state.stage}`);
  const done = normaliseDone(state.done);
  if (done.length > 0) parts.push(`done=${done.join('.')}`);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
}

export function visibleItems(stage: StageFilter): readonly EvidenceItem[] {
  return EVIDENCE_ITEMS.filter((item) => isShownAt(item, stage));
}

export interface Progress {
  readonly checked: number;
  readonly total: number;
}

/** Counts the items shown at the stage. A tick on an item the filter hides is kept in the state but not counted. */
export function progress(state: RoomState): Progress {
  const done = new Set(state.done);
  const shown = visibleItems(state.stage);
  return { checked: shown.filter((item) => done.has(item.code)).length, total: shown.length };
}

export function progressText({ checked, total }: Progress): string {
  return `${checked} of ${total} ${total === 1 ? 'item' : 'items'} checked.`;
}

/** The checklist as Markdown task lists, for the items shown at the stage. */
export function toMarkdown(state: RoomState): string {
  const done = new Set(state.done);
  const count = progress(state);
  const lines: string[] = [
    '# Evidence room checklist',
    '',
    `Showing: ${stageName(state.stage)}${state.stage === 'all' ? '' : ' and earlier stages'}.`,
    `Progress: ${progressText(count)}`,
  ];
  for (const group of EVIDENCE_GROUPS) {
    const items = itemsInGroup(group.id).filter((item) => isShownAt(item, state.stage));
    if (items.length === 0) continue;
    lines.push('', `## ${group.title}`, '');
    for (const item of items) lines.push(`- [${done.has(item.code) ? 'x' : ' '}] ${item.label}`);
  }
  lines.push('', '---', '', 'A preparation list from the World Enterprise Incubator evidence room. WE makes no promise of funding.', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// Custom element. Nothing below runs at import time except the guarded registration in defineEvidenceRoom().
// ---------------------------------------------------------------------------------------------------------------

/** A message stays this long, then the line empties. The space for it is reserved, so nothing moves either way. */
const MESSAGE_MS = 8000;

export function defineEvidenceRoom(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-evidence-room') !== undefined) return;

  class EvidenceRoomElement extends HTMLElement {
    private state: RoomState = EMPTY_STATE;
    private messageTimer: number | undefined;

    connectedCallback(): void {
      // The controls are rendered disabled, so a visitor without JavaScript is not handed buttons that do nothing.
      this.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input[name="stage"], button').forEach((control) => {
        control.disabled = false;
      });
      this.setAttribute('data-enhanced', '');
      this.state = parseState(window.location.hash);
      this.addEventListener('change', (event) => this.onChange(event));
      this.querySelector<HTMLButtonElement>('[data-copy]')?.addEventListener('click', () => void this.copy());
      this.querySelector<HTMLButtonElement>('[data-print]')?.addEventListener('click', () => window.print());
      this.querySelector<HTMLButtonElement>('[data-clear]')?.addEventListener('click', () => this.clear());
      window.addEventListener('hashchange', this.onHashChange);
      this.render();
    }

    disconnectedCallback(): void {
      window.clearTimeout(this.messageTimer);
      window.removeEventListener('hashchange', this.onHashChange);
    }

    private readonly onHashChange = (): void => {
      if (!isStateHash(window.location.hash)) return;
      this.state = parseState(window.location.hash);
      this.render();
    };

    private onChange(event: Event): void {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name === 'stage' && isStageFilter(target.value)) {
        this.state = { stage: target.value, done: this.state.done };
      } else if (target.dataset.code !== undefined) {
        const ticked = new Set(this.state.done);
        if (target.checked) ticked.add(target.dataset.code);
        else ticked.delete(target.dataset.code);
        this.state = { stage: this.state.stage, done: normaliseDone(ticked) };
      } else {
        return;
      }
      this.render();
      this.syncUrl();
    }

    private clear(): void {
      this.state = { stage: this.state.stage, done: [] };
      this.render();
      this.syncUrl();
      this.say('All ticks cleared.');
    }

    /** Writes the state to the address without adding a history entry. */
    private syncUrl(): void {
      const hash = serializeState(this.state);
      try {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'the browser refused';
        this.say(`Your ticks still work on this page, but the address bar could not be updated (${reason}).`);
      }
    }

    private render(): void {
      const done = new Set(this.state.done);
      this.querySelectorAll<HTMLInputElement>('input[name="stage"]').forEach((radio) => {
        radio.checked = radio.value === this.state.stage;
      });
      this.querySelectorAll<HTMLInputElement>('input[data-code]').forEach((box) => {
        box.checked = done.has(box.dataset.code ?? '');
      });
      this.querySelectorAll<HTMLElement>('[data-item]').forEach((row) => {
        const item = itemByCode(row.dataset.item ?? '');
        row.hidden = item === undefined || !isShownAt(item, this.state.stage);
      });
      this.querySelectorAll<HTMLElement>('[data-group]').forEach((section) => {
        section.hidden = section.querySelector('[data-item]:not([hidden])') === null;
      });
      const progressLine = this.querySelector<HTMLElement>('[data-progress]');
      if (progressLine !== null) progressLine.textContent = progressText(progress(this.state));
    }

    private say(text: string): void {
      const line = this.querySelector<HTMLElement>('[data-message]');
      if (line === null) return;
      line.textContent = text;
      window.clearTimeout(this.messageTimer);
      this.messageTimer = window.setTimeout(() => {
        line.textContent = '';
      }, MESSAGE_MS);
    }

    private async copy(): Promise<void> {
      const markdown = toMarkdown(this.state);
      const box = this.querySelector<HTMLTextAreaElement>('[data-markdown]');
      if (box !== null) box.value = markdown;
      try {
        await navigator.clipboard.writeText(markdown);
        this.say('Copied the checklist as Markdown.');
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'the browser refused';
        const fallback = this.querySelector<HTMLDetailsElement>('[data-fallback]');
        if (fallback !== null) fallback.open = true;
        box?.focus();
        box?.select();
        this.say(`Could not copy automatically (${reason}). The Markdown is in the box below. Select it and copy it by hand.`);
      }
    }
  }

  customElements.define('we-evidence-room', EvidenceRoomElement);
}
