/**
 * The five phases of the engagement and how they map onto the site's three stages (SALES.md 5.1, SITE-COPY 2.2): Ignite is Dream,
 * Build and Launch are Build, Grow and Orbit are Grow. Windows are the typical windows the public data shows, never a promise: a plan
 * sets its own pace and a gate is reached by milestones, not by dates. No days, no fees, never numbered milestones (C-16, C-17).
 *
 * stages.ts keeps the stage pages' activities, working tools and exit evidence; this module adds the long-horizon layer on top.
 */
import type { StageId } from './stages.ts';
import type { StatId } from './clock.ts';

export type PhaseId = 'ignite' | 'build' | 'launch' | 'grow' | 'orbit';

/** A method from the WE frameworks with the words its letters stand for (BRIEF 1, SITE-COPY 2.4 to 2.6). */
export interface Method {
  readonly name: string;
  readonly expansion: readonly string[];
}

export const METHODS = {
  dream: { name: 'D.R.E.A.M. Playbook', expansion: ['Discover', 'Relate', 'Empower', 'Advise', 'Motivate'] },
  orbital: { name: 'O.R.B.I.T.A.L. Plan', expansion: ['Objective', 'Resources', 'Budget', 'Indicators', 'Transport', 'Activities', 'Logistics'] },
  startup: { name: 'S.T.A.R.T.U.P. Initiative', expansion: ['Structure', 'Think Tank', 'Analysis', 'Relations', 'UX/UI', 'Publications'] },
  android: { name: 'A.N.D.R.O.I.D. Ops', expansion: ['Advance', 'Network', 'Design', 'Research', 'Optimize', 'Implement', 'Deliver'] },
  launch: { name: 'L.A.U.N.C.H. Sequence', expansion: ['Logistics', 'Application', 'Users', 'Navigation', 'Channel', 'Hive'] },
  growth: { name: 'G.R.O.W.T.H. phase', expansion: ['Gauge', 'Research', 'Organize', 'Work', 'Target', 'Health'] },
  horizon: { name: 'Event Horizon', expansion: [] },
} as const satisfies Record<string, Method>;

export interface Phase {
  readonly id: PhaseId;
  readonly name: string;
  /** The site stage the phase belongs to. */
  readonly stage: StageId;
  /** Typical window from public data, written out ("Months 0 to 6"). */
  readonly window: string;
  /** Start and end of the window in years, for drawing it on the clock. `end` is undefined for an open window. */
  readonly from: number;
  readonly to: number | undefined;
  readonly work: string;
  readonly methods: readonly Method[];
  readonly checkpoint: string;
  /** The UBF image of the phase (BRIEF 2.1, 2.2). */
  readonly image: string;
}

export const PHASES: readonly Phase[] = [
  {
    id: 'ignite',
    name: 'Ignite',
    stage: 'dream',
    window: 'Months 0 to 6',
    from: 0,
    to: 0.5,
    work: 'First proof and the written plan',
    methods: [METHODS.dream, METHODS.orbital],
    checkpoint: 'Six-month review',
    image: 'A Star ignites',
  },
  {
    id: 'build',
    name: 'Build',
    stage: 'build',
    window: 'Months 6 to 18',
    from: 0.5,
    to: 1.5,
    work: 'The first release and the first customers, through the steepest year',
    methods: [METHODS.startup, METHODS.android],
    checkpoint: 'Year-one Orbit Review',
    image: 'A Star on its Track',
  },
  {
    id: 'launch',
    name: 'Launch',
    stage: 'build',
    window: 'Months 18 to 36',
    from: 1.5,
    to: 3,
    work: 'Repeatable sales and product-market fit',
    methods: [METHODS.launch],
    checkpoint: 'Year-three Orbit Review',
    image: 'Lift-off: the Star becomes a Super Star',
  },
  {
    id: 'grow',
    name: 'Grow',
    stage: 'grow',
    window: 'Years 3 to 5',
    from: 3,
    to: 5,
    work: 'Becoming an established company',
    methods: [METHODS.growth],
    checkpoint: 'Year-five Orbit Review',
    image: 'The Super Star gathers moons',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    stage: 'grow',
    window: 'Year 5 onward',
    from: 5,
    to: undefined,
    work: 'Running steady and planning what comes next',
    methods: [METHODS.horizon],
    checkpoint: 'WE steps down by notice',
    image: 'A settled solar system',
  },
];

export function phasesOf(stage: StageId): readonly Phase[] {
  return PHASES.filter((p) => p.stage === stage);
}

