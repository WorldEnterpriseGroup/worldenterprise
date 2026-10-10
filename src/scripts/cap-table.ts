/**
 * Cap table explainer. The first half is pure logic (ownership before and after new shares are issued, and its working) and runs under
 * `node --test`. The second half defines the `<we-cap-table>` custom element, which only enhances server-rendered markup. Nothing is
 * stored, nothing is sent, nothing goes into the address bar: the numbers stay in the page.
 *
 * The tool counts issued shares and nothing else, and it handles no money. Every result is a number, or
 * a stated reason why there is no number: an empty cap table never becomes `NaN` or a division by zero.
 *
 * Ownership is held as a fraction of issued shares and shown as a percent rounded to two decimal places. The change is worked from the
 * unrounded fractions, then rounded.
 */

import { enhanceForm, showIssues, showResult } from '../components/tools/enhance.ts';
import { NEEDS_A_FIX, NOT_DEFINED, WAITING } from '../components/tools/copy.ts';
import { formatCount, formatPercent, formatPoints, isUsable, parseEntry } from '../components/tools/numeric.ts';
import type { FieldIssue, ResultStatus } from '../components/tools/numeric.ts';
import { CAP_INPUT_IDS, INPUTS, RESULTS, inputSpec, waitingDetail } from '../components/islands/we-cap-table/spec.ts';
import type { CapInputId, CapResultId } from '../components/islands/we-cap-table/spec.ts';

/** Raw text of each field, as typed. A field that is absent or blank counts as not entered. */
export type RawInputs = Readonly<Partial<Record<CapInputId, string>>>;

export interface CapResult {
  readonly id: CapResultId;
  readonly status: ResultStatus;
  /** What is shown as the result: the number, or a short state. */
  readonly display: string;
  /** The working with the visitor's numbers when ready, otherwise the reason there is no number. */
  readonly detail: string;
}

export interface Outcome {
  readonly issues: readonly FieldIssue[];
  readonly results: readonly CapResult[];
}

const NO_SHARES_TODAY = 'No shares are issued today, so there is no ownership to count.';
const NO_SHARES_AFTER = 'No shares are issued after the issue, so there is no ownership to count.';
const NOTHING_TO_COMPARE = 'No shares are issued today, so there is no ownership today to compare with.';

type Calc = { readonly ok: true; readonly value: number; readonly display: string; readonly working: string } | { readonly ok: false; readonly reason: string };

/** A holding as a fraction of issued shares, or the reason there is none to count. */
function share(held: number, issued: number, noShares: string): { readonly ok: true; readonly fraction: number } | { readonly ok: false; readonly reason: string } {
  if (issued === 0) return { ok: false, reason: noShares };
  const fraction = held / issued;
  if (!isUsable(fraction)) return { ok: false, reason: 'The result is too large to show.' };
  return { ok: true, fraction };
}

/** Your shares divided by every issued share. */
export function ownership(yours: number, others: number): Calc {
  const issued = yours + others;
  const result = share(yours, issued, NO_SHARES_TODAY);
  if (!result.ok) return result;
  const display = formatPercent(result.fraction * 100);
  return { ok: true, value: result.fraction, display, working: `${formatCount(yours)} / ${formatCount(issued)} = ${display}` };
}

/** Your shares divided by every issued share once the new shares are added. */
export function ownershipAfter(yours: number, others: number, issue: number): Calc {
  const issued = yours + others + issue;
  const result = share(yours, issued, NO_SHARES_AFTER);
  if (!result.ok) return result;
  const display = formatPercent(result.fraction * 100);
  return { ok: true, value: result.fraction, display, working: `${formatCount(yours)} / ${formatCount(issued)} = ${display}` };
}

