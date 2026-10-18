import { resolveCta } from '../../data/cta/index.ts';
import type { CtaCollection, CtaModel, CtaVariant } from '../../data/cta/index.ts';
import { getRouteState } from '../../lib/route-state.ts';

export interface PageCtaInput {
  readonly path: string;
  readonly collection: CtaCollection;
  /** The desk id, for an article. */
  readonly topic?: string | undefined;
  /** The frontmatter `cta` override of the document. */
  readonly cta?: { readonly variant: CtaVariant; readonly briefId?: string | undefined } | undefined;
}

/**
 * The call to action the default map of `src/data/cta` gives a document, or null. The end band (`CtaEnd`) and the side rail of a prose
 * page (`ProseRail`) both read it here, so the two can never name different targets for one page.
 */
export async function resolvePageCta({ path, collection, topic, cta }: PageCtaInput): Promise<CtaModel | null> {
  const state = await getRouteState();
  return resolveCta(
    {
      path,
      collection,
      ...(topic !== undefined ? { topic } : {}),
      ...(cta !== undefined ? { frontmatterCta: { variant: cta.variant, ...(cta.briefId !== undefined ? { briefId: cta.briefId } : {}) } } : {}),
    },
    state.isLive,
  );
}
