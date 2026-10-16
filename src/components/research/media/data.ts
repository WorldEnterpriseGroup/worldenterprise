/**
 * WP-23 (issue #89): the sourced figures the reference families show (fundability, research, briefs, playbooks). Pages render these
 * values and never retype a number. Every figure maps to a register id (SALES.md ST-01 to ST-41, `.astro-magazine/plans/wave9/statistics.json`)
 * or to a figure verified for this package and recorded in `.astro-magazine/sources/wp-23.json` (ids `W23-*`).
 *
 * Population figures describe new U.S. businesses, venture-backed companies, web home pages or breach datasets. None is a result of
 * WE's work, and every block that prints them says so (HONESTY lines below).
 */
import type { Datum, Milestone, Stat, StatSource, SurvivalSeries } from '../../visuals/contracts.ts';

/** Under every block of population statistics (SITE-COPY rule 5). */
export const HONESTY_BUSINESSES = "These figures describe all new U.S. businesses, not WE's results.";
/** Under venture and lending figures. */
export const HONESTY_MARKET = "These figures describe the wider market, not WE's results.";
/** Under the web accessibility and breach figures. */
export const HONESTY_INDUSTRY = "These figures describe the wider industry, not WE's results.";
/** Under figures from journal studies of founders. */
export const HONESTY_STUDIES = "These figures describe the founders in each study, not WE's results.";
/** Claim C-05, required next to any funding visual. */
export const NO_FUNDING = 'WE makes no promise of funding.';

export const SOURCES = {
  /** ST-01, ST-02, ST-03, ST-40 and the survival curves. */
  bls: {
    label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7',
    href: 'https://www.bls.gov/bdm/us_age_naics_00_table7.txt',
    period: 'March 2025 release',
  },
  /** ST-35, NAICS 51. */
  blsInfo: {
    label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7, Information (NAICS 51)',
    href: 'https://www.bls.gov/bdm/us_age_naics_51_table7.txt',
    period: 'March 2025 release',
  },
  /** ST-35, NAICS 54. */
  blsPro: {
    label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7, Professional and technical services (NAICS 54)',
    href: 'https://www.bls.gov/bdm/us_age_naics_54_table7.txt',
    period: 'March 2025 release',
  },
  /** ST-06, ST-07, ST-08. */
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
    label: 'U.S. Small Business Administration, Office of Advocacy, Frequently Asked Questions About Small Business',
    href: 'https://advocacy.sba.gov/wp-content/uploads/2026/02/FINAL_FAQsAboutSmallBusiness_2026_012826.pdf',
    period: '2026',
  },
  /** ST-09 and W23-01 to W23-03. */
  carta: {
    label: 'Carta, State of Private Markets: Q1 2026',
    href: 'https://carta.com/data/state-of-private-markets-q1-2026-full-report/',
    period: 'Q1 2026',
  },
  /** ST-11 and W23-04. */
  cbi: {
    label: 'CB Insights, The top reasons startups fail',
    href: 'https://www.cbinsights.com/research/report/startup-failure-reasons-top/',
    period: 'published March 5, 2026',
  },
  /** ST-33 (corrected, W23-05) and W23-06. */
  sbcs: {
    label: 'Federal Reserve Banks, Small Business Credit Survey, 2026 Report on Employer Firms',
    href: 'https://www.fedsmallbusiness.org/-/media/project/clevelandfedtenant/fsbsite/reports/2026/2026-report-on-employer-firms/2026-report-on-employer-firms.pdf',
    period: '2025 survey',
  },
  /** W23-07 to W23-09. */
  webaim: {
    label: 'WebAIM, The WebAIM Million',
    href: 'https://webaim.org/projects/million/',
    period: 'February 2026',
  },
  /** W23-10 to W23-14. */
  dbir: {
    label: 'Verizon, 2026 Data Breach Investigations Report, Executive Summary',
    href: 'https://www.verizon.com/business/resources/executivebriefs/2026-dbir-executive-summary.pdf',
    period: '2026 edition',
  },
  /** W23-11 (the 2025 and 2024 points of the third-party trend). */
  dbir2025: {
    label: 'Verizon, 2025 Data Breach Investigations Report news release',
    href: 'https://www.verizon.com/about/news/2025-data-breach-investigations-report',
    period: '2025 edition',
  },
  /** ST-16 to ST-18. */
  azoulay: {
    label: 'Azoulay, Jones, Kim and Miranda, Age and High-Growth Entrepreneurship, American Economic Review: Insights',
    href: 'https://www.aeaweb.org/articles?id=10.1257/aeri.20180582',
    period: '2020',
  },
  /** ST-19. */
  gompers: {
    label: 'Gompers, Kovner, Lerner and Scharfstein, Performance persistence in entrepreneurship, Journal of Financial Economics',
    href: 'https://doi.org/10.1016/j.jfineco.2009.11.001',
    period: '2010',
  },
} as const satisfies Record<string, StatSource>;