/** Ownership after less ownership today, in percentage points, worked from the unrounded fractions. */
export function ownershipChange(yours: number, others: number, issue: number): Calc {
  const before = ownership(yours, others);
  if (!before.ok) return { ok: false, reason: NOTHING_TO_COMPARE };
  const after = ownershipAfter(yours, others, issue);
  if (!after.ok) return after;
  const points = (after.value - before.value) * 100;
  const display = formatPoints(points);
  return { ok: true, value: points, display, working: `From ${before.display} to ${after.display}, worked from the unrounded figures.` };
}

/** Every issued share once the new shares are added. */
export function totalAfter(yours: number, others: number, issue: number): Calc {
  const total = yours + others + issue;
  if (!isUsable(total)) return { ok: false, reason: 'The result is too large to show.' };
  const display = formatCount(total);
  return { ok: true, value: total, display, working: `${formatCount(yours)} + ${formatCount(others)} + ${formatCount(issue)} = ${display}` };
}

/** Everything the page shows for the entries typed so far. Pure: the same text gives the same outcome. */
export function calculate(raw: RawInputs): Outcome {
  const entered: Partial<Record<CapInputId, number>> = {};
  const issues: FieldIssue[] = [];
  for (const id of CAP_INPUT_IDS) {
    const parsed = parseEntry(inputSpec(id), raw[id]);
    if (parsed.kind === 'value') entered[id] = parsed.value;
    else if (parsed.kind === 'error') issues.push({ id, message: parsed.message });
  }
  const blocked = new Set(issues.map((issue) => issue.id));
  const labels = (ids: readonly CapInputId[]): string => ids.map((id) => inputSpec(id).label).join(', ');

  const results = RESULTS.map((spec): CapResult => {
    const broken = spec.needs.filter((id) => blocked.has(id));
    if (broken.length > 0) {
      return { id: spec.id, status: 'waiting', display: NEEDS_A_FIX, detail: `Correct ${labels(broken)} to see this.` };
    }
    const missing = spec.needs.filter((id) => entered[id] === undefined);
    if (missing.length > 0) {
      return { id: spec.id, status: 'waiting', display: WAITING, detail: `Enter ${labels(missing)} to see this.` };
    }
    const yours = entered.yours ?? 0;
    const others = entered.others ?? 0;
    const issue = entered.issue ?? 0;
    const calc =
      spec.id === 'before'
        ? ownership(yours, others)
        : spec.id === 'after'
          ? ownershipAfter(yours, others, issue)
          : spec.id === 'change'
            ? ownershipChange(yours, others, issue)
            : totalAfter(yours, others, issue);
    if (!calc.ok) return { id: spec.id, status: 'undefined', display: NOT_DEFINED, detail: calc.reason };
    return { id: spec.id, status: 'ready', display: calc.display, detail: calc.working };
  });
  return { issues, results };
}

/** What a result says before anything is typed, and in the served page. */
export function waitingText(id: CapResultId): { readonly display: string; readonly detail: string } {
  return { display: WAITING, detail: waitingDetail(id) };
}

// ---------------------------------------------------------------------------------------------------------------
// Custom element. Nothing below runs at import time except the guarded registration in defineCapTable().
// ---------------------------------------------------------------------------------------------------------------

export function defineCapTable(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-cap-table') !== undefined) return;

  class CapTableElement extends HTMLElement {
    private enhanced: { readonly dispose: () => void } | null = null;

    connectedCallback(): void {
      this.enhanced = enhanceForm(this, () => this.render());
    }

    disconnectedCallback(): void {
      this.enhanced?.dispose();
      this.enhanced = null;
    }

    private raw(): RawInputs {
      const values: Partial<Record<CapInputId, string>> = {};
      for (const spec of INPUTS) {
        const field = this.querySelector<HTMLInputElement>(`#cap-${spec.id}`);
        if (field !== null) values[spec.id] = field.value;
      }
      return values;
    }

    private render(): void {
      const outcome = calculate(this.raw());
      showIssues(this, CAP_INPUT_IDS, outcome.issues, (id) => `cap-${id}`);
      for (const result of outcome.results) showResult(this, result.id, result.status, result.display, result.detail);
    }
  }

  customElements.define('we-cap-table', CapTableElement);
}
