import type { StatSource } from '../../components/visuals/contracts.ts';
import { BED_SURVIVAL_INFORMATION, BED_SURVIVAL_TOTAL } from '../datasets/bed-survival.generated.ts';
import {
  ageShareArea,
  dilutionBars,
  exitRidgeline,
  formationWaffle,
  founderAgeRange,
  payrollSlope,
  roundAgeBars,
  roundGapBars,
  sectorSlope,
  src as wp35Source,
  survivalWaffle,
} from '../datasets/figures.ts';
import { RETRIEVED as RETRIEVED_WP35 } from '../datasets/sources.ts';
import {
  BDS_2023_BY_AGE,
  BDS_2023_BY_SIZE,
  BDS_2023_EXIT_RATE,
  BDS_2023_SECTOR_EXIT_RATE,
  BDS_EXIT_AGES,
  BDS_STARTUP_FIRMS,
  BDS_STARTUP_YEARS,
} from './bds.generated.ts';
import type { BdsAgeClass, BdsExitAge } from './bds.generated.ts';
import { AI_USE_BY_SECTOR, BLS_ALTERNATIVE_2023, BLS_TENURE_2026, BTOS_AI, NIST_AI_RMF_CORE, OWASP_LLM_2025 } from './datasets.ts';
import { RETRIEVED_WP26, sourceLine } from './sources.ts';
import type { InsightSourceId } from './sources.ts';

/**
 * The insight figure registry (WP-26, wave 11). Each entry is one sourced figure that src/components/insights/InsightFigures.astro draws on
 * an /insights/ article page, below the article body. Figures are pure data here, so the unit tests can check every value against its
 * published source, every label against the copy rules, and every article against the registry (registry.ts).
 *
 * New figures draw on the datasets WP-26 fetched (sources.ts). Figures reused from the /data/ hub take their props from WP-35's
 * src/data/datasets/figures.ts unchanged, so the two pages can never disagree.
 */

/** Which package's sources ledger holds the fetch behind a figure. */
export interface LedgerRef {
  readonly wp: 'WP-26' | 'WP-35';
  readonly sourceId: string;
}

interface Base {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly caption: string;
  readonly sources: readonly StatSource[];
  readonly retrieved: string;
  readonly derived?: string | undefined;
  readonly note?: string | undefined;
  readonly ledger: readonly LedgerRef[];
}

export interface BarItem {
  readonly label: string;
  readonly value: number;
  readonly display: string;
  readonly highlight?: boolean;
}

export interface BarsFigure extends Base {
  readonly kind: 'bars';
  readonly items: readonly BarItem[];
  /** Scale maximum (default: the largest value). */
  readonly max?: number;
  /** Table header of the label column and of the value column. */
  readonly groupLabel: string;
  readonly valueLabel: string;
}

export interface LinePoint {
  readonly x: number;
  /** Row label in the table. */
  readonly label: string;
}

export interface LineFigure extends Base {
  readonly kind: 'line';
  readonly points: readonly LinePoint[];
  readonly series: readonly { readonly label: string; readonly values: readonly number[] }[];
  /** x positions that get an axis label, and the label. */
  readonly ticks: readonly { readonly x: number; readonly label: string }[];
  readonly yMin: number;
  readonly yMax: number;
  /** Axis: values are divided by this and followed by `axisUnit`. */
  readonly axisDivisor: number;
  readonly axisUnit: string;
  /** How a value prints in the table. */
  readonly tableFormat: 'percent1' | 'count';
  readonly xLabel: string;
}

export interface RankFigure extends Base {
  readonly kind: 'rank';
  readonly items: readonly { readonly code: string; readonly name: string }[];
}

/** Figures reused from WP-35: the props go to the /data/ chart component as they are. */
export interface WaffleFigure extends Base {
  readonly kind: 'waffle';
  readonly props: typeof survivalWaffle | typeof formationWaffle;
}
export interface SlopeFigure extends Base {
  readonly kind: 'slope';
  readonly props: typeof payrollSlope | typeof sectorSlope;
}
export interface RidgelineFigure extends Base {
  readonly kind: 'ridgeline';
  readonly props: typeof exitRidgeline;
}
export interface RangeFigure extends Base {
  readonly kind: 'range';
  readonly props: typeof founderAgeRange;
}
export interface AreaFigure extends Base {
  readonly kind: 'area';
  readonly props: typeof ageShareArea;
}

