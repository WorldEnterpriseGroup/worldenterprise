import type { StatSource } from '../../components/visuals/contracts.ts';

/**
 * The public sources behind the insight figures that WP-26 fetched itself (wave 11, issue #92). Every record matches a fetch in
 * `.astro-magazine/sources/wp-26.json`, with the same id and URL; tests/unit/wp-26 keeps the two in step. Figures reused from the /data/ hub
 * cite WP-35's registry (src/data/datasets/sources.ts) instead, and their fetches are in wp-35.json.
 *
 * Values are copied as published or derived by plain arithmetic that the figure states; nothing is estimated.
 */
export const RETRIEVED_WP26 = '2026-10-16';

export type InsightSourceId =
  | 'census-bds-2023-fa'
  | 'census-bds-2023-fz'
  | 'census-bds-2023-sec-fa'
  | 'census-bds-2023-economy'
  | 'census-bds-faq'
  | 'census-btos-national'
  | 'census-ai-use-story'
  | 'nist-ai-rmf'
  | 'owasp-llm-2025'
  | 'bls-tenure-2026'
  | 'bls-alternative-2023';

export interface InsightSource {
  readonly id: InsightSourceId;
  readonly title: string;
  readonly publisher: string;
  /** The exact page or file fetched. Always https. */
  readonly url: string;
  /** The period the figures describe, as the source line prints it. */
  readonly period: string;
  /** The short citation used in a figure's source line. */
  readonly short: string;
}

export const INSIGHT_SOURCES: readonly InsightSource[] = [
  {
    id: 'census-bds-2023-fa',
    title: 'Business Dynamics Statistics, firm age table (bds2023_fa.csv)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www2.census.gov/programs-surveys/bds/tables/time-series/2023/bds2023_fa.csv',
    period: '1978 to 2023',
    short: 'U.S. Census Bureau, Business Dynamics Statistics, firm age',
  },
  {
    id: 'census-bds-2023-fz',
    title: 'Business Dynamics Statistics, firm size table (bds2023_fz.csv)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www2.census.gov/programs-surveys/bds/tables/time-series/2023/bds2023_fz.csv',
    period: '2023',
    short: 'U.S. Census Bureau, Business Dynamics Statistics, firm size',
  },
  {
    id: 'census-bds-2023-sec-fa',
    title: 'Business Dynamics Statistics, sector by firm age table (bds2023_sec_fa.csv)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www2.census.gov/programs-surveys/bds/tables/time-series/2023/bds2023_sec_fa.csv',
    period: '2023',
    short: 'U.S. Census Bureau, Business Dynamics Statistics, sector by firm age',
  },
  {
    id: 'census-bds-2023-economy',
    title: 'Business Dynamics Statistics, economy-wide table (bds2023.csv)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www2.census.gov/programs-surveys/bds/tables/time-series/2023/bds2023.csv',
    period: '2023',
    short: 'U.S. Census Bureau, Business Dynamics Statistics, economy-wide',
  },
  {
    id: 'census-bds-faq',
    title: 'BDS FAQ',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/programs-surveys/bds/about/faq.html',
    period: 'current page',
    short: 'U.S. Census Bureau, BDS FAQ',
  },
  {
    id: 'census-btos-national',
    title: 'Business Trends and Outlook Survey, national estimates (National.xlsx)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/hfp/btos/downloads/National.xlsx',
    period: 'November 17, 2025 to October 4, 2026',
    short: 'U.S. Census Bureau, Business Trends and Outlook Survey',
  },
  {
    id: 'census-ai-use-story',
    title: 'Large Firms With at Least 20 Employees Biggest AI Users (America Counts, May 26, 2026)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/library/stories/2026/05/ai-use-businesses.html',
    period: 'data collected to May 3, 2026',
    short: 'U.S. Census Bureau, AI Use at U.S. Businesses (Business Trends and Outlook Survey)',
  },
  {
    id: 'nist-ai-rmf',
    title: 'Artificial Intelligence Risk Management Framework (AI RMF 1.0), NIST AI 100-1',
    publisher: 'National Institute of Standards and Technology',
    url: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    period: 'January 2023, Tables 1 to 4',
    short: 'NIST, AI Risk Management Framework 1.0 (NIST AI 100-1)',
  },
  {
    id: 'owasp-llm-2025',
    title: 'OWASP Top 10 for LLM Applications 2025',
    publisher: 'OWASP Gen AI Security Project',
    url: 'https://genai.owasp.org/llm-top-10/',
    period: '2025 list',
    short: 'OWASP Gen AI Security Project, Top 10 for LLM Applications 2025',
  },
  {
    id: 'bls-tenure-2026',
    title: 'Employee Tenure, Table 1: Median years of tenure with current employer by age and sex',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/news.release/tenure.t01.htm',
    period: 'January 2026',
    short: 'U.S. Bureau of Labor Statistics, Employee Tenure, Table 1',
  },
  {
    id: 'bls-alternative-2023',
    title: 'Contingent and Alternative Employment Arrangements, July 2023',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/news.release/conemp.nr0.htm',
    period: 'July 2023',
    short: 'U.S. Bureau of Labor Statistics, Contingent and Alternative Employment Arrangements',
  },
];

export function insightSource(id: InsightSourceId): InsightSource {
  const found = INSIGHT_SOURCES.find((s) => s.id === id);
  if (found === undefined) throw new Error(`insight-figures: unknown source "${id}"`);
  return found;
}

/** The source line entry for a figure. */
export const sourceLine = (id: InsightSourceId): StatSource => {
  const s = insightSource(id);
  return { label: s.short, href: s.url, period: s.period };
};
