import type { DatasetSourceId } from './types.ts';

/**
 * Single figures quoted from Carta's State of Private Markets: Q1 2026 (published 2026-05-29), and two other published figures on how long
 * the early years last. Each is quoted as the publisher prints it; none is recomputed, and no Carta dataset is re-hosted.
 */
export interface Milestone {
  readonly id: string;
  readonly label: string;
  /** Where the bar or marker starts, in years. */
  readonly start: number;
  /** Where it ends, in years. Equal to start for a marker. */
  readonly end: number;
  readonly kind: 'span' | 'point';
  readonly group: 'formation' | 'funding' | 'survival' | 'shutdown';
  /** The printed figure, as words. */
  readonly figure: string;
  readonly source: DatasetSourceId;
}

/** Quarters to first payroll, 2021 applications that formed within eight quarters (BFS BF_DUR8Q): 2.29 quarters. */
export const QUARTERS_TO_PAYROLL_2021 = 2.29;

export const MILESTONES: readonly Milestone[] = [
  { id: 'payroll', label: 'Application to first payroll (businesses that hired within two years)', start: 0, end: QUARTERS_TO_PAYROLL_2021 / 4, kind: 'span', group: 'formation', figure: '2.29 quarters on average, 2021 applications', source: 'census-bfs-monthly' },
  { id: 'established', label: 'Until a business counts as established', start: 0, end: 3.5, kind: 'span', group: 'formation', figure: 'More than three and a half years old', source: 'gem-us-2020' },
  { id: 'seed-a', label: 'Seed to Series A (median gap)', start: 0, end: 2.0, kind: 'span', group: 'funding', figure: '2.0 years', source: 'carta-spm-q1-2026' },
  { id: 'a-b', label: 'Series A to Series B (median gap)', start: 0, end: 2.1, kind: 'span', group: 'funding', figure: '2.1 years', source: 'carta-spm-q1-2026' },
  { id: 'b-c', label: 'Series B to Series C (median gap)', start: 0, end: 2.4, kind: 'span', group: 'funding', figure: '2.4 years', source: 'carta-spm-q1-2026' },
  { id: 'age-a', label: 'Median company age raising a Series A', start: 2.8, end: 2.8, kind: 'point', group: 'funding', figure: '2.8 years old', source: 'carta-spm-q1-2026' },
  { id: 'age-d', label: 'Median company age raising a Series D', start: 7.4, end: 7.4, kind: 'point', group: 'funding', figure: '7.4 years old', source: 'carta-spm-q1-2026' },
  { id: 'age-e', label: 'Median company age raising a Series E or later', start: 9.5, end: 9.5, kind: 'point', group: 'funding', figure: '9.5 years old', source: 'carta-spm-q1-2026' },
  { id: 'half', label: 'Half of new establishments gone (2015 opening-year group)', start: 5, end: 5, kind: 'point', group: 'survival', figure: '50.2% still operating at year 5', source: 'bls-bed-total' },
  { id: 'ten', label: 'Still operating at year 10 (2015 opening-year group)', start: 10, end: 10, kind: 'point', group: 'survival', figure: '34.7% still operating at year 10', source: 'bls-bed-total' },
  { id: 'runway', label: 'Last fundraise to shutdown, venture-backed companies that closed (median)', start: 0, end: 22 / 12, kind: 'span', group: 'shutdown', figure: '22 months', source: 'cb-insights-2026' },
];

/** Median dilution per round, Carta Q1 2026, percent (approximate, as the report prints: "approximately 19% at seed"). */
export const MEDIAN_DILUTION: readonly { readonly stage: string; readonly percent: number }[] = [
  { stage: 'Seed', percent: 19 },
  { stage: 'Series A', percent: 18 },
  { stage: 'Series B', percent: 13 },
  { stage: 'Series C', percent: 9.5 },
  { stage: 'Series D', percent: 4.9 },
];
