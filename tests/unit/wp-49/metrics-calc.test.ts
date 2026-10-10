import assert from 'node:assert/strict';
import test from 'node:test';
import { METRIC_IDS } from '../../../src/components/islands/we-calc/formulas.ts';
import type { InputId, MetricId } from '../../../src/components/islands/we-calc/formulas.ts';
import { calculate, formatValue, lifetimeValue, MAX_ENTRY, parseEntry } from '../../../src/scripts/metrics-calc.ts';
import type { MetricResult, Outcome, RawInputs } from '../../../src/scripts/metrics-calc.ts';

/** One month, entered the way a founder would type it. Worked by hand in the comments of each test. */
const BASE: Readonly<Record<InputId, string>> = {
  startingMrr: '10,000',
  newMrr: '1500',
  expansionMrr: '500',
  contractionMrr: '200',
  churnedMrr: '300',
  acquisitionSpend: '6000',
  newCustomers: '10',
  grossMarginPct: '80',
  cash: '120000',
  monthlyBurn: '15000',
};

function result(outcome: Outcome, id: MetricId): MetricResult {
  const found = outcome.results.find((r) => r.id === id);
  assert.ok(found, `no result for ${id}`);
  return found;
}

function withInputs(changes: RawInputs): RawInputs {
  return { ...BASE, ...changes };
}

function assertClean(outcome: Outcome): void {
  for (const r of outcome.results) {
    assert.doesNotMatch(`${r.display} ${r.detail}`, /NaN|Infinity|undefined|null/, `${r.id}: ${r.display} / ${r.detail}`);
    if (r.value !== null) assert.ok(Number.isFinite(r.value), `${r.id} is not finite`);
    assert.equal(r.status === 'ready', r.value !== null, `${r.id}: a value exists exactly when the result is ready`);
  }
}

test('a full month works out by hand', () => {
  const outcome = calculate(BASE);
  assert.deepEqual(outcome.issues, []);
  assertClean(outcome);
  const expected: Readonly<Record<MetricId, number>> = {
    netNewMrr: 1500, // 1500 + 500 - 200 - 300
    revenueChurn: 5, // (300 + 200) / 10000
    nrr: 100, // (10000 - 300 - 200 + 500) / 10000
    quickRatio: 4, // 2000 / 500
    cac: 600, // 6000 / 10
    cacPayback: 5, // 600 / (150 x 0.8)
    ltv: 2280, // 120 x (0.95 / (1 + 0 - 0.95))
    ltvToCac: 3.8, // 2280 / 600
    runway: 8, // 120000 / 15000
  };
  for (const id of METRIC_IDS) {
    const r = result(outcome, id);
    assert.equal(r.status, 'ready', id);
    assert.ok(Math.abs((r.value ?? Number.NaN) - expected[id]) < 1e-9, `${id}: ${r.value} vs ${expected[id]}`);
  }
  assert.equal(result(outcome, 'revenueChurn').display, '5.0%');
  assert.equal(result(outcome, 'quickRatio').display, '4.00');
  assert.equal(result(outcome, 'runway').display, '8.0 months');
  assert.equal(result(outcome, 'ltv').display, '2,280');
  assert.equal(result(outcome, 'revenueChurn').detail, '((300 + 200) / 10,000) x 100 = 5.0%');
  assert.equal(result(outcome, 'cac').detail, '6,000 / 10 = 600');
});

test('every result shows its working with the entered numbers', () => {
  const outcome = calculate(BASE);
  assert.equal(result(outcome, 'netNewMrr').detail, '1,500 + 500 - 200 - 300 = 1,500');
  assert.equal(result(outcome, 'quickRatio').detail, '(1,500 + 500) / (300 + 200) = 4.00');
  assert.match(result(outcome, 'nrr').detail, /^\[\(10,000 - 300 - 200 \+ 500\) \/ 10,000\] x 100 = 100\.0%$/);
});

