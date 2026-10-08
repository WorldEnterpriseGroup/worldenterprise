/** Seat roles as functions, not people (SAGE-PLAN 6.8 and 7.1). Used by the dedicated-teams page. Names come from src/data/seat-roles.ts. */
import { seatRoleLabel } from '../../data/seat-roles.ts';
import type { SeatRoleId } from '../../data/seat-roles.ts';

export interface SeatRole {
  readonly role: string;
  readonly does: string;
}

const DOES: Readonly<Record<SeatRoleId, string>> = {
  'delivery-lead': 'Keeps the cycle plan, the review and the list of open decisions current, and is the day-to-day contact for the founder.',
  'product-design': 'Turns the validated problem into flows, screens and a design system the team can build from.',
  'front-end': 'Builds the part of the product customers see and use.',
  'back-end': 'Builds the services, data and integrations behind the interface.',
  qa: 'Tests each release against what was agreed and records what was found.',
  'devops-security': 'Sets up environments and releases, and works through the security baseline checklist.',
  brand: 'Shapes the name, identity and messaging the product is presented with.',
  'growth-support': 'Helps run customer conversations, onboarding and the support loop.',
  operations: 'Sets up the operating cadence, goals and metrics definitions the company reports against.',
};

/** The order the dedicated-teams page reads in: the lead first, then the build roles, then the company roles. */
const ORDER: readonly SeatRoleId[] = ['delivery-lead', 'product-design', 'front-end', 'back-end', 'qa', 'devops-security', 'brand', 'growth-support', 'operations'];

export const SEAT_ROLES: readonly SeatRole[] = ORDER.map((id) => ({ role: seatRoleLabel(id), does: DOES[id] }));
