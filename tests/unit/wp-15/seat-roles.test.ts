import assert from 'node:assert/strict';
import test from 'node:test';
import { SEAT_ROLES as NETWORK_ROLES } from '../../../src/components/network/roles.ts';
import { SEAT_ROLES as PROGRAM_ROLES } from '../../../src/components/program/roles.ts';
import { SEAT_ROLE_GROUPS, SEAT_ROLE_IDENTITIES, seatRoleLabel } from '../../../src/data/seat-roles.ts';
import type { SeatRoleId } from '../../../src/data/seat-roles.ts';
import { ROLES, ROLE_GROUPS } from '../../../src/scripts/team-composer.ts';

const ids = SEAT_ROLE_IDENTITIES.map((r) => r.id);

test('the shared list has nine unique roles in the groups the Team Composer shows', () => {
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
  const groups: readonly string[] = SEAT_ROLE_GROUPS.map((g) => g.id);
  for (const role of SEAT_ROLE_IDENTITIES) assert.ok(groups.includes(role.group), `${role.id} group`);
});

test('the Team Composer offers exactly the shared roles, in order, under the shared groups', () => {
  assert.deepEqual(ROLES.map((r) => ({ id: r.id, label: r.label, group: r.group })), SEAT_ROLE_IDENTITIES.map((r) => ({ ...r })));
  assert.deepEqual(ROLE_GROUPS, SEAT_ROLE_GROUPS);
  for (const role of ROLES) assert.ok(role.summary.length >= 20, `${role.id} has a summary`);
});

test('the operator network page lists the shared roles under the shared labels', () => {
  assert.deepEqual(NETWORK_ROLES.map((r) => [r.id, r.title]), SEAT_ROLE_IDENTITIES.map((r) => [r.id, r.label]));
});

test('the dedicated-teams page lists every shared role once, under the shared label', () => {
  assert.deepEqual([...PROGRAM_ROLES.map((r) => r.role)].sort(), SEAT_ROLE_IDENTITIES.map((r) => r.label).sort());
  for (const role of PROGRAM_ROLES) assert.ok(role.does.length >= 20, `${role.role} has a description`);
});

test('seatRoleLabel names a role and throws for an unknown id', () => {
  assert.equal(seatRoleLabel('qa'), 'Quality assurance');
  assert.throws(() => seatRoleLabel('chief-of-everything' as SeatRoleId), /Unknown seat role id/);
});
