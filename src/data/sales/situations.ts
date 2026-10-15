import type { SalesSourceId } from './sources.ts';
import type { StatId } from './stats.ts';
import type { Bar, Series } from './timeline.ts';
import {
  AGE_55_64_SHARE,
  APPROVAL_BY_FIRM_AGE,
  FORMATION_FUNNEL,
  INDUSTRY_EXPERIENCE,
  PRIOR_SUCCESS,
  NECESSITY_SHARE,
  START_RATE_BY_NATIVITY,
} from './timeline.ts';

/**
 * The seven situation pages of /who-we-work-with/ (SITE-COPY.md section 6, SALES.md sections 4 and 6.3). Situations, never identities:
 * every page is for anyone in that situation, and no protected group is named in a headline, H1, image or meta title. Equity answers ship
 * as their non-equity fallback until counsel clears C-07.
 */

export type SituationId = 'industry-insider' | 'encore' | 'repeat-builder' | 'global' | 'under-backed' | 'next-gen' | 'restart';

/** The world drawn for a situation (WorldMark variants). */
export type WorldVariant = 'spinout' | 'horizon' | 'twin' | 'arrival' | 'superstar' | 'ignition' | 'comet';

export interface SituationCta {
  readonly label: string;
  /** A site path; `/apply/?situation=<id>` for the readiness review. */
  readonly href: string;
}

export interface Objection {
  readonly question: string;
  readonly answer: string;
}

export interface SituationChart {
  readonly title: string;
  readonly description: string;
  /** Bars, or (when empty) the `line` series. */
  readonly bars: readonly Bar[];
  readonly line?: Series;
  /** Points on the line to label, by x value. */
  readonly marks?: readonly number[];
  /** The unit printed on the axis. */
  readonly unit: string;
  readonly sources: readonly SalesSourceId[];
  readonly caveat?: string;
}

export interface Situation {
  readonly id: SituationId;
  readonly slug: string;
  /** The segment name used in cards and the hub (situation-based). */
  readonly name: string;
  readonly headline: string;
  /** Meta title: short, names the situation, never a group. */
  readonly seoTitle: string;
  readonly description: string;
  readonly subhead: string;
  /** The one-line card text on the hub. */
  readonly card: string;
  /** Who this page is for, as a situation. */
  readonly situation: string;
  readonly hook: string;
  readonly obstacles: readonly string[];
  readonly bullets: readonly string[];
  readonly world: WorldVariant;
  readonly worldAlt: string;
  readonly stats: readonly StatId[];
  readonly chart: SituationChart;
  readonly objections: readonly Objection[];
  /** A boundary WE states on the page. */
  readonly note?: string;
  readonly primary: SituationCta;
  /** Secondary actions in order of preference; the page shows the first one whose route is live. */
  readonly secondary: readonly SituationCta[];
}

export const FIT_TEXT =
  'The core of the business can be built on a screen: software, a digital product, or a service run on software and expertise. You can fund a team from revenue, savings, outside capital or a corporate budget.';

export const NOT_FIT_TEXT =
  'WE is not the right help if the core work of the business is physical (food service, retail floors, manufacturing, clinical care), if you want capital above all, or if you need one deliverable. If so, WE will say so and point you to better help.';

export const EQUITY_FALLBACK = 'WE is paid for work already done. The agreement sets every term before you sign.';

const apply = (id: SituationId): string => `/apply/?situation=${id}`;

const HOW_WE_WORK: SituationCta = { label: 'See how WE works', href: '/how-we-work/' };
const HOW_IT_WORKS_FALLBACK: SituationCta = { label: 'See how WE works', href: '/program/how-it-works/' };
const HOW_LONG: SituationCta = { label: 'See how long it really takes', href: '/why-it-takes-time/' };
const TIMELINE_BRIEF: SituationCta = { label: 'Get the timeline brief', href: '/briefs/real-timeline/' };
const TALK: SituationCta = { label: 'Talk to WE', href: '/contact/' };

