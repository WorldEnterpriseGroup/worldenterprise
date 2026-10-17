import { DESK_LABELS, isDeskId } from '../../data/desks.ts';

/**
 * The items of /rss.xml, chosen from the insights and research collections: a published entry whose route is live, newest first.
 * Pure, so a unit test feeds it entries and a fabricated route state. Nothing else is in the feed: a thank-you page, a hub and a
 * brief squeeze page are not articles, and a desk added to src/data/desks.ts needs no edit here because the category is its label.
 */

export interface FeedEntry {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly description: string;
    readonly publishedDate: Date;
    /** The desk id of an insight. */
    readonly topic?: string | undefined;
  };
}

export interface FeedItem {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly pubDate: Date;
  readonly category: string;
}

const lastSegment = (id: string): string => id.split('/').at(-1) ?? id;

export function feedItems(
  insights: readonly FeedEntry[],
  research: readonly FeedEntry[],
  isLive: (route: string) => boolean,
): readonly FeedItem[] {
  const items: FeedItem[] = [];
  for (const entry of insights) {
    const path = `/insights/${lastSegment(entry.id)}/`;
    if (!isLive(path)) continue;
    const topic = entry.data.topic;
    items.push({
      title: entry.data.title,
      description: entry.data.description,
      path,
      pubDate: entry.data.publishedDate,
      category: topic !== undefined && isDeskId(topic) ? DESK_LABELS[topic].name : 'Insights',
    });
  }
  for (const entry of research) {
    const path = `/research/${lastSegment(entry.id)}/`;
    if (!isLive(path)) continue;
    items.push({ title: entry.data.title, description: entry.data.description, path, pubDate: entry.data.publishedDate, category: 'Research' });
  }
  return items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime() || a.title.localeCompare(b.title, 'en'));
}
