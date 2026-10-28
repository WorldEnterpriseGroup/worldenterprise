import { getCollection } from 'astro:content';
import { effectiveRouteMode, FORM_ROUTES } from '../data/forms.ts';
import { routes } from '../data/routes.ts';
import { readFlag } from './env.ts';
import { listPageFiles } from './page-files.ts';
import { computeRouteState, entryRouteIds, fileToRoute } from './route-core.ts';
import type { PageFileRoute, RouteContext, RouteState } from './route-core.ts';

/**
 * Build-time route state: which launch:true ledger rows actually exist. Nav, sitemap, RSS, search and the
 * HTML site map must be generated from `state.live`, never from the raw ledger.
 */
export const COLLECTION_NAMES = ['pages', 'services', 'playbooks', 'guides', 'insights', 'research', 'library', 'briefs'] as const;


function pageRoutes(): PageFileRoute[] {
  const found: PageFileRoute[] = [];
  // Read from disk, not through a module glob: a glob over the pages folder puts every page's stylesheet on every page.
  for (const file of listPageFiles(process.cwd())) {
    const route = fileToRoute(file);
    if (route !== null) found.push(route);
  }
  return found;
}

interface DraftAware {
  readonly id: string;
  readonly data: { readonly draft?: boolean };
}

async function loadEntries(name: (typeof COLLECTION_NAMES)[number]): Promise<readonly DraftAware[]> {
  return (await getCollection(name)) as readonly DraftAware[];
}

let cached: Promise<{ state: RouteState; drafts: readonly string[] }> | undefined;

async function build(): Promise<{ state: RouteState; drafts: readonly string[] }> {
  const entryIds: Record<string, Set<string>> = {};
  const drafts: string[] = [];
  for (const name of COLLECTION_NAMES) {
    const ids = new Set<string>();
    for (const entry of await loadEntries(name)) {
      if (entry.data.draft === true) drafts.push(`${name}/${entry.id}`);
      else for (const id of entryRouteIds(name, entry.id)) ids.add(id);
    }
    entryIds[name] = ids;
  }
  const ctx: RouteContext = { pageRoutes: pageRoutes(), entryIds };
  return { state: computeRouteState(ctx), drafts };
}

/** Memoised route state for the whole build. */
export async function getRouteState(): Promise<RouteState> {
  cached ??= build();
  return (await cached).state;
}

/** Paths of draft entries across all collections (unfinished content). */
export async function getDraftEntries(): Promise<readonly string[]> {
  cached ??= build();
  return (await cached).drafts;
}

export function isReleaseBuild(): boolean {
  return readFlag('PUBLIC_RELEASE');
}

/**
 * Release assertions (PUBLIC_RELEASE=1): every launch:true route exists, no draft content remains, and no
 * launched form route is disabled. Throws one error listing every violation. A no-op for other builds.
 */
export async function assertReleaseReady(): Promise<void> {
  if (!isReleaseBuild()) return;
  const state = await getRouteState();
  const drafts = await getDraftEntries();
  const problems: string[] = [];
  for (const path of state.missing) problems.push(`launch:true route does not exist: ${path}`);
  for (const draft of drafts) problems.push(`draft content remains: ${draft}`);
  for (const r of routes) {
    const formId = FORM_ROUTES[r.path];
    if (r.launch && formId !== undefined && effectiveRouteMode(r.path) === 'disabled') {
      problems.push(`launched form route ${r.path} has form "${formId}" in disabled mode`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Release assertions failed (${problems.length}):\n- ${problems.join('\n- ')}`);
  }
}
