/** Shared brand vocabulary. Plain TypeScript with no Astro imports, so unit tests and the lead's audit can import it under node. */

/** One vector composition per page-family hero (and the two hubs that have no family of their own). */
export const COMPOSITION_IDS = ['segments', 'industries', 'compare', 'journey', 'investors', 'partners', 'briefs', 'resources'] as const;
export type CompositionId = (typeof COMPOSITION_IDS)[number];

/** The ground a brand element sits on. A dark band exists (decision D-8) but never carries the logo. */
export const GROUNDS = ['light', 'tint', 'dark'] as const;
export type Ground = (typeof GROUNDS)[number];

export function isCompositionId(value: string): value is CompositionId {
  return (COMPOSITION_IDS as readonly string[]).includes(value);
}
