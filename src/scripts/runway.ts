/**
 * Runway calculator. The first half is pure logic (the two runway calculations and their working) and runs under `node --test`. The
 * second half defines the `<we-runway>` custom element, which only enhances server-rendered markup. Nothing is stored, nothing is
 * sent, nothing goes into the address bar: the numbers stay in the page.
 *
 * Every result is a number, or a stated reason why there is no number. A division by zero, a missing entry or a result past the count
 * the tool makes never becomes `NaN` or `Infinity`. Runway is always rounded down, as the runway article says to do.
 */

import { enhanceForm, showIssues, showResult } from '../components/tools/enhance.ts';
import { NEEDS_A_FIX, NOT_DEFINED, WAITING } from '../components/tools/copy.ts';
import { floorTo, formatAmount, formatCount, formatMonthsDown, isUsable, parseEntry } from '../components/tools/numeric.ts';
import type { FieldIssue, ResultStatus } from '../components/tools/numeric.ts';
import { INPUTS, MAX_MONTHS_COUNTED, RESULTS, RUNWAY_INPUT_IDS, inputSpec, waitingDetail } from '../components/islands/we-runway/spec.ts';
import type { RunwayInputId, RunwayResultId } from '../components/islands/we-runway/spec.ts';

/** Raw text of each field, as typed. A field that is absent or blank counts as not entered. */
export type RawInputs = Readonly<Partial<Record<RunwayInputId, string>>>;

export interface RunwayResult {
  readonly id: RunwayResultId;
  readonly status: ResultStatus;
  /** Months, rounded down to one decimal place, only when status is `ready`. Always finite. */
  readonly months: number | null;
  /** What is shown as the result: the months, or a short state. */
  readonly display: string;
  /** The working with the visitor's numbers when ready, otherwise the reason there is no number. */
  readonly detail: string;
}

export interface Outcome {
  readonly issues: readonly FieldIssue[];
  readonly results: readonly RunwayResult[];
}

const NO_BURN = 'Net burn is 0, so cash is not running down and runway has no end to count to.';
const PAST_THE_COUNT = 'Cash lasts past 1,200 months, which is 100 years and past the count this tool makes.';

type Calc = { readonly ok: true; readonly months: number; readonly working: string } | { readonly ok: false; readonly reason: string };

/** Cash divided by a burn that stays the same. A runway past MAX_MONTHS_COUNTED months has no result. */
export function levelRunway(cash: number, burn: number): Calc {
  if (burn === 0) return { ok: false, reason: NO_BURN };
  const months = cash / burn;
  if (!isUsable(months) || months > MAX_MONTHS_COUNTED) return { ok: false, reason: PAST_THE_COUNT };
  return {
    ok: true,
    months,
    working: `${formatAmount(cash)} / ${formatAmount(burn)} = ${formatMonthsDown(months)}, which is ${formatCount(Math.floor(floorTo(months, 6)))} whole months`,
  };
}

/**
 * Runway when burn grows by `growthPct` percent every month. The first month uses `burn`; each later month uses the one before it
 * multiplied by 1 + growthPct / 100. Months are added one at a time while the next one still fits in the cash left, and the runway is
 * the whole months funded plus the cash left divided by the burn of the month that does not fit. The count stops at
 * MAX_MONTHS_COUNTED months, and a cash balance that outlasts it has no result.
 */