test('the brief CLV formula, with and without a discount, checked against the published form', () => {
  const published = (margin: number, retention: number, discount: number): number => margin * (retention / (1 + discount - retention));
  for (const [margin, retention, discount] of [
    [120, 0.97, 0],
    [50, 0.5, 0],
    [80, 0.9, 0.01],
    [10, 0, 0.1],
  ] as const) {
    const calc = lifetimeValue(margin, retention, discount);
    assert.ok(calc.ok);
    assert.ok(Math.abs(calc.value - published(margin, retention, discount)) < 1e-9);
  }
});

test('zero churn and contraction leave lifetime value undefined, with a reason', () => {
  const calc = lifetimeValue(120, 1, 0);
  assert.equal(calc.ok, false);
  const outcome = calculate(withInputs({ churnedMrr: '0', contractionMrr: '0' }));
  assert.equal(result(outcome, 'ltv').status, 'undefined');
  assert.equal(result(outcome, 'ltvToCac').status, 'undefined');
  assert.match(result(outcome, 'ltv').detail, /never lost/);
  assert.equal(result(outcome, 'revenueChurn').display, '0.0%');
  assertClean(outcome);
});

test('zero starting MRR leaves churn, retention and lifetime value undefined', () => {
  const outcome = calculate(withInputs({ startingMrr: '0', churnedMrr: '0', contractionMrr: '0' }));
  for (const id of ['revenueChurn', 'nrr', 'ltv', 'ltvToCac'] as const) assert.equal(result(outcome, id).status, 'undefined', id);
  assert.equal(result(outcome, 'netNewMrr').status, 'ready');
  assertClean(outcome);
});

test('no customers acquired leaves every cost per customer undefined', () => {
  const outcome = calculate(withInputs({ newCustomers: '0' }));
  for (const id of ['cac', 'cacPayback', 'ltv', 'ltvToCac'] as const) assert.equal(result(outcome, id).status, 'undefined', id);
  assert.match(result(outcome, 'cac').detail, /No customers were acquired/);
  assertClean(outcome);
});

test('no losses leaves the quick ratio undefined', () => {
  const outcome = calculate(withInputs({ churnedMrr: '0', contractionMrr: '0' }));
  assert.equal(result(outcome, 'quickRatio').status, 'undefined');
  assert.match(result(outcome, 'quickRatio').detail, /Nothing was lost/);
  assert.equal(result(outcome, 'nrr').display, '105.0%');
});

test('zero gross margin leaves payback undefined and lifetime value at zero', () => {
  const outcome = calculate(withInputs({ grossMarginPct: '0' }));
  assert.equal(result(outcome, 'cacPayback').status, 'undefined');
  assert.equal(result(outcome, 'ltv').value, 0);
  assert.equal(result(outcome, 'ltvToCac').value, 0);
});

test('zero acquisition spend gives a CAC of zero and leaves LTV to CAC undefined', () => {
  const outcome = calculate(withInputs({ acquisitionSpend: '0' }));
  assert.equal(result(outcome, 'cac').value, 0);
  assert.equal(result(outcome, 'cacPayback').value, 0);
  assert.equal(result(outcome, 'ltvToCac').status, 'undefined');
  assertClean(outcome);
});

test('net burn of zero leaves runway undefined; zero cash with burn gives zero months', () => {
  const none = calculate(withInputs({ monthlyBurn: '0' }));
  assert.equal(result(none, 'runway').status, 'undefined');
  assert.match(result(none, 'runway').detail, /not running down/);
  const empty = calculate(withInputs({ cash: '0' }));
  assert.equal(result(empty, 'runway').display, '0.0 months');
  assertClean(none);
});

test('a shrinking month gives a negative net new MRR and a quick ratio under one', () => {
  const outcome = calculate(withInputs({ newMrr: '0', expansionMrr: '0', contractionMrr: '100', churnedMrr: '200' }));
  assert.equal(result(outcome, 'netNewMrr').display, '-300');
  assert.equal(result(outcome, 'quickRatio').display, '0.00');
  assert.equal(result(outcome, 'nrr').display, '97.0%');
  assert.equal(result(outcome, 'revenueChurn').display, '3.0%');
});

