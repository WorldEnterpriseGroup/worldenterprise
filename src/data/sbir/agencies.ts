/**
 * The eleven participating agencies (WP-34, #83). Funding type, budget and award ranges are as SBIR.gov lists them on the retrieval
 * date (source `sbir-agencies`); the "how it feels" lines are WE's plain-language reading of each agency's own pages and of the award
 * data, and every one ends with the reminder to read the current solicitation. Budgets are listed by SBIR.gov and change every year.
 */
import type { SbirSourceId } from './sources.ts';

export type FundingType = 'Grants' | 'Contracts' | 'Grants and contracts' | 'Agreements';

export interface Agency {
  /** Short name as used in the award data and in charts. */
  readonly short: string;
  readonly id: string;
  readonly name: string;
  readonly type: FundingType;
  /** The yearly SBIR/STTR budget as SBIR.gov lists it. */
  readonly budget: string;
  readonly phase1: string;
  readonly phase2: string;
  readonly topics: string;
  /** How applying tends to feel: open or topic-led, and what the first step is. */
  readonly style: string;
  readonly sttr: boolean;
  readonly url: string;
  readonly sources: readonly SbirSourceId[];
}

export const AGENCIES: readonly Agency[] = [
  {
    short: 'DoD',
    id: 'dod',
    name: 'Department of Defense',
    type: 'Contracts',
    budget: '$2.3 billion',
    phase1: '$50,000 to $250,000',
    phase2: '$800,000 to $1.83 million',
    topics: 'Priority areas such as artificial intelligence and autonomy, biotechnology, cybersecurity, microelectronics, quantum sciences and space.',
    style: 'Topic-led. Defense components publish specific topics, and you answer a topic through the DoD SBIR/STTR Innovation Portal (DSIP). The customer is a program office that wants a capability, so the proposal reads like a plan to deliver one.',
    sttr: true,
    url: 'https://www.dodsbirsttr.mil/submissions/',
    sources: ['sbir-agencies'],
  },
  {
    short: 'HHS',
    id: 'hhs',
    name: 'Department of Health and Human Services (mainly the National Institutes of Health)',
    type: 'Grants and contracts',
    budget: '$1.2 billion',
    phase1: '$275,000 and up',
    phase2: '$1.83 million',
    topics: 'Health, life science and biomedical discoveries.',
    style: 'Mostly investigator-initiated grant applications through funding announcements, with a separate list of contract solicitations. Scientific review is rigorous and the writing is long. NIH sets aside $1.4 billion a year across these programs, by its own count.',
    sttr: true,
    url: 'https://seed.nih.gov/small-business-funding/small-business-program-basics',
    sources: ['sbir-agencies', 'nih-seed'],
  },
  {
    short: 'DOE',
    id: 'doe',
    name: 'Department of Energy (including ARPA-E)',
    type: 'Agreements',
    budget: '$349 million',
    phase1: '$200,000 to $300,000',
    phase2: '$1.1 million to $2 million',
    topics: 'Scientific computing, environmental management, fossil and fusion energy, cybersecurity, energy security and more.',
    style: 'Topic-led, by program office, with funding opportunities released on a schedule. The programs are managed by DOE’s Office of Technology Commercialization, and DOE’s own page says they were reauthorized effective April 13, 2026.',
    sttr: true,
    url: 'https://science.osti.gov/sbir',
    sources: ['sbir-agencies', 'doe-sbir'],
  },
  {
    short: 'NSF',
    id: 'nsf',
    name: 'National Science Foundation',
    type: 'Grants',
    budget: '$174 million',
    phase1: '$300,000',
    phase2: '$1.25 million',
    topics: 'Almost all technology and market sectors, except clinical trials.',
    style: 'Open, not topic-led. NSF asks for a short project pitch first, and invites a full proposal only when the pitch fits. It describes itself as seed funding of up to $2 million that takes no ownership of your company.',
    sttr: true,
    url: 'https://seedfund.nsf.gov/',
    sources: ['sbir-agencies', 'nsf-seed-fund'],
  },
  {
    short: 'NASA',
    id: 'nasa',
    name: 'National Aeronautics and Space Administration',
    type: 'Contracts',
    budget: '$174 million',
    phase1: '$150,000',
    phase2: '$1 million',
    topics: 'Seventeen technology areas, including propulsion, avionics, power and energy storage, robotics and communications.',
    style: 'Topic-led. In 2026 NASA began using a Broad Agency Announcement that releases subtopics through the year instead of once a year, and its page lists each opening with its close and selection dates.',
    sttr: true,
    url: 'https://www.nasa.gov/sbir_sttr/',
    sources: ['sbir-agencies', 'nasa-sbir'],
  },
  {
    short: 'USDA',
    id: 'usda',
    name: 'Department of Agriculture',
    type: 'Grants',
    budget: '$42 million',
    phase1: '$125,000 to $175,000',
    phase2: '$600,000',
    topics: 'Forest resources, plant and animal production, food science and nutrition, rural development, aquaculture, biofuels and small farms.',
    style: 'Topic-led grants through the National Institute of Food and Agriculture, with topic areas that map to farm, food and forest problems.',
    sttr: false,
    url: 'https://www.nifa.usda.gov/grants/programs/sbir-sttr',
    sources: ['sbir-agencies'],
  },
  {
    short: 'DHS',
    id: 'dhs',
    name: 'Department of Homeland Security',
    type: 'Contracts',
    budget: '$15 million',
    phase1: '$175,000',
    phase2: '$1 million',
    topics: 'Border and maritime security, chemical and biological defense, critical infrastructure, cybersecurity, first responders and more.',
    style: 'Topic-led contracts shaped by the operational needs of its security missions.',
    sttr: false,
    url: 'https://www.sbir.gov/participating-agencies',
    sources: ['sbir-agencies'],
  },
  {
    short: 'DOT',
    id: 'dot',
    name: 'Department of Transportation',
    type: 'Contracts',
    budget: '$9 million',
    phase1: '$200,000',
    phase2: '$1 million',
    topics: 'Technologies supporting the Federal Highway, Railroad and Transit Administrations and the pipeline safety agency.',
    style: 'A small program, with topics tied to the missions of its operating administrations.',
    sttr: false,
    url: 'https://www.sbir.gov/participating-agencies',
    sources: ['sbir-agencies'],
  },
  {
    short: 'ED',
    id: 'ed',
    name: 'Department of Education',
    type: 'Contracts',
    budget: '$10 million',
    phase1: '$250,000',
    phase2: '$1 million',
    topics: 'Education technology for students, educators, infants and toddlers, and learners with or at risk for disabilities.',
    style: 'Contracts for education technology used in classrooms and in early-intervention and special-education settings.',
    sttr: false,
    url: 'https://www.sbir.gov/participating-agencies',
    sources: ['sbir-agencies'],
  },
  {
    short: 'EPA',
    id: 'epa',
    name: 'Environmental Protection Agency',
    type: 'Contracts',
    budget: '$5 million',
    phase1: '$100,000',
    phase2: '$400,000',
    topics: 'Air quality, homeland security, sustainable materials, safe chemicals, land revitalization and clean water.',
    style: 'A small program with environmental topics and among the smallest award sizes of the eleven, which suits a tightly focused first project.',
    sttr: false,
    url: 'https://www.sbir.gov/participating-agencies',
    sources: ['sbir-agencies'],
  },
  {
    short: 'DOC',
    id: 'doc',
    name: 'Department of Commerce (NIST and NOAA)',
    type: 'Grants',
    budget: '$15 million',
    phase1: '$100,000',
    phase2: '$400,000',
    topics: 'Technologies that support the missions of NOAA and NIST.',
    style: 'Grants tied to weather, ocean, measurement and standards problems.',
    sttr: false,
    url: 'https://www.sbir.gov/participating-agencies',
    sources: ['sbir-agencies'],
  },
];

export const AGENCY_COUNT = AGENCIES.length;
