/**
 * Words on the /data/ pages (WP-35). Pure data so the unit tests can scan every line against the claims rules. The through-line is the
 * CEO's: a fast pace day to day, and the patience that years take. Every figure in a sentence here also lives in a dataset.
 */
import { SURVIVAL_2015_YEAR10, SURVIVAL_2015_YEAR5, APPLICATIONS_2025, QUARTERS_8Q_2021, thousandsOf } from './figures.ts';

export const HONESTY = "These figures describe all new U.S. businesses, not WE's results.";
export const NO_PROMISE = 'No one can promise that a company will survive, and WE makes no promise of funding.';

export const HUB = {
  path: '/data/',
  title: 'The long game, in data',
  seoTitle: 'The long game, in data',
  eyebrow: 'Data and charts',
  description: 'Public data on how long a business takes: starting, first payroll, survival, funding rounds and exits. Sourced charts with the data behind each.',
  lead: 'A company can be started in a week and run at a fast pace every day. Becoming an established one takes years. Public data shows how many, stage by stage.',
  thesis: [
    'Day to day, a startup moves quickly: decisions in hours, releases in days. Year to year, the clock is different. This page follows the public numbers along a founder’s route, from the first filing to the exit.',
    'Every chart names its source, shows the data as a table, and says how the figures were handled. The numbers are about all new U.S. businesses.',
  ],
  tiles: [
    { value: `${SURVIVAL_2015_YEAR10}%`, label: 'of establishments that opened in 2015 were still open ten years later', source: 'bls-bed-total' },
    { value: `${(APPLICATIONS_2025 / 1e6).toFixed(2)}M`, label: `business applications filed in 2025 (${thousandsOf(APPLICATIONS_2025)}), a record: starting is not the hard part`, source: 'census-bfs-monthly' },
    { value: '2.0', label: 'years: the median gap between a Seed round and a Series A', source: 'carta-spm-q1-2026' },
  ],
  stages: {
    formation: {
      stage: 'Stage 1 of 5, formation',
      heading: 'More people start than ever',
      body: [
        `Applications to start a business reached ${thousandsOf(APPLICATIONS_2025)} in 2025, more than double 2005, in every industry. Beginning is fast.`,
        'That is the pace of the first week. The rest of this page is about the years.',
      ],
      more: { label: 'More on starting: industries, and how many applications become employers', href: '/data/formation/' },
    },
    payroll: {
      stage: 'Stage 2 of 5, first revenue',
      heading: 'The first payroll is arriving later',
      body: [
        `For applications that did become employer businesses, the average wait from application to first payroll grew to ${QUARTERS_8Q_2021} quarters in 2021.`,
        'A first hire is a milestone measured in quarters, and the wait is getting longer, not shorter.',
      ],
    },
    survival: {
      stage: 'Stage 3 of 5, the survival years',
      heading: 'The first five years decide the most',
      body: [
        `About half of new establishments are gone by year 5, and ${SURVIVAL_2015_YEAR5}% of the 2015 group were still open at year 5. After year 1 the yearly risk falls steadily, and it keeps falling for a decade.`,
        'The pattern has held for opening-year groups from 1994 to 2020. That steadiness is the point: the timeline is the same one every founder meets.',
      ],
      more: { label: 'All the survival charts: six groups, three industries', href: '/data/survival/' },
    },
    funding: {
      stage: 'Stage 4 of 5, funding rounds',
      heading: 'Each round is years apart',
      body: [
        'Among venture-backed companies, the median gap from Seed to Series A is 2.0 years, from A to B 2.1 and from B to C 2.4. A company raising a Series E or later is a median 9.5 years old.',
        'Fast-paced work happens inside those years. The calendar does not speed up for it.',
      ],
      more: { label: 'The funding clock: gaps, ages and dilution', href: '/data/years-to-milestones/' },
    },
    exits: {
      stage: 'Stage 5 of 5, exits and growth',
      heading: 'The companies that grow fastest are founded by people with years behind them',
      body: [
        'Among U.S. startups founded in 2007 to 2009, the fastest-growing 1 in 1,000 had founders averaging 45.0 years old, against 41.8 for all startups. Founders of companies that exited averaged 46.7.',
        'Experience and patience travel together. The data does not say that age causes growth; it says the picture of the young founder racing is not the whole picture.',
      ],
      more: { label: 'Who starts, and who builds the fastest-growing firms', href: '/data/who-starts/' },
    },
  },
  close: {
    heading: 'Fast pace every day. Patience across the years.',
    body: [
      'WE is a long-horizon business incubation and consulting firm. A dedicated, fully remote team works with a founder day to day at startup speed, and for as long as the work is useful, because the years are what they are.',
      HONESTY,
      NO_PROMISE,
    ],
  },
} as const;

