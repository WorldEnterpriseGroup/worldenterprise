import { isDeskId } from '../data/desks.ts';
import { CATEGORY_IDS as ECOSYSTEM_CATEGORY_IDS } from '../data/ecosystem/types.ts';
import { FAMILIES } from '../data/families.ts';
import { MACHINE_ROUTES, routes } from '../data/routes.ts';
import type { RouteRow } from '../data/routes.ts';

/**
 * Pure route-existence logic, free of Astro globals so it runs under `node --test`.
 * src/lib/route-state.ts feeds it the page files (read from disk) and published collection ids.
 */

/** Dynamic page pattern to the collection whose entry ids supply the parameter. */
export const DYNAMIC_COLLECTIONS: Readonly<Record<string, string>> = {
  '/insights/[slug]/': 'insights',
  '/research/[slug]/': 'research',
  '/library/[slug]/': 'library',
  '/services/[slug]/': 'services',
  '/playbooks/[slug]/': 'playbooks',
  '/fundability/[slug]/': 'guides',
  // The squeeze pages: a brief has a route once its open abstract exists, and never before (contracts section 5).
  '/briefs/[id]/': 'briefs',
};

/** Dynamic patterns whose parameter comes from a fixed list instead of a collection. */
export const DYNAMIC_FIXED: Readonly<Record<string, readonly string[]>> = {
  // src/pages/newsletter/[...slug].astro emits only /newsletter/ itself (an empty rest segment).
  '/newsletter/[...slug]/': [''],
  // src/pages/ecosystem/[category].astro emits one page per directory category, from the same list (WP-33). Without this row isLive()
  // treated every /ecosystem/<category>/ page as missing, so no CTA or band could link to one.
  '/ecosystem/[category]/': ECOSYSTEM_CATEGORY_IDS,
};

/**
 * Collections whose pages are routed by the last segment of the entry id, because entries sit in
 * sub-folders (insights/dream/<slug>.mdx) while the URL is flat (/insights/<slug>/).
 */
const LAST_SEGMENT_COLLECTIONS: ReadonlySet<string> = new Set(['insights']);

/**
 * The topic page of a desk. The parameter is a desk id from src/data/desks.ts, and the page exists only once the desk holds a
 * published article (src/pages/insights/topic/[topic].astro emits exactly those desks), so a desk nobody has written for leaves no dead route.
 */
export const DESK_TOPIC_PATTERN = '/insights/topic/[topic]/';

/** Whether a published `insights` entry sits in the desk folder (entry ids are `<desk>/<slug>`). */
function deskHoldsArticle(desk: string, ctx: RouteContext): boolean {
  const prefix = `${desk}/`;
  for (const id of ctx.entryIds.insights ?? []) {
    if (id.startsWith(prefix)) return true;
  }
  return false;
}

/** The ids under which a published entry can satisfy a dynamic route parameter. */
export function entryRouteIds(collection: string, id: string): readonly string[] {
  if (!LAST_SEGMENT_COLLECTIONS.has(collection)) return [id];
  const last = id.split('/').at(-1);
  return last === undefined || last === id ? [id] : [id, last];
}

export interface PageFileRoute {
  /** Route pattern with trailing slash (or a file name), for example /insights/[slug]/ */
  readonly pattern: string;
  readonly dynamic: boolean;
}

/** Converts a glob key such as /src/pages/insights/[slug].astro to a route pattern. Returns null for ignored files. */
export function fileToRoute(file: string): PageFileRoute | null {
  const rel = file.replace(/^\/?src\/pages\//, '');
  if (rel.split('/').some((segment) => segment.startsWith('_'))) return null;
  const noExt = rel.replace(/\.(astro|md|mdx|ts|js)$/, '');
  const isEndpoint = /\.(ts|js)$/.test(rel);
  if (noExt === '404' && !isEndpoint) return { pattern: '/404.html', dynamic: false };
  let pattern: string;
  if (isEndpoint && /\.[a-z]+$/.test(noExt)) {
    pattern = `/${noExt}`;
  } else if (noExt === 'index') {
    pattern = '/';
  } else if (noExt.endsWith('/index')) {
    pattern = `/${noExt.slice(0, -'index'.length)}`;
  } else {
    pattern = `/${noExt}/`;
  }
  return { pattern, dynamic: pattern.includes('[') };
}

function segments(path: string): string[] {
  return path.split('/').filter((s) => s !== '');
}

/** Returns the parameter values when `path` matches the dynamic `pattern`, else null. */
export function matchDynamic(pattern: string, path: string): Record<string, string> | null {
  const p = segments(pattern);
  const q = segments(path);
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i += 1) {
    const seg = p[i] ?? '';
    const rest = /^\[\.\.\.(.+)\]$/.exec(seg);
    if (rest?.[1] !== undefined) {
      // An optional rest segment matches zero remaining parts and yields ''.
      params[rest[1]] = q.slice(i).join('/');
      return params;
    }
    const one = /^\[(.+)\]$/.exec(seg);
    const value = q[i];
    if (value === undefined) return null;
    if (one?.[1] !== undefined) {
      params[one[1]] = value;
    } else if (seg !== value) {
      return null;
    }
  }
  return q.length === p.length ? params : null;
}

