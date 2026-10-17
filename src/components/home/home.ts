/**
 * Data for the home page sections (SITE-COPY 1, BRIEF 2.1). Copy only: no figures (those live in ../program/clock.ts with their
 * sources), no prices, no seat counts, no client data.
 */
import type { TeamRole } from '../visuals/contracts.ts';
import type { IsLive } from '../program/ctas.ts';
import { routeOf } from '../program/ctas.ts';

/** The seven situations of SITE-COPY 1.6 and 6.1 to 6.7: situations, never identities. */
export interface Situation {
  readonly id: string;
  readonly label: string;
  readonly line: string;
  readonly icon: 'steering' | 'calendar' | 'handover' | 'globe' | 'team' | 'checklist' | 'gate';
}

export const SITUATIONS: readonly Situation[] = [
  { id: 'industry-insiders', label: 'Leaving an industry to build in it', line: 'Your industry years are the head start.', icon: 'steering' },
  { id: 'encore-founders', label: 'Starting later in a career', line: 'Experience is the head start.', icon: 'calendar' },
  { id: 'repeat-builders', label: 'Building a second company', line: 'Start the second one at full speed.', icon: 'handover' },
  { id: 'global-founders', label: 'Building a U.S. company', line: 'Build here, with a team that knows the ground.', icon: 'globe' },
  { id: 'under-backed-builders', label: 'Capable, but under-backed', line: 'Capacity now. Credibility over time.', icon: 'team' },
  { id: 'next-gen-founders', label: 'Early in a career', line: 'Borrow the experience. Keep the company.', icon: 'checklist' },
  { id: 'restart-founders', label: 'Starting after a change', line: 'A restart can be a real start.', icon: 'gate' },
];

/** Where a situation's own page lives once it is built: the new route family first, then the founders family. */
export function situationHref(situation: Situation, isLive: IsLive): string | undefined {
  return [`/who-we-work-with/${situation.id}/`, `/founders/${situation.id}/`].find((path) => isLive(routeOf(path)));
}

/**
 * The team WE steers, as roles (SITE-COPY 1.3): illustrative and unpriced. No seat count, no rate, no selector; the group ids are the
 * ones src/data/seat-roles.ts tints by.
 */
export const TEAM_ROLES: readonly TeamRole[] = [
  { role: 'Delivery lead', level: 'Steering, for WE', group: 'coordination' },
  { role: 'Product design', group: 'build' },
  { role: 'Engineering', group: 'build' },
  { role: 'Quality and security', group: 'build' },
  { role: 'Brand', group: 'company' },
  { role: 'Customers and growth', group: 'company' },
  { role: 'Operations', group: 'coordination' },
  { role: 'Records', group: 'coordination' },
];
