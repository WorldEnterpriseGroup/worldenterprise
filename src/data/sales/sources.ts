/**
 * The sources behind every statistic on the sales pages (WP-58, ORCHESTRATION "Sales direction adopted": all statistics come from the
 * SALES.md ST register with source citations). Each entry was fetched on 2026-10-14 and is recorded, with the verbatim quote that backs
 * each figure, in `.astro-magazine/sources/wp-58.json`. Pure data: no Astro imports, so `node --test` can check it.
 */

export type SalesSourceId =
  | 'bls-bed-total'
  | 'bls-bed-information'
  | 'bls-bed-professional'
  | 'sba-faq-2026'
  | 'census-bfs'
  | 'census-bfs-definitions'
  | 'gem-usa-2026'
  | 'cohen-hochberg-2014'
  | 'cb-insights-2026'
  | 'azoulay-2018'
  | 'gompers-2006'
  | 'kauffman-2025'
  | 'kauffman-2021'
  | 'fed-sbcs-2026';

export interface SalesSource {
  readonly id: SalesSourceId;
  /** The document's title as its publisher gives it. */
  readonly title: string;
  readonly publisher: string;
  /** The page that was fetched. Always https. */
  readonly url: string;
  /** The short citation used in a chart's source line. */
  readonly short: string;
  /** The UTC date of the fetch, as recorded in the sources ledger. */
  readonly accessed: string;
}

const ACCESSED = '2026-10-14';

