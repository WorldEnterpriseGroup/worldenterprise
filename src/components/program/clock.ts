/**
 * The business clock as data: the public figures the home page and the program pages show, each with the source a reader can open
 * (SALES.md proof library ST-01 to ST-08 and ST-40; ledger: .astro-magazine/sources/wp-53.json). Pages render these values; they never
 * retype a figure. Every figure describes all new U.S. businesses, never WE's results, so every block that shows one also shows
 * HONESTY_LINE.
 */
import type { Milestone, Stat, StatSource, SurvivalSeries } from '../visuals/contracts.ts';

/** The line under every block of statistics (SITE-COPY rule 5). */
export const HONESTY_LINE = "These figures describe all new U.S. businesses, not WE's results.";

/** The required funding line on `/` and `/program/grow/` (claim C-05). */
export const NO_FUNDING_LINE = 'WE makes no promise of funding.';

export const SOURCES = {
  /** ST-01, ST-02, ST-03, ST-40 and the survival curve. */
  bls: {
    label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7 (March 2025 release)',
    href: 'https://www.bls.gov/bdm/us_age_naics_00_table7.txt',
  },
  /** ST-07 and ST-08. */
  census: {
    label: 'U.S. Census Bureau, Business Formation Statistics',
    href: 'https://www.census.gov/econ/bfs/index.html',
  },
  /** ST-05. */
  gem: {
    label: 'Global Entrepreneurship Monitor, United States 2019/2020 Report (Babson College)',
    href: 'https://www.babson.edu/media/babson/assets/global-entrepreneurship-monitor/GEM-2019-2020-US-Report.pdf',
  },
  /** ST-04. */
  sba: {
    label: 'U.S. Small Business Administration, Office of Advocacy, Frequently Asked Questions About Small Business (2026)',
    href: 'https://advocacy.sba.gov/wp-content/uploads/2026/02/FINAL_FAQsAboutSmallBusiness_2026_012826.pdf',
  },
} as const satisfies Record<string, StatSource>;

export type StatId = 'ST-01' | 'ST-02' | 'ST-03' | 'ST-04' | 'ST-05' | 'ST-07' | 'ST-08' | 'ST-40';

/** One figure per register id. `value` is exactly what the page prints. */
export const STATS: Readonly<Record<StatId, Stat>> = {
  'ST-01': { value: '77.9%', label: 'of new U.S. businesses were still operating after one year (opened in the year to March 2024)', source: SOURCES.bls, icon: 'gate' },
  'ST-02': { value: '51.4%', label: 'were still operating after five years (opened in the year to March 2020)', source: SOURCES.bls, icon: 'clock' },
  'ST-03': { value: '34.7%', label: 'were still operating after ten years (opened in the year to March 2015)', source: SOURCES.bls, icon: 'globe' },
  'ST-04': { value: '69.5%', label: 'of businesses that reach year five go on to reach year ten (average of the years 1994 to 2022)', source: SOURCES.sba, icon: 'globe' },
  'ST-05': { value: '42 months', label: 'of paying wages before a business is counted as established', source: SOURCES.gem, icon: 'calendar' },
  'ST-07': { value: '7.5%', label: 'of 2021 U.S. business applications became employer businesses within two years', source: SOURCES.census, icon: 'checklist' },
  'ST-08': { value: '2.29 quarters', label: 'on average from application to first payroll, for 2021 applicants that hired', source: SOURCES.census, icon: 'clock' },
  'ST-40': { value: '56.3%', label: 'were still operating after three years (opened in the year to March 2022)', source: SOURCES.bls, icon: 'gate' },
};

export function stats(...ids: readonly StatId[]): readonly Stat[] {
  return ids.map((id) => STATS[id]);
}

/**
 * Share of private-sector establishments opened in the year to March 2015 still operating each March after (BLS BED Table 7, total
 * private). One opening-year group, so every point counts the same businesses.
 */
export const SURVIVAL_2015: SurvivalSeries = {
  label: 'All private industries, opened in the year to March 2015',
  points: [100, 79.6, 69.1, 61.4, 55.4, 50.2, 46.4, 43.6, 40.3, 37.4, 34.7].map((percent, year) => ({ year, percent })),
};

export const SURVIVAL_NOTE = 'Establishments with at least one employee. A closure is not always a failure: it includes sales and mergers.';

/**
 * The long-horizon timeline under Dream, Build and Grow: where the phases sit on the clock, anchored on the public figures. Years run
 * from the first month of the company; windows are typical, and a company's own plan sets its pace.
 */
export const CLOCK_MILESTONES: readonly Milestone[] = [
  { at: 0.08, label: 'Ignite', detail: 'First proof and the written plan' },
  { at: 0.57, label: 'First payroll, on average', detail: 'More than two quarters after applying', source: SOURCES.census },
  { at: 1, kind: 'survival', label: '77.9% still operating', source: SOURCES.bls },
  { at: 1.5, label: 'Launch', detail: 'Repeatable sales and product-market fit' },
  { at: 3, kind: 'survival', label: '56.3% still operating', source: SOURCES.bls },
  { at: 3.5, label: 'Established', detail: 'Forty-two months of paying wages', source: SOURCES.gem },
  { at: 5, kind: 'survival', label: '51.4% still operating', source: SOURCES.bls },
  { at: 5.5, label: 'Orbit', detail: 'Running steady; WE steps down by notice' },
  { at: 10, kind: 'survival', label: '34.7% still operating', source: SOURCES.bls },
];
