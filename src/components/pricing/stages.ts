import type { StageKey, WePackage } from '../../data/packages.ts';

/**
 * Short names for the four published company stages, for a radio label, a select option or an eyebrow where the full sentence does not fit.
 * Each is the opening phrase of the stage-fit sentence in src/data/packages.ts (claim C-10), shortened and never extended: the sentence
 * itself always appears next to it, verbatim. Keyed by stage key so a fifth stage cannot be added here without the data module.
 */
export const STAGE_LABELS: Readonly<Record<StageKey, string>> = {
  'idea-or-prototype': 'Idea or prototype',
  'first-product': 'First product',
  'early-customer-evidence': 'Early customer evidence',
  'several-products-or-regulated': 'Several products, or a regulated field',
};

export function stageLabel(pkg: Pick<WePackage, 'stageKey'>): string {
  return STAGE_LABELS[pkg.stageKey];
}
