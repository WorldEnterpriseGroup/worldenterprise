/**
 * Metrics calculator. The first half is pure logic (parsing a typed entry, the nine calculations, number formatting) and runs under
 * `node --test`. The second half defines the `<we-calc>` custom element, which only enhances server-rendered markup. Nothing is
 * stored, nothing is sent, nothing goes into the address bar: the numbers stay in the page.
 *
 * Every result is a number, or a stated reason why there is no number. A division by zero, a missing entry or a result that is too
 * large to show never becomes `NaN` or `Infinity`.
 */

import { INPUTS, INPUT_IDS, METRICS, inputSpec, metricDefinition } from '../components/islands/we-calc/formulas.ts';
import type { InputId, InputKind, MetricId, MetricUnit } from '../components/islands/we-calc/formulas.ts';

/** Raw text of each field, as typed. A field that is absent or blank counts as not entered. */
export type RawInputs = Readonly<Partial<Record<InputId, string>>>;

/** The largest entry accepted. It keeps every product and quotient well inside the range of a double. */
export const MAX_ENTRY = 1e12;

export type ParsedEntry =
  | { readonly kind: 'empty' }
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'error'; readonly message: string };

/** Digits with optional thousands commas and an optional decimal part. No sign, no exponent, no currency symbol. */
const PLAIN_NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^\.\d+$/;

/** Parses what a person typed into one field. Returns a described error rather than a number that cannot be used. */
export function parseEntry(id: InputId, raw: string | undefined): ParsedEntry {
  const spec = inputSpec(id);
  const text = (raw ?? '').trim();
  if (text === '') return { kind: 'empty' };
  const unsigned = text.startsWith('-') ? text.slice(1).trim() : text;
  if (!PLAIN_NUMBER.test(unsigned)) {
    return { kind: 'error', message: `${spec.label}: enter a number such as ${EXAMPLES[spec.kind]}.` };
  }
  const value = Number(unsigned.replace(/,/g, ''));
  if (!Number.isFinite(value)) return { kind: 'error', message: `${spec.label}: that number is too large to use.` };
  if (text.startsWith('-') && value !== 0) return { kind: 'error', message: `${spec.label}: enter zero or more, not a negative number.` };
  if (value > MAX_ENTRY) return { kind: 'error', message: `${spec.label}: use a number below one trillion.` };
  if (spec.kind === 'count' && !Number.isInteger(value)) return { kind: 'error', message: `${spec.label}: enter a whole number of customers.` };
  if (spec.kind === 'percent' && value > 100) return { kind: 'error', message: `${spec.label}: enter a percent from 0 to 100.` };
  return { kind: 'value', value: value === 0 ? 0 : value };
}

const EXAMPLES: Readonly<Record<InputKind, string>> = {
  amount: '12500 or 12,500.50',
  count: '8',
  percent: '72.5',
};

export interface FieldIssue {
  readonly id: InputId;
  readonly message: string;
}

export type ResultStatus = 'ready' | 'waiting' | 'undefined';

export interface MetricResult {
  readonly id: MetricId;
  readonly status: ResultStatus;
  /** The number, only when status is `ready`. Always finite. */
  readonly value: number | null;
  /** What is shown as the result: the formatted number, or a short state. */
  readonly display: string;
  /** The working with the visitor's numbers when ready, otherwise the reason there is no number. */
  readonly detail: string;
}

export interface Outcome {
  readonly issues: readonly FieldIssue[];
  readonly results: readonly MetricResult[];
}

type Entered = Partial<Record<InputId, number>>;

const formatters = {
  amount: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }),
  percent: new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  ratio: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  months: new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
} as const;

/** Formats a value for its unit. A value that rounds to zero is shown without a minus sign. */
export function formatValue(unit: MetricUnit, value: number): string {
  const text = formatters[unit].format(value);
  const plain = /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
  if (unit === 'percent') return `${plain}%`;
  if (unit === 'months') return `${plain} ${plain === '1.0' ? 'month' : 'months'}`;
  return plain;
}

function amount(value: number): string {
  return formatters.amount.format(value);
}

/** A share of one, such as retention, with enough places that the working still reads as the number it stands for. */
const shareFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });

type Calc = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly reason: string };

const good = (value: number): Calc => (Number.isFinite(value) ? { ok: true, value: value === 0 ? 0 : value } : { ok: false, reason: 'The result is too large to show.' });
const bad = (reason: string): Calc => ({ ok: false, reason });

function divide(numerator: number, denominator: number, reasonIfZero: string): Calc {
  if (denominator === 0) return bad(reasonIfZero);
  return good(numerator / denominator);
}

/**
 * The brief's basic customer lifetime value: Margin x (Retention / (1 + Discount - Retention)). Margin is the gross margin of one
 * customer for one period, Retention and Discount are shares of one. Not defined when the divisor is zero or less, which for a
 * retention of one and no discount means a customer is never lost.
 */
