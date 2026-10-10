import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_ENTRY,
  floorTo,
  formatAmount,
  formatCount,
  formatMonthsDown,
  formatPercent,
  formatPoints,
  isUsable,
  parseEntry,
} from '../../../src/components/tools/numeric.ts';
import type { EntrySpec } from '../../../src/components/tools/numeric.ts';

const amount: EntrySpec = { label: 'Cash', kind: 'amount' };
const count: EntrySpec = { label: 'Holders', kind: 'count' };
const percent: EntrySpec = { label: 'Growth', kind: 'percent' };

test('a blank or missing entry is empty, never zero', () => {
  assert.deepEqual(parseEntry(amount, undefined), { kind: 'empty' });
  assert.deepEqual(parseEntry(amount, ''), { kind: 'empty' });
  assert.deepEqual(parseEntry(amount, '   '), { kind: 'empty' });
});

test('plain numbers parse, with thousands commas and one decimal part', () => {
  assert.deepEqual(parseEntry(amount, '1000'), { kind: 'value', value: 1000 });
  assert.deepEqual(parseEntry(amount, ' 12,345.5 '), { kind: 'value', value: 12345.5 });
  assert.deepEqual(parseEntry(amount, '.5'), { kind: 'value', value: 0.5 });
  assert.deepEqual(parseEntry(amount, '0'), { kind: 'value', value: 0 });
});

test('negative zero is zero and any other negative is an error that says what to fix', () => {
  const zero = parseEntry(amount, '-0');
  assert.equal(zero.kind, 'value');
  if (zero.kind === 'value') assert.ok(Object.is(zero.value, 0));
  const negative = parseEntry(amount, '-5');
  assert.equal(negative.kind, 'error');
  if (negative.kind === 'error') assert.match(negative.message, /^Cash: enter zero or more/);
});

test('anything that is not plain digits is an error, never a number', () => {
  for (const text of ['abc', '1e3', '$5', '5%', '1,00', '5.', '0x10', 'NaN', 'Infinity', '1 000', '--1', '1..2', '١٢٣']) {
    assert.equal(parseEntry(amount, text).kind, 'error', text);
  }
});

test('a count must be whole and a percent must be from 0 to 100', () => {
  assert.equal(parseEntry(count, '2.5').kind, 'error');
  assert.deepEqual(parseEntry(count, '3'), { kind: 'value', value: 3 });
  assert.equal(parseEntry(percent, '100.01').kind, 'error');
  assert.deepEqual(parseEntry(percent, '100'), { kind: 'value', value: 100 });
  assert.deepEqual(parseEntry(percent, '0'), { kind: 'value', value: 0 });
});

test('the largest entry is one trillion, and a longer number is an error rather than infinity', () => {
  assert.deepEqual(parseEntry(amount, '1,000,000,000,000'), { kind: 'value', value: MAX_ENTRY });
  assert.equal(parseEntry(amount, '1000000000001').kind, 'error');
  assert.equal(parseEntry(amount, '9'.repeat(400)).kind, 'error');
});

test('every error message names the field and is plain text', () => {
  for (const text of ['abc', '-1', '1000000000001']) {
    const parsed = parseEntry(amount, text);
    assert.equal(parsed.kind, 'error');
    if (parsed.kind === 'error') assert.match(parsed.message, /^Cash: [A-Za-z].*\.$/);
  }
});

test('formatting is fixed, grouped and never negative zero', () => {
  assert.equal(formatAmount(1234.567), '1,234.57');
  assert.equal(formatAmount(-0.001), '0');
  assert.equal(formatCount(1234), '1,234');
  assert.equal(formatPercent(12.5), '12.50%');
  assert.equal(formatPoints(2.5), '+2.50 points');
  assert.equal(formatPoints(-2.5), '-2.50 points');
  assert.equal(formatPoints(0), '0.00 points');
});

test('months are rounded down to one decimal place, with the float noise of the division removed first', () => {
  assert.equal(formatMonthsDown(10), '10.0 months');
  assert.equal(formatMonthsDown(100000 / 18000), '5.5 months');
  assert.equal(formatMonthsDown(0.3 / 0.1), '3.0 months');
  assert.equal(formatMonthsDown(1), '1.0 month');
  assert.equal(formatMonthsDown(0.99), '0.9 months');
  assert.equal(floorTo(2.9999999999999996, 1), 3);
  assert.equal(floorTo(7.1428, 1), 7.1);
});

test('only a finite number is usable', () => {
  assert.equal(isUsable(1), true);
  assert.equal(isUsable(Number.NaN), false);
  assert.equal(isUsable(Number.POSITIVE_INFINITY), false);
});
