/**
 * The sourced figures the hubs show (WP-24). Every number comes from the ST register in src/data/sales/stats.ts or from the WP-35
 * datasets (src/data/datasets/figures.ts); this module only turns a register entry into the `Stat` the visuals take, with its source
 * line and period. No hub invents a statistic. The ids each hub cites are listed in HUB_STATS so the tests can check every one against
 * the ledger (.astro-magazine/sources/wp-24.json). Pure data, no Astro imports.
 */
import type { Stat, StatSource } from '../visuals/contracts.ts';
import { STATS } from '../../data/sales/stats.ts';
import type { StatId } from '../../data/sales/stats.ts';
import { salesSource } from '../../data/sales/sources.ts';

/** The source line of a register entry: the first source it cites, with the period the figure describes. */
export function statSourceOf(id: StatId): StatSource {
  const entry = STATS[id];
  const first = entry.sources[0];
  if (first === undefined) throw new Error(`hubs/stats: ${id} cites no source`);
  const s = salesSource(first);
  return { label: s.short, href: s.url, period: entry.period };
}

/** A register entry as a stat tile. */
export function tile(id: StatId, icon?: string): Stat {
  const entry = STATS[id];
  return { value: entry.value, label: entry.label, source: statSourceOf(id), ...(icon !== undefined ? { icon } : {}) };
}

/** The register ids each hub shows, for the ledger test. Charts from the WP-35 datasets are listed by figure id in HUB_FIGURES. */
export const HUB_STATS = {
  '/insights/': ['ST-02', 'ST-03', 'ST-04'],
  '/resources/': ['ST-06', 'ST-07', 'ST-08'],
  '/compare/': ['ST-10', 'ST-01', 'ST-02', 'ST-04', 'ST-34'],
  '/industries/': ['ST-35', 'ST-02'],
  '/founders/': ['ST-16', 'ST-17', 'ST-18', 'ST-27'],
  '/investors/': ['ST-33', 'ST-11'],
  '/faq/': ['ST-10', 'ST-02'],
} as const satisfies Readonly<Record<string, readonly StatId[]>>;

/** The WP-35 dataset figures each hub reuses (by the figure's export name), for the ledger test. */
export const HUB_FIGURES = {
  '/industries/': ['fiveYearSwarm'],
  '/founders/': ['founderAgeScatter'],
  '/investors/': ['dilutionBars', 'roundGapBars'],
} as const;
