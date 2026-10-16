import type { DatasetSource, DatasetSourceId } from './types.ts';

/**
 * The sources behind every figure on /data/ (WP-35). Each was fetched on RETRIEVED by the writing session; `.astro-magazine/sources/wp-35.json`
 * holds the timestamps and tools. Figures are copied or arithmetically derived, never estimated, and a figure that could not be verified
 * is left out. Carta figures are quoted one by one (the report says "Reproduction prohibited"), never as a re-hosted dataset.
 */
export const RETRIEVED = '2026-10-15';

export const DATASET_SOURCES: readonly DatasetSource[] = [
  {
    id: 'bls-bed-total',
    title: 'Business Employment Dynamics, Table 7: Survival of private sector establishments by opening year (Total Private)',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/bdm/us_age_naics_00_table7.txt',
    published: 'Data through March 2025',
    retrieved: RETRIEVED,
    kind: 'official-statistics',
    short: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7',
    transformation:
      'Values are copied as printed: "Survival Rates Since Birth" and "Survival Rates of Previous Year\'s Survivors". Each opening-year group is the establishments that opened in the twelve months ended March of the year named. Ages are the number of Marches since opening.',
    caveats: [
      'The unit is the establishment (one location), not the firm: a new branch of an existing company counts as an opening.',
      'Private employer establishments only; businesses with no employees are not covered.',
      'An exit is not always a failure: closures include sales, mergers and voluntary closures of healthy businesses.',
    ],
  },
  {
    id: 'bls-bed-information',
    title: 'Business Employment Dynamics, Table 7: Survival of private sector establishments by opening year (Information, NAICS 51)',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/bdm/us_age_naics_51_table7.txt',
    published: 'Data through March 2025',
    retrieved: RETRIEVED,
    kind: 'official-statistics',
    short: 'BLS Business Employment Dynamics, Table 7, Information (NAICS 51)',
    transformation: 'Values are copied as printed ("Survival Rates Since Birth").',
    caveats: [
      'Information includes software publishers, telecommunications, media and data processing; it is not software alone.',
      'Industry cells are small, and a published curve can rise between two years (for example the 2002 opening-year group between years 20 and 21) when establishments are reclassified. Values are shown as published.',
    ],
  },
  {
    id: 'bls-bed-professional',
    title: 'Business Employment Dynamics, Table 7: Survival of private sector establishments by opening year (Professional, Scientific, and Technical Services, NAICS 54)',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/bdm/us_age_naics_54_table7.txt',
    published: 'Data through March 2025',
    retrieved: RETRIEVED,
    kind: 'official-statistics',
    short: 'BLS Business Employment Dynamics, Table 7, Professional and technical services (NAICS 54)',
    transformation: 'Values are copied as printed ("Survival Rates Since Birth").',
    caveats: ['Includes consulting, legal, accounting, design and computer systems design.'],
  },
  {
    id: 'census-bfs-monthly',
    title: 'Business Formation Statistics, monthly series (bfs_monthly.csv)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/econ/bfs/csv/bfs_monthly.csv',
    published: 'Release of 2026-10-14 (September 2026 data)',
    retrieved: RETRIEVED,
    kind: 'official-statistics',
    short: 'U.S. Census Bureau, Business Formation Statistics',
    transformation:
      'Annual totals are the sum of the twelve not-seasonally-adjusted monthly U.S. values of a series (BA_BA applications, BA_HBA high-propensity applications, BF_BF4Q and BF_BF8Q formations within four and eight quarters), by NAICS sector where the file gives one. Quarters to first payroll (BF_DUR4Q, BF_DUR8Q) are the mean of the twelve monthly values. Sector groups are sums of the file\'s sector codes.',
    caveats: [
      'The Census Bureau revises the series each year (next revision scheduled with the October 2026 release).',
      'An application is a request for an employer identification number, not a launched business; a formation is the first payroll.',
      'Duration is measured only for applications that formed an employer business within the window.',
    ],
  },
  {
    id: 'census-bfs-definitions',
    title: 'Business Formation Statistics: Definitions',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/econ/bfs/definitions.html',
    published: 'Current page',
    retrieved: RETRIEVED,
    kind: 'official-statistics',
    short: 'U.S. Census Bureau, Business Formation Statistics, definitions',
    transformation: 'Definitions only; no figures are taken from this page.',
    caveats: [],
  },
  {
    id: 'kauffman-2025',
    title: 'National Report on Early-Stage Entrepreneurship in the United States: 2025',
    publisher: 'Ewing Marion Kauffman Foundation (Robert W. Fairlie)',
    url: 'https://indicators-new.kauffman.org/wp-content/uploads/sites/13/2026/05/2025-Early-Stage-Entrepreneurship-National-Report.pdf',
    published: 'May 2026',
    retrieved: RETRIEVED,
    kind: 'research-foundation',
    short: 'Kauffman Indicators of Early-Stage Entrepreneurship, National Report 2025',
    transformation: 'Table 5 (rate of new entrepreneurs by age group, 1996 to 2025) is copied as printed.',
    caveats: [
      'The rate of new entrepreneurs is the percent of people aged 20 to 64 who do not own a business in one survey month and start one in the next with 15 or more hours worked a week.',
      'Estimates come from the Current Population Survey and include businesses with no employees.',
    ],
  },
  {
    id: 'kauffman-2021',
    title: 'Trends in Entrepreneurship: Who Is the Entrepreneur? 1996 to 2021',
    publisher: 'Ewing Marion Kauffman Foundation',
    url: 'https://www.kauffman.org/wp-content/uploads/2022/10/Kauffman_Trends-in-Entrepreneurship-Who-Is-The-Entrepreneur-2021.pdf',
    published: 'October 2022',
    retrieved: RETRIEVED,
    kind: 'research-foundation',
    short: 'Kauffman Foundation, Who Is the Entrepreneur? 1996 to 2021',
    transformation: 'Table 3 (share of new entrepreneurs by age group, 1996 to 2021) is copied as printed.',
    caveats: ['Current Population Survey estimates; the four age groups cover ages 20 to 64 only.'],
  },
  {
    id: 'azoulay-2018',
    title: 'Age and High-Growth Entrepreneurship (NBER Working Paper 24489; published in American Economic Review: Insights 2(1), 2020)',
    publisher: 'Azoulay, Jones, Kim and Miranda, National Bureau of Economic Research',
    url: 'https://www.nber.org/system/files/working_papers/w24489/w24489.pdf',
    published: 'April 2018 (working paper); March 2020 (AER: Insights)',
    retrieved: RETRIEVED,
    kind: 'peer-reviewed',
    short: 'Azoulay, Jones, Kim and Miranda, Age and High-Growth Entrepreneurship (NBER WP 24489; AER: Insights 2020)',
    transformation:
      'Table 5 (mean founder age, standard deviation and count by growth tier and region or type of firm) is copied as printed. A band drawn from the mean minus one standard deviation to the mean plus one is our arithmetic.',
    caveats: [
      'Table 5 covers firms founded 2007 to 2009; growth is employment five years after founding, so the "top 0.1%" tier is 1,700 founders.',
      'Successful exit means an IPO or an acquisition; those were about 0.15% of founders.',
      'Association, not a prediction for any one founder.',
    ],
  },
  {
    id: 'carta-spm-q1-2026',
    title: 'State of Private Markets: Q1 2026',
    publisher: 'Carta, Inc. (Carta Data)',
    url: 'https://carta.com/data/state-of-private-markets-q1-2026-full-report/',
    published: '2026-05-29',
    retrieved: RETRIEVED,
    kind: 'industry-report',
    short: 'Carta, State of Private Markets: Q1 2026',
    transformation: 'Single figures are quoted as the report prints them (medians of U.S. venture-backed companies on Carta). Nothing is re-hosted, and no figure is recomputed.',
    caveats: [
      'Venture-backed companies on the Carta platform only, a small share of all new businesses.',
      'Medians describe companies that raised the next round; companies that did not are not in them.',
    ],
    usage: 'The report is marked "Reproduction prohibited". WE quotes specific figures with attribution and re-hosts no dataset.',
  },
  {
    id: 'cb-insights-2026',
    title: 'The top reasons startups fail',
    publisher: 'CB Insights',
    url: 'https://www.cbinsights.com/research/report/startup-failure-reasons-top/',
    published: '2026-03-05',
    retrieved: RETRIEVED,
    kind: 'industry-report',
    short: 'CB Insights, The top reasons startups fail (2026)',
    transformation: 'The median of 22 months from last fundraise to shutdown is quoted as printed.',
    caveats: ['431 venture-backed companies that publicly shut down since 2023; self-reported post-mortems.'],
  },
  {
    id: 'sba-faq-2026',
    title: 'Frequently Asked Questions About Small Business 2026',
    publisher: 'U.S. Small Business Administration, Office of Advocacy',
    url: 'https://advocacy.sba.gov/wp-content/uploads/2026/02/FINAL_FAQsAboutSmallBusiness_2026_012826.pdf',
    published: 'February 2026',
    retrieved: RETRIEVED,
    kind: 'official-statistics',
    short: 'U.S. SBA Office of Advocacy, Frequently Asked Questions About Small Business 2026',
    transformation: 'Averages for opening years 1994 to 2022 are quoted as printed.',
    caveats: ['Averages across opening-year groups, from the same BLS survival tables.'],
  },
  {
    id: 'gem-us-2020',
    title: 'Global Entrepreneurship Monitor, United States Report 2019/2020',
    publisher: 'Babson College, Global Entrepreneurship Monitor',
    url: 'https://www.babson.edu/media/babson/assets/global-entrepreneurship-monitor/GEM-2019-2020-US-Report.pdf',
    published: '2020',
    retrieved: RETRIEVED,
    kind: 'research-foundation',
    short: 'Global Entrepreneurship Monitor, United States Report 2019/2020',
    transformation: 'The age at which a business counts as established ("more than three and a half years old") is quoted; 3.5 years is the same figure as 42 months.',
    caveats: ['A definition used for counting, not an outcome.'],
  },
];

const BY_ID: ReadonlyMap<DatasetSourceId, DatasetSource> = new Map(DATASET_SOURCES.map((s) => [s.id, s]));

export function datasetSource(id: DatasetSourceId): DatasetSource {
  const source = BY_ID.get(id);
  if (source === undefined) throw new Error(`Unknown dataset source "${id}"`);
  return source;
}

/** The anchor of a source's entry in the page's "Sources and method" list. */
export const sourceAnchor = (id: DatasetSourceId): string => `#source-${id}`;
