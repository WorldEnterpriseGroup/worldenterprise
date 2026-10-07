import { getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

/**
 * Loads a marketing or legal page entry from the `pages` collection. The glob loader may strip a trailing
 * `/index` from the entry id, so both spellings are tried before the build fails with a precise message.
 */
export async function loadPage(id: string): Promise<CollectionEntry<'pages'>> {
  const entry = (await getEntry('pages', id)) ?? (await getEntry('pages', id.replace(/\/index$/, '')));
  if (entry === undefined) {
    throw new Error(`Missing content entry src/content/pages/${id}.md for this route.`);
  }
  return entry;
}
