import { salesSource } from '../../../data/sales/sources.ts';
import type { SalesSourceId } from '../../../data/sales/sources.ts';
import { stat } from '../../../data/sales/stats.ts';
import type { StatId } from '../../../data/sales/stats.ts';
import type { Milestone, Stat, StatSource } from '../../visuals/contracts.ts';

/**
 * WP-37 (wave 10, issue #86): the longevity narrative shared by the home page, the program pages, /how-we-work/,
 * /why-it-takes-time/ and /who-we-work-with/. Pure data: no Astro imports, so `node --test` can check it.
 *
 * Every figure here is one of the register's ST-nn statistics already published by WP-58 (src/data/sales/stats.ts), cited from the
 * same source records. No new figure is introduced. The ecosystem wording avoids the words the site denylist keeps off these pages
 * (the ecosystem context, docs/wave10-contracts.md, is for /ecosystem/, /sbir-sttr/, /data/ and marked insights).
 */

export const SPINE_HEADLINE = 'Move fast every week. Build for the decade.';

/** The routes the new bands link to. A band renders only when its route is built (isLiveOnDisk), so no page links a dead route. */
export const ROUTES = {
  ecosystem: '/ecosystem/',
  sbir: '/sbir-sttr/',
  data: '/data/',
  howLong: '/why-it-takes-time/',
  howWeWork: '/how-we-work/',
  apply: '/apply/',
} as const;

/** The source of a statistic as a visuals `StatSource` (label, link, period). */
export function toVisualSource(id: SalesSourceId, period: string): StatSource {
  const s = salesSource(id);
  return { label: s.short, href: s.url, period };
}

/** A register statistic as a visuals `Stat`: the figure, what it counts, and its first source. */
export function visualStat(id: StatId, icon?: string): Stat {
  const s = stat(id);
  const first = s.sources[0];
  if (first === undefined) throw new Error(`Statistic ${id} has no source`);
  return { value: s.value, label: s.label, source: toVisualSource(first, s.period), icon };
}

/** The weekly loop: WE's own cadence (how-we-work CADENCE, "Weekly"), the fast half of the spine. */
export interface LoopStep {
  readonly label: string;
  readonly line: string;
  readonly icon: 'calendar' | 'team' | 'report' | 'checklist';
}

export const WEEKLY_LOOP: readonly LoopStep[] = [
  { label: 'Plan', line: 'The week’s cycle is set in writing.', icon: 'calendar' },
  { label: 'Build', line: 'A dedicated team ships the work.', icon: 'team' },
  { label: 'Report', line: 'A written status, every week.', icon: 'report' },
  { label: 'Decide', line: 'You say yes or no to the next cycle.', icon: 'checklist' },
];

/** The three figures of the slow half: the share of new establishments still operating at years one, five and ten (BLS, Table 7). */
export const DECADE_STATS: readonly StatId[] = ['ST-01', 'ST-02', 'ST-03'];

/** The long-horizon track: where milestones typically fall, and the survival gates, all from the register. */
export function decadeMilestones(): readonly Milestone[] {
  const payroll = stat('ST-08');
  const established = stat('ST-05');
  const y1 = stat('ST-01');
  const y5 = stat('ST-02');
  const y10 = stat('ST-03');
  const src = (s: { sources: readonly SalesSourceId[]; period: string }): StatSource => {
    const first = s.sources[0];
    if (first === undefined) throw new Error('A statistic on the timeline has no source');
    return toVisualSource(first, s.period);
  };
  return [
    { at: 0.08, label: 'First written status', detail: 'WE reports in writing from the first week.' },
    { at: 0.57, label: 'First payroll', detail: 'Typically 2.29 quarters after a business applies, for the 2021 applications.', source: src(payroll) },
    { at: 1, kind: 'survival', label: `${y1.value} still operating`, detail: 'One year after opening.', source: src(y1) },
    { at: 3.5, label: 'Counted as established', detail: 'A business is called established at 42 months.', source: src(established) },
    { at: 5, kind: 'survival', label: `${y5.value} still operating`, detail: 'Five years after opening.', source: src(y5) },
    { at: 10, kind: 'survival', label: `${y10.value} still operating`, detail: 'Ten years after opening.', source: src(y10) },
  ];
}

