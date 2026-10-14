/**
 * The generic journey (BRIEF 3.2): WE's template roadmap regrouped into Dream, Build and Grow, with the deliverable the company keeps
 * at each milestone. No numbers, no days, no fees, never "M0 to M8" or a count of milestones, no certification, no funding promise.
 * Pure data, unit-tested.
 */
export type JourneyStage = 'dream' | 'build' | 'grow';
export type JourneyLine = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface JourneyMilestone {
  readonly stage: JourneyStage;
  readonly title: string;
  /** What the company keeps when the milestone closes. */
  readonly keeps: string;
  /** Service line that does most of the work, when one does. */
  readonly line?: JourneyLine | undefined;
}

export interface JourneyPhase {
  readonly id: JourneyStage;
  readonly name: string;
  readonly altitude: 'Survey' | 'Blueprint' | 'Territory';
  readonly path: string;
}

export const JOURNEY_PHASES: readonly JourneyPhase[] = [
  { id: 'dream', name: 'Dream', altitude: 'Survey', path: '/program/dream/' },
  { id: 'build', name: 'Build', altitude: 'Blueprint', path: '/program/build/' },
  { id: 'grow', name: 'Grow', altitude: 'Territory', path: '/program/grow/' },
];

export const JOURNEY_MILESTONES: readonly JourneyMilestone[] = [
  { stage: 'dream', title: 'Diagnostic and roadmap', keeps: 'A baseline readiness scorecard and an agreed plan' },
  { stage: 'dream', title: 'Corporate and ownership records in order', keeps: 'A reconciled ownership ledger and instrument register' },
  { stage: 'dream', title: 'Brand and positioning', keeps: 'Messaging, identity and web presence', line: 'A' },
  { stage: 'build', title: 'Platform baseline and security posture', keeps: 'A security baseline and a first release', line: 'B' },
  { stage: 'build', title: 'Customer evidence', keeps: 'An evidence index traced to sources', line: 'C' },
  { stage: 'build', title: 'Financial model', keeps: 'Scenarios and assumptions', line: 'D' },
  { stage: 'grow', title: 'Operating rhythm', keeps: 'Metrics, reviews and a working cadence' },
  { stage: 'grow', title: 'Records and materials complete', keeps: 'An organized data room and presentation materials', line: 'F' },
];

/** Milestones of one phase, in order. */
export const milestonesOf = (stage: JourneyStage, items: readonly JourneyMilestone[] = JOURNEY_MILESTONES): readonly JourneyMilestone[] =>
  items.filter((m) => m.stage === stage);

/** The six areas of the readiness scorecard (kit figure fig-readiness-scorecard, genericized: no weights, no thresholds). */
export const READINESS_AREAS = ['Entity and ownership records', 'IP and compliance', 'Product and technology', 'Market and traction', 'Financials', 'Team and governance'] as const;
