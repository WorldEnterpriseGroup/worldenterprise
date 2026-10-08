/**
 * Team Composer. The first half is pure data and logic (role list, selection parsing, summary, hand-off to the Apply
 * form) and runs under `node --test`. The second half defines the `<we-team-composer>` custom element, which only
 * enhances server-rendered markup that already works without JavaScript. No storage, no network, no cookies.
 */

import { SEAT_ROLE_GROUPS, SEAT_ROLE_IDENTITIES } from '../data/seat-roles.ts';
import type { SeatRoleGroupId, SeatRoleId } from '../data/seat-roles.ts';

export const ROLE_GROUPS = SEAT_ROLE_GROUPS;
export type RoleGroupId = SeatRoleGroupId;

export interface Role {
  readonly id: SeatRoleId;
  readonly label: string;
  readonly group: RoleGroupId;
  readonly summary: string;
}

/** What each role does, in the Composer's words. Descriptions say what the work is; they make no promise about outcomes. */
const SUMMARIES: Readonly<Record<SeatRoleId, string>> = {
  'product-design': 'Shapes the flows, screens and design system of the product.',
  'front-end': 'Builds the interface people use in the browser.',
  'back-end': 'Builds the services, data and integrations behind the product.',
  qa: 'Tests the product before each release and keeps known problems from shipping again.',
  'devops-security': 'Sets up delivery pipelines and environments, and the security basics around them.',
  brand: 'Creates the name, identity and visual system of the company.',
  'growth-support': 'Talks with customers, runs pilots and answers support questions.',
  operations: 'Keeps goals, metrics and the weekly rhythm in order.',
  'delivery-lead': 'Keeps the plan moving: sequencing, risks and the weekly review.',
};

/** Roles a seat can fill (SAGE-PLAN 6.8). The ids, labels and groups come from src/data/seat-roles.ts. */
export const ROLES: readonly Role[] = SEAT_ROLE_IDENTITIES.map((role) => ({ ...role, summary: SUMMARIES[role.id] }));

export type RoleId = SeatRoleId;

/** Whole seats per role. Roles with zero seats are absent. */
export type TeamSelection = Partial<Record<RoleId, number>>;

export const MAX_SEATS_PER_ROLE = 99;

const ROLE_IDS: readonly string[] = ROLES.map((r) => r.id);

export function isRoleId(value: string): value is RoleId {
  return ROLE_IDS.includes(value);
}

/** Coerces any input to a whole number of seats between 0 and MAX_SEATS_PER_ROLE. Non-numbers become 0. */
export function clampSeats(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_SEATS_PER_ROLE, Math.max(0, Math.floor(n)));
}

/** Builds a selection from loose `{ roleId: count }` input, dropping unknown roles and zero counts. */
export function normaliseSelection(input: Readonly<Record<string, unknown>>): TeamSelection {
  const selection: TeamSelection = {};
  for (const role of ROLES) {
    const seats = clampSeats(input[role.id]);
    if (seats > 0) selection[role.id] = seats;
  }
  return selection;
}

export function totalSeats(selection: TeamSelection): number {
  return ROLES.reduce((sum, role) => sum + (selection[role.id] ?? 0), 0);
}

/** `product-design:2,qa:1`, in role order. Empty string for an empty team. */
export function serializeTeam(selection: TeamSelection): string {
  return ROLES.filter((r) => (selection[r.id] ?? 0) > 0)
    .map((r) => `${r.id}:${selection[r.id]}`)
    .join(',');
}

/** Parses the value of a `team=` parameter. Tolerates stray spaces, unknown roles and bad counts. */
export function parseTeam(value: string): TeamSelection {
  const input: Record<string, unknown> = {};
  for (const part of value.split(',')) {
    const [id, count] = part.split(':');
    if (id === undefined || count === undefined) continue;
    const key = id.trim();
    if (isRoleId(key)) input[key] = count.trim();
  }
  return normaliseSelection(input);
}

/** Reads a team from `#team=...` first, then from `?<role>=<count>` pairs (the no-JavaScript GET form). */
export function parseTeamFromLocation(hash: string, search: string): TeamSelection {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('team');
  if (fromHash !== null) {
    const parsed = parseTeam(fromHash);
    if (totalSeats(parsed) > 0) return parsed;
  }
  const params = new URLSearchParams(search);
  const input: Record<string, unknown> = {};
  for (const role of ROLES) {
    const raw = params.get(role.id);
    if (raw !== null) input[role.id] = raw;
  }
  return normaliseSelection(input);
}

function seatWord(count: number): string {
  return count === 1 ? 'seat' : 'seats';
}

/** Sentence-style description for the Apply form's team field: `Product design (2); Back end (1)`. */
export function describeTeam(selection: TeamSelection): string {
  return ROLES.filter((r) => (selection[r.id] ?? 0) > 0)
    .map((r) => `${r.label} (${selection[r.id]})`)
    .join('; ');
}

export interface TeamSummary {
  readonly seats: number;
  readonly roles: number;
  readonly headline: string;
  readonly lines: readonly { readonly id: RoleId; readonly label: string; readonly seats: number }[];
  readonly groups: readonly { readonly id: RoleGroupId; readonly label: string; readonly seats: number }[];
}