// -----------------------------------------------------------------------------------------------------------------------------------
// The ecosystem band ("Join the programs that fit")
// -----------------------------------------------------------------------------------------------------------------------------------

export const JOIN_HEADLINE = 'Join the programs that fit. WE stays for the long run.';
export const JOIN_LEAD =
  'WE does not compete with the programs around you. Founder programs, coworking spaces, investor communities and public funding each do something WE does not, and most founders do best using several. Join the ones that fit. WE works alongside, for as long as the work is useful.';
export const JOIN_NOTE = 'Independent programs that WE encourages founders to consider. No affiliation or endorsement is implied.';

export interface JoinTile {
  readonly label: string;
  readonly line: string;
  readonly icon: 'calendar' | 'team' | 'globe' | 'contact' | 'document' | 'data' | 'handover';
}

export const JOIN_TILES: readonly JoinTile[] = [
  { label: 'Founder programs', line: 'Structured, time-boxed programs with a peer group and a deadline.', icon: 'calendar' },
  { label: 'Coworking spaces', line: 'A desk, a room and people who are building too.', icon: 'team' },
  { label: 'Investor communities', line: 'Angel groups and investor relations events where you meet the people who fund companies.', icon: 'contact' },
  { label: 'University and lab programs', line: 'Research, labs and technology transfer for science-based companies.', icon: 'document' },
  { label: 'Local small business support', line: 'Advisers, training and regional networks close to home.', icon: 'globe' },
  { label: 'Public funding', line: 'Federal research awards such as SBIR and STTR.', icon: 'data' },
];

// -----------------------------------------------------------------------------------------------------------------------------------
// The SBIR and STTR band
// -----------------------------------------------------------------------------------------------------------------------------------

export const SBIR_HEADLINE = 'Apply to SBIR and STTR.';
export const SBIR_LEAD =
  'The Small Business Innovation Research and Small Business Technology Transfer programs fund small businesses to do research and development. If your company is building something technical, apply, and keep applying.';
export const SBIR_NOTE = 'WE helps founders prepare alongside. WE is not an agency and cannot promise an award.';

export const SBIR_STEPS: readonly { readonly label: string; readonly line: string }[] = [
  { label: 'Find', line: 'The agency topics that match what you build.' },
  { label: 'Prepare', line: 'The registrations, the plan and the proposal.' },
  { label: 'Apply', line: 'Submit, learn from the review and go again.' },
];

// -----------------------------------------------------------------------------------------------------------------------------------
// The data teaser
// -----------------------------------------------------------------------------------------------------------------------------------

export const DATA_HEADLINE = 'See the data behind the long game.';
export const DATA_LEAD = 'Public statistics from the Bureau of Labor Statistics, the Census Bureau, the SBA and the Federal Reserve, charted with every source linked.';
export const DATA_STATS: readonly StatId[] = ['ST-34', 'ST-33', 'ST-11'];

// -----------------------------------------------------------------------------------------------------------------------------------
// Situation pointers (who-we-work-with/*)
// -----------------------------------------------------------------------------------------------------------------------------------

export interface SituationPointer {
  /** The situation's slug (src/data/sales/situations.ts). */
  readonly slug: string;
  /** The situation's line under the longevity headline. */
  readonly pace: string;
  readonly headline: string;
  readonly lead: string;
  /** Kinds of outside programs worth a look for this situation, as labels. */
  readonly programs: readonly { readonly label: string; readonly line: string }[];
  /** Whether SBIR and STTR is worth a line for this situation, and what the line says. */
  readonly sbir?: string;
}

