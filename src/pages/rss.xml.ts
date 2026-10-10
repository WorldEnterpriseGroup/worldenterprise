import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { feedItems } from '../components/geo/feed.ts';
import { site } from '../data/site.ts';
import { getPublished } from '../lib/content.ts';
import { getRouteState } from '../lib/route-state.ts';
import { href } from '../lib/url.ts';

const SELF_LINK = `<atom:link href="${site.origin}/rss.xml" rel="self" type="application/rss+xml" /><language>en-us</language>`;

/**
 * Feed of insights and research briefs: published (non-draft) entries whose route exists, newest first (src/components/geo/feed.ts).
 * An empty feed is valid; it is what ships until the first article is published.
 */
export async function GET(context: APIContext): Promise<Response> {
  const state = await getRouteState();
  const items = feedItems(await getPublished('insights'), await getPublished('research'), (route) => state.isLive(route));
  const origin = context.site ?? new URL(site.origin);
  return rss({
    title: `${site.name}: insights and research`,
    description: 'Practical, sourced articles and research briefs for SaaS founders, from World Enterprise Editorial.',
    site: origin,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: SELF_LINK,
    items: items.map((item) => ({
      title: item.title,
      description: item.description,
      link: href(item.path),
      pubDate: item.pubDate,
      categories: [item.category],
    })),
  });
}
