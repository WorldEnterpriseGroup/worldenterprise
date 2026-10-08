import { readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The page files under src/pages, read from disk. route-state.ts used a module glob over the pages folder for this, and
 * even a lazy glob makes every page module part of every page's module graph: Astro then linked all 29 stylesheets on
 * every page. Reading the directory gives the same list without importing anything.
 */

const PAGE_EXTENSIONS = /\.(astro|md|mdx|ts|js)$/;

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** Every file below `dir`, depth first. A missing directory is an empty list. */
export function walkFiles(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

/** Page files as `/src/pages/<path>` keys, the shape `fileToRoute` takes, sorted for a stable result. */
export function listPageFiles(root: string): string[] {
  const pages = join(root, 'src', 'pages');
  const files = walkFiles(pages)
    .filter((file) => PAGE_EXTENSIONS.test(file))
    .map((file) => `/src/pages/${relative(pages, file).split(sep).join('/')}`)
    .sort();
  if (files.length === 0) {
    throw new Error(`No page files found under ${pages}. Build and dev must run from the repository root.`);
  }
  return files;
}
