import type { CollectionEntry } from 'astro:content';
import { getPublished } from '../../lib/content.ts';
import { LINE_ORDER, entrySlug } from './lines.ts';

export interface ServiceSummary {
  readonly slug: string;
  readonly entry: CollectionEntry<'services'>;
}

/** The published service lines in A to G order. Drafts and fixtures never appear in listings. */
export async function loadServiceLines(): Promise<ServiceSummary[]> {
  const entries = await getPublished('services');
  const summaries = entries.map((entry) => ({ slug: entrySlug(entry.id), entry }));
  return summaries.sort((a, b) => LINE_ORDER.indexOf(a.entry.data.line) - LINE_ORDER.indexOf(b.entry.data.line));
}
