import assert from 'node:assert/strict';
import test from 'node:test';
import { RESULT_IDS } from '../../../src/components/islands/we-cap-table/spec.ts';
import type { CapResultId } from '../../../src/components/islands/we-cap-table/spec.ts';
import { calculate, ownership, ownershipAfter, ownershipChange, totalAfter, waitingText } from '../../../src/scripts/cap-table.ts';
import type { CapResult, RawInputs } from '../../../src/scripts/cap-table.ts';

const result = (raw: RawInputs, id: CapResultId): CapResult => {
  const found = calculate(raw).results.find((r) => r.id === id);
  assert.ok(found, `result ${id}`);
  return found;
};

test('nothing typed shows four waiting results and no issue', () => {
  const outcome = calculate({});
  assert.deepEqual(outcome.issues, []);
  assert.deepEqual(outcome.results.map((r) => [r.id, r.status, r.display]), RESULT_IDS.map((id) => [id, 'waiting', 'Waiting']));
  assert.equal(result({}, 'before').detail, 'Enter Shares you hold, Other shares already issued to see this.');
  assert.equal(result({ yours: '10' }, 'after').detail, 'Enter Other shares already issued, New shares to issue to see this.');
});

test('ownership today needs only the two holdings, and is shares held over shares issued', () => {
  const before = result({ yours: '1,000', others: '3,000' }, 'before');
  assert.equal(before.status, 'ready');
  assert.equal(before.display, '25.00%');
  assert.equal(before.detail, '1,000 / 4,000 = 25.00%');
  assert.equal(result({ yours: '1000', others: '3000' }, 'after').display, 'Waiting');
});

test('issuing shares to someone else works out ownership after, the change and the total', () => {
  const raw = { yours: '1000', others: '3000', issue: '1000' };
  assert.equal(result(raw, 'after').display, '20.00%');
  assert.equal(result(raw, 'after').detail, '1,000 / 5,000 = 20.00%');
  assert.equal(result(raw, 'change').display, '-5.00 points');
  assert.equal(result(raw, 'change').detail, 'From 25.00% to 20.00%, worked from the unrounded figures.');
  assert.equal(result(raw, 'total').display, '5,000');
  assert.equal(result(raw, 'total').detail, '1,000 + 3,000 + 1,000 = 5,000');
});

test('issuing zero shares changes nothing, with no sign on the change', () => {
  const raw = { yours: '700', others: '300', issue: '0' };
  assert.equal(result(raw, 'after').display, '70.00%');
  assert.equal(result(raw, 'change').display, '0.00 points');
  assert.equal(result(raw, 'total').display, '1,000');
});

test('the change is worked from unrounded fractions, so it can differ from the difference of the two rounded percents', () => {
  // 1 / 3 = 33.33...% and 1 / 6 = 16.66...%: the points are -16.67, though 33.33 less 16.67 is 16.66.
  const raw = { yours: '1', others: '2', issue: '3' };
  assert.equal(result(raw, 'before').display, '33.33%');
  assert.equal(result(raw, 'after').display, '16.67%');
  assert.equal(result(raw, 'change').display, '-16.67 points');
});

test('holding no shares is zero percent, not a missing result', () => {
  const raw = { yours: '0', others: '500', issue: '100' };
  assert.equal(result(raw, 'before').display, '0.00%');
  assert.equal(result(raw, 'after').display, '0.00%');
  assert.equal(result(raw, 'change').display, '0.00 points');
});

test('an empty cap table is stated as not defined, never a division by zero', () => {
  const none = calculate({ yours: '0', others: '0', issue: '0' });
  for (const r of none.results.filter((x) => x.id !== 'total')) {
    assert.equal(r.status, 'undefined');
    assert.equal(r.display, 'Not defined');
  }
  assert.equal(result({ yours: '0', others: '0', issue: '0' }, 'total').display, '0');
  assert.match(result({ yours: '0', others: '0', issue: '0' }, 'before').detail, /^No shares are issued today/);
  // New shares into an empty table: ownership after is a number, and the change has nothing to compare with.
  const first = { yours: '0', others: '0', issue: '10' };
  assert.equal(result(first, 'before').status, 'undefined');
  assert.equal(result(first, 'after').display, '0.00%');
  assert.equal(result(first, 'change').status, 'undefined');
  assert.match(result(first, 'change').detail, /no ownership today to compare with/);
  assert.equal(ownership(0, 0).ok, false);
  assert.equal(ownershipAfter(0, 0, 0).ok, false);
  assert.equal(ownershipChange(0, 0, 5).ok, false);
});

test('the largest allowed entries stay finite and formatted', () => {
  const raw = { yours: '999,999,999,999', others: '999,999,999,999', issue: '999,999,999,999' };
  assert.equal(result(raw, 'before').display, '50.00%');
  assert.equal(result(raw, 'after').display, '33.33%');
  assert.equal(result(raw, 'total').display, '2,999,999,999,997');
  const tiny = { yours: '1', others: '999999999999', issue: '999999999999' };
  assert.equal(result(tiny, 'after').display, '0.00%');
});

test('a whole number is required, and a bad entry blocks only the results that need it', () => {
  const fraction = calculate({ yours: '1.5', others: '10', issue: '5' });
  assert.deepEqual(fraction.issues.map((i) => i.id), ['yours']);
  assert.match(fraction.issues[0]?.message ?? '', /^Shares you hold: enter a whole number/);
  assert.ok(fraction.results.every((r) => r.display === 'Needs a fix'));

  const issue = calculate({ yours: '10', others: '10', issue: 'abc' });
  assert.deepEqual(issue.issues.map((i) => i.id), ['issue']);
  assert.equal(issue.results.find((r) => r.id === 'before')?.display, '50.00%');
  assert.equal(issue.results.find((r) => r.id === 'after')?.display, 'Needs a fix');

  assert.match(calculate({ yours: '-1' }).issues[0]?.message ?? '', /enter zero or more/);
  assert.match(calculate({ yours: '1,000,000,000,001' }).issues[0]?.message ?? '', /below one trillion/);
  assert.equal(calculate({ yours: '1e3' }).issues.length, 1);
});

test('no combination of entries writes NaN, Infinity or undefined, and a ready result is always a number', () => {
  const samples = ['', '0', '1', '2', '3', '1,000', '999,999,999,999', '1000000000000', '-3', '1.5', 'x'];
  for (const yours of samples) {
    for (const others of samples) {
      for (const issue of samples) {
        const outcome = calculate({ yours, others, issue });
        const text = [...outcome.issues.map((i) => i.message), ...outcome.results.flatMap((r) => [r.display, r.detail])].join(' | ');
        assert.doesNotMatch(text, /NaN|Infinity|undefined|null/, `${yours} / ${others} / ${issue}: ${text}`);
        assert.equal(outcome.results.length, RESULT_IDS.length);
      }
    }
  }
});

test('the pure helpers agree with the results', () => {
  const total = totalAfter(2, 3, 5);
  assert.ok(total.ok);
  if (total.ok) assert.equal(total.value, 10);
  const own = ownership(2, 3);
  assert.ok(own.ok);
  if (own.ok) assert.equal(own.value, 0.4);
});

test('the served page and the first render say the same thing', () => {
  for (const id of RESULT_IDS) {
    const waiting = waitingText(id);
    assert.equal(waiting.display, 'Waiting');
    assert.match(waiting.detail, /^Enter .* to see this\.$/);
  }
});
