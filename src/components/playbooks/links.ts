import { getRouteState } from '../../lib/route-state.ts';

/** Splits a site path into the route part and any hash or query, so the ledger lookup sees the route only. */
function routeOf(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

/**
 * True when an internal path points at a route that exists in this build. Pages owned by other work packages
 * may not exist yet on a branch; linking only to live routes keeps every build free of dead links.
 */
export async function isLinkable(path: string): Promise<boolean> {
  if (!path.startsWith('/')) return true;
  if (path.startsWith('#')) return true;
  const state = await getRouteState();
  return state.isLive(routeOf(path));
}

export interface LinkItem {
  readonly title: string;
  readonly href: string;
  readonly description?: string;
}

/** Keeps only the items whose target route exists. */
export async function liveItems<T extends { readonly href: string }>(items: readonly T[]): Promise<T[]> {
  const kept: T[] = [];
  for (const item of items) {
    if (await isLinkable(item.href)) kept.push(item);
  }
  return kept;
}
