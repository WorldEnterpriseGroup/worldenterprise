import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeRouteState, entryRouteIds, fileToRoute } from '../../lib/route-core.ts';
import type { PageFileRoute, RouteContext } from '../../lib/route-core.ts';
import { listCollectionFiles } from '../../lib/content-files.ts';
import { listPageFiles } from '../../lib/page-files.ts';

/**
 * The liveness predicate of the CTA system (docs/wave8-contracts.md, section 6.1): is a ledger path a route that this build emits.
 *
 * `src/lib/route-state.ts` answers the same question from `astro:content`, which does not exist inside a Satteri hast plugin, under
 * plain Node or under `node --test`. This module answers it from `node:fs` alone, with the same pure logic (`computeRouteState`):
 * the page files come from `listPageFiles` and the published collection entries from the files of `src/content`. A draft entry is
 * not an entry, exactly as in route-state.ts. A CTA whose target is not live is dropped, never rendered as a dead link.
 */

const CONTENT_EXTENSIONS = /\.mdx?$/;

/** The collections whose entries can back a route (the same list as COLLECTION_NAMES in route-state.ts). */
const COLLECTIONS: readonly string[] = ['pages', 'services', 'playbooks', 'guides', 'insights', 'research', 'library', 'briefs'];

/** Whether the frontmatter block of a Markdown or MDX file carries `draft: true`. */
export function isDraftFile(raw: string): boolean {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1];
  return block !== undefined && /^draft:[ \t]*true[ \t]*$/m.test(block);
}

function readEntry(root: string, collection: string, rel: string): string {
  const file = join(root, 'src', 'content', collection, rel);
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${file} to decide whether it is a draft: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The route context of the repository at `root`, read from disk. */
export function routeContextFromDisk(root: string): RouteContext {
  const pageRoutes: PageFileRoute[] = [];
  for (const file of listPageFiles(root)) {
    const route = fileToRoute(file);
    if (route !== null) pageRoutes.push(route);
  }
  const entryIds: Record<string, Set<string>> = {};
  for (const collection of COLLECTIONS) {
    const ids = new Set<string>();
    for (const rel of listCollectionFiles(root, collection)) {
      if (isDraftFile(readEntry(root, collection, rel))) continue;
      for (const id of entryRouteIds(collection, rel.replace(CONTENT_EXTENSIONS, ''))) ids.add(id);
    }
    entryIds[collection] = ids;
  }
  return { pageRoutes, entryIds };
}

/** A predicate over ledger paths for the repository at `root`. The disk is read once, when the predicate is first used. */
export function createDiskLiveness(root: string): (path: string) => boolean {
  let live: ReadonlySet<string> | undefined;
  return (path) => {
    live ??= computeRouteState(routeContextFromDisk(root)).live;
    return live.has(path);
  };
}

let shared: ((path: string) => boolean) | undefined;

/** The predicate for the working directory, which is the repository root for a build, the dev server and `node --test`. Memoised. */
export function isLiveOnDisk(path: string): boolean {
  shared ??= createDiskLiveness(process.cwd());
  return shared(path);
}
