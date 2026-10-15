/**
 * The seven founder situations of SITE-COPY 1.6 and 6.1 to 6.7, as the founders hub draws them: one world per situation. Situations,
 * not identities: every label names what a founder is doing, never who they are. `path` is the situation page once it is live; the
 * hub links a world only when its page is live, so no label points at a route that does not exist yet.
 */
export interface Situation {
  readonly id: string;
  readonly label: string;
  readonly line: string;
  readonly path: string;
}

export const SITUATIONS: readonly Situation[] = [
  { id: 'industry-insiders', label: 'Leaving an industry to build in it', line: 'Your industry years are the head start.', path: '/founders/industry-insiders/' },
  { id: 'encore-founders', label: 'Starting later in a career', line: 'Experience is the head start.', path: '/founders/encore-founders/' },
  { id: 'repeat-builders', label: 'Building a second company', line: 'Start the second one at full speed.', path: '/founders/repeat-builders/' },
  { id: 'global-founders', label: 'Building a U.S. company', line: 'Build here, with a team that knows the ground.', path: '/founders/global-founders/' },
  { id: 'under-backed-builders', label: 'Capable, but under-backed', line: 'Capacity now. Credibility over time.', path: '/founders/under-backed-builders/' },
  { id: 'next-gen-founders', label: 'Early in a career', line: 'Borrow the experience. Keep the company.', path: '/founders/next-gen-founders/' },
  { id: 'restart-founders', label: 'Starting after a change', line: 'A restart can be a real start.', path: '/founders/restart-founders/' },
];
