import type { CtaModel } from './types.ts';

/** One row of the "Next" list of a page: a title, a ledger path and an optional line under it. */
export interface NextItem {
  readonly title: string;
  readonly href: string;
  readonly description?: string;
}

/**
 * The "Next" list with the call to action of the page as its last row. The row is the primary action of the resolved model, worded as the
 * band words it, so the list and the band of a page never name different next steps. A page whose list already links the primary target
 * keeps its own row (it is never listed twice), and a page with no resolved model keeps its list as it is.
 */
export function withCtaItem(items: readonly NextItem[], model: CtaModel | null): readonly NextItem[] {
  if (model === null || items.some((item) => item.href === model.primary.href)) return items;
  return [...items, { title: model.primary.label, href: model.primary.href, description: model.body }];
}
