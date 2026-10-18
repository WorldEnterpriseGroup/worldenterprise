import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyHandoffHref,
  clampSeats,
  describeTeam,
  MAX_SEATS_PER_ROLE,
  normaliseSelection,
  parseTeam,
  parseTeamFromLocation,
  ROLES,
  seatsTimesRate,
  serializeTeam,
  summariseTeam,
  teamAsText,
  totalSeats,
} from '../../../src/scripts/team-composer.ts';

test('the role list matches the plan and ids are unique', () => {
  assert.equal(ROLES.length, 9);
  assert.equal(new Set(ROLES.map((r) => r.id)).size, 9);
});

test('clampSeats coerces anything to a whole number in range', () => {
  assert.equal(clampSeats('3'), 3);
  assert.equal(clampSeats(2.9), 2);
  assert.equal(clampSeats(-4), 0);
  assert.equal(clampSeats('abc'), 0);
  assert.equal(clampSeats(''), 0);
  assert.equal(clampSeats(null), 0);
  assert.equal(clampSeats(10_000), MAX_SEATS_PER_ROLE);
  assert.equal(clampSeats(Number.NaN), 0);
});

test('normaliseSelection drops unknown roles and zero counts', () => {
  assert.deepEqual(normaliseSelection({ qa: '2', 'back-end': 0, unknown: 5, brand: 'x' }), { qa: 2 });
});

test('serialise and parse round-trip in role order', () => {
  const selection = { qa: 1, 'product-design': 2 };
  const text = serializeTeam(selection);
  assert.equal(text, 'product-design:2,qa:1');
  assert.deepEqual(parseTeam(text), selection);
});

test('parseTeam tolerates junk', () => {
  assert.deepEqual(parseTeam(' qa : 2 ,bogus:3,front-end,back-end:x,brand:1'), { qa: 2, brand: 1 });
  assert.deepEqual(parseTeam(''), {});
});

test('location parsing prefers the fragment and falls back to the query string', () => {
  assert.deepEqual(parseTeamFromLocation('#team=qa:2', '?brand=1'), { qa: 2 });
  assert.deepEqual(parseTeamFromLocation('', '?brand=1&qa=3&bogus=4'), { qa: 3, brand: 1 });
  assert.deepEqual(parseTeamFromLocation('#other=1', ''), {});
  assert.deepEqual(parseTeamFromLocation('#team=bogus:1', '?qa=1'), { qa: 1 });
});

test('summary reports totals, lines and group seats', () => {
  const summary = summariseTeam({ 'front-end': 2, qa: 1, brand: 1 });
  assert.equal(summary.seats, 4);
  assert.equal(summary.roles, 3);
  assert.equal(summary.headline, '4 people across 3 roles.');
  assert.deepEqual(summary.groups.map((g) => [g.id, g.seats]), [['build', 3], ['company', 1], ['coordination', 0]]);
  assert.equal(summariseTeam({}).headline, 'No roles chosen yet.');
  assert.equal(summariseTeam({ qa: 1 }).headline, '1 person across 1 role.');
});

test('description and clipboard text are readable', () => {
  assert.equal(describeTeam({ 'back-end': 1, qa: 2 }), 'Back end (1); Quality assurance (2)');
  assert.match(teamAsText({ qa: 2 }), /Quality assurance: 2 people/);
  assert.equal(teamAsText({}), 'Team sketch: no roles chosen.');
});

test('hand-off link carries the team in the fragment and nothing when empty', () => {
  assert.equal(applyHandoffHref('/worldenterprise/apply/', { qa: 1 }), '/worldenterprise/apply/#team=qa:1');
  assert.equal(applyHandoffHref('/apply/', {}), '/apply/');
  assert.equal(totalSeats({ qa: 1, brand: 2 }), 3);
});

test('seat cost multiplies and rejects a bad rate', () => {
  assert.equal(seatsTimesRate(3, 10), 30);
  assert.throws(() => seatsTimesRate(1, -1), RangeError);
  assert.throws(() => seatsTimesRate(1, Number.NaN), RangeError);
});
