/**
 * Pricing page checker. The first half is pure logic (a count of the statements ticked, and the numbers of those not ticked) and runs
 * under `node --test`. The second half defines the `<we-pricing-checker>` custom element, which only enhances server-rendered markup.
 * Nothing is stored, nothing is sent, nothing goes into the address bar: the ticks stay in the page.
 *
 * The tool checks presence only. It never turns the count into a score, a percent or a grade, and it never ranks the page.
 */

import { enhanceForm, showResult } from '../components/tools/enhance.ts';
import { WAITING } from '../components/tools/copy.ts';
import type { ResultStatus } from '../components/tools/numeric.ts';
import { CHECK_IDS, WAITING_DETAIL, isCheckId } from '../components/islands/we-pricing-checker/spec.ts';
import type { CheckId, CheckResultId } from '../components/islands/we-pricing-checker/spec.ts';

export interface CheckResult {
  readonly id: CheckResultId;
  readonly status: ResultStatus;
  /** The count, as "3 of 8", or a short state. */
  readonly display: string;
  readonly detail: string;
}

export interface Outcome {
  /** How many statements are ticked. */
  readonly marked: number;
  readonly total: number;
  /** The numbers, in list order, of the statements not ticked. */
  readonly openNumbers: readonly number[];
  readonly results: readonly CheckResult[];
}

const ALL_MARKED =
  'Every statement is marked true. That says the page has each item, not that it works for your buyers.';

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** A comma list of numbers: "1, 4, 5". */
function numberList(numbers: readonly number[]): string {
  return numbers.join(', ');
}

/**
 * The counts for the statements ticked so far. Unknown ids are ignored and a repeated id counts once, so the count can never pass the
 * length of the list. Pure: the same ticks give the same outcome.
 */
export function check(ticked: readonly string[]): Outcome {
  const marked = new Set<CheckId>(ticked.filter(isCheckId));
  const total = CHECK_IDS.length;
  const openNumbers = CHECK_IDS.flatMap((id, index) => (marked.has(id) ? [] : [index + 1]));

  if (marked.size === 0) {
    const waiting = (id: CheckResultId): CheckResult => ({ id, status: 'waiting', display: WAITING, detail: WAITING_DETAIL });
    return { marked: 0, total, openNumbers, results: [waiting('present'), waiting('open')] };
  }

  const present: CheckResult = {
    id: 'present',
    status: 'ready',
    display: `${marked.size} of ${total}`,
    detail: `You marked ${marked.size} of the ${total} statements true of your page. This is a count, not a score.`,
  };
  const open: CheckResult =
    openNumbers.length === 0
      ? { id: 'open', status: 'ready', display: `0 of ${total}`, detail: ALL_MARKED }
      : {
          id: 'open',
          status: 'ready',
          display: `${openNumbers.length} of ${total}`,
          detail: `Not yet marked, by ${plural(openNumbers.length, 'number', 'numbers')} in the list: ${numberList(openNumbers)}.`,
        };
  return { marked: marked.size, total, openNumbers, results: [present, open] };
}

/** What a result says before anything is ticked, and in the served page. */
export function waitingText(): { readonly display: string; readonly detail: string } {
  return { display: WAITING, detail: WAITING_DETAIL };
}

// ---------------------------------------------------------------------------------------------------------------
// Custom element. Nothing below runs at import time except the guarded registration in definePricingChecker().
// ---------------------------------------------------------------------------------------------------------------

export function definePricingChecker(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-pricing-checker') !== undefined) return;

  class PricingCheckerElement extends HTMLElement {
    private enhanced: { readonly dispose: () => void } | null = null;

    connectedCallback(): void {
      // A tick is a decision, not typing, so each one updates the counts at once.
      this.enhanced = enhanceForm(this, () => this.render(), { settle: false });
    }

    disconnectedCallback(): void {
      this.enhanced?.dispose();
      this.enhanced = null;
    }

    private ticked(): string[] {
      const names: string[] = [];
      this.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
        if (box.checked) names.push(box.name);
      });
      return names;
    }

    private render(): void {
      const outcome = check(this.ticked());
      for (const result of outcome.results) showResult(this, result.id, result.status, result.display, result.detail);
    }
  }

  customElements.define('we-pricing-checker', PricingCheckerElement);
}
