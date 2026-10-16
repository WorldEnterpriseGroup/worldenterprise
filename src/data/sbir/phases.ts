/**
 * The phases of SBIR and STTR for /sbir-sttr/phases/ (WP-34, #83). Sizes and durations are as SBIR.gov states them on the retrieval
 * date: "How to Apply" gives the typical ranges, and "About" gives the limits agencies may reach without SBA approval, as of April 2026.
 * The base guidelines in the 2023 policy directive ($150,000 and $1 million) are adjusted for inflation, which is why the limits are higher.
 */
import type { SbirSourceId } from './sources.ts';

export interface Phase {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly summary: string;
  readonly duration: string;
  readonly size: string;
  readonly limit: string | null;
  readonly points: readonly string[];
  readonly sources: readonly SbirSourceId[];
}

export const PHASES: readonly Phase[] = [
  {
    id: 'phase-0',
    name: 'Phase 0',
    tag: 'Optional, run by some states',
    summary: 'Help preparing a proposal, offered by some states and regions rather than by the agencies.',
    duration: 'Varies by program',
    size: 'Varies by program',
    limit: null,
    points: [
      'Some states run matching programs that cover part of the cost of preparing a proposal.',
      'The federal FAST Partnership Program funds state and regional organizations that run this kind of help.',
    ],
    sources: ['sbir-apply', 'sbir-fast'],
  },
  {
    id: 'phase-1',
    name: 'Phase I',
    tag: 'Prove the idea can work',
    summary: 'A proof of concept: is the technical idea feasible, and is there a market that wants it?',
    duration: '6 to 12 months',
    size: '$50,000 to $323,000',
    limit: '$323,090 without an SBA waiver, as of April 2026',
    points: [
      'SBIR Phase I normally runs six months and STTR Phase I a year.',
      'The company must do at least two thirds of the research in SBIR Phase I. In STTR, the company does at least 40 percent and the research institution at least 30 percent.',
      'Agencies differ widely inside the range: in recent years the typical Phase I award ran from about $100,000 at EPA to about $300,000 at HHS.',
    ],
    sources: ['sbir-apply', 'sbir-about', 'sbir-policy-directive'],
  },
  {
    id: 'phase-2',
    name: 'Phase II',
    tag: 'Build it',
    summary: 'Continued research and development, usually only for Phase I awardees, ending in a prototype or product a customer can test.',
    duration: '24 months',
    size: '$650,000 to $2.2 million',
    limit: '$2,153,927 without an SBA waiver, as of April 2026',
    points: [
      'Typically only Phase I awardees qualify, though some agencies run a direct-to-Phase II route for companies that did Phase I-type work with other funds.',
      'The company must do at least half of the research in an SBIR Phase II.',
    ],
    sources: ['sbir-apply', 'sbir-about', 'sbir-policy-directive'],
  },
  {
    id: 'phase-3',
    name: 'Phase III',
    tag: 'Sell it',
    summary: 'Commercialization in the private sector or the federal marketplace. No SBIR or STTR money is awarded in this phase.',
    duration: 'Open-ended',
    size: 'No SBIR or STTR funding',
    limit: null,
    points: [
      'A federal agency may buy the result directly, without a new competition, because the work came out of an SBIR or STTR award.',
    ],
    sources: ['sbir-apply'],
  },
];

export interface HelpItem {
  readonly name: string;
  readonly body: string;
  readonly sources: readonly SbirSourceId[];
}

/** The extra help around the phases. A figure is as an agency states it; amounts change by solicitation. */
export const TABA: HelpItem = {
  name: 'Technical and Business Assistance (TABA)',
  body: 'Applicants may add a line to the budget for a vendor who helps with commercialization work such as intellectual property, market analysis and regulatory planning. NIH, DOE and USDA all state up to $6,500 for a Phase I and up to $50,000 for a Phase II. How the vendor is chosen differs by agency, so read the solicitation.',
  sources: ['taba-nida'],
};
