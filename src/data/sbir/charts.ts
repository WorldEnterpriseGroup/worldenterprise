/**
 * Chart-ready rows for /sbir-sttr/** (WP-34, #83), built from the build-time aggregates (aggregates.ts). Pure functions and constants:
 * no Astro imports, so `node --test` can check every figure the pages print. Nothing here is fetched at runtime.
 */
import { AGGREGATES } from './aggregates.ts';

export interface Bar {
  readonly label: string;
  readonly value: number;
  readonly display: string;
  readonly highlight?: boolean;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Series {
  readonly label: string;
  readonly points: readonly Point[];
  readonly primary?: boolean;
}

const A = AGGREGATES;
const nf = new Intl.NumberFormat('en-US');

export const thousands = (n: number): string => nf.format(n);

/** Millions of dollars as words: 4906.2 -> "$4.9 billion", 93.3 -> "$93 million". */
export function usdMillions(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)} billion`;
  return `$${Math.round(m)} million`;
}

/** Whole dollars, with commas: 323090 -> "$323,090". */
export const usd = (n: number): string => `$${nf.format(Math.round(n))}`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-');
  const name = MONTH_NAMES[Number(m) - 1];
  if (y === undefined || name === undefined) throw new Error(`Bad month "${iso}"`);
  return `${name} ${y.slice(2)}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Awards over the years (all agencies, fiscal years 1983 to 2025)
// ---------------------------------------------------------------------------------------------------------------------------------

const peak = A.byYear.reduce((best, y) => (y.usdMillions > best.usdMillions ? y : best), A.byYear[0] ?? { year: 0, awards: 0, usdMillions: 0 });
export const PEAK_YEAR = peak;

export const AWARDS_BY_YEAR_BARS: readonly Bar[] = A.byYear.map((y) => ({
  label: String(y.year),
  value: Math.round(y.usdMillions) / 1000,
  display: usdMillions(y.usdMillions),
  highlight: y.year === peak.year,
}));

export const AWARDS_BY_YEAR_TABLE: readonly (readonly string[])[] = A.byYear.map((y) => [String(y.year), thousands(y.awards), usdMillions(y.usdMillions)]);

// ---------------------------------------------------------------------------------------------------------------------------------
// The pause: awards by month, January 2024 to the latest month in the file
// ---------------------------------------------------------------------------------------------------------------------------------

/** Months from the first to the last month in the data, with zero for a month that has no award. */
export function monthRange(from: string, to: string): readonly string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const monthly = new Map(A.monthly.map((r) => [r.month, r.awards]));
const lastMonth = A.monthly[A.monthly.length - 1]?.month ?? '2026-08';
export const MONTHLY_FROM = '2024-01';
export const MONTHLY_TO = lastMonth;
/** Months with the previous authority expired and the new one not yet signed: October 2025 to March 2026 (signed April 13, 2026). */
export const PAUSE_MONTHS: ReadonlySet<string> = new Set(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);

export const MONTHLY_BARS: readonly Bar[] = monthRange(MONTHLY_FROM, MONTHLY_TO).map((m) => ({
  label: monthLabel(m),
  value: monthly.get(m) ?? 0,
  display: thousands(monthly.get(m) ?? 0),
  highlight: PAUSE_MONTHS.has(m),
}));

export const MONTHLY_TABLE: readonly (readonly string[])[] = MONTHLY_BARS.map((b) => [b.label, b.display]);

/** Awards dated in the six months of the pause, against the same six months a year earlier. */
export const PAUSE_COMPARE = (() => {
  const sum = (months: readonly string[]): number => months.reduce((n, m) => n + (monthly.get(m) ?? 0), 0);
  const during = sum([...PAUSE_MONTHS]);
  const before = sum(['2024-10', '2024-11', '2024-12', '2025-01', '2025-02', '2025-03']);
  return { during, before };
})();

// ---------------------------------------------------------------------------------------------------------------------------------
// Agencies (fiscal years 2020 to 2024 pooled)
// ---------------------------------------------------------------------------------------------------------------------------------

export const AGENCY_WINDOW = `${A.agencies.from} to ${A.agencies.to}`;

export const AGENCY_DOLLAR_BARS: readonly Bar[] = A.agencies.rows.map((r, i) => ({
  label: r.agency,
  value: r.usdMillions,
  display: usdMillions(r.usdMillions),
  highlight: i === 0,
}));

export const AGENCY_TABLE: readonly (readonly string[])[] = A.agencies.rows.map((r) => [
  r.agency,
  thousands(r.awards),
  usdMillions(r.usdMillions),
  r.phase1MedianUsd === null ? 'n/a' : usd(r.phase1MedianUsd),
  r.phase2MedianUsd === null ? 'n/a' : usd(r.phase2MedianUsd),
  thousands(r.sttrAwards),
]);

/** Median Phase I award by agency, largest first. */
export const MEDIAN_PHASE1_BARS: readonly Bar[] = [...A.agencies.rows]
  .filter((r) => r.phase1MedianUsd !== null && r.phase1Awards >= 50)
  .sort((a, b) => (b.phase1MedianUsd ?? 0) - (a.phase1MedianUsd ?? 0))
  .map((r, i) => ({ label: r.agency, value: r.phase1MedianUsd ?? 0, display: usd(r.phase1MedianUsd ?? 0), highlight: i === 0 }));

/** Phase II awards for every 100 Phase I awards, same window. A ratio of counts, not a conversion rate. */
export const PHASE2_PER_100_BARS: readonly Bar[] = [...A.agencies.rows]
  .filter((r) => r.phase1Awards >= 50)
  .map((r) => ({ label: r.agency, value: Math.round((100 * r.phase2Awards) / r.phase1Awards), display: `${Math.round((100 * r.phase2Awards) / r.phase1Awards)}`, highlight: false }))
  .sort((a, b) => b.value - a.value)
  .map((b, i) => ({ ...b, highlight: i === 0 }));