export interface RouteContext {
  /** Route patterns from src/pages. */
  readonly pageRoutes: readonly PageFileRoute[];
  /** Published (non-draft) entry ids per collection. */
  readonly entryIds: Readonly<Record<string, ReadonlySet<string>>>;
}

function pagesEntryExists(prefixSegments: string[], param: string, ctx: RouteContext): boolean {
  const ids = ctx.entryIds.pages;
  if (ids === undefined) return false;
  // The root of a rest route (`industries/[...hub]`) has an empty parameter; dropping it keeps the base `industries`, not `industries/`.
  const base = [...prefixSegments, param].filter((part) => part !== '').join('/');
  return ids.has(base) || ids.has(`${base}/index`);
}

/**
 * The hub of a page family whose entries live in the `pages` collection, mapped to the entry id that holds its copy (`<folder>/index`, the
 * `program/index` precedent). A hub with no such entry is pending: a static `index.astro` alone must not publish an empty hub on fallback copy.
 */
const HUB_ENTRY_IDS: ReadonlyMap<string, string> = new Map(
  FAMILIES.flatMap((family) => (family.collection === 'pages' && family.hub !== undefined ? [[family.hub.path, `${family.folder}/index`] as const] : [])),
);

/** Whether a ledger path is backed by a page file (and, for dynamic pages, by a published entry). */
export function routeExists(path: string, ctx: RouteContext): boolean {
  const hubEntry = HUB_ENTRY_IDS.get(path);
  if (hubEntry !== undefined && ctx.entryIds.pages?.has(hubEntry) !== true) return false;
  for (const page of ctx.pageRoutes) {
    if (!page.dynamic) {
      if (page.pattern === path) return true;
      continue;
    }
    const params = matchDynamic(page.pattern, path);
    if (params === null) continue;
    if (page.pattern === DESK_TOPIC_PATTERN) {
      const desk = params.topic;
      if (desk !== undefined && isDeskId(desk) && deskHoldsArticle(desk, ctx)) return true;
      continue;
    }
    const fixed = DYNAMIC_FIXED[page.pattern];
    if (fixed !== undefined) {
      if (Object.values(params).every((v) => fixed.includes(v))) return true;
      continue;
    }
    const collection = DYNAMIC_COLLECTIONS[page.pattern];
    const value = Object.values(params)[0];
    if (value === undefined) continue;
    if (collection !== undefined) {
      if (ctx.entryIds[collection]?.has(value) === true) return true;
      continue;
    }
    // Fallback for any other dynamic page: a `pages` entry whose id mirrors the path.
    const prefix = segments(page.pattern).filter((s) => !s.startsWith('['));
    if (pagesEntryExists(prefix, value, ctx)) return true;
  }
  return false;
}

export interface RouteState {
  readonly live: ReadonlySet<string>;
  readonly missing: readonly string[];
  isLive(href: string): boolean;
}

/** Computes which launch:true ledger rows (and launched machine routes) exist. */
export function computeRouteState(ctx: RouteContext, ledger: readonly RouteRow[] = routes): RouteState {
  const live = new Set<string>();
  const missing: string[] = [];
  for (const r of ledger) {
    if (!r.launch) continue;
    if (routeExists(r.path, ctx)) live.add(r.path);
    else missing.push(r.path);
  }
  for (const m of MACHINE_ROUTES) {
    if (!m.launch) continue;
    if (m.generated === 'page') {
      if (routeExists(m.path, ctx)) live.add(m.path);
      else missing.push(m.path);
    } else {
      live.add(m.path);
    }
  }
  return { live, missing, isLive: (href) => live.has(href) };
}
