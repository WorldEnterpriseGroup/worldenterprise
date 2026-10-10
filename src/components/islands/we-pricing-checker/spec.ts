/**
 * The pricing page checker's statements, results and page copy, as data. One source for the server-rendered checklist, the table that
 * explains each result (which is the no-JavaScript fallback) and the count in src/scripts/pricing-checker.ts. Every sentence of static
 * copy lives here or in src/content/pages/tools/pricing-page-checker.mdx, so the sentence ledger can enumerate it.
 *
 * The statements are the launch checklist of the "Pricing page fundamentals" article, in its order. The tool checks presence only: it
 * counts what the visitor ticks and never scores, grades or ranks the page.
 *
 * Pure data: no Astro imports, so `node --test` loads it.
 */

export const CHECK_IDS = ['audience', 'unit', 'limits', 'edge', 'table', 'questions', 'person', 'reason'] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export interface CheckSpec {
  readonly id: CheckId;
  readonly text: string;
}

export const CHECKS: readonly CheckSpec[] = [
  { id: 'audience', text: 'Each plan has a one-line statement of who it is for.' },
  { id: 'unit', text: 'The pricing unit is named and explained in one sentence.' },
  { id: 'limits', text: 'Every limit appears in the units the customer uses.' },
  { id: 'edge', text: 'The page says what happens at a limit, how billing works and how to cancel.' },
  { id: 'table', text: 'The comparison table uses real headers and does not depend on color alone.' },
  { id: 'questions', text: 'Two real customer questions are answered on the page.' },
  { id: 'person', text: 'A way to reach a person is visible.' },
  { id: 'reason', text: 'The reason for the current price is written down somewhere you will find it later.' },
];

export function isCheckId(value: string): value is CheckId {
  return (CHECK_IDS as readonly string[]).includes(value);
}

export const RESULT_IDS = ['present', 'open'] as const;
export type CheckResultId = (typeof RESULT_IDS)[number];

export interface CheckResultSpec {
  readonly id: CheckResultId;
  readonly name: string;
}

export const RESULTS: readonly CheckResultSpec[] = [
  { id: 'present', name: 'Statements marked true' },
  { id: 'open', name: 'Statements not yet marked' },
];

export function resultSpec(id: CheckResultId): CheckResultSpec {
  const spec = RESULTS.find((result) => result.id === id);
  if (spec === undefined) throw new Error(`Unknown pricing checker result: ${id}`);
  return spec;
}

export const ISLAND = {
  panelTitle: 'Your pricing page',
  panelIntro: 'Read your own pricing page, then tick each statement that is true of it today.',
  legend: 'True of my pricing page today',
  liveLabel: 'Results: pricing page statements',
} as const;

/** What a result says before anything is ticked, and in the served page. */
export const WAITING_DETAIL = 'Tick a statement to see this.';

export interface FormulaRow {
  readonly id: CheckResultId;
  readonly name: string;
  readonly formula: string;
  readonly assumptions: readonly string[];
}

export const FORMULAS: readonly FormulaRow[] = [
  {
    id: 'present',
    name: 'Statements marked true',
    formula: 'The number of statements you have ticked, out of all the statements in the list.',
    assumptions: [
      'A tick means the statement is true of your page today, as you judge it.',
      'Each statement counts once, and no statement counts for more than another.',
      'The count is not a score, a grade or a percent.',
    ],
  },
  {
    id: 'open',
    name: 'Statements not yet marked',
    formula: 'The numbers, in list order, of the statements you have not ticked.',
    assumptions: [
      'The numbers are the ones in the list above.',
      'A statement that is not ticked is not yet marked true. It is not marked false.',
    ],
  },
];

export const FORMULAS_PAGE = {
  title: 'How each count is worked out',
  intro: 'Every result above comes from the rule in this table. The statements themselves come from the launch checklist in the article on pricing page fundamentals.',
  caption: 'Rules and assumptions of the pricing checker',
  regionLabel: 'Rules used by the pricing page checker',
  headers: ['Result', 'Rule', 'Assumptions'] as const,
  methodology:
    'Each result is a count of the ticks you make, or the numbers of the statements you have not ticked. Nothing is weighed, ranked or compared, so the same ticks always give the same counts.',
  limitations:
    'The checker cannot see your page, so it cannot tell whether a tick is true. It checks for presence, not quality: a statement can be true of a page that still confuses its buyers. It shows no benchmark or target, and a count is not a forecast of how the page will be read.',
} as const;

export const PAGE = {
  lead: 'Eight statements from a launch checklist. Tick the ones that are true of your page, and see what is left.',
  noscript: 'JavaScript is off. The ticks below need JavaScript, but the rules still work by hand: every statement is listed, and the table further down explains each count.',
  jump: 'Start checking',
  secondary: 'Read the rules',
} as const;
