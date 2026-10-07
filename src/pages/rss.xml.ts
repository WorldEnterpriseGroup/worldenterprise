import rss from '@astrojs/rss';
import type { RSSFeedItem } from '@astrojs/rss';
import type { APIContext } from 'astro';
import { insightPath } from '../components/insights/articles.ts';
import { site } from '../data/site.ts';
import { getPublished } from '../lib/content.ts';
import { getRouteState } from '../lib/route-state.ts';
import { href } from '../lib/url.ts';

const SELF_LINK = `<atom:link href="${site.origin}/rss.xml" rel="self" type="application/rss+xml" /><language>en-us</language>`;

/**
 * Feed of insights and research briefs: published (non-draft) entries whose route exists, newest first.
 * An empty feed is valid; it is what ships until the first article is published.
 */
export async function GET(context: APIContext): Promise<Response> {
  const state = await getRouteState();
  const dated: { readonly date: number; readonly item: RSSFeedItem }[] = [];

  for (const entry of await getPublished('insights')) {
    const path = insightPath(entry);
    if (!state.isLive(path)) continue;
    dated.push({
      date: entry.data.publishedDate.getTime(),
      item: {
        title: entry.data.title,
        description: entry.data.description,
        link: href(path),
        pubDate: entry.data.publishedDate,
        categories: [entry.data.topic],
      },
    });
  }
  for (const entry of await getPublished('research')) {
    const slug = entry.id.split('/').at(-1) ?? entry.id;
    const path = `/research/${slug}/`;
    if (!state.isLive(path)) continue;
    dated.push({
      date: entry.data.publishedDate.getTime(),
      item: {
        title: entry.data.title,
        description: entry.data.description,
        link: href(path),
        pubDate: entry.data.publishedDate,
        categories: ['research'],
      },
    });
  }
  dated.sort((a, b) => b.date - a.date);

  const origin = context.site ?? new URL(site.origin);
  return rss({
    title: `${site.name}: insights and research`,
    description: 'Practical, sourced articles and research briefs for SaaS founders, from World Enterprise Editorial.',
    site: origin,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: SELF_LINK,
    items: dated.map((d) => d.item),
  });
}