/** "D.R.E.A.M. Playbook (Discover, Relate, Empower, Advise, Motivate)". */
export function methodWithExpansion(method: Method): string {
  return method.expansion.length === 0 ? method.name : `${method.name} (${method.expansion.join(', ')})`;
}

/** What a stage page says on top of the stage data: the long-horizon headline, its window, the figures and what the company keeps. */
export interface StageView {
  readonly id: StageId;
  /** The page heading (SITE-COPY 2.4 to 2.6). */
  readonly headline: string;
  /** Document title when the heading is longer than the 31-character page-title budget. */
  readonly seoTitle?: string;
  readonly subhead: string;
  /** Body paragraphs. */
  readonly body: readonly string[];
  readonly stats: readonly StatId[];
  /** The deliverables the company keeps at the end of the stage (BRIEF 3.2, genericized). */
  readonly keeps: readonly { readonly title: string; readonly note: string; readonly icon: KeepIcon }[];
  /** The UBF picture of the stage. */
  readonly picture: string;
}

export type KeepIcon = 'checklist' | 'document' | 'globe' | 'gate' | 'data' | 'report' | 'calendar' | 'handover' | 'steering';

export const STAGE_VIEWS: Readonly<Record<StageId, StageView>> = {
  dream: {
    id: 'dream',
    headline: 'Dream: find the first proof',
    subhead:
      'Months 0 to 6, typically. Most new business applications never become employer businesses, and those that do take more than two quarters to reach first payroll.',
    body: [
      'In Dream, the team works through the D.R.E.A.M. Playbook and writes the O.R.B.I.T.A.L. Plan. You leave the stage with a readiness scorecard and plan, the ownership records in order and a brand that says what the company does.',
    ],
    stats: ['ST-07', 'ST-08'],
    keeps: [
      { title: 'Readiness scorecard and plan', note: 'Where each area of the company starts, and the written plan for the next phase.', icon: 'checklist' },
      { title: 'Ownership records', note: 'The company records in order and in one place.', icon: 'document' },
      { title: 'Brand', note: 'A name, a look and words that say what the company does.', icon: 'globe' },
    ],
    picture: 'A Star ignites',
  },
  build: {
    id: 'build',
    headline: 'Build: through the steepest year',
    seoTitle: 'Build: the steepest year',
    subhead: 'Months 6 to 36, typically. About 1 in 5 new businesses close in their first year.',
    body: [
      'Build covers two phases. Build is the first release, the first customers and the first hires, run on the S.T.A.R.T.U.P. Initiative and A.N.D.R.O.I.D. Ops. Launch makes sales repeatable and finds product-market fit, run on the L.A.U.N.C.H. Sequence.',
      'You keep a security baseline and a first release, a customer evidence index and a financial model.',
    ],
    stats: ['ST-01', 'ST-40'],
    keeps: [
      { title: 'Security baseline and first release', note: 'A first release real customers use, built on a written security baseline.', icon: 'gate' },
      { title: 'Customer evidence index', note: 'Every customer conversation and result, indexed so anyone can check it.', icon: 'data' },
      { title: 'Financial model', note: 'The numbers the plan rests on, with their sources.', icon: 'report' },
    ],
    picture: 'Lift-off: a Star on its Track becomes a Super Star',
  },
  grow: {
    id: 'grow',
    headline: 'Grow: becoming established',
    subhead: 'Year three onward. A business is not counted as established until it has paid wages for 42 months.',
    body: [
      'Grow runs on the G.R.O.W.T.H. phase and then the Event Horizon: what comes after, whether that is steady running, new lines, a succession or a sale. The team steps down by notice as the company’s own hires take over.',
      'You keep an operating rhythm and organized records and materials.',
    ],
    stats: ['ST-05', 'ST-04'],
    keeps: [
      { title: 'Operating rhythm', note: 'The weekly, monthly and quarterly reviews, run by the company’s own people.', icon: 'calendar' },
      { title: 'Organized records and materials', note: 'Records, metrics and materials kept so a new hire, a partner or a buyer can follow them.', icon: 'handover' },
    ],
    picture: 'A Super Star gathers moons, then settles into a solar system',
  },
};

/** Mission Control (SITE-COPY 2.3): the review rings, inner to outer. */
export const MISSION_CONTROL: readonly { readonly ring: string; readonly what: string }[] = [
  { ring: 'Every week', what: 'A written status, and you say yes or no to the next cycle’s plan.' },
  { ring: 'Every month', what: 'A service report and a review.' },
  { ring: 'Every quarter', what: 'A business review against the plan.' },
  { ring: 'Every year', what: 'An Orbit Review, timed to the points on the clock where most businesses close.' },
];
