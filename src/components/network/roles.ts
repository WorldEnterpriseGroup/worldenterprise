/**
 * Roles a dedicated team can include. The ids and titles come from src/data/seat-roles.ts, the same list the Team Composer offers (SAGE-PLAN
 * 6.8); this module adds only what the operator network pages say about each role. Roles are functions, never individuals: no person is
 * named anywhere in this module or on the pages that use it.
 */

import { SEAT_ROLE_IDENTITIES } from '../../data/seat-roles.ts';
import type { SeatRoleId } from '../../data/seat-roles.ts';

export type SeatLine = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface SeatRole {
  readonly id: SeatRoleId;
  /** Label shown on the card. It is the Team Composer's label for the same role. */
  readonly title: string;
  /** Group shown as the card eyebrow. */
  readonly group: 'Product' | 'Engineering' | 'Quality and operations' | 'Brand and growth' | 'Delivery';
  readonly summary: string;
  /** One plain statement of what the role does not do. */
  readonly doesNot: string;
  /** Service lines the role mostly supports. */
  readonly lines: readonly SeatLine[];
}

type SeatRoleCopy = Omit<SeatRole, 'id' | 'title'>;

const COPY: Readonly<Record<SeatRoleId, SeatRoleCopy>> = {
  'product-design': {
    group: 'Product',
    summary: 'Turns what customers told you into flows, screens and a design system the build team can use.',
    doesNot: 'Does not decide what the product is for. That stays with the founder.',
    lines: ['B'],
  },
  'front-end': {
    group: 'Engineering',
    summary: 'Builds the parts of the product people see and use, in the browser and on small screens.',
    doesNot: 'Does not set product priorities or change scope without a written decision.',
    lines: ['B'],
  },
  'back-end': {
    group: 'Engineering',
    summary: 'Builds the services, data model and integrations behind the interface.',
    doesNot: 'Does not run your live product around the clock.',
    lines: ['B'],
  },
  qa: {
    group: 'Quality and operations',
    summary: 'Plans and runs tests, records defects and checks each release against what was agreed.',
    doesNot: 'Does not give any assurance that a product will pass an external audit.',
    lines: ['B'],
  },
  'devops-security': {
    group: 'Engineering',
    summary: 'Sets up the build, release and hosting routine and reviews the product for common security mistakes.',
    doesNot: 'Does not certify the product and does not stand in for a specialist you hire.',
    lines: ['B', 'G'],
  },
  brand: {
    group: 'Brand and growth',
    summary: 'Shapes the name, identity and the way the company describes its product.',
    doesNot: 'Does not give legal advice on names, marks or domains. Your counsel does that.',
    lines: ['A'],
  },
  'growth-support': {
    group: 'Brand and growth',
    summary: 'Runs customer discovery, pilots and a first support routine, and keeps the pipeline honest.',
    doesNot: 'Does not close deals for you and does not promise that conversations become customers.',
    lines: ['C'],
  },
  operations: {
    group: 'Quality and operations',
    summary: 'Keeps the weekly rhythm: goals, metrics, reviews and the written record of decisions.',
    doesNot: 'Does not keep your books, file your taxes or run the company for you.',
    lines: ['D', 'E'],
  },
  'delivery-lead': {
    group: 'Delivery',
    summary: 'Plans each cycle with you, keeps the team on that plan and reports results in writing.',
    doesNot: 'Does not promise a delivery date or a funding result.',
    lines: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  },
};

export const SEAT_ROLES: readonly SeatRole[] = SEAT_ROLE_IDENTITIES.map((role) => ({ id: role.id, title: role.label, ...COPY[role.id] }));

export function rolePath(): string {
  return '/network/operators/';
}
