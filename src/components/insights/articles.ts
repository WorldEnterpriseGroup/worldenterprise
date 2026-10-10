import type { CollectionEntry } from 'astro:content';
import { DESKS, DESK_LABELS } from '../../data/desks.ts';
import type { Desk } from '../../data/desks.ts';
import { getPublished } from '../../lib/content.ts';
import { countWords } from '../../lib/content-files.ts';
import { pickRelated, pickRelatedArticles } from './related.ts';
import type { RelatedItem } from './related.ts';

// `countWords` lives in the plain-Node module so the article rubric test can count the way the site does; it is re-exported here.
export { countWords, DESKS, DESK_LABELS };
export type { Desk };
export type Insight = CollectionEntry<'insights'>;

/** The route slug is the last segment of the collection id (entries live in desk folders). */
export function insightSlug(entry: { readonly id: string }): string {
  return entry.id.split('/').at(-1) ?? entry.id;
}

export function insightPath(entry: { readonly id: string }): string {
  return `/insights/${insightSlug(entry)}/`;
}

const WORDS_PER_MINUTE = 220;

/** Reading time in whole minutes (minimum one) from the raw entry body. */
export function readingMinutes(body: string | undefined): number {
  const words = countWords(body ?? '');
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Published insights, newest first, then title. */
export async function listInsights(desk?: Desk): Promise<Insight[]> {
  const all = await getPublished('insights');
  return all
    .filter((e) => desk === undefined || e.data.topic === desk)
    .sort((a, b) => b.data.publishedDate.getTime() - a.data.publishedDate.getTime() || a.data.title.localeCompare(b.data.title));
}

/**
 * Related-rail items: service line, playbook, template (live routes only), the articles named in `related` (live only, fail-closed),
 * then up to two siblings from the desk that are not already listed. `catalog` is every published article, so `related` may name an
 * article in another desk; it defaults to the siblings.
 */
export function relatedFor(
  entry: Insight,
  siblings: readonly Insight[],
  isLive: (path: string) => boolean,
  catalog: readonly Insight[] = siblings,
): RelatedItem[] {
  const own = pickRelated(
    { services: entry.data.relatedServices, playbook: entry.data.relatedPlaybook, template: entry.data.relatedTemplate },
    isLive,
  );
  const named = pickRelatedArticles(
    entry.data.related,
    catalog.map((a) => ({ slug: insightSlug(a), title: a.data.title })),
    isLive,
    insightSlug(entry),
  );
  const listed = new Set(named.map((n) => n.href));
  const more = siblings
    .filter((s) => s.id !== entry.id && s.data.topic === entry.data.topic && !listed.has(insightPath(s)))
    .slice(0, 2)
    .map((s) => ({ kind: `More in ${DESK_LABELS[s.data.topic].name}`, title: s.data.title, href: insightPath(s) }));
  return [...own, ...named, ...more];
}
