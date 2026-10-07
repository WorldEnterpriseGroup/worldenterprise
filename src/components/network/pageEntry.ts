import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

/**
 * Finds a page entry by its folder. The glob loader collapses an index file to the folder name, so
 * `founders/index.mdx` has the id "founders"; a named file keeps its full path.
 */
export async function getPageEntry(...ids: readonly string[]): Promise<CollectionEntry<'pages'>> {
  const entries = await getCollection('pages');
  const found = entries.find((entry) => ids.includes(entry.id));
  if (found === undefined) throw new Error(`Missing content entry for ${ids.join(' or ')} in src/content/pages.`);
  return found;
}
