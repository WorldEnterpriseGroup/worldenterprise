/**
 * The ten components of the Universal Business Framework (BRIEF 2, from the organization's framework notes), paraphrased in one line
 * each for the UBF planetarium. Paraphrases only: no efficacy claims, no source marketing lines (D-16, C-19), no company named.
 */
export interface UbfComponent {
  readonly label: string;
  readonly description: string;
}

export const UBF_COMPONENTS: readonly UbfComponent[] = [
  { label: 'Galaxy', description: 'An entire industry' },
  { label: 'Black Hole', description: 'A dominant corporation at the center of an industry' },
  { label: 'Super Nova', description: 'An event that reshapes an industry: a merger, a new rule, a breakthrough' },
  { label: 'Solar System', description: 'A holding company and the companies around it' },
  { label: 'Sun', description: 'The headquarters, or the largest public company in a system' },
  { label: 'Super Star', description: 'A flagship company that could become a sun' },
  { label: 'Star', description: 'A small company or project with S.M.A.R.T. goals' },
  { label: 'Moon', description: 'A side project, subsidiary or department in orbit' },
  { label: 'Comet', description: 'An unstable project that needs better planning' },
  { label: 'Asteroid', description: 'An unstable project to steer around' },
];
