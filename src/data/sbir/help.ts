/**
 * Independent help a founder can use around SBIR and STTR (WP-34, #83). Every entry is a program run by someone else. WE does not run
 * them, is not affiliated with them and does not endorse them; the page says so beside the list. Descriptions are as the program's own
 * pages state them, and the one that this build could only find through search results says so in its source entry.
 */
import type { SbirSourceId } from './sources.ts';

export interface HelpProgram {
  readonly id: string;
  readonly name: string;
  readonly runBy: string;
  readonly body: string;
  readonly url: string;
  readonly sources: readonly SbirSourceId[];
}

export const HELP_PROGRAMS: readonly HelpProgram[] = [
  {
    id: 'sbdc',
    name: 'Small Business Development Centers',
    runBy: 'U.S. Small Business Administration and host organizations',
    body: 'Local advisers and training for small businesses, with counseling on planning, registration and applying for federal programs.',
    url: 'https://www.sba.gov/local-assistance/resource-partners/small-business-development-centers-sbdc',
    sources: ['sba-sbdc'],
  },
  {
    id: 'fast',
    name: 'Federal and State Technology (FAST) Partnership',
    runBy: 'U.S. Small Business Administration, through state and regional organizations',
    body: 'Outreach, technical and business assistance, and financial support to help companies that have not yet won an award.',
    url: 'https://www.sbir.gov/community/fast',
    sources: ['sbir-fast'],
  },
  {
    id: 'state',
    name: 'State matching and Phase 0 programs',
    runBy: 'Individual states',
    body: 'Some states cover part of the cost of preparing a proposal or match an award once it is made. SBIR.gov calls this Phase 0, and each state sets its own rules.',
    url: 'https://www.sbir.gov/apply',
    sources: ['sbir-apply'],
  },
  {
    id: 'apex',
    name: 'APEX Accelerators',
    runBy: 'U.S. Department of Defense, Office of Small Business Programs',
    body: 'Local centers, formerly called Procurement Technical Assistance Centers, that help businesses learn to work with the Department of Defense and other federal buyers. Useful before a first defense proposal.',
    url: 'https://business.defense.gov/Engage/News/Article/3821927/apex-accelerators-are-a-critical-front-door-for-businesses',
    sources: ['apex-search'],
  },
  {
    id: 'program-staff',
    name: 'The agency’s own program staff',
    runBy: 'Each participating agency',
    body: 'Agencies list contacts for each program and many hold webinars before a solicitation closes. A short conversation about whether a topic fits is the best use of an hour before writing.',
    url: 'https://www.sbir.gov/participating-agencies',
    sources: ['sbir-agencies'],
  },
];

export const INDEPENDENT_NOTICE =
  'These are independent programs WE encourages founders to consider; no affiliation is implied. WE does not run them.';
