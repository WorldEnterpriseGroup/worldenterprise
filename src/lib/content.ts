import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { isReleaseBuild } from './route-state.ts';

/**
 * Collection helpers. Pages render every entry in dev and preview (so unfinished work can be inspected) but mark drafts
 * noindex; release builds never see drafts because assertReleaseReady() fails first.
 */
export type PublicCollection = 'pages' | 'services' | 'playbooks' | 'guides' | 'insights' | 'research' | 'library';

export function isDraft(entry: { readonly data: { readonly draft?: boolean } }): boolean {
  return entry.data.draft === true;
}

/** Entries for static path generation. Drafts are included except in release builds. */
export async function getRenderable<K extends PublicCollection>(name: K): Promise<CollectionEntry<K>[]> {
  const entries = await getCollection(name);
  return isReleaseBuild() ? entries.filter((e) => !isDraft(e)) : entries;
}

/** Entries that may appear in nav, sitemap, RSS, search and listings: never drafts. */
export async function getPublished<K extends PublicCollection>(name: K): Promise<CollectionEntry<K>[]> {
  const entries = await getCollection(name);
  return entries.filter((e) => !isDraft(e));
}
