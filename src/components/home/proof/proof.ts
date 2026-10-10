/**
 * The home page's "Promise and proof" rows (wave 7, WP-44): four statements, the page that holds the evidence for each, and how the
 * statement is grounded. The source leads and the row links to it, so a reader checks a claim in one click. The statements are the
 * four that the home page has published since wave 5 (claims C-01, C-02, C-03, C-04, C-05); none is new.
 *
 * Pure data, free of Astro globals, so `node --test` imports it.
 */

export type ProofBasis = 'framework' | 'editorial-judgement';

export interface ProofRow {
  /** The statement as published. */
  readonly claim: string;
  /** The page that holds the evidence, named for the reader. */
  readonly source: string;
  /** Ledger path of that page. Every path here must be a launch:true ledger row (unit test). */
  readonly sourceHref: string;
  readonly basis: ProofBasis;
}

export const PROOF: readonly ProofRow[] = [
  { claim: 'WE is a digital incubator for SaaS and works fully remotely.', source: 'How the program works', sourceHref: '/program/how-it-works/', basis: 'framework' },
  { claim: 'Team seats are dedicated to one company and steered by WE.', source: 'Dedicated seats, steered by WE', sourceHref: '/program/dedicated-teams/', basis: 'framework' },
  { claim: 'Each stage ends with evidence you can inspect, not a promised outcome.', source: 'Dream, Build and Grow', sourceHref: '/program/dream/', basis: 'editorial-judgement' },
  { claim: 'WE does not promise funding.', source: 'Fundability and investor readiness', sourceHref: '/fundability/', basis: 'editorial-judgement' },
];

export const BASIS_LABEL: Readonly<Record<ProofBasis, string>> = {
  framework: 'Published framework',
  'editorial-judgement': 'Editorial judgment',
};

export interface ResolvedProofRow {
  readonly claim: string;
  readonly source: string;
  /** Undefined when the source page is not built, so the row never links to a page that does not exist. */
  readonly sourceHref: string | undefined;
  readonly basis: ProofBasis;
}

/** The rows for a build: a source whose page is not live keeps its label and loses its link. */
export function resolveProof(isLive: (path: string) => boolean, rows: readonly ProofRow[] = PROOF): readonly ResolvedProofRow[] {
  return rows.map((row) => ({
    claim: row.claim,
    source: row.source,
    sourceHref: isLive(row.sourceHref) ? row.sourceHref : undefined,
    basis: row.basis,
  }));
}
