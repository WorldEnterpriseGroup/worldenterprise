/**
 * The statistics the WP-56 templates may show as pull-stats. Each figure is taken from the ST register of the sales strategy
 * (worldenterprise-redesign-kit/SALES.md, section 1.6) and carries the published source line SITE-COPY.md gives it (sections 1.2 and
 * 5.5). No other number may be shown by a family template, and every block of statistics is followed by the honesty line.
 * Ledger: `.astro-magazine/sources/wp-56.json`.
 */

export interface PullStat {
  /** The register id, for the ledger and the tests. Never rendered. */
  readonly id: `ST-${string}`;
  /** The large figure. */
  readonly figure: string;
  /** One line that says what the figure counts. */
  readonly label: string;
}

export interface StatBlock {
  readonly heading: string;
  readonly stats: readonly PullStat[];
  /** The source line printed under the block. */
  readonly source: string;
}

/** Shown under every block of statistics (SITE-COPY.md, rule 5). */
export const HONESTY_LINE = "These figures describe all new U.S. businesses, not WE's results.";

/** The real clock (SITE-COPY.md 1.2): the survival curve in three figures. ST-01, ST-02, ST-03. */
export const TIMELINE_BLOCK: StatBlock = {
  heading: 'A company takes years',
  stats: [
    { id: 'ST-01', figure: '77.9%', label: 'of new U.S. establishments were still operating after one year.' },
    { id: 'ST-02', figure: '51.4%', label: 'survive five years.' },
    { id: 'ST-03', figure: '34.7%', label: 'survive ten years.' },
  ],
  source: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics, Table 7 (March 2025 release).',
};
