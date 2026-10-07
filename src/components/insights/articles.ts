import type { CollectionEntry } from 'astro:content';
import { DESKS } from '../../data/routes.ts';
import type { Desk } from '../../data/routes.ts';
import { getPublished } from '../../lib/content.ts';
import { pickRelated } from './related.ts';
import type { RelatedItem } from './related.ts';

export { DESKS };
export type { Desk };
export type Insight = CollectionEntry<'insights'>;

export const DESK_LABELS: Readonly<Record<Desk, { readonly name: string; readonly blurb: string }>> = {
  dream: { name: 'Dream', blurb: 'Decide what to build, and whether to build it, before any code exists.' },
  build: { name: 'Build', blurb: 'Scope, staff and ship a first release without over-building.' },
  grow: { name: 'Grow', blurb: 'Win the first customers and keep them.' },
  fundable: { name: 'Fundable', blurb: 'Prepare evidence that survives diligence. No promise of funding.' },
};

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

/** Word count of prose: strips frontmatter-free MDX imports, JSX tags and markdown punctuation. */
export function countWords(body: string): number {
  const text = body
    .replace(/^import .*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|\-]{1,}/g, ' ');
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** Published insights, newest first, then title. */
export async function listInsights(desk?: Desk): Promise<Insight[]> {
  const all = await getPublished('insights');
  return all
    .filter((e) => desk === undefined || e.data.topic === desk)
    .sort((a, b) => b.data.publishedDate.getTime() - a.data.publishedDate.getTime() || a.data.title.localeCompare(b.data.title));
}

/** Related-rail items: service line, playbook, template (live routes only), then up to two siblings from the desk. */
export function relatedFor(entry: Insight, siblings: readonly Insight[], isLive: (path: string) => boolean): RelatedItem[] {
  const own = pickRelated(
    { services: entry.data.relatedServices, playbook: entry.data.relatedPlaybook, template: entry.data.relatedTemplate },
    isLive,
  );
  const more = siblings
    .filter((s) => s.id !== entry.id && s.data.topic === entry.data.topic)
    .slice(0, 2)
    .map((s) => ({ kind: `More in ${DESK_LABELS[s.data.topic].name}`, title: s.data.title, href: insightPath(s) }));
  return [...own, ...more];
}