export function lifetimeValue(margin: number, retention: number, discount: number): Calc {
  const divisor = 1 + discount - retention;
  if (divisor <= 0) {
    return bad('No revenue was lost to churn or downgrades, so under this formula a customer is never lost and the lifetime has no end.');
  }
  return good(margin * (retention / divisor));
}

const NO_CUSTOMERS = 'No customers were acquired, so there is no cost per customer to work out.';
const NO_STARTING_MRR = 'Starting MRR is 0, so there is no revenue to measure the loss against.';

const NO_MARGIN = 'Gross margin or new MRR per customer is 0, so a new customer adds no margin to recover its cost.';

interface Worked {
  readonly calc: Calc;
  readonly working: string;
}

function work(id: MetricId, v: Entered): Worked {
  const n = (key: InputId): number => v[key] ?? 0;
  const s = amount;
  const r = (value: number): string => shareFormat.format(value);
  switch (id) {
    case 'netNewMrr': {
      const value = n('newMrr') + n('expansionMrr') - n('contractionMrr') - n('churnedMrr');
      return { calc: good(value), working: `${s(n('newMrr'))} + ${s(n('expansionMrr'))} - ${s(n('contractionMrr'))} - ${s(n('churnedMrr'))}` };
    }
    case 'revenueChurn': {
      const calc = divide((n('churnedMrr') + n('contractionMrr')) * 100, n('startingMrr'), NO_STARTING_MRR);
      return { calc, working: `((${s(n('churnedMrr'))} + ${s(n('contractionMrr'))}) / ${s(n('startingMrr'))}) x 100` };
    }
    case 'nrr': {
      const calc = divide((n('startingMrr') - n('churnedMrr') - n('contractionMrr') + n('expansionMrr')) * 100, n('startingMrr'), NO_STARTING_MRR);
      return { calc, working: `[(${s(n('startingMrr'))} - ${s(n('churnedMrr'))} - ${s(n('contractionMrr'))} + ${s(n('expansionMrr'))}) / ${s(n('startingMrr'))}] x 100` };
    }
    case 'quickRatio': {
      const gains = n('newMrr') + n('expansionMrr');
      const losses = n('churnedMrr') + n('contractionMrr');
      const calc = divide(gains, losses, 'Nothing was lost this month, so the ratio has no divisor.');
      return { calc, working: `(${s(n('newMrr'))} + ${s(n('expansionMrr'))}) / (${s(n('churnedMrr'))} + ${s(n('contractionMrr'))})` };
    }
    case 'cac': {
      const calc = divide(n('acquisitionSpend'), n('newCustomers'), NO_CUSTOMERS);
      return { calc, working: `${s(n('acquisitionSpend'))} / ${s(n('newCustomers'))}` };
    }
    case 'cacPayback': {
      const cac = work('cac', v).calc;
      if (!cac.ok) return { calc: cac, working: '' };
      const perCustomer = n('newMrr') / n('newCustomers');
      const monthlyMargin = perCustomer * (n('grossMarginPct') / 100);
      const calc = divide(cac.value, monthlyMargin, NO_MARGIN);
      return { calc, working: `${s(cac.value)} / (${s(perCustomer)} x ${s(n('grossMarginPct'))}%)` };
    }
    case 'ltv': {
      if (n('newCustomers') === 0) return { calc: bad(NO_CUSTOMERS), working: '' };
      if (n('startingMrr') === 0) return { calc: bad(NO_STARTING_MRR), working: '' };
      const margin = (n('newMrr') / n('newCustomers')) * (n('grossMarginPct') / 100);
      const retention = 1 - (n('churnedMrr') + n('contractionMrr')) / n('startingMrr');
      return {
        calc: lifetimeValue(margin, retention, 0),
        working: `${s(margin)} x (${r(retention)} / (1 + 0 - ${r(retention)}))`,
      };
    }
    case 'ltvToCac': {
      const ltv = work('ltv', v).calc;
      const cac = work('cac', v).calc;
      if (!ltv.ok) return { calc: ltv, working: '' };
      if (!cac.ok) return { calc: cac, working: '' };
      return { calc: divide(ltv.value, cac.value, 'CAC is 0, so there is no cost to set lifetime value against.'), working: `${s(ltv.value)} / ${s(cac.value)}` };
    }
    case 'runway': {
      const calc = divide(n('cash'), n('monthlyBurn'), 'Net burn is 0, so cash is not running down and runway has no end to count to.');
      return { calc, working: `${s(n('cash'))} / ${s(n('monthlyBurn'))}` };
    }
  }
}

/** The cross-field rule: losses are counted from customers the month started with. Returns the field to mark, or null. */
function crossFieldIssue(entered: Entered): FieldIssue | null {
  const start = entered.startingMrr;
  if (start === undefined) return null;
  const lost = (entered.churnedMrr ?? 0) + (entered.contractionMrr ?? 0);
  if (lost <= start) return null;
  const id: InputId = entered.churnedMrr !== undefined ? 'churnedMrr' : 'contractionMrr';
  return { id, message: 'Churned plus contraction MRR cannot be more than starting MRR.' };
}

