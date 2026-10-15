import type { SalesSourceId } from './sources.ts';
import type { StatId } from './stats.ts';

/**
 * The data behind the six charts of /why-it-takes-time/ and the situation-page charts. Every series is copied from the source named
 * beside it (fetched 2026-10-14; research/timeline-stats.json and research/demographics.json of the redesign kit hold the same values).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Series {
  readonly label: string;
  readonly points: readonly Point[];
  /** Draw this line strongest. */
  readonly primary?: boolean;
}

export interface Bar {
  readonly label: string;
  readonly value: number;
  /** How the value is printed. */
  readonly display: string;
  readonly highlight?: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Chart 1: yearly business applications (Census BFS, BA_BA, sum of 12 monthly not seasonally adjusted values)
// ---------------------------------------------------------------------------------------------------------------------------------

export const APPLICATIONS_BY_YEAR: readonly Point[] = [
  { x: 2005, y: 2485100 }, { x: 2006, y: 2615834 }, { x: 2007, y: 2633956 }, { x: 2008, y: 2559006 }, { x: 2009, y: 2406259 },
  { x: 2010, y: 2473934 }, { x: 2011, y: 2550495 }, { x: 2012, y: 2550198 }, { x: 2013, y: 2591539 }, { x: 2014, y: 2691040 },
  { x: 2015, y: 2795897 }, { x: 2016, y: 2948338 }, { x: 2017, y: 3182674 }, { x: 2018, y: 3486829 }, { x: 2019, y: 3498990 },
  { x: 2020, y: 4356498 }, { x: 2021, y: 5390816 }, { x: 2022, y: 5062563 }, { x: 2023, y: 5469302 }, { x: 2024, y: 5224176 },
  { x: 2025, y: 5671836 },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Chart 2: the formation funnel for 2021 applications (Census BFS: BA_BA, BF_BF4Q, BF_BF8Q)
// ---------------------------------------------------------------------------------------------------------------------------------

export const FORMATION_FUNNEL: readonly Bar[] = [
  { label: 'Business applications filed in 2021', value: 5390816, display: '5,390,816' },
  { label: 'Became employers within one year', value: 315318, display: '315,318 (5.8%)' },
  { label: 'Became employers within two years', value: 403072, display: '403,072 (7.5%)', highlight: true },
];

/** Average quarters from application to first payroll, for applications that formed within eight quarters (DUR8Q). */
export const QUARTERS_TO_PAYROLL: readonly Bar[] = [
  { label: '2005 applications', value: 1.48, display: '1.48 quarters' },
  { label: '2021 applications', value: 2.29, display: '2.29 quarters', highlight: true },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Chart 3: survival since opening, establishments opened in the year to March 2015 (BLS BED Table 7: total, NAICS 51, NAICS 54)
// ---------------------------------------------------------------------------------------------------------------------------------

const curve = (values: readonly number[]): readonly Point[] => values.map((y, x) => ({ x, y }));

export const SURVIVAL_2015: readonly Series[] = [
  { label: 'All private-sector establishments', points: curve([100, 79.6, 69.1, 61.4, 55.4, 50.2, 46.4, 43.6, 40.3, 37.4, 34.7]), primary: true },
  { label: 'Information (includes software)', points: curve([100, 80.8, 70.0, 60.8, 53.3, 46.8, 42.6, 38.6, 35.4, 33.0, 30.0]) },
  { label: 'Professional and technical services', points: curve([100, 81.6, 71.2, 63.0, 56.0, 50.3, 46.9, 43.2, 40.0, 37.2, 34.3]) },
];

/** The phase bands drawn behind the survival curve, in years since opening. The names are WE's phases, not the source's. */
export interface PhaseBand {
  readonly label: string;
  readonly from: number;
  readonly to: number;
}

export const PHASES: readonly PhaseBand[] = [
  { label: 'Ignite', from: 0, to: 0.5 },
  { label: 'Build', from: 0.5, to: 1.5 },
  { label: 'Launch', from: 1.5, to: 3 },
  { label: 'Grow', from: 3, to: 5 },
  { label: 'Orbit', from: 5, to: 15 },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Chart 4: a quarter against the years (months on one axis)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Span {
  readonly label: string;
  readonly from: number;
  readonly to: number;
  readonly display: string;
  readonly source: SalesSourceId;
  readonly kind: 'program' | 'window' | 'marker';
}

export const MONTHS_AXIS = 60;

export const CLOCK_SPANS: readonly Span[] = [
  { label: 'A fixed-term program for founders', from: 0, to: 3, display: '3 months', source: 'cohen-hochberg-2014', kind: 'program' },
  { label: 'Incubation, as the research defines it', from: 12, to: 60, display: '1 to 5 years', source: 'cohen-hochberg-2014', kind: 'window' },
  { label: 'Counted as an established business', from: 42, to: 42, display: '42 months', source: 'gem-usa-2026', kind: 'marker' },
  { label: 'About half of new establishments have closed', from: 60, to: 60, display: '5 years', source: 'sba-faq-2026', kind: 'marker' },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Chart 5: the odds staircase, survival from the previous year (BLS BED Table 7, opened in the year to March 2013)
// ---------------------------------------------------------------------------------------------------------------------------------

export const ODDS_STAIRCASE_2013: readonly Bar[] = [
  { label: 'Year 1', value: 79.6, display: '79.6%' },
  { label: 'Year 2', value: 86.6, display: '86.6%' },
  { label: 'Year 3', value: 89.0, display: '89.0%' },
  { label: 'Year 4', value: 90.1, display: '90.1%' },
  { label: 'Year 5', value: 91.5, display: '91.5%' },
  { label: 'Year 6', value: 92.2, display: '92.2%' },
  { label: 'Year 7', value: 91.7, display: '91.7%' },
  { label: 'Year 8', value: 93.2, display: '93.2%' },
  { label: 'Year 9', value: 94.4, display: '94.4%', highlight: true },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Chart 6: reasons given by venture-backed startups that shut down (CB Insights 2026; more than one reason allowed)
// ---------------------------------------------------------------------------------------------------------------------------------

export const FAILURE_REASONS: readonly Bar[] = [
  { label: 'Ran out of capital', value: 70, display: '70%', highlight: true },
  { label: 'Poor product-market fit', value: 43, display: '43%', highlight: true },
  { label: 'Bad timing', value: 29, display: '29%' },
  { label: 'Unsustainable unit economics', value: 19, display: '19%' },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Founder age (Azoulay, Jones, Kim and Miranda)
// ---------------------------------------------------------------------------------------------------------------------------------

export const FOUNDER_AGE: readonly Bar[] = [
  { label: 'All founders of U.S. startups that hire', value: 41.9, display: '41.9 years' },
  { label: 'Founders of the fastest-growing 1 in 1,000', value: 45.0, display: '45.0 years', highlight: true },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Situation charts
// ---------------------------------------------------------------------------------------------------------------------------------

export const INDUSTRY_EXPERIENCE: readonly Bar[] = [
  { label: 'Three or more years in the same industry', value: 0.26, display: '0.26%', highlight: true },
  { label: 'No experience in the industry', value: 0.11, display: '0.11%' },
];

export const PRIOR_SUCCESS: readonly Bar[] = [
  { label: 'After a prior success', value: 30, display: '30%', highlight: true },
  { label: 'After a prior failure', value: 22, display: '22%' },
  { label: 'First-time founders', value: 21, display: '21%' },
];

export const START_RATE_BY_NATIVITY: readonly Bar[] = [
  { label: 'Immigrant adults', value: 0.6, display: '0.60%', highlight: true },
  { label: 'U.S.-born adults', value: 0.3, display: '0.30%' },
];

export const AGE_55_64_SHARE: readonly Bar[] = [
  { label: '1996', value: 14.8, display: '14.8%' },
  { label: '2021', value: 22.8, display: '22.8%', highlight: true },
];

export const APPROVAL_BY_FIRM_AGE: readonly Bar[] = [
  { label: 'Firms aged 0 to 5', value: 48, display: '48%', highlight: true },
  { label: 'Firms aged 6 to 20', value: 51, display: '51%' },
  { label: 'Firms aged 21 or more', value: 63, display: '63%' },
];

/** Opportunity share of new entrepreneurs by year (Kauffman 2025 report, Table 8). Necessity share is 100 minus this. */
const OPPORTUNITY_SHARE: readonly (readonly [number, number])[] = [
  [1996, 81.1], [1997, 79.5], [1998, 80.8], [1999, 83.9], [2000, 86.4], [2001, 83.0], [2002, 76.8], [2003, 77.1], [2004, 79.3], [2005, 79.1],
  [2006, 80.8], [2007, 80.2], [2008, 80.7], [2009, 73.8], [2010, 74.2], [2011, 74.1], [2012, 78.4], [2013, 78.2], [2014, 79.6], [2015, 84.0],
  [2016, 86.3], [2017, 84.4], [2018, 86.2], [2019, 86.9], [2020, 69.8], [2021, 80.9], [2022, 88.3], [2023, 85.2], [2024, 82.3], [2025, 83.3],
];

export const NECESSITY_SHARE: Series = {
  label: 'Share of new entrepreneurs who started out of necessity',
  points: OPPORTUNITY_SHARE.map(([x, opportunity]) => ({ x, y: Math.round((100 - opportunity) * 10) / 10 })),
  primary: true,
};

/** Which register entries each chart restates, for the tests and the sources ledger. */
export const CHART_STATS: Readonly<Record<string, readonly StatId[]>> = {
  applications: ['ST-06'],
  funnel: ['ST-07', 'ST-08'],
  survival: ['ST-01', 'ST-02', 'ST-03', 'ST-35'],
  clock: ['ST-10', 'ST-05'],
  staircase: ['ST-34', 'ST-04'],
  reasons: ['ST-11'],
  age: ['ST-16', 'ST-17'],
};
