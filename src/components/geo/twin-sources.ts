import { getCollection } from 'astro:content';
import denylist from '../../../claims-denylist.json';
import { routes } from '../../data/routes.ts';
import { getPublished } from '../../lib/content.ts';
import { getRouteState } from '../../lib/route-state.ts';
import { twinPath } from '../../lib/markdown-twins.ts';
import type { RequiredRuleLike, TwinSource } from '../../lib/markdown-twins.ts';
import { assembleTwins } from './assemble.ts';
import type { AssembledTwins, TwinContent } from './assemble.ts';

/**
 * The twins of this build. Loads the collections, asks the route state which pages are built, and hands both to assembleTwins
 * (pure, tested over the real content). The result is memoised for the build, so the .md endpoint, the llms files and the
 * `rel=alternate` link in SeoHead all see the same set.
 */

const REQUIRED: readonly RequiredRuleLike[] = denylist.required as readonly RequiredRuleLike[];

/** The FAQ and glossary pages fix their date by hand (src/pages/faq/index.astro, src/pages/glossary/index.astro). */
const REFERENCE_UPDATED = new Date('2026-10-06');

const INDEXABLE: ReadonlySet<string> = new Set(routes.filter((r) => r.indexable).map((r) => r.path));

async function load(): Promise<AssembledTwins> {
  const state = await getRouteState();
  const [insights, research, pages, guides, services, playbooks, faq, glossary] = await Promise.all([
    getPublished('insights'),
    getPublished('research'),
    getPublished('pages'),
    getPublished('guides'),
    getPublished('services'),
    getPublished('playbooks'),
    getCollection('faq'),
    getCollection('glossary'),
  ]);
  const content: TwinContent = {
    insights,
    research,
    pages,
    guides,
    services,
    playbooks,
    faq: faq.filter((e) => e.data.draft !== true).map((e) => ({ question: e.data.question, answer: e.data.answer, group: e.data.group })),
    glossary: glossary.filter((e) => e.data.draft !== true).map((e) => ({ term: e.data.term, definition: e.data.definition, group: e.data.group })),
    referenceUpdated: REFERENCE_UPDATED,
  };
  return assembleTwins(content, {
    isEligible: (route) => state.isLive(route) && INDEXABLE.has(route),
    isLive: (route) => state.isLive(route),
    required: REQUIRED,
  });
}

let cached: Promise<AssembledTwins> | undefined;

/** Every twin of this build, in a stable order, with the entries that were skipped and why. */
export async function getTwins(): Promise<AssembledTwins> {
  cached ??= load();
  return cached;
}

/** The twin source for a page route, or undefined. */
export async function getTwin(route: string): Promise<TwinSource | undefined> {
  return (await getTwins()).twins.find((t) => t.route === route);
}

/** The routes that have a twin. */
export async function getTwinRoutes(): Promise<ReadonlySet<string>> {
  return new Set((await getTwins()).twins.map((t) => t.route));
}

/** The twin URL path of a page, or null when the page has no twin. SeoHead asks this for the `rel=alternate` link. */
export async function twinPathFor(route: string): Promise<string | null> {
  return (await getTwinRoutes()).has(route) ? twinPath(route) : null;
}
