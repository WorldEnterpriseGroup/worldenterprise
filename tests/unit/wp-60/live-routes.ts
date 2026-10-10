import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '../../../src/data/routes.ts';
import { listCollectionFiles } from '../../../src/lib/content-files.ts';
import { listPageFiles } from '../../../src/lib/page-files.ts';
import { computeRouteState, entryRouteIds, fileToRoute } from '../../../src/lib/route-core.ts';
import type { PageFileRoute, RouteContext } from '../../../src/lib/route-core.ts';

/** The collections src/lib/route-state.ts loads (COLLECTION_NAMES there); kept in step by the test that compares them. */
export const ROUTED_COLLECTIONS: readonly string[] = ['pages', 'services', 'playbooks', 'guides', 'insights', 'research', 'library', 'briefs'];

const isDraft = (raw: string): boolean => {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] ?? '';
  return /^draft:[ \t]*true[ \t]*$/m.test(front);
};

/**
 * The route context the build computes, read from the files instead of `astro:content`: the page files, and the ids of the published
 * (non-draft) entries of every routed collection. An entry id is its path under the collection without the extension.
 */
export function routeContextAt(root: string): RouteContext {
  const pageRoutes = listPageFiles(root).map((file) => fileToRoute(file)).filter((r): r is PageFileRoute => r !== null);
  const entryIds: Record<string, Set<string>> = {};
  for (const collection of ROUTED_COLLECTIONS) {
    const ids = new Set<string>();
    for (const rel of listCollectionFiles(root, collection)) {
      if (isDraft(readFileSync(join(root, 'src', 'content', collection, rel), 'utf8'))) continue;
      for (const id of entryRouteIds(collection, rel.replace(/\.mdx?$/, ''))) ids.add(id);
    }
    entryIds[collection] = ids;
  }
  return { pageRoutes, entryIds };
}

/** The live routes of the working tree: what `getRouteState()` reports, so nav, the sitemap and an article's links all see the same set. */
export function liveRoutesAt(root: string): ReadonlySet<string> {
  return computeRouteState(routeContextAt(root), routes).live;
}