/** Team-shape summary: totals, one line per chosen role and seats per group. */
export function summariseTeam(selection: TeamSelection): TeamSummary {
  const seats = totalSeats(selection);
  const lines = ROLES.filter((r) => (selection[r.id] ?? 0) > 0).map((r) => ({ id: r.id, label: r.label, seats: selection[r.id] ?? 0 }));
  const groups = ROLE_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    seats: ROLES.filter((r) => r.group === g.id).reduce((sum, r) => sum + (selection[r.id] ?? 0), 0),
  }));
  const headline =
    seats === 0
      ? 'No seats chosen yet.'
      : `${seats} ${seatWord(seats)} across ${lines.length} ${lines.length === 1 ? 'role' : 'roles'}.`;
  return { seats, roles: lines.length, headline, lines, groups };
}

/** Link target for the Apply form carrying the team in the URL fragment. `applyPath` is already base-aware. */
export function applyHandoffHref(applyPath: string, selection: TeamSelection): string {
  const team = serializeTeam(selection);
  return team === '' ? applyPath : `${applyPath}#team=${team}`;
}

/** Plain text for the clipboard. */
export function teamAsText(selection: TeamSelection): string {
  const summary = summariseTeam(selection);
  if (summary.seats === 0) return 'Team sketch: no seats chosen.';
  const lines = summary.lines.map((l) => `- ${l.label}: ${l.seats} ${seatWord(l.seats)}`);
  return ['Team sketch for World Enterprise Incubator', summary.headline, ...lines].join('\n');
}

/** Seats multiplied by the monthly rate. Used only when the operator publishes the seat rate (flags.seatPrice). */
export function seatsTimesRate(seats: number, monthlyRate: number): number {
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) throw new RangeError('The seat rate must be a non-negative number.');
  return Math.round(seats * monthlyRate * 100) / 100;
}

// ---------------------------------------------------------------------------------------------------------------
// Custom element. Nothing below runs at import time except the guarded registration in defineTeamComposer().
// ---------------------------------------------------------------------------------------------------------------

function query<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

export function defineTeamComposer(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-team-composer') !== undefined) return;

  class TeamComposerElement extends HTMLElement {
    private form: HTMLFormElement | null = null;
    private copyTimer: number | undefined;

    connectedCallback(): void {
      this.form = query<HTMLFormElement>(this, 'form');
      if (this.form === null) return;
      this.setAttribute('data-enhanced', '');
      this.form.addEventListener('input', () => this.render());
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        window.location.assign(this.handoffHref());
      });
      query<HTMLButtonElement>(this, '[data-copy]')?.addEventListener('click', () => void this.copy());
      this.form.addEventListener('reset', () => window.setTimeout(() => this.render(), 0));
      this.render();
    }

    disconnectedCallback(): void {
      window.clearTimeout(this.copyTimer);
    }

    private selection(): TeamSelection {
      const input: Record<string, unknown> = {};
      if (this.form !== null) {
        for (const role of ROLES) {
          const el = this.form.elements.namedItem(role.id);
          if (el instanceof HTMLInputElement) input[role.id] = el.value;
        }
      }
      return normaliseSelection(input);
    }

    private handoffHref(): string {
      const target = this.form?.getAttribute('action') ?? '/apply/';
      return applyHandoffHref(target, this.selection());
    }

    private render(): void {
      const selection = this.selection();
      const summary = summariseTeam(selection);
      const headline = query<HTMLElement>(this, '[data-headline]');
      if (headline !== null) headline.textContent = summary.headline;

      const roster = query<HTMLElement>(this, '[data-roster]');
      if (roster !== null) {
        roster.replaceChildren(
          ...summary.lines.map((line) => {
            const item = document.createElement('li');
            item.textContent = `${line.label}: ${line.seats} ${seatWord(line.seats)}`;
            return item;
          }),
        );
        roster.hidden = summary.lines.length === 0;
      }

      this.querySelectorAll<HTMLMeterElement>('meter[data-group]').forEach((meter) => {
        const group = summary.groups.find((g) => g.id === meter.dataset.group);
        const seats = group?.seats ?? 0;
        meter.max = Math.max(1, summary.seats);
        meter.value = seats;
        const text = query<HTMLElement>(this, `[data-group-text="${meter.dataset.group ?? ''}"]`);
        if (text !== null) text.textContent = `${seats} ${seatWord(seats)}`;
      });

      const cost = query<HTMLElement>(this, '[data-cost]');
      const rateAttr = cost?.dataset.rate;
      if (cost !== null && rateAttr !== undefined && rateAttr !== '') {
        const rate = Number(rateAttr);
        if (Number.isFinite(rate) && summary.seats > 0) {
          const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.dataset.currency ?? 'USD', maximumFractionDigits: 0 });
          cost.textContent = `${summary.seats} ${seatWord(summary.seats)} at ${formatted.format(rate)} per seat each month: ${formatted.format(seatsTimesRate(summary.seats, rate))} a month.`;
        } else {
          cost.textContent = '';
        }
      }
    }

    private async copy(): Promise<void> {
      const status = query<HTMLElement>(this, '[data-status]');
      const text = teamAsText(this.selection());
      try {
        if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('The clipboard is not available in this browser.');
        await navigator.clipboard.writeText(text);
        if (status !== null) status.textContent = 'Team sketch copied.';
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown reason';
        if (status !== null) status.textContent = `Could not copy automatically (${reason}). Select the summary text and copy it by hand.`;
      }
      window.clearTimeout(this.copyTimer);
      this.copyTimer = window.setTimeout(() => {
        if (status !== null) status.textContent = '';
      }, 6000);
    }
  }

  customElements.define('we-team-composer', TeamComposerElement);
}
