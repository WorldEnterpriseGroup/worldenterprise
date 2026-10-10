/**
 * The metrics calculator's inputs and metric definitions, as data. One source for the server-rendered form, the formula table
 * (which is the no-JavaScript fallback) and the calculation in src/scripts/metrics-calc.ts.
 *
 * Where a definition comes from is recorded on every metric. `brief` means the formula is the one published in the research brief
 * /research/early-stage-saas-metrics-definitions/ (src/content/research/early-stage-saas-metrics-definitions.md, appendix table),
 * character for character. `adapted` means the brief's formula with the brief's customer count replaced by recurring revenue.
 * `convention` means the brief does not define the metric; the page says so, in the brief's own words: a formula the references do not
 * state is a reporting choice, so say which one you use. tests/unit/wp-49/formulas.test.ts reads the brief and fails when a `brief`
 * formula drifts from its table row, or when a `convention` metric is one the brief does define.
 *
 * Pure data: no Astro imports, so `node --test` loads it.
 */

export const INPUT_IDS = [
  'startingMrr',
  'newMrr',
  'expansionMrr',
  'contractionMrr',
  'churnedMrr',
  'acquisitionSpend',
  'newCustomers',
  'grossMarginPct',
  'cash',
  'monthlyBurn',
] as const;
export type InputId = (typeof INPUT_IDS)[number];

/** How an input is validated and shown: an amount (zero or more), a whole count, or a percentage from 0 to 100. */
export type InputKind = 'amount' | 'count' | 'percent';

export type PanelId = 'revenue' | 'acquisition' | 'cash';

export interface InputSpec {
  readonly id: InputId;
  readonly label: string;
  /** One or two short lines. Shown under the field until the entry has a problem, then replaced by the message, so the field never changes height. */
  readonly hint: string;
  readonly kind: InputKind;
  readonly panel: PanelId;
}

export const INPUTS: readonly InputSpec[] = [
  { id: 'startingMrr', label: 'Starting MRR', hint: 'Monthly recurring revenue at the start of the month.', kind: 'amount', panel: 'revenue' },
  { id: 'newMrr', label: 'New MRR', hint: 'Added by customers who joined this month.', kind: 'amount', panel: 'revenue' },
  { id: 'expansionMrr', label: 'Expansion MRR', hint: 'Added by existing customers: upgrades and extra seats.', kind: 'amount', panel: 'revenue' },
  { id: 'contractionMrr', label: 'Contraction MRR', hint: 'Lost to downgrades by customers who stayed.', kind: 'amount', panel: 'revenue' },
  { id: 'churnedMrr', label: 'Churned MRR', hint: 'Lost to customers who left this month.', kind: 'amount', panel: 'revenue' },
  { id: 'acquisitionSpend', label: 'Acquisition spend', hint: 'Marketing cost for the month. Add sales wages for the extended form.', kind: 'amount', panel: 'acquisition' },
  { id: 'newCustomers', label: 'Customers acquired', hint: 'New paying customers this month, as a whole number.', kind: 'count', panel: 'acquisition' },
  { id: 'grossMarginPct', label: 'Gross margin (%)', hint: 'Revenue less the cost of serving it, as a percent.', kind: 'percent', panel: 'acquisition' },
  { id: 'cash', label: 'Cash on hand', hint: 'What the company holds now, in the same currency.', kind: 'amount', panel: 'cash' },
  { id: 'monthlyBurn', label: 'Net burn per month', hint: 'Cash out less cash in over a month. Enter 0 if cash grew.', kind: 'amount', panel: 'cash' },
];

export const PANELS: readonly { readonly id: PanelId; readonly title: string; readonly intro: string }[] = [
  { id: 'revenue', title: 'Recurring revenue', intro: 'One month of movement in monthly recurring revenue (MRR). Enter a 0 where nothing happened.' },
  { id: 'acquisition', title: 'Acquiring customers', intro: 'What the month cost and what it brought in. Margin is the share of revenue you keep after serving it.' },
  { id: 'cash', title: 'Cash', intro: 'What the company holds and how fast it is falling.' },
];