test('blank fields hold a result back and name what is missing', () => {
  const outcome = calculate({});
  assert.deepEqual(outcome.issues, []);
  for (const r of outcome.results) {
    assert.equal(r.status, 'waiting');
    assert.match(r.detail, /^Enter .+ to see this\.$/);
  }
  const partial = calculate({ cash: '5000' });
  assert.equal(result(partial, 'runway').detail, 'Enter Net burn per month to see this.');
});

test('a bad entry is described, holds back only what depends on it, and never reaches the arithmetic', () => {
  const cases: readonly [InputId, string, RegExp][] = [
    ['startingMrr', 'abc', /Starting MRR: enter a number such as/],
    ['newMrr', '12e3', /New MRR: enter a number/],
    ['newMrr', '1.2.3', /New MRR: enter a number/],
    ['cash', '$500', /Cash on hand: enter a number/],
    ['cash', 'Infinity', /Cash on hand: enter a number/],
    ['cash', 'NaN', /Cash on hand: enter a number/],
    ['monthlyBurn', '-5', /Net burn per month: enter zero or more/],
    ['newCustomers', '2.5', /whole number/],
    ['grossMarginPct', '120', /from 0 to 100/],
    ['cash', '1e13', /enter a number/],
    ['cash', '5000000000000', /below one trillion/],
    ['cash', '9'.repeat(400), /below one trillion|too large/],
  ];
  for (const [id, text, message] of cases) {
    const outcome = calculate(withInputs({ [id]: text }));
    const issue = outcome.issues.find((i) => i.id === id);
    assert.ok(issue, `${id}=${text} should be an issue`);
    assert.match(issue.message, message, `${id}=${text}`);
    assertClean(outcome);
  }
  const outcome = calculate(withInputs({ cash: 'abc' }));
  assert.equal(result(outcome, 'runway').status, 'waiting');
  assert.equal(result(outcome, 'runway').display, 'Needs a fix');
  assert.equal(result(outcome, 'cac').status, 'ready');
});

test('entries accept thousands commas, spaces around the number and a leading decimal point', () => {
  assert.deepEqual(parseEntry('cash', ' 1,250,000.50 '), { kind: 'value', value: 1250000.5 });
  assert.deepEqual(parseEntry('cash', '.5'), { kind: 'value', value: 0.5 });
  assert.deepEqual(parseEntry('cash', '   '), { kind: 'empty' });
  assert.deepEqual(parseEntry('cash', undefined), { kind: 'empty' });
  assert.deepEqual(parseEntry('cash', '-0'), { kind: 'value', value: 0 });
  assert.equal(parseEntry('cash', '12,34').kind, 'error');
  assert.equal(parseEntry('cash', String(MAX_ENTRY)).kind, 'value');
});

test('losses cannot be more than starting MRR', () => {
  const outcome = calculate(withInputs({ startingMrr: '400', churnedMrr: '300', contractionMrr: '200' }));
  assert.equal(outcome.issues.length, 1);
  assert.equal(outcome.issues[0]?.message, 'Churned plus contraction MRR cannot be more than starting MRR.');
  assert.equal(result(outcome, 'revenueChurn').display, 'Needs a fix');
  assertClean(outcome);
  assert.deepEqual(calculate(withInputs({ startingMrr: '500', churnedMrr: '300', contractionMrr: '200' })).issues, []);
});

test('a rounded-to-zero result carries no minus sign', () => {
  assert.equal(formatValue('percent', -0.0001), '0.0%');
  assert.equal(formatValue('ratio', -0.001), '0.00');
  assert.equal(formatValue('amount', -0.001), '0');
  assert.equal(formatValue('months', 1), '1.0 month');
});

test('no input, however hostile, makes any result NaN or Infinity', () => {
  const samples = ['', ' ', '0', '0.0', '-0', '1', '0.0000001', '999999999999', '1000000000000', 'abc', '1e5', '١٢٣', '--1', '1,,000', '😀', '9'.repeat(30)];
  const ids = Object.keys(BASE) as InputId[];
  let seed = 7;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed;
  };
  for (let round = 0; round < 600; round += 1) {
    const raw: Partial<Record<InputId, string>> = {};
    for (const id of ids) raw[id] = samples[next() % samples.length] ?? '';
    assertClean(calculate(raw));
  }
});
