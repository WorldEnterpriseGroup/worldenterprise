import { getPublished } from '../../lib/content.ts';
import { getRouteState } from '../../lib/route-state.ts';
import type { IsLive } from './actions.ts';
import type { FamilyLink } from './types.ts';
import { readingPath } from './view.ts';
import type { ArticleRef } from './view.ts';

/**
 * Build-time loaders for the family routes: the liveness predicate and the reading path. Everything they decide goes through the
 * pure modules (paths.ts, actions.ts, view.ts); these functions only read the collections and the route state.
 */

/** Whether a ledger path is a live route in this build. Fail-closed: an unknown path is not live. */
export async function loadIsLive(): Promise<IsLive> {
  const state = await getRouteState();
  return (path) => state.isLive(path);
}

/** The articles of the `insights` collection as the reading path sees them. A route is `/insights/<last segment of the id>/`. */
async function loadArticles(): Promise<readonly ArticleRef[]> {
  const entries = await getPublished('insights');
  return entries.map((entry) => ({
    title: entry.data.title,
    href: `/insights/${entry.id.split('/').at(-1) ?? entry.id}/`,
    summary: entry.data.description,
    segments: entry.data.segments,
    published: entry.data.publishedDate,
  }));
}

/** The reading path of a segment: its articles that are live in this build, newest first. */
export async function loadReading(slug: string): Promise<readonly FamilyLink[]> {
  const [articles, isLive] = await Promise.all([loadArticles(), loadIsLive()]);
  return readingPath(articles, slug).filter((link) => isLive(link.href));
}
