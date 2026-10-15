import type { DatasetSourceId } from './types.ts';

/**
 * Mean founder age at founding by growth tier, from Table 5 of Azoulay, Jones, Kim and Miranda (NBER WP 24489; AER: Insights 2020).
 * Firms founded 2007 to 2009; growth is employment five years after founding. Copied as printed: mean age, standard deviation, founder count.
 */
export const AZOULAY_SOURCE: DatasetSourceId = 'azoulay-2018';

export interface AgeTier {
  readonly tier: string;
  readonly mean: number;
  readonly sd: number;
  readonly founders: number;
}

/** Panel A, "US (entire)". */
export const FOUNDER_AGE_BY_TIER: readonly AgeTier[] = [
  { tier: 'All startups', mean: 41.8, sd: 11.9, founders: 1079000 },
  { tier: 'Fastest-growing 10%', mean: 41.6, sd: 11.5, founders: 126000 },
  { tier: 'Fastest-growing 5%', mean: 42.1, sd: 11.5, founders: 62000 },
  { tier: 'Fastest-growing 1%', mean: 43.7, sd: 11.1, founders: 13000 },
  { tier: 'Fastest-growing 1 in 1,000', mean: 45.0, sd: 10.7, founders: 1700 },
  { tier: 'Successful exit (IPO or acquisition)', mean: 46.7, sd: 10.6, founders: 4000 },
];

export interface AgeSegment {
  readonly segment: string;
  /** Mean age of all startups' founders in the segment. */
  readonly allStartups: number;
  /** Mean age of the founders of the segment's fastest-growing 1 in 1,000 firms. */
  readonly topTenth: number;
  /** Mean age of the founders of firms that exited by IPO or acquisition. */
  readonly exited: number;
}

/** Panels A and B, every row, as printed. */
export const FOUNDER_AGE_BY_SEGMENT: readonly AgeSegment[] = [
  { segment: 'United States', allStartups: 41.8, topTenth: 45.0, exited: 46.7 },
  { segment: 'California', allStartups: 41.4, topTenth: 43.5, exited: 46.6 },
  { segment: 'Massachusetts', allStartups: 41.7, topTenth: 43.2, exited: 47.7 },
  { segment: 'New York', allStartups: 41.5, topTenth: 44.2, exited: 46.2 },
  { segment: 'Silicon Valley', allStartups: 41.7, topTenth: 44.3, exited: 47.2 },
  { segment: 'Entrepreneurial hubs', allStartups: 41.2, topTenth: 42.6, exited: 46.7 },
  { segment: 'Technology employment', allStartups: 43.2, topTenth: 45.9, exited: 48.4 },
  { segment: 'Venture-backed firms', allStartups: 42.4, topTenth: 43.4, exited: 47.9 },
  { segment: 'Patenting firms', allStartups: 44.4, topTenth: 46.2, exited: 49.3 },
];
