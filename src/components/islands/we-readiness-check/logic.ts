/**
 * Pure logic for the readiness self-check. No DOM and no Astro imports, so `node --test` can load it.
 * The self-check lists gaps. It never produces a score, a percentage, a count or a prediction.
 */
export interface GapSource {
  readonly id: string;
  readonly title: string;
  readonly href: string;
}

export interface Gap {
  readonly id: string;
  readonly title: string;
  readonly href: string;
}

/** Returns the statements that are not confirmed, in their original order. */
export function collectGaps(items: readonly GapSource[], confirmed: ReadonlySet<string>): Gap[] {
  return items.filter((item) => !confirmed.has(item.id)).map((item) => ({ id: item.id, title: item.title, href: item.href }));
}