export const METRIC_IDS = ['netNewMrr', 'revenueChurn', 'nrr', 'quickRatio', 'cac', 'cacPayback', 'ltv', 'ltvToCac', 'runway'] as const;
export type MetricId = (typeof METRIC_IDS)[number];

export type MetricUnit = 'amount' | 'percent' | 'ratio' | 'months';
export type MetricSource = 'brief' | 'adapted' | 'convention';

export interface MetricDefinition {
  readonly id: MetricId;
  readonly name: string;
  readonly unit: MetricUnit;
  /** The formula as shown on the page. For `brief` it is the brief's text exactly. */
  readonly formula: string;
  readonly source: MetricSource;
  /** The metric's name in the brief's appendix table, or null when the brief does not define it. */
  readonly briefMetric: string | null;
  /** The brief's published formula, verbatim, or null. For `adapted` it is the text this definition was adapted from. */
  readonly briefFormula: string | null;
  /** Symbols and assumptions, stated so a reader can recompute the number from the inputs. */
  readonly assumptions: readonly string[];
  /** The panel the result is shown in. */
  readonly panel: PanelId;
  /** Inputs the result needs. An empty one holds the result back until it is entered. */
  readonly needs: readonly InputId[];
}

export const METRICS: readonly MetricDefinition[] = [
  {
    id: 'netNewMrr',
    name: 'Net new MRR',
    unit: 'amount',
    formula: 'New MRR + Expansion MRR - Contraction MRR - Churned MRR',
    source: 'convention',
    briefMetric: null,
    briefFormula: null,
    assumptions: ['The change in MRR over the month. Starting MRR is not needed.'],
    panel: 'revenue',
    needs: ['newMrr', 'expansionMrr', 'contractionMrr', 'churnedMrr'],
  },
  {
    id: 'revenueChurn',
    name: 'Revenue churn',
    unit: 'percent',
    formula: '(Churned MRR / Starting MRR) x 100',
    source: 'adapted',
    briefMetric: 'Customer churn',
    briefFormula: '(Customers lost / Total customers during period) x 100',
    assumptions: [
      'The brief states churn for customers. This is the same ratio with recurring revenue in place of customers, so it is labelled revenue churn.',
      'Only revenue from customers you started the month with counts: Churned MRR cannot be more than Starting MRR.',
    ],
    panel: 'revenue',
    needs: ['startingMrr', 'churnedMrr'],
  },
  {
    id: 'nrr',
    name: 'Net revenue retention (NRR)',
    unit: 'percent',
    formula:
      '[(Beginning recurring revenue - MRR lost from churn - MRR lost from downgrades + revenue from upgrades) / Beginning recurring revenue] x 100',
    source: 'brief',
    briefMetric: 'NRR',
    briefFormula:
      '[(Beginning recurring revenue - MRR lost from churn - MRR lost from downgrades + revenue from upgrades) / Beginning recurring revenue] x 100',
    assumptions: [
      'Beginning recurring revenue is Starting MRR. MRR lost from churn is Churned MRR, MRR lost from downgrades is Contraction MRR, and revenue from upgrades is Expansion MRR.',
      'Existing customers only: New MRR is not in it.',
    ],
    panel: 'revenue',
    needs: ['startingMrr', 'churnedMrr', 'contractionMrr', 'expansionMrr'],
  },
  {
    id: 'quickRatio',
    name: 'Quick ratio',
    unit: 'ratio',
    formula: '(New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)',
    source: 'convention',
    briefMetric: null,
    briefFormula: null,
    assumptions: ['A ratio of two derived figures. The inputs are shown beside the result so it can be recomputed.'],
    panel: 'revenue',
    needs: ['newMrr', 'expansionMrr', 'churnedMrr', 'contractionMrr'],
  },
  {
    id: 'cac',
    name: 'Customer acquisition cost (CAC)',
    unit: 'amount',
    formula: 'MCC / CA',
    source: 'brief',
    briefMetric: 'CAC, simple',
    briefFormula: 'MCC / CA',
    assumptions: [
      'MCC is the marketing cost for the period and CA is the customers acquired in it, as the brief reads the symbols.',
      'If the spend you enter also holds sales and marketing wages, software, professional services or overhead, the result is the extended form. Label which form you use and do not mix the two in one trend line.',
    ],
    panel: 'acquisition',
    needs: ['acquisitionSpend', 'newCustomers'],
  },
  {
    id: 'cacPayback',
    name: 'CAC payback',
    unit: 'months',
    formula: 'CAC / (New MRR per customer x Gross margin)',
    source: 'convention',
    briefMetric: null,
    briefFormula: null,
    assumptions: [
      'New MRR per customer is New MRR divided by Customers acquired. Gross margin is entered as a percent and used as a share.',
      'The result is the number of months of gross margin from a new customer that it takes to cover its CAC. Churn during those months is ignored.',
    ],
    panel: 'acquisition',
    needs: ['acquisitionSpend', 'newCustomers', 'newMrr', 'grossMarginPct'],
  },
  {
    id: 'ltv',
    name: 'Customer lifetime value (LTV)',
    unit: 'amount',
    formula: 'Margin x (Retention / (1 + Discount - Retention))',
    source: 'brief',
    briefMetric: 'CLV',
    briefFormula: 'Margin x (Retention / (1 + Discount - Retention))',
    assumptions: [
      'The brief gives the basic form only. Margin is the monthly gross margin of one new customer: New MRR per customer x Gross margin.',
      'Retention is one minus revenue churn for the month, as a share. This treats lost revenue like a lost customer.',
      'Discount, the allowance for the time value of money, is set to 0. The calculator makes no allowance for it.',
    ],
    panel: 'acquisition',
    needs: ['newMrr', 'newCustomers', 'grossMarginPct', 'startingMrr', 'churnedMrr'],
  },
  {
    id: 'ltvToCac',
    name: 'LTV to CAC ratio',
    unit: 'ratio',
    formula: 'LTV / CAC',
    source: 'convention',
    briefMetric: null,
    briefFormula: null,
    assumptions: [
      'The brief notes that a ratio of lifetime value to acquisition cost is sometimes quoted. It publishes no target and neither does this page.',
      'It inherits every assumption of LTV and of CAC.',
    ],
    panel: 'acquisition',
    needs: ['acquisitionSpend', 'newCustomers', 'newMrr', 'grossMarginPct', 'startingMrr', 'churnedMrr'],
  },
  {
    id: 'runway',
    name: 'Runway',
    unit: 'months',
    formula: 'Cash on hand / Net burn per month',
    source: 'convention',
    briefMetric: null,
    briefFormula: null,
    assumptions: ['Assumes this month’s burn repeats. It is arithmetic, not a forecast, and it says nothing about future fundraising.'],
    panel: 'cash',
    needs: ['cash', 'monthlyBurn'],
  },
];

export function inputSpec(id: InputId): InputSpec {
  const found = INPUTS.find((input) => input.id === id);
  if (found === undefined) throw new Error(`Unknown calculator input: ${id}`);
  return found;
}

export function metricDefinition(id: MetricId): MetricDefinition {
  const found = METRICS.find((metric) => metric.id === id);
  if (found === undefined) throw new Error(`Unknown metric: ${id}`);
  return found;
}

/** The sentence under the form. The same words are in the static page so a visitor without JavaScript reads them too. */
export const SOURCE_LABELS: Readonly<Record<MetricSource, string>> = {
  brief: 'Formula from the research brief',
  adapted: 'Adapted from the research brief',
  convention: 'A convention: the research brief does not define it',
};

/** The short tag on each result card. */
export const SOURCE_TAGS: Readonly<Record<MetricSource, string>> = {
  brief: 'Formula from the brief',
  adapted: 'Adapted from the brief',
  convention: 'Convention',
};