export const SITUATIONS: readonly Situation[] = [
  {
    id: 'industry-insider',
    slug: 'industry-insiders',
    name: 'Industry Insider',
    headline: 'Your industry years are the head start.',
    seoTitle: 'Industry insiders',
    description: 'For anyone leaving an industry to build a company in it: a dedicated team, steered by WE, paced to the years a company really takes.',
    subhead: 'Founders with three or more years in their industry are more than twice as likely to build a top-growth company. WE adds the company-building team you have not had yet.',
    card: 'You know the industry. WE brings the company-building years.',
    situation: 'For anyone with three or more years in one industry who is leaving, or about to leave, an employer to build a company in that same industry. Often a spinout.',
    hook: 'You already have the hardest thing to get: the industry years. WE brings the company-building years.',
    obstacles: [
      'Deep knowledge of the field, and little practice at hiring a first team, setting up finance, running go-to-market or governance.',
      'A reputation built over years that a shaky launch would spend.',
      'Savings on the line while the company finds its feet.',
    ],
    bullets: [
      'A dedicated team, steered by WE, from first customer to operating company.',
      'A plan paced to the real business clock, with reviews at years one, three and five.',
      'You stay the expert and keep every decision. WE answers for how the team runs.',
    ],
    world: 'spinout',
    worldAlt: 'A moon breaks away from its planet along a dotted path, into an orbit of its own.',
    stats: ['ST-18', 'ST-16'],
    chart: {
      title: 'Industry years and top growth',
      description: 'Share of founders who build a top 1 in 1,000 growth firm: 0.26% with three or more years in the same industry, 0.11% with no experience in it.',
      bars: INDUSTRY_EXPERIENCE,
      unit: 'percent of founders',
      sources: ['azoulay-2018'],
    },
    objections: [
      { question: 'I know my industry better than any consultant.', answer: 'Agreed. WE does not replace your expertise. WE supplies the company-building you have not done yet: the first team, the finance, the go-to-market and the records.' },
      { question: 'I can hire a fractional operations lead.', answer: 'You can, for one function and part of the week. WE brings a whole team and one steering hand, and it is built to stay through years three to five.' },
      { question: 'How is WE paid?', answer: EQUITY_FALLBACK },
    ],
    primary: { label: 'Start my spinout review', href: apply('industry-insider') },
    secondary: [HOW_WE_WORK, HOW_IT_WORKS_FALLBACK],
  },
  {
    id: 'encore',
    slug: 'encore-founders',
    name: 'Encore Founder',
    headline: 'Experience is the head start.',
    seoTitle: 'Building later in a career',
    description: 'For anyone starting a company later in a career: a dedicated team and a paced plan, with an end in view from day one.',
    subhead: 'In the data, founders later in a career are more likely to build a top-growth company, not less. WE brings the team and the pace, so you can build without doing everything yourself.',
    card: 'Later in a career, with the years that the data favors.',
    situation: 'For anyone starting a company late in a career or after one: leaving an executive role, military or public service, or building a business to hand on.',
    hook: 'The data says your best founding years may be now.',
    obstacles: [
      'Savings you have spent decades building feel exposed.',
      'Digital setup, hiring and marketing are work you do not want to do yourself.',
      'The worry of being too late to start.',
    ],
    bullets: [
      'A dedicated team for the digital, marketing and operations work.',
      'A paced plan with budgets and stop points written in.',
      'An end in view from day one: grow it, hand it on or sell it.',
    ],
    world: 'horizon',
    worldAlt: 'A world rising over the horizon, with the years ahead of it.',
    stats: ['ST-17', 'ST-16', 'ST-27'],
    chart: {
      title: 'Starting later is common',
      description: 'Share of new U.S. entrepreneurs aged 55 to 64: 14.8% in 1996 and 22.8% in 2021.',
      bars: AGE_55_64_SHARE,
      unit: 'percent of new entrepreneurs',
      sources: ['kauffman-2021'],
    },
    objections: [
      { question: 'Am I too late to start?', answer: 'The data says the opposite: a 50-year-old founder is 1.8 times as likely as a 30-year-old to build a top-growth company.' },
      { question: 'I cannot risk my retirement.', answer: 'The plan is paced, the team scales by notice, and every term is in writing before you sign. WE helps you set a budget and stop points in the plan.' },
      { question: 'I do not want to report to anyone.', answer: 'You do not. You set direction. WE reports to you.' },
    ],
    note: 'WE does not give financial advice. Bring your own planner into the conversation.',
    primary: { label: 'Plan the next chapter with WE', href: apply('encore') },
    secondary: [HOW_LONG],
  },
  {
    id: 'repeat-builder',
    slug: 'repeat-builders',
    name: 'Repeat Builder',
    headline: 'Start the second one at full speed.',
    seoTitle: 'Second-time builders',
    description: 'For anyone building a second or later company: a steered team and a written method from Day One, so you skip the rebuild.',
    subhead: 'Prior success predicts success, but experience alone barely does. WE brings a steered team and a written method on Day One, so you skip the rebuild.',
    card: 'Your second company should not start from zero.',
    situation: 'For anyone building a second or later company, whether the last one succeeded, was sold or closed.',
    hook: 'Your second company should not start from zero.',
    obstacles: [
      'Rebuilding a team and an operating system from scratch.',
      'Trusting the old playbook too much in a new market.',
      'No one at your level to push back.',
    ],
    bullets: [
      'Begin at the phase your company is in, not at the start.',
      'Outside governance at every monthly and quarterly review.',
      'Scale the team up or down by notice as the work changes.',
    ],
    world: 'twin',
    worldAlt: 'Two worlds sharing one orbit: a second company built in the same system as the first.',
    stats: ['ST-19'],
    chart: {
      title: 'What carries over to the next company',
      description: 'Share of venture-backed founders whose next company went public: 30% after a prior success, 22% after a prior failure, 21% for first-time founders.',
      bars: PRIOR_SUCCESS,
      unit: 'percent succeeding',
      sources: ['gompers-2006'],
      caveat: 'Venture-backed founders only; success means the company went public.',
    },
    objections: [
      { question: 'I have done this before.', answer: 'Yes, and that is why you know what the first year costs. WE removes the rebuild so you can start at the phase you are in.' },
      { question: 'I already have my network.', answer: 'Good. Keep it. WE is not a network. WE is a team and a method.' },
      { question: 'How is WE paid?', answer: EQUITY_FALLBACK },
    ],
    primary: { label: 'Book a build review', href: apply('repeat-builder') },
    secondary: [TALK],
  },
  {
    id: 'global',
    slug: 'global-founders',
    name: 'Global Founder',
    headline: 'Build here, with a team that knows the ground.',
    seoTitle: 'Building a U.S. company from abroad',
    description: 'For anyone building a U.S. company while new to U.S. markets, credit or rules: a steered team and records built to U.S. expectations.',
    subhead: 'A new market is a situation, not a limit. WE steers the team and the records that a U.S. company runs on, alongside your own counsel.',
    card: 'You already build. WE helps you build here.',
    situation: 'For anyone building a U.S. business while new to U.S. markets, credit, rules or networks, including companies moving to the United States.',
    hook: 'You already build. WE helps you build here.',
    obstacles: [
      'A thin U.S. credit history.',
      'Unfamiliar banking, compliance and hiring systems.',
      'A small local referral network.',
    ],
    bullets: [
      'A dedicated team for U.S. go-to-market, operations and records.',
      'Coordination with your immigration and corporate lawyers.',
      'Continuity through the years it takes to build a U.S. track record.',
    ],
    world: 'arrival',
    worldAlt: 'A small craft arrives along a dotted trail at a large, settled world.',
    stats: ['ST-21'],
    chart: {
      title: 'Monthly start rate, 2025',
      description: 'Share of adults who started a business each month in 2025: 0.60% of immigrant adults and 0.30% of U.S.-born adults.',
      bars: START_RATE_BY_NATIVITY,
      unit: 'percent of adults each month',
      sources: ['kauffman-2025'],
    },
    objections: [
      { question: 'I need a lawyer, not a consultant.', answer: 'You need both. WE coordinates with your counsel and gives no legal or immigration advice.' },
      { question: 'How do the terms work with a partner abroad?', answer: 'Every term is in an agreement your own counsel reviews before you sign.' },
    ],
    note: 'WE does not give immigration or legal advice.',
    primary: { label: 'Start my U.S. build review', href: apply('global') },
    secondary: [TIMELINE_BRIEF],
  },
  {
    id: 'under-backed',
    slug: 'under-backed-builders',
    name: 'Under-Backed Builder',
    headline: 'Capacity now. Credibility over time.',
    seoTitle: 'Capable founders who need capacity',
    description: 'For capable founders with real demand who get less access to capital than the business deserves. WE makes no promise of funding.',
    subhead: 'Capable founders often get less access to capital than their businesses deserve. WE adds a steered team and builds the records and operating history that make a company easier to back. WE makes no promise of funding.',
    card: 'The gap is access, not ability.',
    situation: 'For any capable founder with real demand whose access to capital, networks and support lags what the business can do.',
    hook: 'The gap is access, not ability.',
    obstacles: [
      'Financing that arrives late, partly, or not at all, especially for young firms.',
      'Starting smaller, and staying smaller, for years.',
      'Doing everything yourself.',
    ],
    bullets: [
      'A dedicated team sized to what the company can sustain.',
      'Written records, reviews and financial readiness built month by month.',
      'Terms you see in full, and review with your own counsel, before you sign.',
    ],
    world: 'superstar',
    worldAlt: 'A bright star with a small world held in a wide orbit around it.',
    stats: ['ST-33'],
    chart: {
      title: 'Full approval for financing, by firm age in years',
      description: 'Share of applicant firms fully approved for loans, lines of credit or cash advances: 48% of firms aged 0 to 5, 51% aged 6 to 20, 63% aged 21 or more (ages in years).',
      bars: APPROVAL_BY_FIRM_AGE,
      unit: 'percent fully approved',
      sources: ['fed-sbcs-2026'],
      caveat: 'A survey of employer firms, weighted to the population; firms that closed are not surveyed.',
    },
    objections: [
      { question: 'Is this another program that takes a share of the company up front?', answer: EQUITY_FALLBACK },
      { question: 'I have been let down by consultants before.', answer: 'WE writes everything down: weekly status, monthly reports, quarterly reviews. You can read the state of the work at any time.' },
      { question: 'I cannot pay large cash fees.', answer: 'The readiness review sizes a team to what the company can sustain, which can mean starting small. If it cannot yet sustain a team, WE says so and points you to SBDC, CDFI and Women’s Business Center resources.' },
    ],
    primary: { label: 'Start a readiness review', href: apply('under-backed') },
    secondary: [{ label: 'See how WE is paid', href: '/how-we-work/' }, HOW_LONG],
  },
  {
    id: 'next-gen',
    slug: 'next-gen-founders',
    name: 'Next-Gen Founder',
    headline: 'Borrow the experience. Keep the company.',
    seoTitle: 'Early-career founders',
    description: 'For anyone early in a career with a company to build: a steered, experienced team and a plan built for years, not weeks.',
    subhead: 'Many people start a business early in a career. Few reach employer scale. WE adds a steered, experienced team and a plan built for years, not weeks.',
    card: 'Borrow the experience you do not have yet.',
    situation: 'For anyone early in a career, including students, with high intent and few industry years yet.',
    hook: 'Borrow the experience you do not have yet.',
    obstacles: [
      'Few industry years yet, and the data weighs them heavily.',
      'Thin savings.',
      'The pull of short programs built around a single quarter.',
    ],
    bullets: [
      'An experienced team around your idea, steered by WE.',
      'Start small and grow the team by notice.',
      'A plan that runs past year one, with reviews at years one, three and five.',
    ],
    world: 'ignition',
    worldAlt: 'A spark ignites at the center of a new system, inside two orbits.',
    stats: ['ST-28', 'ST-07'],
    chart: {
      title: 'From application to employer',
      description: 'Of 5,390,816 U.S. business applications filed in 2021, 315,318 (5.8%) became employers within one year and 403,072 (7.5%) within two.',
      bars: FORMATION_FUNNEL,
      unit: 'applications',
      sources: ['census-bfs'],
    },
    objections: [
      { question: 'Why not a three-month program?', answer: 'If you want capital and a short sprint with other founders, a three-month program is built for that. If you want a team that builds with you for years, that is what WE does. About half of businesses are gone by year five, so plan for the years.' },
      { question: 'I cannot afford fees.', answer: 'Start with the timeline brief and a readiness review. If the company cannot sustain a team yet, WE will say so.' },
    ],
    primary: TIMELINE_BRIEF,
    secondary: [{ label: 'Start a readiness review', href: apply('next-gen') }],
  },
  {
    id: 'restart',
    slug: 'restart-founders',
    name: 'Restart Founder',
    headline: 'A restart can be a real start.',
    seoTitle: 'Starting after a career change',
    description: 'For anyone starting a company after a layoff, a caregiving gap or a career change: an honest first look, then a staged plan.',
    subhead: 'Downturns create founders: in 2020, 30.2% of new U.S. entrepreneurs started out of necessity. WE helps you see the road before you commit to it.',
    card: 'Turn a restart into a company built to last.',
    situation: 'For anyone starting after a layoff, a caregiving gap or a career disruption who wants to turn it into a durable company.',
    hook: 'Turn a restart into a company built to last.',
    obstacles: [
      'Time and cash pressure, with income needed now.',
      'Sectors that are easy to enter and hard to last in.',
      'Not knowing yet whether to commit for years.',
    ],
    bullets: [
      'An honest first look: is this a business WE should build with you yet?',
      'A niche that uses the industry experience you already have.',
      'A staged plan, with an initial term and notice after it.',
    ],
    world: 'comet',
    worldAlt: 'A comet on an unstable path is re-planned into a stable orbit.',
    stats: ['ST-29'],
    chart: {
      title: 'Necessity share of new entrepreneurs',
      description: 'Share of new U.S. entrepreneurs who started out of necessity, 1996 to 2025: it peaked at 30.2% in 2020 and was 16.7% in 2025.',
      bars: [],
      line: NECESSITY_SHARE,
      marks: [2020, 2025],
      unit: 'percent of new entrepreneurs',
      sources: ['kauffman-2025'],
    },
    objections: [
      { question: 'I need income now, not partners.', answer: 'Understood. WE is a fit when the business can carry a team. Until then, start with a year-one plan and your local SBDC.' },
      { question: 'I cannot commit to years.', answer: 'You commit to an initial term. After that it runs by notice. The plan is written for years so you can see the road, not so you are locked in.' },
    ],
    primary: { label: 'Ask for a year-one planning session', href: apply('restart') },
    secondary: [TIMELINE_BRIEF],
  },
];

export const situationBySlug = (slug: string): Situation | undefined => SITUATIONS.find((s) => s.slug === slug);

export const situationPath = (s: Situation): string => `/who-we-work-with/${s.slug}/`;
