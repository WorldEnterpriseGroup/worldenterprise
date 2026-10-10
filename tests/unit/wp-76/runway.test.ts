import assert from 'node:assert/strict';
import test from 'node:test';
import { RESULT_IDS } from '../../../src/components/islands/we-runway/spec.ts';
import { calculate, growingRunway, levelRunway, waitingText } from '../../../src/scripts/runway.ts';
import type { RawInputs, RunwayResult } from '../../../src/scripts/runway.ts';

const result = (raw: RawInputs, id: 'level' | 'growing'): RunwayResult => {
  const found = calculate(raw).results.find((r) => r.id === id);
  assert.ok(found, `result ${id}`);
  return found;
};

test('nothing typed shows two waiting results and no issue', () => {
  const outcome = calculate({});
  assert.deepEqual(outcome.issues, []);
  assert.deepEqual(outcome.results.map((r) => [r.id, r.status, r.display, r.months]), [
    ['level', 'waiting', 'Waiting', null],
    ['growing', 'waiting', 'Waiting', null],
  ]);
  assert.equal(result({}, 'level').detail, 'Enter Cash on hand, Net burn per month to see this.');
});

test('level runway is cash divided by net burn, rounded down to one decimal place', () => {
  assert.equal(result({ cash: '100,000', burn: '10,000' }, 'level').display, '10.0 months');
  assert.equal(result({ cash: '100000', burn: '14000' }, 'level').display, '7.1 months');
  assert.equal(result({ cash: '100000', burn: '18000' }, 'level').display, '5.5 months');
  assert.equal(result({ cash: '100000', burn: '12000' }, 'level').months, 8.3);
  assert.equal(result({ cash: '0.3', burn: '0.1' }, 'level').display, '3.0 months');
  assert.equal(result({ cash: '1', burn: '1' }, 'level').display, '1.0 month');
});

test('the working restates the entries and the division', () => {
  assert.equal(result({ cash: '100000', burn: '10000' }, 'level').detail, '100,000 / 10,000 = 10.0 months, which is 10 whole months');
});

test('zero cash is a runway of zero, not a missing result', () => {
  const level = result({ cash: '0', burn: '10' }, 'level');
  assert.equal(level.status, 'ready');
  assert.equal(level.display, '0.0 months');
  assert.equal(result({ cash: '0', burn: '10', growth: '5' }, 'growing').display, '0.0 months');
});

test('zero net burn is stated as not defined, in both results, and is never infinity', () => {
  for (const growth of [undefined, '0', '10']) {
    const outcome = calculate({ cash: '5000', burn: '0', growth });
    for (const r of outcome.results.filter((x) => x.status !== 'waiting')) {
      assert.equal(r.status, 'undefined');
      assert.equal(r.display, 'Not defined');
      assert.equal(r.months, null);
      assert.match(r.detail, /^Net burn is 0, so cash is not running down/);
    }
  }
  assert.equal(levelRunway(5000, 0).ok, false);
  assert.equal(growingRunway(5000, 0, 5).ok, false);
});

test('burn growth of zero gives the level answer', () => {
  for (const [cash, burn] of [[100000, 10000], [100000, 18000], [7, 2], [0.3, 0.1]] as const) {
    const level = levelRunway(cash, burn);
    const growing = growingRunway(cash, burn, 0);
    assert.ok(level.ok && growing.ok);
    if (level.ok && growing.ok) assert.equal(Math.floor(growing.months * 10) / 10, Math.floor(level.months * 10) / 10);
  }
});

test('growing burn counts whole months while the next still fits, then a fraction of the one that does not', () => {
  // 10, 20, 40 use 70 of 100; month four needs 80, so 30 / 80 = 0.375 of it is funded.
  const growing = result({ cash: '100', burn: '10', growth: '100' }, 'growing');
  assert.equal(growing.display, '3.3 months');
  assert.equal(growing.months, 3.3);
  assert.equal(growing.detail, '3 whole months use 70. 30 is left against 80 for month 4, which is 0.37 of a month. Total: 3.3 months');
});

test('a result that would run past 100 years is stated, never shown as a number', () => {
  const past = result({ cash: '1000000000000', burn: '1', growth: '1' }, 'growing');
  assert.equal(past.status, 'undefined');
  assert.match(past.detail, /1,200 months/);
  assert.equal(past.months, null);
});

test('a runway past the 1,200 month count has no result, in both calculations', () => {
  for (const id of ['level', 'growing'] as const) {
    const big = result({ cash: '1000000000000', burn: '1', growth: '0' }, id);
    assert.equal(big.status, 'undefined');
    assert.equal(big.months, null);
    assert.match(big.detail, /past 1,200 months/);
  }
  assert.equal(result({ cash: '1000000000000', burn: '0.001' }, 'level').status, 'undefined');
  assert.equal(result({ cash: '1201', burn: '1', growth: '0' }, 'growing').status, 'undefined');
  assert.equal(result({ cash: '1200', burn: '1', growth: '0' }, 'growing').status, 'ready');
  assert.equal(result({ cash: '1200', burn: '1' }, 'level').status, 'ready');
});

test('a bad entry is an issue on that field and blocks only the results that need it', () => {
  const outcome = calculate({ cash: 'abc', burn: '5', growth: '2' });
  assert.deepEqual(outcome.issues.map((i) => i.id), ['cash']);
  assert.ok(outcome.results.every((r) => r.status === 'waiting' && r.display === 'Needs a fix'));

  const growth = calculate({ cash: '100', burn: '5', growth: '101' });
  assert.deepEqual(growth.issues.map((i) => i.id), ['growth']);
  assert.equal(growth.results.find((r) => r.id === 'level')?.status, 'ready');
  assert.equal(growth.results.find((r) => r.id === 'growing')?.display, 'Needs a fix');
});

test('negative and huge entries are errors with a message that names the field', () => {
  const negative = calculate({ cash: '-1', burn: '5' });
  assert.match(negative.issues[0]?.message ?? '', /^Cash on hand: enter zero or more/);
  const huge = calculate({ cash: '1,000,000,000,001', burn: '5' });
  assert.match(huge.issues[0]?.message ?? '', /below one trillion/);
});

test('no combination of entries writes NaN, Infinity or undefined, and a ready result is always finite', () => {
  const samples = ['', '0', '0.5', '1', '7', '1,000', '999,999,999,999', '1000000000000', '-3', 'x', '100', '101'];
  for (const cash of samples) {
    for (const burn of samples) {
      for (const growth of samples) {
        const outcome = calculate({ cash, burn, growth });
        const text = [...outcome.issues.map((i) => i.message), ...outcome.results.flatMap((r) => [r.display, r.detail])].join(' | ');
        assert.doesNotMatch(text, /NaN|Infinity|undefined|null/, `${cash} / ${burn} / ${growth}: ${text}`);
        for (const r of outcome.results) {
          if (r.status === 'ready') assert.ok(r.months !== null && Number.isFinite(r.months), `${cash} / ${burn} / ${growth}`);
          else assert.equal(r.months, null);
        }
      }
    }
  }
});

test('the served page and the first render say the same thing', () => {
  for (const id of RESULT_IDS) {
    const waiting = waitingText(id);
    assert.equal(waiting.display, 'Waiting');
    assert.match(waiting.detail, /^Enter .* to see this\.$/);
  }
});
