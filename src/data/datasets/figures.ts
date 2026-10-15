import { apportion } from '../../components/visuals/charts/dataviz.ts';
import type { StatSource } from '../../components/visuals/contracts.ts';
import { BED_SURVIVAL_INFORMATION, BED_SURVIVAL_PROFESSIONAL, BED_SURVIVAL_TOTAL, BED_YEARLY_SURVIVAL_TOTAL } from './bed-survival.generated.ts';
import {
  BFS_APPLICATIONS_BY_SECTOR,
  BFS_APPLICATIONS_TOTAL,
  BFS_APPLICATION_YEARS,
  BFS_FORMATIONS_4Q,
  BFS_FORMATIONS_8Q,
  BFS_QUARTERS_TO_PAYROLL_4Q,
  BFS_QUARTERS_TO_PAYROLL_8Q,
} from './bfs.generated.ts';
import { AZOULAY_SOURCE, FOUNDER_AGE_BY_SEGMENT, FOUNDER_AGE_BY_TIER } from './founder-age.ts';
import { MEDIAN_DILUTION, MILESTONES } from './funding-clock.ts';
import {
  KAUFFMAN_AGE_SHARE_YEARS,
  KAUFFMAN_RATE_20_34,
  KAUFFMAN_RATE_35_44,
  KAUFFMAN_RATE_45_54,
  KAUFFMAN_RATE_55_64,
  KAUFFMAN_RATE_YEARS,
  KAUFFMAN_SHARE_20_34,
  KAUFFMAN_SHARE_35_44,
  KAUFFMAN_SHARE_45_54,
  KAUFFMAN_SHARE_55_64,
} from './kauffman.generated.ts';
import { RETRIEVED, datasetSource } from './sources.ts';
import type { DatasetSourceId } from './types.ts';

/**
 * Everything the /data/ charts draw, derived from the typed datasets in this folder. Pure data and arithmetic (no Astro), so the unit
 * tests can check every figure against the published numbers and every caption against the data it describes.
 */

export const src = (id: DatasetSourceId): StatSource => {
  const s = datasetSource(id);
  return { label: s.short, href: s.url, period: s.published };
};