export function growingRunway(cash: number, burn: number, growthPct: number): Calc {
  if (burn === 0) return { ok: false, reason: NO_BURN };
  const factor = 1 + growthPct / 100;
  let monthBurn = burn;
  let spent = 0;
  let whole = 0;
  if (factor === 1) {
    // Level burn, so the whole months are a division and not a count of up to MAX_MONTHS_COUNTED steps.
    const quotient = cash / burn;
    if (!isUsable(quotient) || quotient > MAX_MONTHS_COUNTED) return { ok: false, reason: PAST_THE_COUNT };
    whole = Math.floor(floorTo(quotient, 9));
    spent = whole * burn;
  } else {
    while (whole < MAX_MONTHS_COUNTED && spent + monthBurn <= cash) {
      spent += monthBurn;
      whole += 1;
      monthBurn *= factor;
    }
  }
  const left = cash - spent;
  const fraction = monthBurn > 0 ? left / monthBurn : 0;
  const months = whole + fraction;
  if (!isUsable(months) || months > MAX_MONTHS_COUNTED) return { ok: false, reason: PAST_THE_COUNT };
  const next = whole + 1;
  return {
    ok: true,
    months,
    working: `${formatCount(whole)} whole months use ${formatAmount(spent)}. ${formatAmount(left)} is left against ${formatAmount(monthBurn)} for month ${formatCount(next)}, which is ${formatAmount(floorTo(fraction, 2))} of a month. Total: ${formatMonthsDown(months)}`,
  };
}

/** Everything the page shows for the entries typed so far. Pure: the same text gives the same outcome. */
export function calculate(raw: RawInputs): Outcome {
  const entered: Partial<Record<RunwayInputId, number>> = {};
  const issues: FieldIssue[] = [];
  for (const id of RUNWAY_INPUT_IDS) {
    const parsed = parseEntry(inputSpec(id), raw[id]);
    if (parsed.kind === 'value') entered[id] = parsed.value;
    else if (parsed.kind === 'error') issues.push({ id, message: parsed.message });
  }
  const blocked = new Set(issues.map((issue) => issue.id));
  const labels = (ids: readonly RunwayInputId[]): string => ids.map((id) => inputSpec(id).label).join(', ');

  const results = RESULTS.map((spec): RunwayResult => {
    const broken = spec.needs.filter((id) => blocked.has(id));
    if (broken.length > 0) {
      return { id: spec.id, status: 'waiting', months: null, display: NEEDS_A_FIX, detail: `Correct ${labels(broken)} to see this.` };
    }
    const missing = spec.needs.filter((id) => entered[id] === undefined);
    if (missing.length > 0) {
      return { id: spec.id, status: 'waiting', months: null, display: WAITING, detail: `Enter ${labels(missing)} to see this.` };
    }
    const cash = entered.cash ?? 0;
    const burn = entered.burn ?? 0;
    const calc = spec.id === 'level' ? levelRunway(cash, burn) : growingRunway(cash, burn, entered.growth ?? 0);
    if (!calc.ok) return { id: spec.id, status: 'undefined', months: null, display: NOT_DEFINED, detail: calc.reason };
    return { id: spec.id, status: 'ready', months: floorTo(calc.months, 1), display: formatMonthsDown(calc.months), detail: calc.working };
  });
  return { issues, results };
}

/** What a result says before anything is typed, and in the served page. */
export function waitingText(id: RunwayResultId): { readonly display: string; readonly detail: string } {
  return { display: WAITING, detail: waitingDetail(id) };
}

// ---------------------------------------------------------------------------------------------------------------
// Custom element. Nothing below runs at import time except the guarded registration in defineRunway().
// ---------------------------------------------------------------------------------------------------------------

export function defineRunway(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-runway') !== undefined) return;

  class RunwayElement extends HTMLElement {
    private enhanced: { readonly dispose: () => void } | null = null;

    connectedCallback(): void {
      this.enhanced = enhanceForm(this, () => this.render());
    }

    disconnectedCallback(): void {
      this.enhanced?.dispose();
      this.enhanced = null;
    }

    private raw(): RawInputs {
      const values: Partial<Record<RunwayInputId, string>> = {};
      for (const spec of INPUTS) {
        const field = this.querySelector<HTMLInputElement>(`#runway-${spec.id}`);
        if (field !== null) values[spec.id] = field.value;
      }
      return values;
    }

    private render(): void {
      const outcome = calculate(this.raw());
      showIssues(this, RUNWAY_INPUT_IDS, outcome.issues, (id) => `runway-${id}`);
      for (const result of outcome.results) showResult(this, result.id, result.status, result.display, result.detail);
    }
  }

  customElements.define('we-runway', RunwayElement);
}
