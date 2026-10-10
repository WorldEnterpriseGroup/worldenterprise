/**
 * The cap table explainer's inputs, results and page copy, as data. One source for the server-rendered form, the formula table (which is
 * the no-JavaScript fallback) and the arithmetic in src/scripts/cap-table.ts. Every sentence of static copy lives here or in
 * src/content/pages/tools/cap-table-explainer.mdx, so the sentence ledger can enumerate it.
 *
 * The explainer counts issued shares and nothing else, and it handles no money: it shows how issuing new shares to someone else
 * changes the share of the company that one holding is.
 *
 * Pure data: no Astro imports, so `node --test` loads it.
 */

import type { EntryKind } from '../../tools/numeric.ts';

export const CAP_INPUT_IDS = ['yours', 'others', 'issue'] as const;
export type CapInputId = (typeof CAP_INPUT_IDS)[number];

export interface CapInputSpec {
  readonly id: CapInputId;
  readonly label: string;
  /** One or two short lines, shown under the field until the entry has a problem. */
  readonly hint: string;
  readonly kind: EntryKind;
}

export const INPUTS: readonly CapInputSpec[] = [
  { id: 'yours', label: 'Shares you hold', hint: 'Whole shares, as your own cap table shows them.', kind: 'count' },
  { id: 'others', label: 'Other shares already issued', hint: 'Every issued share that is not yours, as a whole number.', kind: 'count' },
  { id: 'issue', label: 'New shares to issue', hint: 'Whole shares to issue to someone else. Enter 0 to see no change.', kind: 'count' },
];

export function inputSpec(id: CapInputId): CapInputSpec {
  const spec = INPUTS.find((input) => input.id === id);
  if (spec === undefined) throw new Error(`Unknown cap table input: ${id}`);
  return spec;
}

export const RESULT_IDS = ['before', 'after', 'change', 'total'] as const;
export type CapResultId = (typeof RESULT_IDS)[number];

export interface CapResultSpec {
  readonly id: CapResultId;
  readonly name: string;
  /** The inputs the result needs before it can show a number. */
  readonly needs: readonly CapInputId[];
}

export const RESULTS: readonly CapResultSpec[] = [
  { id: 'before', name: 'Your ownership today', needs: ['yours', 'others'] },
  { id: 'after', name: 'Your ownership after the issue', needs: ['yours', 'others', 'issue'] },
  { id: 'change', name: 'Change in your ownership', needs: ['yours', 'others', 'issue'] },
  { id: 'total', name: 'Shares issued after the issue', needs: ['yours', 'others', 'issue'] },
];

export function resultSpec(id: CapResultId): CapResultSpec {
  const spec = RESULTS.find((result) => result.id === id);
  if (spec === undefined) throw new Error(`Unknown cap table result: ${id}`);
  return spec;
}

export const ISLAND = {
  panelTitle: 'Shares',
  panelIntro: 'Count whole shares from your own cap table. The new shares go to someone else, not to you.',
  liveLabel: 'Results: ownership',
} as const;

export interface FormulaRow {
  readonly id: CapResultId;
  readonly name: string;
  readonly formula: string;
  readonly assumptions: readonly string[];
}

export const FORMULAS: readonly FormulaRow[] = [
  {
    id: 'before',
    name: 'Your ownership today',
    formula: 'Shares you hold divided by all issued shares, which is your shares plus the other shares already issued, shown as a percent.',
    assumptions: ['Only issued shares are counted.', 'Every share counts the same, whatever its class.'],
  },
  {
    id: 'after',
    name: 'Your ownership after the issue',
    formula: 'Shares you hold divided by all issued shares once the new shares are added, shown as a percent.',
    assumptions: [
      'The new shares go to someone else.',
      'Nothing else changes: no share is bought back, sold or cancelled.',
    ],
  },
  {
    id: 'change',
    name: 'Change in your ownership',
    formula: 'Your ownership after the issue less your ownership today, in percentage points.',
    assumptions: [
      'The difference is worked from the unrounded figures, then rounded.',
      'A negative change means the shares you hold are a smaller part of a larger total.',
    ],
  },
  {
    id: 'total',
    name: 'Shares issued after the issue',
    formula: 'Your shares, plus the other shares already issued, plus the new shares.',
    assumptions: ['Whole shares only.'],
  },
];

export const FORMULAS_PAGE = {
  title: 'How each number is worked out',
  intro: 'Every result above comes from the formula in this table. Whichever you report, say which one you used and what you assumed.',
  caption: 'Formulas and assumptions of the explainer',
  regionLabel: 'Formulas used by the cap table explainer',
  headers: ['Result', 'Formula', 'Assumptions'] as const,
  methodology:
    'Each result is arithmetic on the three numbers you type. Ownership is one division, the change is one subtraction, and the total is one sum, so every figure can be checked by hand. Percents are rounded to two decimal places for display.',
  limitations:
    'The explainer checks arithmetic, not your records: it cannot tell whether an entry matches your signed documents. It counts issued shares only, so options, promised options and any other right to shares are left out. It counts shares, not money, and it shows no benchmark or target. A result is not a forecast, and it says nothing about whether anyone will invest.',
} as const;

/** What a result says before anything is typed, and in the served page. */
export function waitingDetail(id: CapResultId): string {
  const needs = resultSpec(id).needs.map((input) => inputSpec(input).label);
  return `Enter ${needs.join(', ')} to see this.`;
}

export const PAGE = {
  lead: 'The shares you hold, the shares others hold and the new shares in. Ownership before and after out, with every division shown.',
  noscript: 'JavaScript is off. The fields below need JavaScript, but the formulas still work by hand: every one is listed in the table further down.',
  jump: 'Start counting',
  secondary: 'Read the formulas',
} as const;
