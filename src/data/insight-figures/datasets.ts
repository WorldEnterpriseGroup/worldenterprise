/**
 * Small published datasets behind the insight figures (WP-26), copied as printed from the sources in sources.ts. The BDS tables are in
 * bds.generated.ts because they are long. Pure data, so `node --test` can check every value (tests/unit/wp-26).
 */

/** One two-week Business Trends and Outlook Survey collection period. */
export interface BtosPeriod {
  /** The survey's period code (smpdt): ISO week year and fortnight. */
  readonly code: string;
  /** The collection dates, as words. */
  readonly label: string;
  /** Short axis label. */
  readonly tick: string;
  /** Percent of businesses that used AI in any business function in the last two weeks (question 7, "Yes"). */
  readonly used: number;
  /** Percent that expect to use AI in any business function in the next six months (question 24, "Yes"). */
  readonly expected: number;
}

/**
 * Census BTOS, National.xlsx, sheet "Response Estimates", questions 7 and 24, answer "Yes", every period since the question was reworded to
 * "any of its business functions" (collection from November 17, 2025). Dates are from the sheet "Collection and Reference Dates".
 */
export const BTOS_AI: readonly BtosPeriod[] = [
  { code: '202524', label: 'Nov 17 to 30, 2025', tick: 'Nov 2025', used: 17.3, expected: 21.1 },
  { code: '202525', label: 'Dec 1 to 14, 2025', tick: 'Dec', used: 17.2, expected: 20.9 },
  { code: '202526', label: 'Dec 15 to 28, 2025', tick: 'Dec', used: 17.8, expected: 21.3 },
  { code: '202601', label: 'Dec 29, 2025 to Jan 11, 2026', tick: 'Jan 2026', used: 17.7, expected: 22.4 },
  { code: '202602', label: 'Jan 12 to 25, 2026', tick: 'Jan', used: 18.2, expected: 22.1 },
  { code: '202603', label: 'Jan 26 to Feb 8, 2026', tick: 'Feb', used: 18.9, expected: 22.1 },
  { code: '202604', label: 'Feb 9 to 22, 2026', tick: 'Feb', used: 17.5, expected: 21.0 },
  { code: '202605', label: 'Feb 23 to Mar 8, 2026', tick: 'Mar', used: 18.2, expected: 21.8 },
  { code: '202606', label: 'Mar 9 to 22, 2026', tick: 'Mar', used: 18.9, expected: 22.3 },
  { code: '202607', label: 'Mar 23 to Apr 5, 2026', tick: 'Apr', used: 19.1, expected: 22.5 },
  { code: '202608', label: 'Apr 6 to 19, 2026', tick: 'Apr', used: 19.8, expected: 23.0 },
  { code: '202609', label: 'Apr 20 to May 3, 2026', tick: 'May 2026', used: 19.8, expected: 22.8 },
  { code: '202610', label: 'May 4 to 17, 2026', tick: 'May', used: 19.5, expected: 22.7 },
  { code: '202611', label: 'May 18 to 31, 2026', tick: 'May', used: 20.6, expected: 23.7 },
  { code: '202612', label: 'Jun 1 to 14, 2026', tick: 'Jun', used: 20.6, expected: 23.9 },
  { code: '202613', label: 'Jun 15 to 28, 2026', tick: 'Jun', used: 20.6, expected: 23.7 },
  { code: '202614', label: 'Jun 29 to Jul 12, 2026', tick: 'Jul', used: 21.7, expected: 24.5 },
  { code: '202615', label: 'Jul 13 to 26, 2026', tick: 'Jul', used: 21.5, expected: 24.3 },
  { code: '202616', label: 'Jul 27 to Aug 9, 2026', tick: 'Aug', used: 21.8, expected: 25.9 },
  { code: '202617', label: 'Aug 10 to 23, 2026', tick: 'Aug', used: 22.4, expected: 25.9 },
  { code: '202618', label: 'Aug 24 to Sep 6, 2026', tick: 'Sep', used: 23.2, expected: 27.3 },
  { code: '202619', label: 'Sep 7 to 20, 2026', tick: 'Sep', used: 23.8, expected: 27.6 },
  { code: '202620', label: 'Sep 21 to Oct 4, 2026', tick: 'Oct 2026', used: 23.8, expected: 27.7 },
];

/**
 * AI use by sector, from the Census story of May 26, 2026 (data to May 3, 2026). Information, Finance and Insurance and the national rate
 * are printed to one decimal; retail trade is printed as "around 14%", so it is shown as about 14 percent.
 */
export const AI_USE_BY_SECTOR: readonly { readonly label: string; readonly value: number; readonly display: string }[] = [
  { label: 'Information', value: 39.7, display: '39.7%' },
  { label: 'Finance and insurance', value: 33.9, display: '33.9%' },
  { label: 'All businesses', value: 19.8, display: '19.8%' },
  { label: 'Retail trade', value: 14, display: 'about 14%' },
];

/** NIST AI 100-1, Tables 1 to 4: the categories and subcategories of each function of the AI RMF Core, counted from the tables. */
export const NIST_AI_RMF_CORE: readonly { readonly fn: string; readonly categories: number; readonly subcategories: number }[] = [
  { fn: 'Govern', categories: 6, subcategories: 19 },
  { fn: 'Map', categories: 5, subcategories: 18 },
  { fn: 'Measure', categories: 4, subcategories: 22 },
  { fn: 'Manage', categories: 4, subcategories: 13 },
];

/** OWASP Top 10 for LLM Applications 2025, in the published order. */
export const OWASP_LLM_2025: readonly { readonly code: string; readonly name: string }[] = [
  { code: 'LLM01:2025', name: 'Prompt Injection' },
  { code: 'LLM02:2025', name: 'Sensitive Information Disclosure' },
  { code: 'LLM03:2025', name: 'Supply Chain' },
  { code: 'LLM04:2025', name: 'Data and Model Poisoning' },
  { code: 'LLM05:2025', name: 'Improper Output Handling' },
  { code: 'LLM06:2025', name: 'Excessive Agency' },
  { code: 'LLM07:2025', name: 'System Prompt Leakage' },
  { code: 'LLM08:2025', name: 'Vector and Embedding Weaknesses' },
  { code: 'LLM09:2025', name: 'Misinformation' },
  { code: 'LLM10:2025', name: 'Unbounded Consumption' },
];

/** BLS Employee Tenure, Table 1, "Total" rows, January 2026 column: median years with the current employer, wage and salary workers. */
export const BLS_TENURE_2026: readonly { readonly ages: string; readonly years: number }[] = [
  { ages: 'Ages 20 to 24', years: 1.5 },
  { ages: 'Ages 25 to 34', years: 3.0 },
  { ages: 'Ages 35 to 44', years: 4.7 },
  { ages: 'Ages 45 to 54', years: 7.0 },
  { ages: 'Ages 55 to 64', years: 9.6 },
  { ages: 'Ages 65 and over', years: 9.9 },
  { ages: 'All workers 16 and over', years: 4.1 },
];

/** BLS Contingent and Alternative Employment Arrangements, July 2023 (released November 8, 2024): workers on their sole or main job. */
export const BLS_ALTERNATIVE_2023: readonly { readonly label: string; readonly percent: number; readonly people: string }[] = [
  { label: 'Independent contractors', percent: 7.4, people: '11.9 million' },
  { label: 'On-call workers', percent: 1.7, people: '2.8 million' },
  { label: 'Temporary help agency workers', percent: 0.6, people: '945,000' },
  { label: 'Workers provided by contract firms', percent: 0.5, people: '862,000' },
];