export type InsightFigure = BarsFigure | LineFigure | RankFigure | WaffleFigure | SlopeFigure | RidgelineFigure | RangeFigure | AreaFigure;

const pct1 = (n: number): string => `${(Math.round(n * 10) / 10).toFixed(1)}%`;
const count = (n: number): string => n.toLocaleString('en-US');
const share = (part: number, whole: number): number => Math.round((part / whole) * 1000) / 10;
const wp26 = (...ids: InsightSourceId[]): readonly LedgerRef[] => ids.map((sourceId) => ({ wp: 'WP-26' as const, sourceId }));
const wp35 = (...ids: string[]): readonly LedgerRef[] => ids.map((sourceId) => ({ wp: 'WP-35' as const, sourceId }));

/** Age-class labels that never read as a claim about the site ("Age 16 to 20", not "16 to 20 years"). */
export const AGE_LABEL: Readonly<Record<BdsExitAge, string>> = {
  '1': 'Age 1',
  '2': 'Age 2',
  '3': 'Age 3',
  '4': 'Age 4',
  '5': 'Age 5',
  '6-10': 'Age 6 to 10',
  '11-15': 'Age 11 to 15',
  '16-20': 'Age 16 to 20',
  '21-25': 'Age 21 to 25',
  '26+': 'Age 26 and older',
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Firm age and survival (Census BDS)
// ---------------------------------------------------------------------------------------------------------------------------------

const exitBars = (rates: Readonly<Record<BdsExitAge, number>>): readonly BarItem[] =>
  BDS_EXIT_AGES.map((a, i) => ({ label: AGE_LABEL[a], value: rates[a], display: pct1(rates[a]), highlight: i === 0 }));

const EXIT_DERIVED = 'Rates are the published establishment exit rates (exits in 2023 over the average count of establishments in 2022 and 2023), rounded to one decimal.';

export const exitByFirmAge: BarsFigure = {
  kind: 'bars',
  id: 'bds-exit-by-firm-age',
  title: 'Share of establishments that closed in 2023, by the age of the firm that owned them',
  description: `Ten bars, one per firm-age class. Establishments of one-year-old firms closed at a rate of ${pct1(BDS_2023_EXIT_RATE['1'])} in 2023; the rate falls with every class, to ${pct1(BDS_2023_EXIT_RATE['5'])} at age 5 and ${pct1(BDS_2023_EXIT_RATE['26+'])} for firms aged 26 and older.`,
  caption: `The risk falls as a company ages: about one in four locations of a one-year-old firm closed in 2023, against about one in fourteen for firms aged 26 and older.`,
  items: exitBars(BDS_2023_EXIT_RATE),
  groupLabel: 'Firm age',
  valueLabel: 'Establishment exit rate, 2023',
  sources: [sourceLine('census-bds-2023-fa')],
  retrieved: RETRIEVED_WP26,
  derived: EXIT_DERIVED,
  note: 'All U.S. employer firms in every sector. A closed location is not always a failed company: sales, mergers and planned closures count too.',
  ledger: wp26('census-bds-2023-fa', 'census-bds-faq'),
};

const AGE_GROUPS: readonly { readonly label: string; readonly classes: readonly BdsAgeClass[] }[] = [
  { label: 'Age 0 to 5', classes: ['0', '1', '2', '3', '4', '5'] },
  { label: 'Age 6 to 10', classes: ['6-10'] },
  { label: 'Age 11 to 15', classes: ['11-15'] },
  { label: 'Age 16 to 25', classes: ['16-20', '21-25'] },
  { label: 'Age 26 and older', classes: ['26+'] },
  { label: 'Founded before 1977 (exact age not measured)', classes: ['left-censored'] },
];
const sumOf = (classes: readonly BdsAgeClass[], key: 'firms' | 'emp'): number => classes.reduce((t, c) => t + BDS_2023_BY_AGE[c][key], 0);
const ALL_AGE_CLASSES = Object.keys(BDS_2023_BY_AGE) as BdsAgeClass[];
export const BDS_2023_EMP_SUM = sumOf(ALL_AGE_CLASSES, 'emp');
export const BDS_2023_FIRM_SUM = sumOf(ALL_AGE_CLASSES, 'firms');
export const JOBS_BY_AGE = AGE_GROUPS.map((g) => ({ label: g.label, jobs: share(sumOf(g.classes, 'emp'), BDS_2023_EMP_SUM), firms: share(sumOf(g.classes, 'firms'), BDS_2023_FIRM_SUM) }));
const jobsAt = (label: string): { readonly jobs: number; readonly firms: number } => {
  const g = JOBS_BY_AGE.find((j) => j.label === label);
  if (g === undefined) throw new Error(`insight-figures: no age group "${label}"`);
  return g;
};
const YOUNG = jobsAt('Age 0 to 5');
const OLD = jobsAt('Age 26 and older');
const OLDEST = jobsAt('Founded before 1977 (exact age not measured)');

export const jobsByFirmAge: BarsFigure = {
  kind: 'bars',
  id: 'bds-jobs-by-firm-age',
  title: 'Share of U.S. employer jobs, by the age of the firm, 2023',
  description: `Six bars. Firms aged 0 to 5 held ${pct1(YOUNG.jobs)} of employment while making up ${pct1(YOUNG.firms)} of firms; firms aged 26 and older held ${pct1(OLD.jobs)}, and firms founded before 1977 held ${pct1(OLDEST.jobs)}.`,
  caption: `Most jobs sit in companies that have lasted: firms at least 26 years old employ ${pct1(Math.round((OLD.jobs + OLDEST.jobs) * 10) / 10)} of the workforce.`,
  items: JOBS_BY_AGE.map((g, i) => ({ label: g.label, value: g.jobs, display: `${pct1(g.jobs)} of jobs, ${pct1(g.firms)} of firms`, highlight: i === 0 })),
  max: 50,
  groupLabel: 'Firm age',
  valueLabel: 'Share of jobs and of firms, 2023',
  sources: [sourceLine('census-bds-2023-fa')],
  retrieved: RETRIEVED_WP26,
  derived: 'Each share is the sum of the published employment (or firm) counts of the age classes in the group, divided by the sum over all classes, which equals the economy-wide total in bds2023.csv.',
  note: 'The Census Bureau cannot date firms born before 1977, so they are shown on their own; every one of them was at least 45 years old in 2023.',
  ledger: wp26('census-bds-2023-fa', 'census-bds-2023-economy', 'census-bds-faq'),
};

const SIZE_TOTAL = BDS_2023_BY_SIZE.reduce((t, s) => t + s.firms, 0);
const sizeShare = (sizes: readonly string[]): number => share(BDS_2023_BY_SIZE.filter((s) => sizes.includes(s.size)).reduce((t, s) => t + s.firms, 0), SIZE_TOTAL);
const SIZE_GROUPS: readonly { readonly label: string; readonly sizes: readonly string[] }[] = [
  { label: '1 to 4 employees', sizes: ['1 to 4'] },
  { label: '5 to 9 employees', sizes: ['5 to 9'] },
  { label: '10 to 19 employees', sizes: ['10 to 19'] },
  { label: '20 to 99 employees', sizes: ['20 to 99'] },
  { label: '100 to 499 employees', sizes: ['100 to 499'] },
  { label: '500 or more employees', sizes: ['500 to 999', '1000 to 2499', '2500 to 4999', '5000 to 9999', '10000+'] },
];
export const FIRMS_BY_SIZE = SIZE_GROUPS.map((g) => ({ label: g.label, value: sizeShare(g.sizes) }));
const smallest = FIRMS_BY_SIZE[0]?.value ?? 0;

export const firmsBySize: BarsFigure = {
  kind: 'bars',
  id: 'bds-firms-by-size',
  title: 'U.S. employer firms by number of employees, 2023',
  description: `Six bars. ${pct1(smallest)} of employer firms had 1 to 4 employees, ${pct1(FIRMS_BY_SIZE[1]?.value ?? 0)} had 5 to 9, and ${pct1(FIRMS_BY_SIZE[5]?.value ?? 0)} had 500 or more.`,
  caption: `A company with a handful of people is the normal case, not the exception: ${pct1(smallest)} of U.S. employer firms had fewer than five employees.`,
  items: FIRMS_BY_SIZE.map((g, i) => ({ label: g.label, value: g.value, display: pct1(g.value), highlight: i === 0 })),
  max: 100,
  groupLabel: 'Firm size',
  valueLabel: 'Share of employer firms, 2023',
  sources: [sourceLine('census-bds-2023-fz')],
  retrieved: RETRIEVED_WP26,
  derived: 'Shares are published firm counts divided by the sum of the size classes in the firm-size file; the five largest classes are added together.',
  note: 'Employer firms only: businesses with no employees are not in these data. Firm size is the average of the current and prior year.',
  ledger: wp26('census-bds-2023-fz', 'census-bds-faq'),
};

const startupMax = Math.max(...BDS_STARTUP_FIRMS);
const startupMin = Math.min(...BDS_STARTUP_FIRMS);
const startupLast = BDS_STARTUP_FIRMS[BDS_STARTUP_FIRMS.length - 1] ?? 0;
const yearOf = (v: number): number => BDS_STARTUP_YEARS[BDS_STARTUP_FIRMS.indexOf(v)] ?? 0;

export const startupsByYear: LineFigure = {
  kind: 'line',
  id: 'bds-startups-by-year',
  title: 'New U.S. employer firms each year, 1978 to 2023',
  description: `One line of yearly startup counts (firms of age 0). The count ranged from ${count(startupMin)} in ${yearOf(startupMin)} to ${count(startupMax)} in ${yearOf(startupMax)}, and was ${count(startupLast)} in 2023.`,
  caption: `Between about ${Math.floor(startupMin / 10000) * 10} thousand and ${Math.round(startupMax / 10000) * 10} thousand new employer firms start every year, through every cycle. Starting is common; lasting is what is rare.`,
  points: BDS_STARTUP_YEARS.map((y) => ({ x: y, label: String(y) })),
  series: [{ label: 'New employer firms (age 0)', values: BDS_STARTUP_FIRMS }],
  ticks: [1978, 1990, 2000, 2010, 2023].map((y) => ({ x: y, label: String(y) })),
  yMin: 0,
  yMax: 600000,
  axisDivisor: 1000,
  axisUnit: 'k',
  tableFormat: 'count',
  xLabel: 'Year',
  sources: [sourceLine('census-bds-2023-fa')],
  retrieved: RETRIEVED_WP26,
  derived: 'Values are the published firm counts at firm age 0, copied as printed.',
  note: 'A startup here is a new firm with at least one paid employee; businesses with no employees are not counted.',
  ledger: wp26('census-bds-2023-fa'),
};

/** The 2015 opening-year group, years 0 to 10, from WP-35's BLS BED dataset (the same values the /data/ hub prints). */
const g2015 = (rec: Readonly<Record<number, readonly number[]>>): readonly number[] => {
  const v = rec[2015];
  if (v === undefined || v.length < 11) throw new Error('insight-figures: the 2015 opening-year group is missing');
  return v.slice(0, 11);
};
const INFO_2015 = g2015(BED_SURVIVAL_INFORMATION);
const TOTAL_2015 = g2015(BED_SURVIVAL_TOTAL);

export const informationSurvival: LineFigure = {
  kind: 'line',
  id: 'bed-information-survival-2015',
  title: 'Share of establishments still open, by years since opening, 2015 opening-year group',
  description: `Two lines over ten years. Of information-sector establishments that opened in 2015, ${pct1(INFO_2015[5] ?? 0)} were open at year 5 and ${pct1(INFO_2015[10] ?? 0)} at year 10; for all private industries the figures were ${pct1(TOTAL_2015[5] ?? 0)} and ${pct1(TOTAL_2015[10] ?? 0)}.`,
  caption: `Software sits in the information sector, and it does not escape the long clock: about ${Math.round(INFO_2015[10] ?? 0)} in 100 information establishments were still open ten years on.`,
  points: Array.from({ length: 11 }, (_, i) => ({ x: i, label: `Year ${i}` })),
  series: [
    { label: 'Information sector', values: INFO_2015 },
    { label: 'All private industries', values: TOTAL_2015 },
  ],
  ticks: [0, 2, 4, 6, 8, 10].map((x) => ({ x, label: `Year ${x}` })),
  yMin: 0,
  yMax: 100,
  axisDivisor: 1,
  axisUnit: '%',
  tableFormat: 'percent1',
  xLabel: 'Years since opening',
  sources: [wp35Source('bls-bed-information'), wp35Source('bls-bed-total')],
  retrieved: RETRIEVED_WP35,
  derived: 'Values are the published survival rates since birth, copied as printed.',
  note: 'Establishments, not companies: one company with two locations counts twice.',
  ledger: wp35('bls-bed-information', 'bls-bed-total'),
};

/** Sector articles: one exit-rate figure per NAICS sector, with the all-sector rate as the reference in the note. */
export interface SectorSpec {
  readonly code: string;
  readonly id: string;
  readonly name: string;
  readonly why: string;
}
export const SECTORS: readonly SectorSpec[] = [
  { code: '62', id: 'bds-exit-health-care', name: 'Health care and social assistance', why: 'the sector healthtech customers work in' },
  { code: '52', id: 'bds-exit-finance', name: 'Finance and insurance', why: 'the sector fintech customers work in' },
  { code: '61', id: 'bds-exit-education', name: 'Educational services', why: 'the private education providers edtech sells to' },
  { code: '54', id: 'bds-exit-professional', name: 'Professional, scientific and technical services', why: 'the sector law firms and many government contractors sit in' },
  { code: '51', id: 'bds-exit-information', name: 'Information', why: 'the sector software publishers sit in' },
  { code: '56', id: 'bds-exit-administrative', name: 'Administrative and support services', why: 'the sector staffing and employment agencies sit in' },
  { code: '22', id: 'bds-exit-utilities', name: 'Utilities', why: 'the energy and water companies many climate products sell to' },
];
const sectorFigure = (s: SectorSpec): BarsFigure => {
  const rates = BDS_2023_SECTOR_EXIT_RATE[s.code];
  if (rates === undefined) throw new Error(`insight-figures: sector ${s.code} is missing`);
  return {
    kind: 'bars',
    id: s.id,
    title: `Share of establishments that closed in 2023, by firm age: ${s.name}`,
    description: `Ten bars, one per firm-age class, for ${s.name.toLowerCase()} (NAICS ${s.code}). Establishments of one-year-old firms closed at ${pct1(rates['1'])} in 2023, those of firms aged 6 to 10 at ${pct1(rates['6-10'])}, and those of firms aged 26 and older at ${pct1(rates['26+'])}.`,
    caption: `In ${s.name.toLowerCase()}, ${s.why}, young firms close far more often than old ones: ${pct1(rates['1'])} at age 1 against ${pct1(rates['26+'])} at 26 and older.`,
    items: exitBars(rates),
    groupLabel: 'Firm age',
    valueLabel: `Establishment exit rate, 2023, ${s.name}`,
    sources: [sourceLine('census-bds-2023-sec-fa')],
    retrieved: RETRIEVED_WP26,
    derived: EXIT_DERIVED,
    note: `For comparison, across all sectors the rate was ${pct1(BDS_2023_EXIT_RATE['1'])} at age 1 and ${pct1(BDS_2023_EXIT_RATE['26+'])} at 26 and older. Smaller sectors have fewer firms per class, so their rates move more from class to class.`,
    ledger: wp26('census-bds-2023-sec-fa', 'census-bds-2023-fa', 'census-bds-faq'),
  };
};
export const sectorFigures: readonly BarsFigure[] = SECTORS.map(sectorFigure);

// ---------------------------------------------------------------------------------------------------------------------------------
// AI (Census BTOS, NIST, OWASP)
// ---------------------------------------------------------------------------------------------------------------------------------

const firstAi = BTOS_AI[0];
const lastAi = BTOS_AI[BTOS_AI.length - 1];
if (firstAi === undefined || lastAi === undefined) throw new Error('insight-figures: the BTOS AI series is empty');
const AI_TICKS = ['202524', '202601', '202609', '202620'];

export const aiUseOverTime: LineFigure = {
  kind: 'line',
  id: 'btos-ai-use',
  title: 'Share of U.S. businesses using AI in any business function, two-week periods, November 2025 to October 2026',
  description: `Two lines over ${BTOS_AI.length} survey periods. Businesses that used AI in the last two weeks rose from ${pct1(firstAi.used)} (${firstAi.label}) to ${pct1(lastAi.used)} (${lastAi.label}); businesses expecting to use it in the next six months rose from ${pct1(firstAi.expected)} to ${pct1(lastAi.expected)}.`,
  caption: `Adoption is real but gradual: about one business in four used AI in late 2026, and the expected rate runs only a few points ahead of actual use.`,
  points: BTOS_AI.map((p, i) => ({ x: i, label: p.label })),
  series: [
    { label: 'Used AI in the last two weeks', values: BTOS_AI.map((p) => p.used) },
    { label: 'Expect to use AI in the next six months', values: BTOS_AI.map((p) => p.expected) },
  ],
  ticks: AI_TICKS.map((code) => {
    const i = BTOS_AI.findIndex((p) => p.code === code);
    const p = BTOS_AI[i];
    if (p === undefined) throw new Error(`insight-figures: BTOS period ${code} is missing`);
    return { x: i, label: p.tick };
  }),
  yMin: 0,
  yMax: 40,
  axisDivisor: 1,
  axisUnit: '%',
  tableFormat: 'percent1',
  xLabel: 'Collection period',
  sources: [sourceLine('census-btos-national')],
  retrieved: RETRIEVED_WP26,
  derived: 'Values are the published national estimates (answer "Yes"), copied as printed.',
  note: 'The question asks about AI "in any of its business functions" since November 17, 2025; earlier periods asked a narrower question and are left out. Estimates are survey-based and have a standard error of under half a point.',
  ledger: wp26('census-btos-national'),
};

export const aiUseBySector: BarsFigure = {
  kind: 'bars',
  id: 'btos-ai-by-sector',
  title: 'Share of businesses using AI, selected sectors, survey period ending May 3, 2026',
  description: 'Four bars. 39.7 percent of information-sector businesses used AI in the two weeks before the survey, 33.9 percent in finance and insurance, 19.8 percent of all businesses, and about 14 percent in retail trade.',
  caption: 'Software customers in information and finance already use AI at about twice the national rate, so they will ask how a product uses it.',
  items: AI_USE_BY_SECTOR.map((s) => ({ label: s.label, value: s.value, display: s.display, highlight: s.label === 'All businesses' })),
  max: 50,
  groupLabel: 'Sector',
  valueLabel: 'Used AI in the last two weeks',
  sources: [sourceLine('census-ai-use-story')],
  retrieved: RETRIEVED_WP26,
  derived: 'Values are quoted from the Census Bureau story; the retail figure is printed there as "around 14%".',
  ledger: wp26('census-ai-use-story'),
};

const RMF_TOTAL = NIST_AI_RMF_CORE.reduce((t, f) => t + f.subcategories, 0);
export const nistAiRmfCore: BarsFigure = {
  kind: 'bars',
  id: 'nist-ai-rmf-core',
  title: 'The four functions of the NIST AI Risk Management Framework, by number of subcategories',
  description: `Four bars. Govern has ${NIST_AI_RMF_CORE[0]?.subcategories} subcategories in ${NIST_AI_RMF_CORE[0]?.categories} categories, Map ${NIST_AI_RMF_CORE[1]?.subcategories} in ${NIST_AI_RMF_CORE[1]?.categories}, Measure ${NIST_AI_RMF_CORE[2]?.subcategories} in ${NIST_AI_RMF_CORE[2]?.categories}, and Manage ${NIST_AI_RMF_CORE[3]?.subcategories} in ${NIST_AI_RMF_CORE[3]?.categories}: ${RMF_TOTAL} in all.`,
  caption: `${RMF_TOTAL} outcomes across four functions is a list to work through over years, not a box to tick before launch. A small team picks the ones that fit its risk first.`,
  items: NIST_AI_RMF_CORE.map((f) => ({ label: f.fn, value: f.subcategories, display: `${f.subcategories} subcategories in ${f.categories} categories`, highlight: f.fn === 'Govern' })),
  groupLabel: 'Function',
  valueLabel: 'Subcategories and categories',
  sources: [sourceLine('nist-ai-rmf')],
  retrieved: RETRIEVED_WP26,
  derived: 'Counts are the numbered categories and subcategories in Tables 1 to 4 of the framework.',
  note: 'The framework is voluntary. Govern applies across the other three functions.',
  ledger: wp26('nist-ai-rmf'),
};

export const owaspLlm2025: RankFigure = {
  kind: 'rank',
  id: 'owasp-llm-top-10-2025',
  title: 'The OWASP Top 10 for LLM Applications, 2025 list',
  description: 'Ten numbered risks in the published order, from LLM01 Prompt Injection to LLM10 Unbounded Consumption.',
  caption: 'Prompt injection heads the list, and several entries, such as excessive agency and unbounded consumption, are design choices a team makes early and lives with for years.',
  items: OWASP_LLM_2025,
  sources: [sourceLine('owasp-llm-2025')],
  retrieved: RETRIEVED_WP26,
  derived: 'Codes and names are copied as published.',
  ledger: wp26('owasp-llm-2025'),
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Work and teams (BLS)
// ---------------------------------------------------------------------------------------------------------------------------------

export const tenureByAge: BarsFigure = {
  kind: 'bars',
  id: 'bls-tenure-by-age',
  title: 'Median years with the current employer, by age, January 2026',
  description: 'Seven bars. Median tenure was 1.5 years for workers aged 20 to 24, 3.0 for 25 to 34, 4.7 for 35 to 44, 7.0 for 45 to 54, 9.6 for 55 to 64 and 9.9 for 65 and over; 4.1 for all workers aged 16 and over.',
  caption: 'The typical worker stays about four years. A small company that wants its people for longer has to plan for it: onboarding, written practice and a reason to stay.',
  items: BLS_TENURE_2026.map((t) => ({ label: t.ages, value: t.years, display: `${t.years.toFixed(1)} years`, highlight: t.ages.startsWith('All') })),
  groupLabel: 'Age group',
  valueLabel: 'Median tenure',
  sources: [sourceLine('bls-tenure-2026')],
  retrieved: RETRIEVED_WP26,
  derived: 'Values are the published medians for both sexes, copied as printed.',
  note: 'Wage and salary workers only; tenure is time with the current employer, not in the current job.',
  ledger: wp26('bls-tenure-2026'),
};

export const alternativeArrangements: BarsFigure = {
  kind: 'bars',
  id: 'bls-alternative-arrangements',
  title: 'Workers in alternative arrangements as a share of total U.S. employment, July 2023',
  description: 'Four bars. Independent contractors were 7.4 percent of total employment (11.9 million people), on-call workers 1.7 percent, temporary help agency workers 0.6 percent and workers provided by contract firms 0.5 percent.',
  caption: 'Contracting is common, at 7.4 percent of all workers, so the line between a contractor and an employee is one most young companies will have to draw.',
  items: BLS_ALTERNATIVE_2023.map((a, i) => ({ label: a.label, value: a.percent, display: `${a.percent.toFixed(1)}% (${a.people})`, highlight: i === 0 })),
  max: 10,
  groupLabel: 'Arrangement',
  valueLabel: 'Share of total employment (people)',
  sources: [sourceLine('bls-alternative-2023')],
  retrieved: RETRIEVED_WP26,
  derived: 'Values are quoted from the release, copied as printed.',
  note: 'Sole or main job only. The survey category is not a legal test: classification depends on the facts and on the law that applies.',
  ledger: wp26('bls-alternative-2023'),
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Reused from the /data/ hub (WP-35)
// ---------------------------------------------------------------------------------------------------------------------------------

const fromBars = (
  id: string,
  b: { readonly items: readonly { readonly label: string; readonly value: number; readonly display: string }[]; readonly source: StatSource; readonly title: string; readonly valueLabel: string; readonly note?: string },
  extra: { readonly description: string; readonly caption: string; readonly groupLabel: string; readonly highlight: number },
): BarsFigure => ({
  kind: 'bars',
  id,
  title: b.title,
  description: extra.description,
  caption: extra.caption,
  items: b.items.map((it, i) => ({ ...it, highlight: i === extra.highlight })),
  groupLabel: extra.groupLabel,
  valueLabel: b.valueLabel,
  sources: [b.source],
  retrieved: RETRIEVED_WP35,
  derived: 'Single figures quoted from the report as printed; no dataset is re-hosted.',
  note: b.note ?? 'Venture-backed companies on one equity platform; most companies never raise a priced round.',
  ledger: wp35('carta-spm-q1-2026'),
});

export const roundGaps = fromBars('carta-round-gaps', roundGapBars, {
  description: 'Three bars. The median gap was 2.0 years from seed to Series A, 2.1 years from Series A to Series B and 2.4 years from Series B to Series C.',
  caption: 'Each round buys about two years. A plan that expects the next raise in twelve months is planning against the median.',
  groupLabel: 'Between rounds',
  highlight: 0,
});

export const roundAges = fromBars('carta-round-ages', roundAgeBars, {
  description: 'Three bars. The median company raising a Series A was 2.8 years old, one raising a Series D 7.4 years old, and one raising a Series E or later 9.5 years old.',
  caption: 'Even the companies that raise round after round take most of a decade: the median company at a Series E or later is 9.5 years old.',
  groupLabel: 'Round',
  highlight: 2,
});

export const dilution = fromBars('carta-dilution', dilutionBars, {
  description: 'Five bars. Median dilution was about 19 percent at seed, 18 percent at Series A, 13 percent at Series B, 9.5 percent at Series C and 4.9 percent at Series D.',
  caption: 'Each early round typically gives up close to a fifth of the company, and the effect compounds over the years a company keeps raising.',
  groupLabel: 'Round',
  highlight: 0,
});

const reused = <K extends 'waffle' | 'slope' | 'ridgeline' | 'range' | 'area', P extends { readonly id: string; readonly title: string; readonly description: string; readonly caption: string; readonly sources: readonly StatSource[]; readonly derived: string }>(
  kind: K,
  props: P,
  ledger: readonly string[],
) => ({ kind, id: props.id, title: props.title, description: props.description, caption: props.caption, sources: props.sources, retrieved: RETRIEVED_WP35, derived: props.derived, ledger: wp35(...ledger), props });

export const survivalOf100: WaffleFigure = reused('waffle', survivalWaffle, ['bls-bed-total']);
export const applicationsOf1000: WaffleFigure = reused('waffle', formationWaffle, ['census-bfs-monthly']);
export const timeToPayroll: SlopeFigure = reused('slope', payrollSlope, ['census-bfs-monthly']);
export const applicationsBySector: SlopeFigure = reused('slope', sectorSlope, ['census-bfs-monthly']);
export const exitHazard: RidgelineFigure = reused('ridgeline', exitRidgeline, ['bls-bed-total']);
export const founderAge: RangeFigure = reused('range', founderAgeRange, ['azoulay-2018']);
export const founderAgeShare: AreaFigure = reused('area', ageShareArea, ['kauffman-2021']);

// ---------------------------------------------------------------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------------------------------------------------------------

export const INSIGHT_FIGURES: readonly InsightFigure[] = [
  exitByFirmAge,
  jobsByFirmAge,
  firmsBySize,
  startupsByYear,
  informationSurvival,
  ...sectorFigures,
  aiUseOverTime,
  aiUseBySector,
  nistAiRmfCore,
  owaspLlm2025,
  tenureByAge,
  alternativeArrangements,
  roundGaps,
  roundAges,
  dilution,
  survivalOf100,
  applicationsOf1000,
  timeToPayroll,
  applicationsBySector,
  exitHazard,
  founderAge,
  founderAgeShare,
];

export function figureById(id: string): InsightFigure {
  const found = INSIGHT_FIGURES.find((f) => f.id === id);
  if (found === undefined) throw new Error(`insight-figures: unknown figure "${id}"`);
  return found;
}

/**
 * The figure's values as table rows (label first). The bars and line charts print exactly these rows; for a reused /data/ chart they are the
 * values its own table prints. The sources ledger records the same rows (tests/unit/wp-26).
 */
export function figureValues(f: InsightFigure): readonly (readonly string[])[] {
  switch (f.kind) {
    case 'bars':
      return f.items.map((i) => [i.label, i.display]);
    case 'line':
      return f.points.map((p, i) => [p.label, ...f.series.map((s) => formatLine(f, s.values[i] ?? Number.NaN))]);
    case 'rank':
      return f.items.map((i) => [i.code, i.name]);
    case 'waffle':
      return f.props.groups.map((g) => [g.label, g.display]);
    case 'slope':
      return f.props.rows.map((r) => [r.label, String(r.from), String(r.to)]);
    case 'ridgeline':
      return f.props.ridges.map((r) => [r.label, ...r.values.map(String)]);
    case 'range':
      return f.props.rows.map((r) => [r.label, String(r.mean), String(r.sd)]);
    case 'area':
      return f.props.layers.map((l) => [l.label, ...l.values.map(String)]);
  }
}

export function formatLine(f: LineFigure, v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  return f.tableFormat === 'count' ? count(v) : pct1(v);
}

/** Every piece of copy a figure renders, for the copy-rule tests. */
export function figureCopy(f: InsightFigure): readonly string[] {
  const own = [f.title, f.description, f.caption, f.derived ?? '', f.note ?? '', ...f.sources.flatMap((s) => [s.label, s.period ?? ''])];
  switch (f.kind) {
    case 'bars':
      return [...own, f.groupLabel, f.valueLabel, ...f.items.flatMap((i) => [i.label, i.display])];
    case 'line':
      return [...own, f.xLabel, ...f.points.map((p) => p.label), ...f.series.map((s) => s.label), ...f.ticks.map((t) => t.label)];
    case 'rank':
      return [...own, ...f.items.flatMap((i) => [i.code, i.name])];
    default:
      return own;
  }
}
