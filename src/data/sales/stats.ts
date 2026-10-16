import type { SalesSourceId } from './sources.ts';

/**
 * The statistics the sales pages quote, keyed by their SALES.md register id (ST-nn). Values are exactly as the source prints them, or
 * derived from the source's own data where `derived` says how. They describe the market, never WE's results (SALES.md section 3).
 *
 * Not used, and why (recorded in the WP-58 handoff): ST-09 (the Carta page fetched on 2026-10-14 no longer prints the figure),
 * ST-13, ST-14 and ST-15 (the papers could not be fetched in the writing session), ST-20 and the 5.7% of ST-28 (Census API tables, not
 * a quotable page), ST-37 (secondary).
 */
export type StatId =
  | 'ST-01' | 'ST-02' | 'ST-03' | 'ST-04' | 'ST-05' | 'ST-06' | 'ST-07' | 'ST-08' | 'ST-10' | 'ST-11'
  | 'ST-16' | 'ST-17' | 'ST-18' | 'ST-19' | 'ST-21' | 'ST-27' | 'ST-28' | 'ST-29' | 'ST-33' | 'ST-34' | 'ST-35';

export interface SalesStat {
  readonly id: StatId;
  /** The figure as shown on a tile. */
  readonly value: string;
  /** What the figure counts, in one line. */
  readonly label: string;
  readonly sources: readonly SalesSourceId[];
  /** The year or group the figure describes. */
  readonly period: string;
  /** How WE computed it from the source's data, when it is not printed as is. */
  readonly derived?: string;
  /** A limit on what the figure says, shown wherever the figure is. */
  readonly caveat?: string;
}

export const STATS: Readonly<Record<StatId, SalesStat>> = {
  'ST-01': { id: 'ST-01', value: '77.9%', label: 'of new U.S. establishments were still operating after one year', sources: ['bls-bed-total'], period: 'Opened in the year to March 2024' },
  'ST-02': { id: 'ST-02', value: '51.4%', label: 'were still operating after five years', sources: ['bls-bed-total'], period: 'Opened in the year to March 2020' },
  'ST-03': { id: 'ST-03', value: '34.7%', label: 'were still operating after ten years', sources: ['bls-bed-total'], period: 'Opened in the year to March 2015' },
  'ST-04': { id: 'ST-04', value: '69.5%', label: 'of businesses that reach five years also reach ten', sources: ['sba-faq-2026'], period: '1994 to 2022 average' },
  'ST-05': { id: 'ST-05', value: '42 months', label: 'before GEM counts a business as established (3.5 years)', sources: ['gem-usa-2026'], period: 'Definition' },
  'ST-06': {
    id: 'ST-06', value: '5,671,836', label: 'U.S. business applications in 2025, the most in any year of the series', sources: ['census-bfs'], period: '2025',
    derived: 'Sum of the twelve monthly values, not seasonally adjusted (series BA_BA). The Census Bureau revises the series each year.',
  },
  'ST-07': {
    id: 'ST-07', value: '7.5%', label: 'of 2021 applications became employer businesses within two years', sources: ['census-bfs', 'census-bfs-definitions'], period: 'Applications filed in 2021',
    derived: '403,072 formations within eight quarters (BF_BF8Q) out of 5,390,816 applications (BA_BA), monthly values summed.',
  },
  'ST-08': {
    id: 'ST-08', value: '2.29 quarters', label: 'from application to first payroll in 2021, against 1.48 in 2005', sources: ['census-bfs', 'census-bfs-definitions'], period: '2021 and 2005 applications',
    derived: 'Mean of the twelve monthly values of DUR8Q, for applications that formed within eight quarters.',
  },
  'ST-10': { id: 'ST-10', value: '3 months', label: 'is the usual length of a fixed-term program; incubation runs 1 to 5 years', sources: ['cohen-hochberg-2014'], period: 'Typology, 2014' },
  'ST-11': {
    id: 'ST-11', value: '70%', label: 'of venture-backed startups that shut down cited running out of capital', sources: ['cb-insights-2026'], period: 'Shutdowns since 2023',
    caveat: 'Venture-backed startups only. A company could give more than one reason.',
  },
  'ST-16': { id: 'ST-16', value: '45.0', label: 'mean founder age of the fastest-growing 1 in 1,000 new U.S. firms (41.9 for all that hire)', sources: ['azoulay-2018'], period: 'Founders of 2007 to 2009 (41.9 covers 2007 to 2014)' },
  'ST-17': { id: 'ST-17', value: '1.8x', label: 'as likely: a 50-year-old founder against a 30-year-old, for top-growth firms', sources: ['azoulay-2018'], period: 'Founders of 2007 to 2014' },
  'ST-18': { id: 'ST-18', value: '0.26%', label: 'top-growth rate with 3+ years in the same industry, against 0.11% with none', sources: ['azoulay-2018'], period: 'Founders of 2007 to 2009' },
  'ST-19': {
    id: 'ST-19', value: '30%', label: 'success rate after a prior success, against 22% after a failure and 21% for first-timers', sources: ['gompers-2006'], period: 'Venture-backed founders',
    caveat: 'Venture-backed founders only; success means the company went public.',
  },
  'ST-21': { id: 'ST-21', value: '0.60%', label: 'of immigrant adults started a business each month, against 0.30% of U.S.-born adults', sources: ['kauffman-2025'], period: '2025' },
  'ST-27': { id: 'ST-27', value: '22.8%', label: 'of new entrepreneurs were aged 55 to 64 in 2021, up from 14.8% in 1996', sources: ['kauffman-2021'], period: '1996 and 2021' },
  'ST-28': { id: 'ST-28', value: 'More than 1 in 5', label: 'Americans aged 18 to 34 are starting or running a new business, as reported by the GEM U.S. survey', sources: ['gem-usa-2026'], period: '2025/2026' },
  'ST-29': {
    id: 'ST-29', value: '16.7%', label: 'of new entrepreneurs started out of necessity in 2025, down from 30.2% in 2020', sources: ['kauffman-2025'], period: '2020 and 2025',
    derived: '100% minus the opportunity share the report prints (83.3% in 2025, 69.8% in 2020).',
  },
  'ST-33': {
    id: 'ST-33', value: '48%', label: 'of firms aged 0 to 5 years were fully approved for financing, against 63% of firms aged 21 or more', sources: ['fed-sbcs-2026'], period: 'Applicants in the prior 12 months',
    caveat: 'A survey of employer firms, weighted to the population; firms that closed are not surveyed.',
  },
  'ST-34': { id: 'ST-34', value: '94.4%', label: 'of establishments still open after eight years survived their ninth, against 79.6% in their first', sources: ['bls-bed-total'], period: 'Opened in the year to March 2013' },
  'ST-35': { id: 'ST-35', value: '45.7%', label: 'of Information-sector establishments survived five years (50.8% in professional and technical services)', sources: ['bls-bed-information', 'bls-bed-professional'], period: 'Opened in the year to March 2020' },
};

export function stat(id: StatId): SalesStat {
  return STATS[id];
}
