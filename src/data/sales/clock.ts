import type { SalesSourceId } from './sources.ts';
import type { StatId } from './stats.ts';

/**
 * The stations of /why-it-takes-time/ (SITE-COPY.md section 5): six charts met in order as the reader travels outward from year 0,
 * then the two closing sections. The page and the timeline brief both read this list, so the copy is written once.
 *
 * Changes from SITE-COPY.md, recorded in the WP-58 handoff: chart 4 drops the venture marker (ST-09, the source no longer prints it)
 * and says "42 months old" as the source does; chart 6 drops its second sentence (ST-37 is secondary); section 5.8 rests on the
 * fixed-term and incubation definitions only (ST-13 to ST-15 could not be fetched); section 5.9 shows ST-18 in place of ST-20.
 */

export type StationId = 'applications' | 'funnel' | 'survival' | 'clock' | 'staircase' | 'reasons';

export interface Station {
  readonly id: StationId;
  /** Where on the clock the station sits, shown above the headline. */
  readonly when: string;
  readonly headline: string;
  readonly caption: string;
  readonly tiles: readonly StatId[];
  readonly sources: readonly SalesSourceId[];
  /** The world-forming stage drawn beside the station, 1 (dust) to 6 (a settled world). */
  readonly stage: 1 | 2 | 3 | 4 | 5 | 6;
  /** The accessible name of that drawing. */
  readonly stageTitle: string;
}

export const STATIONS: readonly Station[] = [
  {
    id: 'applications',
    when: 'Year 0',
    headline: 'A record year for starting.',
    caption: 'Americans filed more business applications in 2025 than in any year on record.',
    tiles: ['ST-06'],
    sources: ['census-bfs'],
    stage: 1,
    stageTitle: 'Stage 1 of 6: scattered dust',
  },
  {
    id: 'funnel',
    when: 'Years 0 to 2',
    headline: 'Few become employers quickly.',
    caption: "Of 2021's applications, 7.5% had hired anyone within two years, and the wait to first payroll has grown.",
    tiles: ['ST-07', 'ST-08'],
    sources: ['census-bfs', 'census-bfs-definitions'],
    stage: 2,
    stageTitle: 'Stage 2 of 6: dust gathering around a small core',
  },
  {
    id: 'survival',
    when: 'Years 0 to 10',
    headline: 'About half are gone by year five.',
    caption:
      'About 1 in 5 close in year one, about half by year five, and about a third remain at year ten. Software-heavy and professional-services businesses follow the same curve.',
    tiles: ['ST-01', 'ST-02', 'ST-03', 'ST-35'],
    sources: ['bls-bed-total', 'bls-bed-information', 'bls-bed-professional'],
    stage: 3,
    stageTitle: 'Stage 3 of 6: a hot core',
  },
  {
    id: 'clock',
    when: 'Months 0 to 60',
    headline: 'Three months, or three to five years.',
    caption: 'Many programs for founders are designed for about three months. A business is not counted as established until it is 42 months old.',
    tiles: ['ST-10', 'ST-05'],
    sources: ['cohen-hochberg-2014', 'gem-usa-2026', 'sba-faq-2026'],
    stage: 4,
    stageTitle: 'Stage 4 of 6: a world with land',
  },
  {
    id: 'staircase',
    when: 'Years 1 to 10',
    headline: 'Every year survived makes the next more likely.',
    caption: 'The hardest years are the first five. After that, the odds turn.',
    tiles: ['ST-34', 'ST-04'],
    sources: ['bls-bed-total', 'sba-faq-2026'],
    stage: 5,
    stageTitle: 'Stage 5 of 6: a world with an atmosphere',
  },
  {
    id: 'reasons',
    when: 'Any year',
    headline: 'It is rarely the idea.',
    caption: 'Among venture-backed startups that shut down, running out of capital and missing product-market fit led the reasons given.',
    tiles: ['ST-11'],
    sources: ['cb-insights-2026'],
    stage: 6,
    stageTitle: 'Stage 6 of 6: a settled world with a moon in orbit',
  },
];

export const CLOCK_HERO = {
  title: 'The real clock.',
  lead: 'What public data says about how long a business takes, in six charts.',
  seoTitle: 'Why it takes time',
  description: 'Public data on how long a business takes: applications, formation, survival to year ten, and what ends companies. Every figure sourced.',
} as const;

export const PACED = {
  headline: 'Paced, not packed.',
  body: [
    'Research that sorts programs for founders finds two shapes. Fixed-term programs usually run about three months. Incubation, as the same research defines it, runs one to five years.',
    'WE works to the longer clock: phases matched to the survival curve, written reviews at years one, three and five, and a team that steps down as the company needs less, rather than stopping on a date.',
    'WE does not claim that this changes any survival figure on this page. It is how WE chooses to pace the work.',
  ],
  sources: ['cohen-hochberg-2014'] as readonly SalesSourceId[],
} as const;

export const HEAD_START = {
  headline: 'Experience is the head start.',
  caption:
    'The founders of the fastest-growing startups are, on average, in their forties. Industry experience is one of the strongest signals in the data.',
  tiles: ['ST-17', 'ST-18'] as readonly StatId[],
  sources: ['azoulay-2018'] as readonly SalesSourceId[],
} as const;

export const CLOCK_END = {
  headline: 'So WE is built for the clock.',
  body: 'WE paces the work in phases matched to this curve, with reviews at years one, three and five, and no fixed end date.',
} as const;

/** The rings drawn for "Paced, not packed": WE's phases, in years since the work starts, with the written reviews. */
export const REVIEW_YEARS: readonly number[] = [1, 3, 5];
