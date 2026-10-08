/**
 * The roles a dedicated-team seat can fill (SAGE-PLAN 6.8): one list of ids, labels and groups for the whole site. The Team Composer,
 * the pricing table, the dedicated-teams page and the operator network page each add their own copy to these rows and nothing else,
 * so a role cannot be renamed, added or dropped in one place and not in the others. Roles are functions, never individuals.
 *
 * The id is part of the Apply hand-off (`#team=product-design:2,qa:1`) and of the Team Composer's no-JavaScript query string, so an
 * id changes only together with docs/forms-contract.md.
 */

export const SEAT_ROLE_GROUPS = [
  { id: 'build', label: 'Build the product' },
  { id: 'company', label: 'Build the company' },
  { id: 'coordination', label: 'Coordinate the work' },
] as const;
export type SeatRoleGroupId = (typeof SEAT_ROLE_GROUPS)[number]['id'];

export interface SeatRoleIdentity {
  readonly id: string;
  readonly label: string;
  readonly group: SeatRoleGroupId;
}

export const SEAT_ROLE_IDENTITIES = [
  { id: 'product-design', label: 'Product design', group: 'build' },
  { id: 'front-end', label: 'Front end', group: 'build' },
  { id: 'back-end', label: 'Back end', group: 'build' },
  { id: 'qa', label: 'Quality assurance', group: 'build' },
  { id: 'devops-security', label: 'DevOps and security', group: 'build' },
  { id: 'brand', label: 'Brand', group: 'company' },
  { id: 'growth-support', label: 'Growth and support', group: 'company' },
  { id: 'operations', label: 'Operations', group: 'coordination' },
  { id: 'delivery-lead', label: 'Delivery lead', group: 'coordination' },
] as const satisfies readonly SeatRoleIdentity[];

export type SeatRoleId = (typeof SEAT_ROLE_IDENTITIES)[number]['id'];

const BY_ID: ReadonlyMap<string, SeatRoleIdentity> = new Map(SEAT_ROLE_IDENTITIES.map((r) => [r.id, r]));

/** The label of a role. Throws for an id that is not in the list, so a typo in a page's copy table fails the build. */
export function seatRoleLabel(id: SeatRoleId): string {
  const role = BY_ID.get(id);
  if (role === undefined) throw new Error(`Unknown seat role id "${id}".`);
  return role.label;
}
