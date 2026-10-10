import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { routeOfEntry } from '../../../src/components/reference/resources.ts';
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
