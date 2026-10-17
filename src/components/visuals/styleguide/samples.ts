/**
 * Sample data for the styleguide's visuals section. Every figure is a real, sourced statistic (redesign kit research/timeline-stats,
 * compiled 2026-10-14, status VERIFIED or DERIVED from verified data) so the samples model what the sales pages will publish: a figure,
 * what it measures, who published it and when. Pages own their own data; nothing imports this file outside the styleguide.
 */
import type { Milestone, Stat, StatSource, SurvivalSeries, Datum } from '../contracts.ts';

export const BLS_BED: StatSource = {
  label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, establishment survival (Table 7)',
  href: 'https://www.bls.gov/bdm/bdmage.htm',
  period: 'establishments opened in the year to March 2015, data through March 2025',
};

export const SBA_FAQ: StatSource = {
  label: 'SBA Office of Advocacy, Frequently Asked Questions About Small Business 2026 (from BLS data, 1994 to 2022 averages)',
  href: 'https://advocacy.sba.gov/wp-content/uploads/2026/02/FINAL_FAQsAboutSmallBusiness_2026_012826.pdf',
};

export const BLS_LATEST: StatSource = {
  label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics',
  href: 'https://www.bls.gov/bdm/bdmage.htm',
  period: 'establishments opened in the year to March 2024',
};

export const CENSUS_BFS: StatSource = {
  label: 'U.S. Census Bureau, Business Formation Statistics (sum of monthly, not seasonally adjusted)',
  href: 'https://www.census.gov/econ/bfs/',
  period: '2025',
};

export const CENSUS_BFS_DURATION: StatSource = {
  label: 'U.S. Census Bureau, Business Formation Statistics, average time from application to first payroll',
  href: 'https://www.census.gov/econ/bfs/definitions.html',
  period: 'applications filed in 2021 that hired within eight quarters',
};

export const GEM: StatSource = {
  label: 'Global Entrepreneurship Monitor, definition of an established business',
  href: 'https://entrepreneurship.babson.edu/gem-usa-2026',
};

export const AZOULAY: StatSource = {
  label: 'Azoulay, Jones, Kim and Miranda, Age and High-Growth Entrepreneurship, AER: Insights 2(1)',
  href: 'https://www.aeaweb.org/articles?id=10.1257/aeri.20180582',
  period: 'U.S. founders of firms that hire, 2007 to 2014',
};

export const SBCS: StatSource = {
  label: 'Federal Reserve Banks, Small Business Credit Survey, 2026 Report on Employer Firms',
  href: 'https://www.fedsmallbusiness.org/-/media/project/clevelandfedtenant/fsbsite/reports/2026/2026-report-on-employer-firms/2026-report-on-employer-firms.pdf',
  period: '2025 survey',
};

export const SURVIVAL: readonly SurvivalSeries[] = [
  {
    label: 'All private industries',
    points: [100, 79.6, 69.1, 61.4, 55.4, 50.2, 46.4, 43.6, 40.3, 37.4, 34.7].map((percent, year) => ({ year, percent })),
  },
  {
    label: 'Professional, scientific and technical services',
    points: [100, 81.6, 71.2, 63.0, 56.0, 50.3, 46.9, 43.2, 40.0, 37.2, 34.3].map((percent, year) => ({ year, percent })),
  },
  {
    label: 'Information, including software publishing',
    points: [100, 80.8, 70.0, 60.8, 53.3, 46.8, 42.6, 38.6, 35.4, 33.0, 30.0].map((percent, year) => ({ year, percent })),
  },
];

export const STATS: readonly Stat[] = [
  { value: '5.67 million', label: 'Applications to start a U.S. business in 2025, the highest year on record', source: CENSUS_BFS, icon: 'document' },
  { value: '49.2%', label: 'Share of new establishments still operating five years after opening', source: SBA_FAQ, icon: 'gate' },
  { value: '33.9%', label: 'Share still operating after ten years', source: SBA_FAQ, icon: 'clock' },
  { value: '41.9', label: 'Average age of founders of U.S. firms that hire', source: AZOULAY, icon: 'team' },
];

export const CHALLENGES: readonly Datum[] = [
  { label: 'Higher costs of goods, services or wages', value: 73, display: '73%' },
  { label: 'Paying operating expenses', value: 54, display: '54%' },
  { label: 'Uneven cash flow', value: 50, display: '50%' },
  { label: 'Weak sales', value: 48, display: '48%' },
  { label: 'Costs from tariffs', value: 42, display: '42%' },
  { label: 'Debt payments or interest rates', value: 33, display: '33%' },
];

export const PROFITABILITY: readonly Datum[] = [
  { label: 'Operating at a profit', value: 47, display: '47%' },
  { label: 'Breaking even', value: 19, display: '19%' },
  { label: 'Operating at a loss', value: 34, display: '34%' },
];

export const TIMELINE: readonly Milestone[] = [
  { at: 0.57, label: 'First payroll', detail: 'Average for new applicants who hire within two years', source: CENSUS_BFS_DURATION },
  { at: 3.5, label: 'An established business', detail: 'After 42 months of paying wages', source: GEM },
  { at: 1, kind: 'survival', label: '77.9% still operating', detail: 'One year after opening', source: BLS_LATEST },
  { at: 2, kind: 'survival', label: '67.7% still operating', detail: 'Two years', source: SBA_FAQ },
  { at: 5, kind: 'survival', label: '49.2% still operating', detail: 'Five years', source: SBA_FAQ },
  { at: 10, kind: 'survival', label: '33.9% still operating', detail: 'Ten years', source: SBA_FAQ },
];
