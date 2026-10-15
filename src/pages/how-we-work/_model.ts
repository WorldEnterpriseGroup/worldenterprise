/**
 * The copy and data of /how-we-work/ (WP-54, wave 9 W9-13; SITE-COPY section 4, SALES section 3). Pure data, so tests/unit/wp-54 can
 * check every sentence against the claims rules without building the page.
 *
 * Rules this file keeps: no prices, rates or seat counts; no equity line (C-07 is gated, the fallback ships); no IP promise (CONFIRM);
 * third person ("WE steers"); figures only from the wave 9 statistics register, each with its source and the honesty line.
 */
import type { IconKey } from '../../components/visuals/icons.ts';
import type { Stat } from '../../components/visuals/contracts.ts';

export const PATH = '/how-we-work/';

export interface Cta {
  readonly label: string;
  readonly href: string;
}

/** SALES 6.2: on /how-we-work/ the primary is the readiness review and the secondary is Talk to WE. */
export const PRIMARY_CTA: Cta = { label: 'Start a readiness review', href: '/apply/' };
export const SECONDARY_CTA: Cta = { label: 'Talk to WE', href: '/contact/' };

export const HERO = {
  eyebrow: 'How WE works',
  lead: 'How a company brings WE on, how the work runs, how WE is paid and how it ends.',
} as const;

/** The in-page sections, in reading order. The orbit diagram in the opening split links to each one. */
export const SECTIONS = [
  { id: 'before', label: 'Before Day One', description: 'A conversation, a readiness review and the agreements' },
  { id: 'start', label: 'Start in any month', description: 'No intake calendar and no class to wait for' },
  { id: 'phases', label: 'Five phases', description: 'Paced to the years a company really takes' },
  { id: 'team', label: 'The team WE steers', description: 'Roles on your company, steered by WE' },
  { id: 'cadence', label: 'The rhythm', description: 'Weekly, monthly, quarterly and yearly' },
  { id: 'paid', label: 'How WE is paid', description: 'In cash, monthly, for work already done' },
  { id: 'ending', label: 'How it ends', description: 'Step down, not stop' },
] as const;

export interface Step {
  readonly title: string;
  readonly body: string;
  readonly icon: IconKey;
}

/** SALES 3.2: nothing is signed except an NDA until the agreements. */
export const BEFORE_STEPS: readonly Step[] = [
  {
    title: 'A conversation',
    body: 'A call about the company, your situation and the timeline you expect. If WE is not the right help, WE says so and suggests where to go.',
    icon: 'contact',
  },
  {
    title: 'A readiness review',
    body: 'A structured look at the company with the D.R.E.A.M. Playbook. You receive your company clock: a one-page read of where the company sits, the next checkpoint, what the next phase needs and a draft team shape.',
    icon: 'checklist',
  },
  {
    title: 'The agreements',
    body: 'An NDA, then draft agreements and an order form with every term written down. You review them with your own counsel before anything is signed.',
    icon: 'document',
  },
  {
    title: 'Day One',
    body: 'Accounts, access, introductions, a working agreement and a first deliverable. The team is in place, with a written plan for the first cycle.',
    icon: 'team',
  },
];

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export interface Phase {
  readonly id: 'ignite' | 'build' | 'launch' | 'grow' | 'orbit';
  readonly name: string;
  /** The site stage the phase sits in (Dream, Build, Grow). */
  readonly stage: 'Dream' | 'Build' | 'Grow';
  readonly stageHref: string;
  /** Typical window in months from Day One; `to` is null for the open-ended last phase. */
  readonly from: number;
  readonly to: number | null;
  readonly window: string;
  readonly work: string;
  readonly method: string;
  readonly checkpoint: string;
}

