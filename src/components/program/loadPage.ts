import { getEntry, render } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

/** Loads a `pages` collection entry by id and renders its MDX body. Fails the build with a clear message if it is missing. */
export async function loadPage(id: string): Promise<{
  readonly data: CollectionEntry<'pages'>['data'];
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
}> {
  const entry = await getEntry('pages', id);
  if (entry === undefined) throw new Error(`Content entry pages/${id} not found. Expected src/content/pages/${id}.mdx.`);
  const { Content } = await render(entry);
  return { data: entry.data, Content };
}
