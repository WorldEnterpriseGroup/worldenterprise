import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLAIM_IDS, claimRegistry, claims, isClaimUsable } from '../../../src/data/claims.ts';
import { flags } from '../../../src/data/flags.ts';

test('the registry numbers its claims from C-01 without a gap, each with a source', () => {
  CLAIM_IDS.forEach((id, index) => assert.equal(id, `C-${String(index + 1).padStart(2, '0')}`));
  assert.ok(CLAIM_IDS.length >= 29, 'wave 8 added C-25 to C-29');
  for (const id of CLAIM_IDS) {
    assert.ok(claimRegistry[id].source.length > 0, id);
  }
});

test('excluded claims are never enabled or usable', () => {
  for (const id of CLAIM_IDS) {
    const claim = claimRegistry[id];
    if (claim.status === 'excluded') {
      assert.equal(claim.enabled, false, id);
      assert.equal(isClaimUsable(id), false, id);
    }
  }
});

test('softened claims default off, except the equity concept that wave 9 enabled with no numbers (W9-10)', () => {
  assert.equal(claims.safeConcept, true, 'C-07 equity concept is on (W9-10)');
  assert.equal(claimRegistry['C-08'].status, 'excluded', 'the mechanics behind C-07 stay excluded');
  assert.equal(claimRegistry['C-08'].enabled, false);
  assert.doesNotMatch(claimRegistry['C-07'].summary.replace(/C-\d{2}/g, ''), /\d/, 'the enabled equity concept carries no number');
  assert.equal(claims.years20, false);
  assert.equal(claims.securityPractices, false);
  assert.equal(flags.seatPrice.published, false);
  assert.equal(flags.seatPrice.monthlyRate, null);
});

test('the seat price currency is an ISO 4217 code and defaults to USD', () => {
  assert.match(flags.seatPrice.currency, /^[A-Z]{3}$/);
  assert.equal(flags.seatPrice.currency, 'USD');
});

test('the mandatory claims are usable', () => {
  for (const id of ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-18', 'C-19', 'C-21', 'C-25', 'C-26', 'C-27', 'C-28', 'C-29'] as const) {
    assert.equal(isClaimUsable(id), true, id);
  }
});