// ---------------------------------------------------------------------------------------------------------------------------------
// The funding clock (Carta, Q1 2026; venture-backed companies only)
// ---------------------------------------------------------------------------------------------------------------------------------

/** W23-01: median time between primary rounds, in years. */
export const ROUND_GAPS: readonly Datum[] = [
  { label: 'Seed to Series A', value: 2.0, display: '2.0 years' },
  { label: 'Series A to Series B', value: 2.1, display: '2.1 years' },
  { label: 'Series B to Series C', value: 2.4, display: '2.4 years' },
];

/** ST-09 and W23-02: median company age when it raised the round, in years. */
export const AGE_AT_ROUND: readonly Datum[] = [
  { label: 'Series A', value: 2.8, display: '2.8 years' },
  { label: 'Series D', value: 7.4, display: '7.4 years' },
  { label: 'Series E and later', value: 9.5, display: '9.5 years' },
];

export const FUNDING_NOTE = 'Venture-backed U.S. companies on Carta only; most new businesses never raise venture money.';

/** The funding clock against the survival gates: where the median round falls on the life of a company. */
export const FUNDING_CLOCK: readonly Milestone[] = [
  { at: 1, kind: 'survival', label: '77.9% still operating', source: SOURCES.bls },
  { at: 2.8, label: 'Series A, at the median', detail: 'Age of a venture-backed company when it raises', source: SOURCES.carta },
  { at: 3.5, label: 'Established', detail: 'Forty-two months of paying wages', source: SOURCES.gem },
  { at: 5, kind: 'survival', label: '51.4% still operating', source: SOURCES.bls },
  { at: 7.4, label: 'Series D, at the median', detail: 'Most companies never reach this round', source: SOURCES.carta },
  { at: 9.5, label: 'Series E and later, at the median', detail: 'The private life of a venture-backed company', source: SOURCES.carta },
  { at: 10, kind: 'survival', label: '34.7% still operating', source: SOURCES.bls },
];

/** W23-03, derived: the seed-to-Series-A median (2.0 years) as a count of monthly updates. */
export const MONTHLY_UPDATES_BEFORE_A: Stat = {
  value: '24',
  label: 'monthly updates fit in the median gap between a seed round and a Series A (2.0 years times twelve)',
  source: SOURCES.carta,
  icon: 'report',
};

