import { INSIGHT_FIGURES, figureValues } from '../../../src/data/insight-figures/figures.ts';
import type { LedgerRef } from '../../../src/data/insight-figures/figures.ts';
import { ARTICLE_FIGURES } from '../../../src/data/insight-figures/registry.ts';

/**
 * The `figures` section of .astro-magazine/sources/wp-26.json, as the registry produces it: for each figure, the fetches behind it, the
 * source lines it prints, how WE derived what it draws, the exact values it prints, and the articles that show it. The ledger is generated
 * from this function and the test proves the two are still equal, so neither can drift from the other.
 */
export interface LedgerFigure {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly ledger: readonly LedgerRef[];
  readonly sources: readonly { readonly label: string; readonly href: string; readonly period: string }[];
  readonly retrieved: string;
  readonly derived: string;
  readonly values: readonly (readonly string[])[];
  readonly articles: readonly string[];
}

export function ledgerFigures(): LedgerFigure[] {
  return INSIGHT_FIGURES.map((f) => ({
    id: f.id,
    kind: f.kind,
    title: f.title,
    ledger: f.ledger,
    sources: f.sources.map((s) => ({ label: s.label, href: s.href ?? '', period: s.period ?? '' })),
    retrieved: f.retrieved,
    derived: f.derived ?? '',
    values: figureValues(f),
    articles: Object.entries(ARTICLE_FIGURES)
      .filter(([, ids]) => ids.includes(f.id))
      .map(([key]) => key),
  }));
}