export const SITUATION_POINTERS: readonly SituationPointer[] = [
  {
    slug: 'industry-insiders',
    pace: 'Your experience lets you move fast every week. The years a company takes to settle are still the years, and WE plans for them.',
    headline: 'Use what you know, and the programs built for it.',
    lead: 'Years inside an industry are a head start. Programs that match your field turn that head start into introductions and early customers.',
    programs: [
      { label: 'Industry-specific programs', line: 'Programs run with the sector you already know.' },
      { label: 'Investor communities', line: 'Angel groups and investor relations events that back founders with domain depth.' },
      { label: 'Local small business support', line: 'Advisers and regional networks near you.' },
    ],
    sbir: 'If the problem you know is one a federal agency pays to solve, SBIR and STTR topics are written for exactly that.',
  },
  {
    slug: 'encore-founders',
    pace: 'Experience speeds up every week. It does not shorten the years a company takes, so WE pairs a fast weekly pace with a plan built for the decade.',
    headline: 'Experience pairs well with a peer group.',
    lead: 'A second act benefits from people who are building now. Founder programs and coworking spaces give you the room; WE gives you the team and the long view.',
    programs: [
      { label: 'Founder programs', line: 'A peer group on the same clock as you.' },
      { label: 'Coworking spaces', line: 'A desk and a room full of people building.' },
      { label: 'Investor communities', line: 'Angel groups that back experienced founders.' },
    ],
    sbir: 'If the company is technical, an SBIR or STTR application can be a route to fund early research.',
  },
  {
    slug: 'repeat-builders',
    pace: 'You have built before, so you know the weekly pace. WE adds capacity to it and keeps the plan patient across the years.',
    headline: 'Add capacity, and keep your network growing.',
    lead: 'You know how this goes. Keep your network current with founder communities and investor relations events, and let WE carry the build.',
    programs: [
      { label: 'Founder communities', line: 'Peers who have also done it before.' },
      { label: 'Investor communities', line: 'Angel groups and investor relations events.' },
      { label: 'University and lab programs', line: 'Access to research and talent for the next company.' },
    ],
    sbir: 'Technical ideas can start with an SBIR or STTR application while the team forms.',
  },
  {
    slug: 'global-founders',
    pace: 'Borders and time zones do not slow a written weekly rhythm. The years a company takes are the same everywhere, and WE plans for them.',
    headline: 'Find your local community, wherever you build from.',
    lead: 'Building across borders is easier with people nearby who share the context. Look for programs in your region and for ones that welcome founders from abroad.',
    programs: [
      { label: 'Regional founder programs', line: 'Programs in the city or country where you operate.' },
      { label: 'Coworking spaces', line: 'A local room and local connections.' },
      { label: 'Local small business support', line: 'Advisers who know the regional rules.' },
    ],
    sbir: 'SBIR and STTR have rules on ownership and location. Read them early.',
  },
  {
    slug: 'under-backed-builders',
    pace: 'With less capital, every week counts, and the years still matter. WE pairs a fast weekly pace with a plan that lasts.',
    headline: 'Use every door that is open to you.',
    lead: 'Capable founders who have less capital and fewer introductions gain the most from joining more than one program. Many programs are designed for founders in exactly this position.',
    programs: [
      { label: 'Founder programs', line: 'Including programs for women, veteran and first-generation founders.' },
      { label: 'Local small business support', line: 'Training and advising close to home.' },
      { label: 'Coworking spaces', line: 'A community around you, so you are not building alone.' },
    ],
    sbir: 'SBIR and STTR are open to small businesses that meet the program rules. Check them early.',
  },
  {
    slug: 'next-gen-founders',
    pace: 'Starting young puts time on your side. Use it: ship every week, and build for the decade.',
    headline: 'Start in a community, then stay for the long run.',
    lead: 'Early on, peers matter as much as advice. Join the programs and spaces where people your age are building, and bring WE in when the company needs a steady team.',
    programs: [
      { label: 'University and lab programs', line: 'Programs on campus and in the labs near you.' },
      { label: 'Founder programs', line: 'Structured programs with a peer group.' },
      { label: 'Coworking spaces', line: 'A desk among other people who are starting up.' },
    ],
    sbir: 'Research-based ideas from a lab or a class can be a fit for SBIR and STTR.',
  },
  {
    slug: 'restart-founders',
    pace: 'A restart is a fresh clock. Ship every week, and build for the decade this time.',
    headline: 'A restart is easier alongside others.',
    lead: 'People who have been through it understand a restart. Founder communities and local support give you company while WE steadies the build.',
    programs: [
      { label: 'Founder communities', line: 'Peers who know what a restart takes.' },
      { label: 'Local small business support', line: 'Advisers and training near you.' },
      { label: 'Coworking spaces', line: 'Somewhere to go and people to see.' },
    ],
    sbir: 'A technical restart can apply to SBIR and STTR like any other small business.',
  },
];

export function pointerFor(slug: string): SituationPointer {
  const found = SITUATION_POINTERS.find((p) => p.slug === slug);
  if (found === undefined) throw new Error(`No situation pointer for "${slug}" in src/components/program/longevity/data.ts`);
  return found;
}