const at = <T>(list: readonly T[], i: number, what: string): T => {
  const v = list[i];
  if (v === undefined) throw new Error(`figures: ${what} has no value at index ${i}`);
  return v;
};
const round1 = (n: number): number => Math.round(n * 10) / 10;
export const thousandsOf = (n: number): string => n.toLocaleString('en-US');
const yearIndex = (years: readonly number[], year: number): number => {
  const i = years.indexOf(year);
  if (i < 0) throw new Error(`figures: year ${year} is not in the series`);
  return i;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Survival
// ---------------------------------------------------------------------------------------------------------------------------------

export const GROUP_2015 = 2015;
const g2015 = BED_SURVIVAL_TOTAL[GROUP_2015];
if (g2015 === undefined) throw new Error('figures: the 2015 opening-year group is missing');
export const SURVIVAL_2015_YEAR1 = at(g2015, 1, '2015 group');
export const SURVIVAL_2015_YEAR5 = at(g2015, 5, '2015 group');
export const SURVIVAL_2015_YEAR10 = at(g2015, 10, '2015 group');

export const survivalWaffle = {
  id: 'waffle-2015',
  title: 'Of 100 establishments that opened in 2015, how many were still open at year 10',
  description: `A grid of 100 squares. ${round1(100 - SURVIVAL_2015_YEAR1)} closed within the first year, ${round1(SURVIVAL_2015_YEAR1 - SURVIVAL_2015_YEAR5)} in years 2 to 5, ${round1(SURVIVAL_2015_YEAR5 - SURVIVAL_2015_YEAR10)} in years 6 to 10, and ${SURVIVAL_2015_YEAR10} were still open ten years after opening.`,
  caption: `${SURVIVAL_2015_YEAR10} of every 100 were still open at year 10. Most of the closing happens in the first five years; the years after are quieter.`,
  groups: [
    { label: 'closed in year 1', value: round1(100 - SURVIVAL_2015_YEAR1), display: `${round1(100 - SURVIVAL_2015_YEAR1)}%`, tone: 0 },
    { label: 'closed in years 2 to 5', value: round1(SURVIVAL_2015_YEAR1 - SURVIVAL_2015_YEAR5), display: `${round1(SURVIVAL_2015_YEAR1 - SURVIVAL_2015_YEAR5)}%`, tone: 1 },
    { label: 'closed in years 6 to 10', value: round1(SURVIVAL_2015_YEAR5 - SURVIVAL_2015_YEAR10), display: `${round1(SURVIVAL_2015_YEAR5 - SURVIVAL_2015_YEAR10)}%`, tone: 3 },
    { label: 'still open at year 10', value: SURVIVAL_2015_YEAR10, display: `${SURVIVAL_2015_YEAR10}%`, tone: 2 },
  ],
  unit: 'one in every hundred establishments that opened in 2015',
  total: 100 as const,
  sources: [src('bls-bed-total')],
  derived: 'Each share is a difference between two published survival rates (all private industries); the squares are rounded to add to 100.',
};

const MULTIPLE_GROUPS = [1994, 2000, 2005, 2010, 2015, 2020] as const;
const seriesAt = (rec: Readonly<Record<number, readonly number[]>>, year: number): readonly number[] => {
  const v = rec[year];
  if (v === undefined) throw new Error(`figures: opening-year group ${year} is missing`);
  return v;
};
export const AGES = Array.from({ length: 32 }, (_, i) => i);
export const survivalMultiples = {
  id: 'multiples-survival',
  title: 'Share of establishments still open, by years since opening, six opening-year groups',
  description:
    'Six small charts, one per opening-year group from 1994 to 2020, drawn on the same axes. In every group the share still open falls steeply in the first five years and then flattens; later groups are drawn only as far as they have been observed.',
  caption: 'Same axes, six decades of openings: the shape of the first years barely changes.',
  xs: AGES,
  panels: MULTIPLE_GROUPS.map((y) => ({
    label: `Opened ${y}`,
    series: [
      { label: 'All private industries', values: seriesAt(BED_SURVIVAL_TOTAL, y) },
      { label: 'Information', values: seriesAt(BED_SURVIVAL_INFORMATION, y) },
      { label: 'Professional, scientific and technical', values: seriesAt(BED_SURVIVAL_PROFESSIONAL, y) },
    ],
  })),
  yMax: 100,
  unit: '%',
  columns: 3,
  xLabel: 'Year',
  tableXs: [0, 1, 2, 3, 5, 7, 10, 15, 20, 25, 30],
  sources: [src('bls-bed-total'), src('bls-bed-information'), src('bls-bed-professional')],
  derived: 'Values are copied as printed. Years since opening are the number of Marches after the opening year.',
};

const RIDGE_GROUPS = [1994, 1997, 2000, 2003, 2006, 2009, 2012] as const;
export const RIDGE_AGES = Array.from({ length: 13 }, (_, i) => i + 1);
export const exitRidgeline = {
  id: 'ridgeline-exits',
  title: 'Share of survivors that close in each year of life, seven opening-year groups',
  description:
    'Seven curves, one per opening-year group, show the percent of establishments open at the start of a year that are gone by the next March. Each curve peaks in year 1, at 20 to 23 percent, and falls to between 4 and 6.5 percent by year 13.',
  caption: 'The risk is front-loaded: year 1 is by far the hardest, and it keeps easing for a decade.',
  xs: RIDGE_AGES,
  ridges: RIDGE_GROUPS.map((y) => ({ label: String(y), values: RIDGE_AGES.map((a) => round1(100 - at(seriesAtYearly(y), a - 1, `${y} yearly survival`))) })),
  yMax: 25,
  unit: '%',
  xLabel: 'Year of life',
  sources: [src('bls-bed-total')],
  derived: 'Each value is 100 minus the published survival rate of the previous year\'s survivors (all private industries).',
};
function seriesAtYearly(year: number): readonly number[] {
  return seriesAt(BED_YEARLY_SURVIVAL_TOTAL, year);
}

const SWARM_GROUPS = Array.from({ length: 27 }, (_, i) => 1994 + i);
const swarmRow = (label: string, rec: Readonly<Record<number, readonly number[]>>) => ({
  label,
  dots: SWARM_GROUPS.map((y) => ({ label: `Opened ${y}`, value: at(seriesAt(rec, y), 5, `${label} ${y}`) })),
});
export const fiveYearSwarm = {
  id: 'beeswarm-year5',
  title: 'Share still open at year 5, every opening-year group from 1994 to 2020',
  description:
    'Three rows of 27 dots, one per opening-year group, show the share of establishments still open five years after opening: all private industries, Information, and Professional, scientific and technical services. Every dot falls between about 33 and 53 percent.',
  caption: 'Twenty-seven groups, three industries: about half of all establishments are gone by year 5, and the number barely moves from group to group.',
  rows: [swarmRow('All private industries', BED_SURVIVAL_TOTAL), swarmRow('Information', BED_SURVIVAL_INFORMATION), swarmRow('Professional, scientific and technical', BED_SURVIVAL_PROFESSIONAL)],
  min: 30,
  max: 55,
  unit: '%',
  dotLabel: 'Opening-year group',
  sources: [src('bls-bed-total'), src('bls-bed-information'), src('bls-bed-professional')],
  derived: 'Each dot is the published survival rate at year 5 of one opening-year group.',
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------------------------------------------------------------------

const sector = (key: string): readonly number[] => {
  const v = BFS_APPLICATIONS_BY_SECTOR[key];
  if (v === undefined) throw new Error(`figures: sector ${key} is missing`);
  return v;
};
const GROUPED_SECTORS: readonly { readonly key: string; readonly label: string; readonly short: string }[] = [
  { key: 'NAICS54', label: 'Professional, scientific and technical services', short: 'Professional and technical' },
  { key: 'NAICSRET', label: 'Retail trade', short: 'Retail' },
  { key: 'NAICS23', label: 'Construction', short: 'Construction' },
  { key: 'NAICS62', label: 'Health care and social assistance', short: 'Health care' },
  { key: 'NAICSTW', label: 'Transportation and warehousing', short: 'Transport' },
];
const groupedLayers = GROUPED_SECTORS.map((g) => ({ label: g.label, short: g.short, values: sector(g.key) }));
const otherLayer = BFS_APPLICATIONS_TOTAL.map((t, i) => t - groupedLayers.reduce((sum, l) => sum + at(l.values, i, l.label), 0));
export const APPLICATIONS_2025 = at(BFS_APPLICATIONS_TOTAL, yearIndex(BFS_APPLICATION_YEARS, 2025), 'applications');
export const APPLICATIONS_2005 = at(BFS_APPLICATIONS_TOTAL, yearIndex(BFS_APPLICATION_YEARS, 2005), 'applications');

export const applicationsStack = {
  id: 'area-applications',
  title: 'U.S. business applications by industry, 2005 to 2025',
  description: `Stacked areas of yearly applications. The total rose from ${thousandsOf(APPLICATIONS_2005)} in 2005 to ${thousandsOf(APPLICATIONS_2025)} in 2025; retail trade and professional services are the two largest named layers, and the all-other layer is the rest of the economy.`,
  caption: `More people start than ever: ${thousandsOf(APPLICATIONS_2025)} applications in 2025, more than double 2005. Starting is not the hard part.`,
  xs: BFS_APPLICATION_YEARS,
  layers: [...groupedLayers, { label: 'All other industries', short: 'All other', values: otherLayer }],
  mode: 'stack' as const,
  unit: 'k',
  divisor: 1000,
  xLabel: 'Year',
  sources: [src('census-bfs-monthly')],
  derived: 'Each value is the sum of twelve monthly not-seasonally-adjusted counts; "All other industries" is the total minus the five named industries.',
};

const SLOPE_SECTORS: readonly { readonly key: string; readonly label: string; readonly highlight?: boolean }[] = [
  { key: 'NAICSRET', label: 'Retail trade' },
  { key: 'NAICS54', label: 'Professional and technical', highlight: true },
  { key: 'NAICS23', label: 'Construction' },
  { key: 'NAICS62', label: 'Health care' },
  { key: 'NAICSTW', label: 'Transportation' },
  { key: 'NAICS51', label: 'Information', highlight: true },
  { key: 'NAICS72', label: 'Accommodation and food' },
];
export const sectorSlope = {
  id: 'slope-sectors',
  title: 'Business applications by industry, 2005 and 2025',
  description: 'Seven lines from 2005 to 2025 show yearly applications in thousands. Every industry shown rose; retail trade rose most, from about 300 thousand to 1.17 million. Professional and technical services and Information are highlighted.',
  caption: 'Every industry shown has more people starting than in 2005, including the software-adjacent ones.',
  fromLabel: '2005',
  toLabel: '2025',
  rows: SLOPE_SECTORS.map((s) => {
    const v = sector(s.key);
    return { label: s.label, from: at(v, 0, s.key), to: at(v, v.length - 1, s.key), highlight: s.highlight === true };
  }),
  unit: 'k',
  divisor: 1000,
  places: 0,
  sources: [src('census-bfs-monthly')],
  derived: 'Values are annual sums of monthly counts.',
};

const I2021 = yearIndex(BFS_APPLICATION_YEARS, 2021);
export const QUARTERS_8Q_2005 = at(BFS_QUARTERS_TO_PAYROLL_8Q, 0, 'quarters to payroll');
export const QUARTERS_8Q_2021 = at(BFS_QUARTERS_TO_PAYROLL_8Q, 2021 - 2005, 'quarters to payroll');
export const payrollSlope = {
  id: 'slope-payroll',
  title: 'Average quarters from application to first payroll, 2005 and 2021',
  description: `Two lines from 2005 to 2021. Among applications that became employer businesses within eight quarters, the average wait rose from ${QUARTERS_8Q_2005} to ${QUARTERS_8Q_2021} quarters; within four quarters it rose from ${at(BFS_QUARTERS_TO_PAYROLL_4Q, 0, 'q4')} to ${at(BFS_QUARTERS_TO_PAYROLL_4Q, 16, 'q4')}.`,
  caption: `Getting from an application to a first payroll now takes about ${QUARTERS_8Q_2021} quarters on average, up from ${QUARTERS_8Q_2005} in 2005.`,
  fromLabel: '2005',
  toLabel: '2021',
  rows: [
    { label: 'Within 8 quarters', from: QUARTERS_8Q_2005, to: QUARTERS_8Q_2021, highlight: true },
    { label: 'Within 4 quarters', from: at(BFS_QUARTERS_TO_PAYROLL_4Q, 0, 'q4'), to: at(BFS_QUARTERS_TO_PAYROLL_4Q, 16, 'q4') },
  ],
  unit: ' quarters',
  places: 2,
  sources: [src('census-bfs-monthly')],
  derived: 'Values are the published average duration (BF_DUR4Q and BF_DUR8Q) for applications filed that year. They cover only applications that formed an employer business.',
};

const APPS_2021 = at(BFS_APPLICATIONS_TOTAL, I2021, 'applications 2021');
const F4_2021 = at(BFS_FORMATIONS_4Q, 2021 - 2005, 'formations 4Q');
const F8_2021 = at(BFS_FORMATIONS_8Q, 2021 - 2005, 'formations 8Q');
const FORMATION_SQUARES = apportion([F4_2021, F8_2021 - F4_2021, APPS_2021 - F8_2021], 1000);
export const formationWaffle = {
  id: 'waffle-2021-applications',
  title: 'Of 1,000 business applications filed in 2021, how many became employers',
  description: `A grid of 1,000 squares, each one in a thousand of the applications filed in 2021. ${FORMATION_SQUARES[0]} squares formed employer businesses within four quarters, ${FORMATION_SQUARES[1]} more in quarters five to eight, and the other ${FORMATION_SQUARES[2]} had not formed an employer business within eight quarters.`,
  caption: `Most applications do not reach a first payroll within two years: about ${round1((F8_2021 / APPS_2021) * 100)} in every 100 do.`,
  groups: [
    { label: 'formed within 4 quarters', value: F4_2021, display: `${thousandsOf(F4_2021)}`, tone: 0 },
    { label: 'formed in quarters 5 to 8', value: F8_2021 - F4_2021, display: `${thousandsOf(F8_2021 - F4_2021)}`, tone: 1 },
    { label: 'no employer business within 8 quarters', value: APPS_2021 - F8_2021, display: `${thousandsOf(APPS_2021 - F8_2021)}`, tone: 5 },
  ],
  unit: 'one in a thousand of the applications filed in 2021',
  total: 1000 as const,
  sources: [src('census-bfs-monthly')],
  derived: 'Counts are the 2021 annual sums of applications (BA_BA) and of formations within four and eight quarters; the squares are rounded to add to 1,000. An application is not a launched business.',
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Who starts
// ---------------------------------------------------------------------------------------------------------------------------------

export const ageShareArea = {
  id: 'area-age-share',
  title: 'Share of new entrepreneurs by age group, 1996 to 2021',
  description:
    'A 100 percent stacked area. The share of new entrepreneurs aged 20 to 34 fell from 34.3 percent in 1996 to 26.2 percent in 2021, while the share aged 55 to 64 rose from 14.8 to 22.8 percent.',
  caption: 'Founders are getting older: the 55 to 64 group went from about 1 in 7 to more than 1 in 5.',
  xs: KAUFFMAN_AGE_SHARE_YEARS,
  layers: [
    { label: 'Ages 20 to 34', values: KAUFFMAN_SHARE_20_34 },
    { label: 'Ages 35 to 44', values: KAUFFMAN_SHARE_35_44 },
    { label: 'Ages 45 to 54', values: KAUFFMAN_SHARE_45_54 },
    { label: 'Ages 55 to 64', values: KAUFFMAN_SHARE_55_64 },
  ],
  mode: 'percent' as const,
  unit: '%',
  xLabel: 'Year',
  sources: [src('kauffman-2021')],
  derived: 'Values are copied as printed (Table 3); the chart redraws each year to 100.',
};

export const ageRateMultiples = {
  id: 'multiples-age-rate',
  title: 'Rate of new entrepreneurs by age group, 1996 to 2025',
  description:
    'Four small charts, one per age group, on the same axes. The monthly rate of new entrepreneurs aged 35 to 54 has risen since 1996 (ages 35 to 44: 0.31 percent then, 0.43 percent in 2025); the rate for ages 20 to 34 has stayed near 0.25 percent.',
  caption: 'Every age group starts businesses; the rate has risen for people aged 35 to 54 and stayed flat for the youngest group.',
  xs: KAUFFMAN_RATE_YEARS,
  panels: [
    { label: 'Ages 20 to 34', series: [{ label: 'Rate of new entrepreneurs', values: KAUFFMAN_RATE_20_34 }] },
    { label: 'Ages 35 to 44', series: [{ label: 'Rate of new entrepreneurs', values: KAUFFMAN_RATE_35_44 }] },
    { label: 'Ages 45 to 54', series: [{ label: 'Rate of new entrepreneurs', values: KAUFFMAN_RATE_45_54 }] },
    { label: 'Ages 55 to 64', series: [{ label: 'Rate of new entrepreneurs', values: KAUFFMAN_RATE_55_64 }] },
  ],
  yMax: 0.5,
  unit: '%',
  columns: 2,
  places: 2,
  xLabel: 'Year',
  tableXs: [1996, 2000, 2005, 2010, 2015, 2020, 2025],
  sources: [src('kauffman-2025')],
  derived: 'Values are copied as printed (Table 5): the percent of non-owners in an age group who start a business in a month.',
};

export const founderAgeRange = {
  id: 'range-founder-age',
  title: 'Average founder age by growth tier, startups founded 2007 to 2009',
  description:
    'Six rows with a dot at the mean founder age and a bar for one standard deviation either side. All startups average 41.8 years; the fastest-growing 1 in 1,000 average 45.0; startups that exited by IPO or acquisition average 46.7. The bars overlap almost entirely.',
  caption: 'The firms that grew fastest were not founded by the youngest people. They were founded by people in their mid-forties.',
  rows: FOUNDER_AGE_BY_TIER.map((t, i) => ({ label: t.tier, mean: t.mean, sd: t.sd, n: thousandsOf(t.founders), highlight: i === 4 || i === 5 })),
  min: 20,
  max: 70,
  unit: ' years',
  nLabel: 'Founders in the group',
  sources: [src(AZOULAY_SOURCE)],
  derived: 'Means, standard deviations and founder counts are copied from Table 5 as printed; growth is employment five years after founding.',
};

export const founderAgeScatter = {
  id: 'scatter-founder-age',
  title: 'Founder age: all startups against the fastest-growing 1 in 1,000, nine groups of firms',
  description:
    'Nine dots, one per group of firms (the United States, four regions, entrepreneurial hubs, technology employment, venture-backed firms and patenting firms). Every dot lies above the line where the two ages are equal, so in every group the fastest-growing firms had older founders than the typical startup.',
  caption: 'In all nine groups, the founders of the fastest-growing firms were older than the average founder.',
  items: FOUNDER_AGE_BY_SEGMENT.map((s, i) => ({ label: s.segment, x: s.allStartups, y: s.topTenth, highlight: i === 0 })),
  xLabel: 'Mean age of all startups’ founders (years)',
  yLabel: 'Mean age of founders of the fastest-growing 1 in 1,000 (years)',
  min: 40,
  max: 48,
  unit: ' years',
  diagonalLabel: 'Equal ages',
  sources: [src(AZOULAY_SOURCE)],
  derived: 'Values are copied from Tables 5 (panels A and B) as printed.',
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Funding clock
// ---------------------------------------------------------------------------------------------------------------------------------

export const GANTT_GROUPS = ['Getting started', 'Funding rounds', 'Staying open', 'When it ends'] as const;
const groupName: Readonly<Record<string, (typeof GANTT_GROUPS)[number]>> = {
  formation: 'Getting started',
  funding: 'Funding rounds',
  survival: 'Staying open',
  shutdown: 'When it ends',
};
export const milestoneGantt = {
  id: 'gantt-milestones',
  title: 'How long each stage takes: published figures on one clock',
  description:
    'Eleven rows on a ten-year clock. The first payroll takes about 0.6 of a year after the application; seed to Series A takes a median 2.0 years; the median company raising a Series A is 2.8 years old and one raising a Series E or later is 9.5. Half of new establishments are gone at year 5.',
  caption: 'Fast weeks, slow years: each stage is measured in years, not quarters.',
  rows: MILESTONES.map((m) => ({
    id: m.id,
    label: m.label,
    start: m.start,
    end: m.end,
    kind: m.kind,
    figure: m.figure,
    group: groupName[m.group] ?? 'Getting started',
  })),
  groups: GANTT_GROUPS as readonly string[],
  max: 10,
  unit: 'years',
  sources: [src('census-bfs-monthly'), src('gem-us-2020'), src('carta-spm-q1-2026'), src('bls-bed-total'), src('cb-insights-2026')],
  derived: 'Each row is one published figure placed on the clock; bars are separate durations measured from the same start, not a chain that adds up. Carta figures are quoted one by one.',
  note: 'Figures describe all U.S. businesses or, for the funding rows, venture-backed companies. They are not WE’s results.',
};

export const dilutionBars = {
  items: MEDIAN_DILUTION.map((d) => ({ label: d.stage, value: d.percent, display: `about ${d.percent}%` })),
  source: src('carta-spm-q1-2026'),
  title: 'Median ownership given up in each round, by stage',
  valueLabel: 'Median dilution',
  note: 'Quoted one by one from the publisher’s report; the figures are approximate as printed.',
};

export const roundGapBars = {
  items: [
    { label: 'Seed to Series A', value: 2.0, display: '2.0 years' },
    { label: 'Series A to Series B', value: 2.1, display: '2.1 years' },
    { label: 'Series B to Series C', value: 2.4, display: '2.4 years' },
  ],
  source: src('carta-spm-q1-2026'),
  title: 'Median years between funding rounds',
  valueLabel: 'Median gap',
};

export const roundAgeBars = {
  items: [
    { label: 'Series A', value: 2.8, display: '2.8 years old' },
    { label: 'Series D', value: 7.4, display: '7.4 years old' },
    { label: 'Series E or later', value: 9.5, display: '9.5 years old' },
  ],
  source: src('carta-spm-q1-2026'),
  title: 'Median age of the company at each round',
  valueLabel: 'Median company age',
};

export { RETRIEVED };