export const FUNDING_STATS: readonly Stat[] = [
  { value: '2.8 years', label: 'median age of a venture-backed company when it raises a Series A', source: SOURCES.carta, icon: 'clock' },
  { value: '2.0 years', label: 'median gap between a seed round and a Series A', source: SOURCES.carta, icon: 'calendar' },
  { value: '9.5 years', label: 'median age at a Series E or later round', source: SOURCES.carta, icon: 'globe' },
  { value: '48%', label: 'of loan applicants aged 0 to 5 years were fully approved for the financing they sought', source: SOURCES.sbcs, icon: 'gate' },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Lending (Federal Reserve Small Business Credit Survey, 2025 survey, employer firms)
// ---------------------------------------------------------------------------------------------------------------------------------

/** W23-05 (replaces the age bands of ST-33 with the report's own bands, page 18). */
export const APPROVAL_BY_AGE: readonly Datum[] = [
  { label: 'Firms aged 0 to 5', value: 48, display: '48%' },
  { label: 'Firms aged 6 to 20', value: 51, display: '51%' },
  { label: 'Firms aged 21 or more', value: 63, display: '63%' },
];

/** W23-06: share of loan, line of credit and cash advance applicants fully approved, by survey year (page 17). */
export const APPROVAL_BY_YEAR: readonly Datum[] = [
  { label: '2018 survey', value: 58, display: '58%' },
  { label: '2019 survey', value: 62, display: '62%' },
  { label: '2020 survey', value: 50, display: '50%' },
  { label: '2021 survey', value: 46, display: '46%' },
  { label: '2022 survey', value: 53, display: '53%' },
  { label: '2023 survey', value: 51, display: '51%' },
  { label: '2024 survey', value: 52, display: '52%' },
  { label: '2025 survey', value: 52, display: '52%' },
];

export const SBCS_NOTE = 'Employer firms with 1 to 499 employees that applied; a weighted convenience sample. Firms that already closed are not surveyed.';

// ---------------------------------------------------------------------------------------------------------------------------------
// Why venture-backed companies shut down (CB Insights, 2026)
// ---------------------------------------------------------------------------------------------------------------------------------

/** ST-11 (first two rows) and W23-04 (the next two). */
export const SHUTDOWN_REASONS: readonly Datum[] = [
  { label: 'Ran out of capital', value: 70, display: '70%' },
  { label: 'Poor product-market fit', value: 43, display: '43%' },
  { label: 'Bad timing or market conditions', value: 29, display: '29%' },
  { label: 'Unsustainable unit economics', value: 19, display: '19%' },
];

export const SHUTDOWN_NOTE = 'Venture-backed startups that shut down since 2023 with identifiable reasons; a company can give several, so the shares add up to more than 100%.';

// ---------------------------------------------------------------------------------------------------------------------------------
// The business clock (BLS, Census, GEM, SBA)
// ---------------------------------------------------------------------------------------------------------------------------------

export const BUSINESS_STATS: readonly Stat[] = [
  { value: '5.67 million', label: 'U.S. business applications in 2025, a record for the series', source: SOURCES.census, icon: 'document' },
  { value: '77.9%', label: 'of new U.S. businesses were still operating after one year (opened in the year to March 2024)', source: SOURCES.bls, icon: 'gate' },
  { value: '51.4%', label: 'were still operating after five years (opened in the year to March 2020)', source: SOURCES.bls, icon: 'clock' },
  { value: '34.7%', label: 'were still operating after ten years (opened in the year to March 2015)', source: SOURCES.bls, icon: 'globe' },
];

export const FORMATION_STATS: readonly Stat[] = [
  { value: '7.5%', label: 'of 2021 U.S. business applications became employer businesses within two years', source: SOURCES.census, icon: 'checklist' },
  { value: '2.29 quarters', label: 'on average from application to first payroll, for 2021 applicants that hired', source: SOURCES.census, icon: 'clock' },
  { value: '42 months', label: 'of paying wages before a business is counted as established', source: SOURCES.gem, icon: 'calendar' },
];

const curve = (label: string, values: readonly number[]): SurvivalSeries => ({ label, points: values.map((percent, year) => ({ year, percent })) });

/** Establishments opened in the year to March 2015 (BLS BED Table 7; kit research timeline-stats.json, recommended_primary_chart). */
export const SURVIVAL_2015: readonly SurvivalSeries[] = [
  curve('All private industries', [100, 79.6, 69.1, 61.4, 55.4, 50.2, 46.4, 43.6, 40.3, 37.4, 34.7]),
  curve('Information, including software', [100, 80.8, 70.0, 60.8, 53.3, 46.8, 42.6, 38.6, 35.4, 33.0, 30.0]),
  curve('Professional and technical services', [100, 81.6, 71.2, 63.0, 56.0, 50.3, 46.9, 43.2, 40.0, 37.2, 34.3]),
];

export const SURVIVAL_NOTE = 'Establishments with at least one employee, opened in the year to March 2015. A closure is not always a failure: it includes sales and mergers.';

export const TIMELINE_CLOCK: readonly Milestone[] = [
  { at: 0.57, label: 'First payroll, on average', detail: 'More than two quarters after applying', source: SOURCES.census },
  { at: 1, kind: 'survival', label: '77.9% still operating', source: SOURCES.bls },
  { at: 2, label: "7.5% have hired", detail: "Share of 2021 applications that were employers within two years", source: SOURCES.census },
  { at: 3, kind: 'survival', label: '56.3% still operating', source: SOURCES.bls },
  { at: 3.5, label: 'Established', detail: 'Forty-two months of paying wages', source: SOURCES.gem },
  { at: 5, kind: 'survival', label: '51.4% still operating', source: SOURCES.bls },
  { at: 10, kind: 'survival', label: '34.7% still operating', source: SOURCES.bls },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Founders (journal research)
// ---------------------------------------------------------------------------------------------------------------------------------

/** ST-19: share of venture-backed founders whose company succeeds, by track record. */
export const FOUNDER_TRACK_RECORD: readonly Datum[] = [
  { label: 'Founded a successful company before', value: 30, display: '30%' },
  { label: 'Last venture failed', value: 22, display: '22%' },
  { label: 'First-time founder', value: 21, display: '21%' },
];

/** ST-18: share reaching the top 0.1% of growth, in percent. */
export const INDUSTRY_EXPERIENCE: readonly Datum[] = [
  { label: 'Three or more years in the same industry', value: 0.26, display: '0.26%' },
  { label: 'No prior experience in the industry', value: 0.12, display: '0.12%' },
];

/** ST-16: average founder age, in years. */
export const FOUNDER_AGE: readonly Datum[] = [
  { label: 'Founders of the fastest-growing 0.1% of startups', value: 45, display: '45' },
  { label: 'Founders of all hiring startups', value: 41.9, display: '41.9' },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Web accessibility (WebAIM Million, February 2026)
// ---------------------------------------------------------------------------------------------------------------------------------

/** W23-08: the six most common detected failures, share of the top one million home pages. */
export const WCAG_FAILURES: readonly Datum[] = [
  { label: 'Low contrast text', value: 83.9, display: '83.9%' },
  { label: 'Missing alternative text for images', value: 53.1, display: '53.1%' },
  { label: 'Missing form input labels', value: 51, display: '51%' },
  { label: 'Empty links', value: 46.3, display: '46.3%' },
  { label: 'Empty buttons', value: 30.6, display: '30.6%' },
  { label: 'Missing document language', value: 13.5, display: '13.5%' },
];

export const WCAG_NOTE = 'Automated tests detect only part of WCAG; the share of pages that fully conform is lower still.';

/** W23-07 and W23-09. */
export const ACCESSIBILITY_STATS: readonly Stat[] = [
  { value: '95.9%', label: 'of the top one million home pages had detected WCAG 2 failures in 2026, up from 94.8% in 2025', source: SOURCES.webaim, icon: 'checklist' },
  { value: '56.1', label: 'detected accessibility errors per home page, on average', source: SOURCES.webaim, icon: 'data' },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Breaches (Verizon DBIR)
// ---------------------------------------------------------------------------------------------------------------------------------

/** W23-11: share of breaches with a third party involved, by report edition (2024 derived from "doubled to 30%"). */
export const THIRD_PARTY_TREND: readonly Datum[] = [
  { label: '2024 report', value: 15, display: '15%' },
  { label: '2025 report', value: 30, display: '30%' },
  { label: '2026 report', value: 48, display: '48%' },
];

export const DBIR_NOTE = 'Breaches in the Verizon dataset for each edition; the 2024 point is the 2025 release saying the share doubled to 30%.';

/** W23-10, W23-12 to W23-14. */
export const BREACH_STATS: readonly Stat[] = [
  { value: '31%', label: 'of breaches began with the exploitation of a vulnerability, now the most common way in', source: SOURCES.dbir, icon: 'gate' },
  { value: '62%', label: 'of breaches involved the human element', source: SOURCES.dbir, icon: 'team' },
  { value: '26%', label: 'of critical known-exploited vulnerabilities were fully fixed in 2025', source: SOURCES.dbir, icon: 'checklist' },
  { value: '43 days', label: 'median time to fully resolve a critical vulnerability, up from 32', source: SOURCES.dbir, icon: 'clock' },
];