/** SALES 3.3 and SITE-COPY 2.2. Typical windows from public data, never promises: gates are reached by milestones, not dates. */
export const PHASES: readonly Phase[] = [
  {
    id: 'ignite',
    name: 'Ignite',
    stage: 'Dream',
    stageHref: '/program/dream/',
    from: 0,
    to: 6,
    window: 'Months 0 to 6',
    work: 'First proof and the written plan.',
    method: 'D.R.E.A.M. Playbook and O.R.B.I.T.A.L. Plan',
    checkpoint: 'Six-month review',
  },
  {
    id: 'build',
    name: 'Build',
    stage: 'Build',
    stageHref: '/program/build/',
    from: 6,
    to: 18,
    window: 'Months 6 to 18',
    work: 'The first release and the first customers, through the steepest year.',
    method: 'S.T.A.R.T.U.P. Initiative and A.N.D.R.O.I.D. Ops',
    checkpoint: 'Year-one Orbit Review',
  },
  {
    id: 'launch',
    name: 'Launch',
    stage: 'Build',
    stageHref: '/program/build/',
    from: 18,
    to: 36,
    window: 'Months 18 to 36',
    work: 'Repeatable sales and product-market fit.',
    method: 'L.A.U.N.C.H. Sequence',
    checkpoint: 'Year-three Orbit Review',
  },
  {
    id: 'grow',
    name: 'Grow',
    stage: 'Grow',
    stageHref: '/program/grow/',
    from: 36,
    to: 60,
    window: 'Years 3 to 5',
    work: 'Becoming an established company.',
    method: 'G.R.O.W.T.H. phase',
    checkpoint: 'Year-five Orbit Review',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    stage: 'Grow',
    stageHref: '/program/grow/',
    from: 60,
    to: null,
    window: 'Year 5 onward',
    work: 'Running steady, and planning what comes next.',
    method: 'Event Horizon',
    checkpoint: 'WE steps down by notice',
  },
];

/** The months the scale shows. The last phase is open-ended, so it runs to the edge with a fade. */
export const SCALE_MONTHS = 72;

/** Checkpoints on the scale, in months from Day One. */
export const CHECKPOINTS = [
  { at: 6, label: 'Six-month review' },
  { at: 12, label: 'Year-one Orbit Review' },
  { at: 36, label: 'Year-three Orbit Review' },
  { at: 60, label: 'Year-five Orbit Review' },
] as const;

/** Year ticks on the scale (months). */
export const YEAR_TICKS = [0, 12, 24, 36, 48, 60, 72] as const;

/** The site stages over the phases: Dream holds Ignite, Build holds Build and Launch, Grow holds Grow and Orbit. */
export const STAGES = [
  { name: 'Dream', href: '/program/dream/', from: 0, to: 6 },
  { name: 'Build', href: '/program/build/', from: 6, to: 36 },
  { name: 'Grow', href: '/program/grow/', from: 36, to: null },
] as const;

/**
 * Grid columns of the scale: one column per six months, so a phase's columns are its window to scale. `to: null` runs to the end.
 * Returns the CSS grid-column value as start and end lines (1-based).
 */
export function scaleColumns(from: number, to: number | null): { readonly start: number; readonly end: number } {
  const step = 6;
  if (from < 0 || from % step !== 0 || from >= SCALE_MONTHS) throw new Error(`scaleColumns: from ${from} is not a six-month step inside the scale`);
  if (to !== null && (to <= from || to % step !== 0 || to > SCALE_MONTHS)) throw new Error(`scaleColumns: to ${to} is not a six-month step after ${from}`);
  return { start: from / step + 1, end: (to ?? SCALE_MONTHS) / step + 1 };
}

/** The stage of a year tick: "Day One", "Year 1" ... (never "N years", which the claims audit reads as an experience claim). */
export function tickLabel(months: number): string {
  return months === 0 ? 'Day One' : `Year ${months / 12}`;
}

