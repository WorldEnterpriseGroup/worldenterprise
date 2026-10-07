/** Seat roles as functions, not people (SAGE-PLAN 6.8 and 7.1). Used by the dedicated-teams page. */
export interface SeatRole {
  readonly role: string;
  readonly does: string;
}

export const SEAT_ROLES: readonly SeatRole[] = [
  { role: 'Delivery lead', does: 'Keeps the cycle plan, the review and the list of open decisions current, and is the day-to-day contact for the founder.' },
  { role: 'Product design', does: 'Turns the validated problem into flows, screens and a design system the team can build from.' },
  { role: 'Front end engineering', does: 'Builds the part of the product customers see and use.' },
  { role: 'Back end engineering', does: 'Builds the services, data and integrations behind the interface.' },
  { role: 'Quality assurance', does: 'Tests each release against what was agreed and records what was found.' },
  { role: 'DevOps and security', does: 'Sets up environments and releases, and works through the security baseline checklist.' },
  { role: 'Brand', does: 'Shapes the name, identity and messaging the product is presented with.' },
  { role: 'Growth and support', does: 'Helps run customer conversations, onboarding and the support loop.' },
  { role: 'Operations', does: 'Sets up the operating cadence, goals and metrics definitions the company reports against.' },
] as const;