export const SURVIVAL_PAGE = {
  path: '/data/survival/',
  title: 'How long new businesses last',
  seoTitle: 'How long new businesses last, in data',
  description: 'Survival of new U.S. establishments over thirty years of opening-year groups: six groups, three industries, every year of life, with the data.',
  eyebrow: 'Data and charts',
  lead: 'Thirty years of opening-year groups, the same shape every time: a steep first five years, then a long, slow tail.',
  stages: [
    {
      id: 'groups',
      heading: 'Six groups, one shape',
      body: ['Each small chart is one opening-year group, on the same axes. The groups opened in different economies, in 1994, 2000, 2005, 2010, 2015 and 2020, and the first years look alike.'],
    },
    {
      id: 'risk',
      heading: 'The risk is front-loaded',
      body: ['In year 1 about one in five establishments closes. By year 13 the yearly figure is between 4 and 6 in 100. The longer a business has lasted, the more likely it is to last another year.'],
    },
    {
      id: 'spread',
      heading: 'Every group, every industry, one band',
      body: ['Each dot is one opening-year group at year 5. Across 27 groups, the all-industry figure stays in a narrow band near half. Information, which includes software publishing, sits lower; professional and technical services sits close to the total.'],
    },
  ],
  note: 'An establishment is one location of a business, so closures include sales and mergers as well as failures. The data does not show whether any program changes these odds.',
} as const;

export const FORMATION_PAGE = {
  path: '/data/formation/',
  title: 'Who files, and what happens next',
  seoTitle: 'Starting a business: formation in data',
  description: 'U.S. business applications by industry since 2005, how many become employers, and how long that takes, from the Census Bureau, with the data.',
  eyebrow: 'Data and charts',
  lead: 'Starting is easy to do and easy to count. Reaching a first payroll is slower and rarer.',
  stages: [
    { id: 'industries', heading: 'More starts in every industry', body: ['Applications grew in every industry shown, including Information and professional and technical services, the two closest to software work.'] },
    { id: 'employers', heading: 'Most applications do not become employers', body: ['An application is a request for a tax number, often by one person with no plan to hire. Of the applications filed in 2021, fewer than 8 in 100 became an employer business within two years.'] },
  ],
  note: 'An application is not a launched business. Many applicants never intend to hire.',
} as const;

export const WHO_PAGE = {
  path: '/data/who-starts/',
  title: 'Who starts, and who builds fast',
  seoTitle: 'Who starts a business: founders in data',
  description: 'Founder age in the United States: the share and rate of new entrepreneurs by age since 1996, and the age of founders of the fastest-growing firms.',
  eyebrow: 'Data and charts',
  lead: 'Founders are older than the usual picture, and the fastest-growing firms are older still.',
  stages: [
    { id: 'shares', heading: 'The founder is getting older', body: ['In 1996 more than a third of new entrepreneurs were 20 to 34. In 2021 about a quarter were, and the 55 to 64 group had grown to more than a fifth.'] },
    { id: 'rates', heading: 'Starting rates by age', body: ['The monthly rate of new entrepreneurs aged 35 to 54 has risen since 1996, while the rate for ages 20 to 34 has stayed flat.'] },
    { id: 'growth', heading: 'The fastest-growing firms and their founders', body: ['In all nine groups of firms studied, the founders of the fastest-growing 1 in 1,000 were older, on average, than founders of all startups. The ranges overlap: this is a tilt, not a rule.'] },
  ],
  note: 'Founder age is one factor among many and the data shows an association, not a cause.',
} as const;

export const MILESTONES_PAGE = {
  path: '/data/years-to-milestones/',
  title: 'The funding clock',
  seoTitle: 'The funding clock, in years',
  description: 'Published figures on how long each stage takes: first payroll, establishment, funding-round gaps and company age, with ownership given up per round.',
  eyebrow: 'Data and charts',
  lead: 'Each stage of a venture-backed company is measured in years, and every round gives up a share of ownership.',
  stages: [
    { id: 'clock', heading: 'One clock for every stage', body: ['Bars show how long each published stage takes, measured from the same starting line. They are separate durations, not a chain that adds up.'] },
    { id: 'rounds', heading: 'Gaps, ages and dilution', body: ['The median gap between rounds is two years or more at every stage, and each round gives up a share of ownership.'] },
  ],
  note: 'Funding figures describe venture-backed companies, a small share of all new businesses. They are quoted one by one from the publisher.',
} as const;
