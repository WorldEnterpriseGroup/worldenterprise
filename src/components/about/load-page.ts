import { getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

/**
 * Loads a marketing or legal page entry from the `pages` collection. The glob loader strips a trailing `/index` from the
 * entry id, so the stripped id is tried first: asking for `press/index` first makes Astro log "Entry pages → press/index was
 * not found" on every build. The id as given is the fallback, then the build fails with a precise message.
 */
export async function loadPage(id: string): Promise<CollectionEntry<'pages'>> {
  const stripped = id.replace(/\/index$/, '');
  const entry = (await getEntry('pages', stripped)) ?? (stripped === id ? undefined : await getEntry('pages', id));
  if (entry === undefined) {
    throw new Error(`Missing content entry src/content/pages/${id}.md for this route.`);
  }
  return entry;
}
