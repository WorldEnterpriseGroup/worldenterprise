/**
 * Wording for the Investor Introductions add-on (claim C-14, owner decision of 2026-10-09).
 *
 * The add-on is a separate, paid service with a securities-safe structure: a flat fee for curation and preparation that does
 * not depend on any investment closing, no stake or transaction-based pay, no negotiation of terms, no securities advice, no
 * handling of funds, a limited number of curated introductions made only after the line F readiness criteria are met, and no
 * promise of a meeting, a reply or funding.
 *
 * The two sentences below are checked against claims-denylist.json by tests/unit/wp-18 (rules R-C14-*), and scripts/audit-claims.mjs
 * requires them in the built pages. Counsel reviews this wording before the gh-pages release (.astro-magazine/handoffs/wp-18.md).
 */

/** The owner's disclaimer, verbatim. Shown wherever the add-on is named. */
export const INTRODUCTIONS_DISCLAIMER =
  'Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.';

/** The sentence that fixes the fee structure. Shown on the pages that describe the add-on in full, and on the pricing page. */
export const INTRODUCTIONS_FLAT_FEE = 'The fee does not depend on whether any investment closes.';

export interface ReadinessCriterion {
  /** The line F artifact or record the criterion comes from (see src/content/services/fundability-and-investor-readiness.mdx). */
  readonly artifact: string;
  /** What must be in place before WE curates any introduction. */
  readonly inPlace: string;
}

/** The readiness criteria, mapped to the artifacts of Service Line F. */
export const INTRODUCTIONS_READINESS: readonly ReadinessCriterion[] = [
  { artifact: 'Readiness assessment', inPlace: 'Complete, with no kind of evidence marked missing.' },
  { artifact: 'Corporate and cap-table records', inPlace: 'Organized and reconciled so they match your counsel’s records.' },
  { artifact: 'Evidence index', inPlace: 'Every traction statement linked to a source record, and reviewed by a company officer.' },
  { artifact: 'Financial model', inPlace: 'Assumptions written down and outputs reproducible.' },
  { artifact: 'Data room', inPlace: 'Organized against a standard index, each folder complete or marked not applicable.' },
  { artifact: 'Pitch materials', inPlace: 'Every factual claim tied to evidence.' },
];
