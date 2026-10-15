/**
 * Types shared by the /data/ datasets (WP-35). A dataset is a typed module of figures copied from a public source; the source registry
 * (sources.ts) records where each figure came from, when it was retrieved and how WE transformed it. Pure data: no Astro imports, so
 * `node --test` can check it (tests/unit/wp-35).
 */

export type DatasetSourceId =
  | 'bls-bed-total'
  | 'bls-bed-information'
  | 'bls-bed-professional'
  | 'census-bfs-monthly'
  | 'census-bfs-definitions'
  | 'kauffman-2025'
  | 'kauffman-2021'
  | 'azoulay-2018'
  | 'carta-spm-q1-2026'
  | 'cb-insights-2026'
  | 'sba-faq-2026'
  | 'gem-us-2020';

export type SourceKind = 'official-statistics' | 'peer-reviewed' | 'research-foundation' | 'industry-report';

export interface DatasetSource {
  readonly id: DatasetSourceId;
  /** The document's title as its publisher gives it. */
  readonly title: string;
  readonly publisher: string;
  /** The exact page or file that was fetched. Always https. */
  readonly url: string;
  /** When the publisher released it (as precisely as the document says). */
  readonly published: string;
  /** The date WE fetched it, YYYY-MM-DD. */
  readonly retrieved: string;
  readonly kind: SourceKind;
  /** The short citation used in a chart's source line. */
  readonly short: string;
  /** What WE did to the published figures (nothing, a sum, a difference, a rounding). */
  readonly transformation: string;
  /** Limits on what the figures say. */
  readonly caveats: readonly string[];
  /** Licence or usage note, where the publisher states one. */
  readonly usage?: string;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}
