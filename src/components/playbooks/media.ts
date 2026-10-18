/**
 * The media moments of each playbook page (WP-23, #89): a generated cover, a step-flow diagram of the playbook's own steps, and one
 * sourced figure that frames the question the playbook answers. The figures live in research/media/data.ts and render through
 * briefs/BriefFigure.astro, so every number comes from the sources and claims registers; nothing is typed in here. A playbook added
 * later without an entry gets the survival curve, so it still shows three moments.
 */
import type { BriefFigure } from '../briefs/media.ts';
import { SOURCES } from '../research/media/data.ts';

export type SourceKey = keyof typeof SOURCES;

/** The source each figure is drawn from (the key in SOURCES). */
export const FIGURE_SOURCE: Readonly<Record<BriefFigure, SourceKey>> = {
  'approval-by-age': 'sbcs',
  formation: 'census',
  'survival-information': 'bls',
  'survival-all': 'bls',
  'shutdowns-fit': 'cbi',
  'shutdowns-capital': 'cbi',
  'age-at-round': 'carta',
  hiring: 'census',
  'track-record': 'gompers',
  'founder-age': 'azoulay',
  'industry-experience': 'azoulay',
};

export type PlaybookMoment =
  | { readonly type: 'cover'; readonly id: string }
  | { readonly type: 'flow'; readonly id: string }
  | { readonly type: 'figure'; readonly id: string; readonly figure: BriefFigure; readonly source: SourceKey };

/** Which figure each playbook shows. */
export const PLAYBOOK_FIGURES: Readonly<Record<string, BriefFigure>> = {
  'validate-the-problem': 'shutdowns-fit',
  'design-the-product': 'survival-information',
  'set-up-the-company': 'formation',
  'build-and-ship-v1': 'survival-all',
  'hire-your-first-team-member': 'hiring',
  'price-your-first-saas-product': 'shutdowns-capital',
  'earn-your-first-customers': 'shutdowns-fit',
  'run-your-first-outbound-sequence': 'survival-information',
  'build-repeatable-growth': 'survival-all',
  'prepare-for-investor-conversations': 'age-at-round',
};

const FALLBACK: BriefFigure = 'survival-all';

/** The moments of one playbook, in reading order. */
export function playbookMedia(slug: string): readonly PlaybookMoment[] {
  const figure = PLAYBOOK_FIGURES[slug] ?? FALLBACK;
  return [
    { type: 'cover', id: 'playbook-cover' },
    { type: 'figure', id: 'playbook-figure', figure, source: FIGURE_SOURCE[figure] },
    { type: 'flow', id: 'playbook-step-flow' },
  ];
}

/** Stat tiles are a stats moment; everything else here is a chart. */
export const figureKind = (figure: BriefFigure): 'stats' | 'chart' => (figure === 'formation' || figure === 'hiring' ? 'stats' : 'chart');