export const SALES_SOURCES: readonly SalesSource[] = [
  {
    id: 'bls-bed-total',
    title: 'Business Employment Dynamics, Table 7: Survival of private sector establishments by opening year (total private)',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/bdm/us_age_naics_00_table7.txt',
    short: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7',
    accessed: ACCESSED,
  },
  {
    id: 'bls-bed-information',
    title: 'Business Employment Dynamics, Table 7: Survival of private sector establishments by opening year (Information, NAICS 51)',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/bdm/us_age_naics_51_table7.txt',
    short: 'BLS Business Employment Dynamics, Table 7, NAICS 51',
    accessed: ACCESSED,
  },
  {
    id: 'bls-bed-professional',
    title: 'Business Employment Dynamics, Table 7: Survival of private sector establishments by opening year (Professional, Scientific, and Technical Services, NAICS 54)',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/bdm/us_age_naics_54_table7.txt',
    short: 'BLS Business Employment Dynamics, Table 7, NAICS 54',
    accessed: ACCESSED,
  },
  {
    id: 'sba-faq-2026',
    title: 'Frequently Asked Questions About Small Business, 2026',
    publisher: 'U.S. Small Business Administration, Office of Advocacy',
    url: 'https://advocacy.sba.gov/wp-content/uploads/2026/02/FINAL_FAQsAboutSmallBusiness_2026_012826.pdf',
    short: 'SBA Office of Advocacy, Frequently Asked Questions About Small Business (2026)',
    accessed: ACCESSED,
  },
  {
    id: 'census-bfs',
    title: 'Business Formation Statistics, monthly data (CSV)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/econ/bfs/csv/bfs_monthly.csv',
    short: 'U.S. Census Bureau, Business Formation Statistics',
    accessed: ACCESSED,
  },
  {
    id: 'census-bfs-definitions',
    title: 'Business Formation Statistics: Definitions',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/econ/bfs/definitions.html',
    short: 'U.S. Census Bureau, Business Formation Statistics definitions',
    accessed: ACCESSED,
  },
  {
    id: 'gem-usa-2026',
    title: 'GEM USA 2025/2026 report coverage',
    publisher: 'Babson College',
    url: 'https://entrepreneurship.babson.edu/gem-usa-2026/',
    short: 'Global Entrepreneurship Monitor, U.S. report 2025/2026 (Babson College)',
    accessed: ACCESSED,
  },
  {
    id: 'cohen-hochberg-2014',
    title: 'Accelerating Startups: The Seed Accelerator Phenomenon (Cohen and Hochberg, 2014), Table 2',
    publisher: 'University of Colorado Boulder, Leeds School of Business (faculty copy)',
    url: 'https://leeds-faculty.colorado.edu/bhagat/Accelerators-Start-Ups.pdf',
    short: 'Cohen and Hochberg (2014)',
    accessed: ACCESSED,
  },
  {
    id: 'cb-insights-2026',
    title: 'The top reasons startups fail',
    publisher: 'CB Insights',
    url: 'https://www.cbinsights.com/research/report/startup-failure-reasons-top/',
    short: 'CB Insights (2026), venture-backed startups that shut down; more than one reason allowed',
    accessed: ACCESSED,
  },
  {
    id: 'azoulay-2018',
    title: 'Age and High-Growth Entrepreneurship (Azoulay, Jones, Kim and Miranda), NBER Working Paper 24489',
    publisher: 'National Bureau of Economic Research',
    url: 'https://www.nber.org/system/files/working_papers/w24489/w24489.pdf',
    short: 'Azoulay, Jones, Kim and Miranda, Age and High-Growth Entrepreneurship',
    accessed: ACCESSED,
  },
  {
    id: 'gompers-2006',
    title: 'Skill vs. Luck in Entrepreneurship and Venture Capital (Gompers, Kovner, Lerner and Scharfstein), NBER Working Paper 12592',
    publisher: 'National Bureau of Economic Research',
    url: 'https://www.nber.org/system/files/working_papers/w12592/w12592.pdf',
    short: 'Gompers, Kovner, Lerner and Scharfstein (venture-backed founders)',
    accessed: ACCESSED,
  },
  {
    id: 'kauffman-2025',
    title: 'National Report on Early-Stage Entrepreneurship in the United States: 2025',
    publisher: 'Ewing Marion Kauffman Foundation',
    url: 'https://indicators-new.kauffman.org/wp-content/uploads/sites/13/2026/05/2025-Early-Stage-Entrepreneurship-National-Report.pdf',
    short: 'Kauffman Indicators of Entrepreneurship, National Report (2025)',
    accessed: ACCESSED,
  },
  {
    id: 'kauffman-2021',
    title: 'Trends in Entrepreneurship: Who Is the Entrepreneur? 1996 to 2021',
    publisher: 'Ewing Marion Kauffman Foundation',
    url: 'https://www.kauffman.org/wp-content/uploads/2022/10/Kauffman_Trends-in-Entrepreneurship-Who-Is-The-Entrepreneur-2021.pdf',
    short: 'Kauffman, Who Is the Entrepreneur? (2022)',
    accessed: ACCESSED,
  },
  {
    id: 'fed-sbcs-2026',
    title: 'Small Business Credit Survey: 2026 Report on Employer Firms',
    publisher: 'Federal Reserve Banks',
    url: 'https://www.fedsmallbusiness.org/-/media/project/clevelandfedtenant/fsbsite/reports/2026/2026-report-on-employer-firms/2026-report-on-employer-firms.pdf',
    short: 'Federal Reserve Banks, Small Business Credit Survey (2026 report on employer firms)',
    accessed: ACCESSED,
  },
];

const BY_ID: ReadonlyMap<SalesSourceId, SalesSource> = new Map(SALES_SOURCES.map((s) => [s.id, s]));

export function salesSource(id: SalesSourceId): SalesSource {
  const source = BY_ID.get(id);
  if (source === undefined) throw new Error(`Unknown sales source "${id}"`);
  return source;
}

/** The sources a page cites, in first-use order, without repeats. */
export function sourcesFor(ids: readonly SalesSourceId[]): readonly SalesSource[] {
  return [...new Set(ids)].map(salesSource);
}

/** The anchor of a source in a page's sources list (SourcesList renders `source-<id>`). */
export const sourceAnchor = (id: SalesSourceId): string => `#source-${id}`;
