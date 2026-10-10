import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { routeOfEntry } from '../../../src/components/reference/resources.ts';
import { listPageFiles } from '../../../src/lib/page-files.ts';
import { computeRouteState, entryRouteIds, fileToRoute } from '../../../src/lib/route-core.ts';
import type { PageFileRoute, RouteState } from '../../../src/lib/route-core.ts';
import type { MetaCollection, MetaEntry } from '../../../src/components/reference/resources.ts';

/**
 * The content entries the Resources hub reads, taken from the files on disk the way the collections would give them: the title and the
 * description of each non-draft entry, and the file each came from (the sentence ledger maps a sentence to its file).
 */
export interface DiskEntry extends MetaEntry {
  readonly file: string;
}

const FOLDERS: ReadonlyArray<{ readonly collection: MetaCollection; readonly folder: string }> = [
  { collection: 'pages', folder: 'src/content/pages' },
  { collection: 'library', folder: 'src/content/library' },
  { collection: 'guides', folder: 'src/content/guides' },
  { collection: 'playbooks', folder: 'src/content/playbooks' },
  { collection: 'research', folder: 'src/content/research' },
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

interface Frontmatter {
  readonly title?: string;
  readonly description?: string;
  readonly draft?: boolean;
}

export function readDiskEntries(root: string): DiskEntry[] {
  const entries: DiskEntry[] = [];
  for (const { collection, folder } of FOLDERS) {
    for (const path of filesUnder(join(root, folder))) {
      const text = readFileSync(path, 'utf8');
      const match = /^---\n([\s\S]*?)\n---/.exec(text);
      if (match?.[1] === undefined) continue;
      const data = parse(match[1]) as Frontmatter;
      if (data.draft === true || data.title === undefined) continue;
      const id = relative(join(root, folder), path).replace(/\.mdx?$/, '');
      entries.push({
        collection,
        id,
        title: data.title,
        ...(data.description === undefined ? {} : { description: data.description }),
        file: relative(root, path),
      });
    }
  }
  return entries;
}

/** The route of each disk entry, for provenance checks: the first entry wins when two collections claim a route. */
export function routesOf(entries: readonly DiskEntry[]): Map<string, DiskEntry> {
  const byRoute = new Map<string, DiskEntry>();
  for (const entry of entries) {
    const route = routeOfEntry(entry.collection, entry.id);
    if (!byRoute.has(route)) byRoute.set(route, entry);
  }
  return byRoute;
}

/** The collections the build counts as pages (COLLECTION_NAMES in src/lib/route-state.ts). */
const ROUTE_COLLECTIONS = ['pages', 'services', 'playbooks', 'guides', 'insights', 'research', 'library', 'briefs'] as const;

/**
 * The route state of the tree on disk, computed by the build's own pure functions: the page files under src/pages and the published
 * (non-draft) entry ids of each collection. A route the hub lists is live here exactly when it is live in the build.
 */
export function routeStateOnDisk(root: string): RouteState {
  const pageRoutes = listPageFiles(root).flatMap((file): PageFileRoute[] => {
    const route = fileToRoute(file);
    return route === null ? [] : [route];
  });
  const entryIds: Record<string, Set<string>> = {};
  for (const collection of ROUTE_COLLECTIONS) {
    const ids = new Set<string>();
    const folder = join(root, 'src/content', collection);
    for (const path of filesUnder(folder)) {
      const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, 'utf8'));
      const data = match?.[1] === undefined ? {} : (parse(match[1]) as Frontmatter);
      if (data.draft === true) continue;
      for (const id of entryRouteIds(collection, relative(folder, path).replace(/\.mdx?$/, ''))) ids.add(id);
    }
    entryIds[collection] = ids;
  }
  return computeRouteState({ pageRoutes, entryIds });
}