const BLS: Stat['source'] = { label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7', href: 'https://www.bls.gov/bdm/us_age_naics_00_table7.txt' };
const GEM: Stat['source'] = {
  label: 'Global Entrepreneurship Monitor, United States 2019/2020 Report, p. 26',
  href: 'https://www.babson.edu/media/babson/assets/global-entrepreneurship-monitor/GEM-2019-2020-US-Report.pdf',
};

/** The business clock behind the phase windows (statistics register ST-01, ST-40, ST-02, ST-05; recorded in .astro-magazine/sources/wp-54.json). */
export const CLOCK_STATS: readonly Stat[] = [
  { value: '77.9%', label: 'of new U.S. establishments were still operating after one year (group opened in the year to March 2024)', source: { ...BLS, period: '2024 to 2025' }, icon: 'gate' },
  { value: '56.3%', label: 'survive three years (2022 group)', source: { ...BLS, period: '2022 to 2025' }, icon: 'gate' },
  { value: '51.4%', label: 'survive five years (2020 group)', source: { ...BLS, period: '2020 to 2025' }, icon: 'gate' },
  { value: '42 months', label: 'of paying wages before GEM counts a business as established', source: GEM, icon: 'clock' },
];

/** SITE-COPY 1 rule 5: under every block of statistics. */
export const HONESTY_LINE = "These figures describe all new U.S. businesses, not WE's results.";

export interface TeamRoleItem {
  readonly role: string;
  readonly level?: string;
  readonly group: 'build' | 'company' | 'coordination';
}

/** The team WE steers, as roles (SALES 3.5). Illustrative: your team schedule sets the real roles. No prices, no seat counts. */
export const TEAM_ROLES: readonly TeamRoleItem[] = [
  { role: 'Delivery Lead', level: 'Named contact', group: 'coordination' },
  { role: 'Technical Lead', level: 'Named contact', group: 'build' },
  { role: 'Executive Sponsor', level: 'Named contact', group: 'coordination' },
  { role: 'Product design', group: 'build' },
  { role: 'Front end', group: 'build' },
  { role: 'Back end', group: 'build' },
  { role: 'Quality assurance', group: 'build' },
  { role: 'Brand', group: 'company' },
  { role: 'Growth and support', group: 'company' },
  { role: 'Operations', group: 'coordination' },
];

/** SITE-COPY 4.3. */
export const TEAM_POINTS: readonly string[] = [
  'The team works only on your company, role by role, as written in your team schedule.',
  'WE recruits the people, manages them and replaces them when needed, including subcontractors.',
  'WE gives direction, planning, coaching, quality oversight and reporting.',
  'You set where the company goes.',
  'Your named contacts at WE are a Delivery Lead, a Technical Lead and an Executive Sponsor.',
];

export interface Rhythm {
  readonly name: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  readonly body: string;
  readonly who: string;
  readonly icon: IconKey;
}

/** SITE-COPY 4.4 and SALES 3.4. No response times, SLA figures or business-day deadlines. */
export const CADENCE: readonly Rhythm[] = [
  { name: 'Weekly', body: 'A written status. You say yes or no to the next cycle’s plan.', who: 'Delivery Lead and founder', icon: 'report' },
  { name: 'Monthly', body: 'A service report and a monthly service review.', who: 'Delivery Lead', icon: 'data' },
  { name: 'Quarterly', body: 'A business review against the plan, and the team shape for the next quarter.', who: 'Executive Sponsor and founder', icon: 'checklist' },
  {
    name: 'Yearly',
    body: 'An Orbit Review on each Day One anniversary, timed to the year-one, year-three and year-five points: a phase gate, team reshaping and an updated company clock.',
    who: 'Executive Sponsor, Technical Lead, Delivery Lead and founder',
    icon: 'gate',
  },
];

/** SALES 3.6, the cash line. */
export const PAID_CASH =
  'WE is paid in cash, monthly, for the work of the team on your company. The fee covers the people and everything it takes to keep them working: pay, benefits, equipment, recruiting and replacement. The agreement sets every figure before you sign, and WE shares current terms during the readiness review rather than on a price list.';

/** SALES 3.6, the fallback that ships while C-07 is gated. */
export const PAID_FALLBACK =
  'WE is paid for work already done, never in advance of it. Every term, including how steering is valued, is in the agreement you review with your own counsel.';

/** Month blocks of the payment visual: the work of a month, then its payment marker. */
export const PAID_MONTHS = 6;

/** SALES 3.7 and SITE-COPY 4.6. The IP sentence is CONFIRM-gated and is not published. */
export const ENDING_BODY: readonly string[] = [
  'Your agreement has an initial term and then renews as your order form sets. After the initial term, either side can end it by notice. Roles can be added or removed by notice.',
  'When the company is ready, WE plans the end with you: a smaller team, lighter steering and a handover to your own hires.',
];

export const DEFAULT_TERM_LABEL = 'Default initial term: six months. Default; your agreement sets the real terms.';

/** The steps of the step-down drawing: the steering ring fades segment by segment. */
export const STEP_DOWN = [
  { label: 'Full team and steering' },
  { label: 'A smaller team' },
  { label: 'Lighter steering' },
  { label: 'Handover to your own hires' },
] as const;

/** SITE-COPY 4.7. */
export const IS_AND_IS_NOT: readonly (readonly [is: string, isNot: string])[] = [
  ['A services firm that steers a team inside your company', 'An investor, a lender or a fund'],
  ['Set up for years, with no fixed end date', 'A three-month program'],
  ['Building your company, around your idea', 'A venture studio that starts its own ideas'],
  ['Answerable for how the team works', 'A staffing provider that sends people for you to manage'],
  ['Coordinating with your lawyer and accountant', 'A law, tax or immigration adviser'],
];