/** Everything the page shows for the entries typed so far. Pure: the same text gives the same outcome. */
export function calculate(raw: RawInputs): Outcome {
  const entered: Entered = {};
  const issues: FieldIssue[] = [];
  for (const id of INPUT_IDS) {
    const parsed = parseEntry(id, raw[id]);
    if (parsed.kind === 'value') entered[id] = parsed.value;
    else if (parsed.kind === 'error') issues.push({ id, message: parsed.message });
  }
  const cross = crossFieldIssue(entered);
  if (cross !== null) issues.push(cross);
  const blocked = new Set(issues.map((issue) => issue.id));

  const results = METRICS.map((metric): MetricResult => {
    const labels = (ids: readonly InputId[]): string => ids.map((id) => inputSpec(id).label).join(', ');
    const broken = metric.needs.filter((id) => blocked.has(id));
    if (broken.length > 0) {
      return { id: metric.id, status: 'waiting', value: null, display: 'Needs a fix', detail: `Correct ${labels(broken)} to see this.` };
    }
    const missing = metric.needs.filter((id) => entered[id] === undefined);
    if (missing.length > 0) {
      return { id: metric.id, status: 'waiting', value: null, display: 'Waiting', detail: `Enter ${labels(missing)} to see this.` };
    }
    const { calc, working } = work(metric.id, entered);
    if (!calc.ok) return { id: metric.id, status: 'undefined', value: null, display: 'Not defined', detail: calc.reason };
    return { id: metric.id, status: 'ready', value: calc.value, display: formatValue(metric.unit, calc.value), detail: `${working} = ${formatValue(metric.unit, calc.value)}` };
  });
  return { issues, results };
}

/** What a result says before anything is typed, and in the served page. */
export function waitingText(id: MetricId): { readonly display: string; readonly detail: string } {
  const needs = metricDefinition(id).needs.map((input) => inputSpec(input).label);
  return { display: 'Waiting', detail: `Enter ${needs.join(', ')} to see this.` };
}

// ---------------------------------------------------------------------------------------------------------------
// Custom element. Nothing below runs at import time except the guarded registration in defineMetricsCalculator().
// ---------------------------------------------------------------------------------------------------------------

/** Typing settles for this long before the results are rewritten, so a screen reader hears the result once, not once per key. */
const SETTLE_MS = 400;

export function defineMetricsCalculator(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-calc') !== undefined) return;

  class MetricsCalculatorElement extends HTMLElement {
    private form: HTMLFormElement | null = null;
    private timer: number | undefined;

    connectedCallback(): void {
      this.form = this.querySelector<HTMLFormElement>('form');
      if (this.form === null) return;
      const form = this.form;
      form.addEventListener('submit', (event) => event.preventDefault());
      form.addEventListener('input', () => this.schedule());
      form.addEventListener('reset', () => window.setTimeout(() => this.render(), 0));
      // The controls are rendered disabled, so a visitor without JavaScript is not handed fields that do nothing.
      form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
        control.disabled = false;
      });
      this.setAttribute('data-enhanced', '');
      this.render();
    }

    disconnectedCallback(): void {
      window.clearTimeout(this.timer);
    }

    private schedule(): void {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.render(), SETTLE_MS);
    }

    private raw(): RawInputs {
      const values: Partial<Record<InputId, string>> = {};
      if (this.form === null) return values;
      for (const spec of INPUTS) {
        const field = this.form.elements.namedItem(spec.id);
        if (field instanceof HTMLInputElement) values[spec.id] = field.value;
      }
      return values;
    }

    private render(): void {
      const outcome = calculate(this.raw());
      const issueById = new Map(outcome.issues.map((issue) => [issue.id, issue.message]));
      for (const spec of INPUTS) {
        const field = this.querySelector<HTMLInputElement>(`#calc-${spec.id}`);
        const note = this.querySelector<HTMLElement>(`[data-note="${spec.id}"]`);
        const message = issueById.get(spec.id);
        if (field !== null) {
          if (message === undefined) field.removeAttribute('aria-invalid');
          else field.setAttribute('aria-invalid', 'true');
        }
        if (note !== null) {
          note.textContent = message ?? note.dataset.hint ?? '';
          note.toggleAttribute('data-error', message !== undefined);
        }
      }
      for (const result of outcome.results) {
        const row = this.querySelector<HTMLElement>(`[data-metric="${result.id}"]`);
        if (row === null) continue;
        row.dataset.status = result.status;
        const value = row.querySelector<HTMLElement>('[data-value]');
        const detail = row.querySelector<HTMLElement>('[data-detail]');
        if (value !== null) value.textContent = result.display;
        if (detail !== null) detail.textContent = result.detail;
      }
    }
  }

  customElements.define('we-calc', MetricsCalculatorElement);
}