export const PHASE2_PER_100_TABLE: readonly (readonly string[])[] = A.agencies.rows
  .filter((r) => r.phase1Awards >= 50)
  .map((r) => [r.agency, thousands(r.phase1Awards), thousands(r.phase2Awards), String(Math.round((100 * r.phase2Awards) / r.phase1Awards))]);

export const STTR_TOTAL = A.agencies.rows.reduce((n, r) => n + r.sttrAwards, 0);
/** The five agencies that run STTR at scale in the award data, and the awards of all others together. */
export const STTR_MAIN = A.agencies.rows.filter((r) => r.sttrAwards >= 100).map((r) => r.agency);
export const STTR_OTHER_COUNT = A.agencies.rows.filter((r) => r.sttrAwards < 100).reduce((n, r) => n + r.sttrAwards, 0);

// ---------------------------------------------------------------------------------------------------------------------------------
// Phase I to Phase II
// ---------------------------------------------------------------------------------------------------------------------------------

const gap = A.phaseGap;
export const GAP_BARS: readonly Bar[] = gap.buckets.map((b) => ({
  label: b.label,
  value: b.companies,
  display: `${thousands(b.companies)} (${Math.round((100 * b.companies) / gap.companiesWithLaterPhaseII)}%)`,
  highlight: b.label === '1 to 2 years',
}));
export const GAP_SHARE_WITH_PHASE2 = Math.round((100 * gap.companiesWithLaterPhaseII) / gap.companiesWithPhaseI);

// ---------------------------------------------------------------------------------------------------------------------------------
// NIH success rates (the one agency that publishes them by phase in a standard public table)
// ---------------------------------------------------------------------------------------------------------------------------------

export const NIH_SERIES: readonly Series[] = [
  { label: 'Phase I', primary: true, points: A.nih.map((r) => ({ x: r.fy, y: r.phase1Percent })) },
  {
    label: 'Phase II (regular)',
    points: A.nih.filter((r) => r.phase2Percent !== null).map((r) => ({ x: r.fy, y: r.phase2Percent ?? 0 })),
  },
];

export const NIH_TABLE: readonly (readonly string[])[] = A.nih.map((r) => [
  String(r.fy),
  thousands(r.phase1Reviewed),
  thousands(r.phase1Awarded),
  `${r.phase1Percent}%`,
  r.phase2Reviewed === null ? 'not in the table' : thousands(r.phase2Reviewed),
  r.phase2Awarded === null ? 'not in the table' : thousands(r.phase2Awarded),
  r.phase2Percent === null ? 'not in the table' : `${r.phase2Percent}%`,
]);

const nihLatest = A.nih[A.nih.length - 1];
export const NIH_LATEST = nihLatest;
export const NIH_FIRST_FY = A.nih[0]?.fy ?? 2015;
export const NIH_LAST_FY = nihLatest?.fy ?? 2025;
/** The best and the lowest Phase I year in the window, for the plain-language line under the chart. */
export const NIH_PHASE1_RANGE = {
  high: A.nih.reduce((b, r) => (r.phase1Percent > b.phase1Percent ? r : b), A.nih[0] ?? { fy: 0, phase1Percent: 0 }),
  low: A.nih.reduce((b, r) => (r.phase1Percent < b.phase1Percent ? r : b), A.nih[0] ?? { fy: 0, phase1Percent: 0 }),
};

// ---------------------------------------------------------------------------------------------------------------------------------
// First-time awardees, states, repeat winners
// ---------------------------------------------------------------------------------------------------------------------------------

export const FIRST_TIME_SERIES: readonly Series[] = [
  { label: 'Phase I awards to a company with no earlier SBIR or STTR award', primary: true, points: A.firstTime.map((r) => ({ x: r.year, y: r.percent })) },
];
export const FIRST_TIME_TABLE: readonly (readonly string[])[] = A.firstTime.map((r) => [String(r.year), thousands(r.phase1Awards), thousands(r.toFirstTime), `${r.percent}%`]);
const recentFirst = A.firstTime.filter((r) => r.year >= 2015 && r.year <= 2024);
export const FIRST_TIME_RECENT = {
  from: 2015,
  to: 2024,
  percent: Math.round((100 * recentFirst.reduce((n, r) => n + r.toFirstTime, 0)) / recentFirst.reduce((n, r) => n + r.phase1Awards, 0)),
};

export const STATE_TOP = 10;
export const STATE_BARS: readonly Bar[] = A.states.rows.slice(0, STATE_TOP).map((r, i) => ({
  label: r.state,
  value: r.awards,
  display: thousands(r.awards),
  highlight: i === 0,
}));
export const STATE_TABLE: readonly (readonly string[])[] = A.states.rows.map((r) => [r.state, thousands(r.awards), usdMillions(r.usdMillions)]);
export const STATE_TOP_SHARE = Math.round((100 * A.states.rows.slice(0, STATE_TOP).reduce((n, r) => n + r.awards, 0)) / A.states.total);

export const REPEAT_BARS: readonly Bar[] = A.repeat.rows.map((r) => ({
  label: r.label,
  value: r.dollarSharePercent,
  display: `${r.dollarSharePercent}% of dollars`,
  highlight: r === A.repeat.rows[A.repeat.rows.length - 1],
}));
export const REPEAT_TABLE: readonly (readonly string[])[] = A.repeat.rows.map((r) => [r.label, thousands(r.companies), `${r.dollarSharePercent}%`]);
