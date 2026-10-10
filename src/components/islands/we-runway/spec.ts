/**
 * The runway calculator's inputs, results and page copy, as data. One source for the server-rendered form, the formula table (which is
 * the no-JavaScript fallback) and the calculation in src/scripts/runway.ts. Every sentence of static copy lives here or in
 * src/content/pages/tools/runway-calculator.mdx, so the sentence ledger can enumerate it.
 *
 * Pure data: no Astro imports, so `node --test` loads it.
 */

import type { EntryKind } from '../../tools/numeric.ts';

export const RUNWAY_INPUT_IDS = ['cash', 'burn', 'growth'] as const;
export type RunwayInputId = (typeof RUNWAY_INPUT_IDS)[number];

export interface RunwayInputSpec {
  readonly id: RunwayInputId;
  readonly label: string;
  /** One or two short lines, shown under the field until the entry has a problem. */
  readonly hint: string;
  readonly kind: EntryKind;
}

export const INPUTS: readonly RunwayInputSpec[] = [
  { id: 'cash', label: 'Cash on hand', hint: 'What the company holds now, in one currency.', kind: 'amount' },
  { id: 'burn', label: 'Net burn per month', hint: 'Cash out less cash in over a month. Enter 0 if cash grew.', kind: 'amount' },
  { id: 'growth', label: 'Burn growth per month (%)', hint: 'Optional. How much faster burn grows each month, from 0 to 100.', kind: 'percent' },
];

export function inputSpec(id: RunwayInputId): RunwayInputSpec {
  const spec = INPUTS.find((input) => input.id === id);
  if (spec === undefined) throw new Error(`Unknown runway input: ${id}`);
  return spec;
}

export const RESULT_IDS = ['level', 'growing'] as const;
export type RunwayResultId = (typeof RESULT_IDS)[number];

export interface RunwayResultSpec {
  readonly id: RunwayResultId;
  readonly name: string;
  /** The inputs the result needs before it can show a number. */
  readonly needs: readonly RunwayInputId[];
}

export const RESULTS: readonly RunwayResultSpec[] = [
  { id: 'level', name: 'Runway at level burn', needs: ['cash', 'burn'] },
  { id: 'growing', name: 'Runway with growing burn', needs: ['cash', 'burn', 'growth'] },
];

export function resultSpec(id: RunwayResultId): RunwayResultSpec {
  const spec = RESULTS.find((result) => result.id === id);
  if (spec === undefined) throw new Error(`Unknown runway result: ${id}`);
  return spec;
}

/** The count stops here: 1,200 months is 100 years. */
export const MAX_MONTHS_COUNTED = 1200;

export const ISLAND = {
  panelTitle: 'Cash and burn',
  panelIntro: 'What the company holds, how fast it is falling, and, if you want to see it, how fast that fall is speeding up.',
  currency: 'Use one currency for every amount. The results carry no currency sign.',
  liveLabel: 'Results: runway',
} as const;

export interface FormulaRow {
  readonly id: RunwayResultId;
  readonly name: string;
  readonly formula: string;
  readonly assumptions: readonly string[];
}

export const FORMULAS: readonly FormulaRow[] = [
  {
    id: 'level',
    name: 'Runway at level burn',
    formula: 'Cash on hand divided by net burn per month, rounded down to one decimal place.',
    assumptions: [
      'Net burn stays the same every month.',
      'Cash on hand is the money in the bank today, not money owed to the company.',
      'Net burn is cash out less cash in over a month, so a month with no net burn has no runway to count.',
      'The count stops at 1,200 months, which is 100 years.',
    ],
  },
  {
    id: 'growing',
    name: 'Runway with growing burn',
    formula:
      'The first month uses the net burn you entered. Each later month uses the month before it multiplied by 1 plus the growth percent divided by 100. Add up the months until the next one would use more than the cash left. Runway is the whole months funded plus the cash left divided by that next month’s burn, rounded down to one decimal place.',
    assumptions: [
      'Burn grows by the same percent every month.',
      'A burn that falls is not modeled. Enter 0 for growth and use level burn.',
      'The count stops at 1,200 months, which is 100 years.',
    ],
  },
];

export const FORMULAS_PAGE = {
  title: 'How each number is worked out',
  intro: 'Every result above comes from the formula in this table. Whichever you report, say which one you used and what you assumed.',
  caption: 'Formulas and assumptions for the runway calculator',
  regionLabel: 'Formulas used by the runway calculator',
  headers: ['Result', 'Formula', 'Assumptions'] as const,
  methodology:
    'Each result is arithmetic on the three numbers you type. Level burn is a single division. Growing burn adds each month’s burn in turn, so the working can be checked by hand, month by month. Figures in the working are rounded for display, and runway is always rounded down.',
  limitations:
    'The calculator checks arithmetic, not your books: it cannot tell whether an entry is right. It treats cash as the bank balance and net burn as one month repeated, ignores the timing of payments, tax, loans and currency movements, and shows no benchmark or target. A result is not a forecast, and it says nothing about whether anyone will invest or lend.',
} as const;

/** What a result says before anything is typed, and in the served page. */
export function waitingDetail(id: RunwayResultId): string {
  const needs = resultSpec(id).needs.map((input) => inputSpec(input).label);
  return `Enter ${needs.join(', ')} to see this.`;
}

export const PAGE = {
  lead: 'Cash, burn and, if you want it, burn growth in. Months of runway out, with every step shown.',
  noscript: 'JavaScript is off. The fields below need JavaScript, but the formulas still work by hand: every one is listed in the table further down.',
  jump: 'Start calculating',
  secondary: 'Read the formulas',
} as const;
