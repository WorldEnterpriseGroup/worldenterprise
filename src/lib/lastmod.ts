import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { walkFiles } from './page-files.ts';
import { DYNAMIC_COLLECTIONS, fileToRoute, matchDynamic } from './route-core.ts';

/**
 * Sitemap lastmod lookup (WP-09 request W15-1). Runs in Node at config time, never inside a page.
 * A route's lastmod is the date the page itself declares as its modified date, so the sitemap, the JSON-LD dateModified and
 * article:modified_time always agree (the build audit compares them). In order:
 *   1. the `updatedDate` / `updated` / `publishedDate` frontmatter of the route's content entry, the same fallback chain
 *      ArticleLayout and BriefLayout use for their `updated` prop;
 *   2. a literal `updated={new Date('YYYY-MM-DD')}` in the page file, for a page with no content entry (the FAQ and the glossary);
 *   3. otherwise the date of the last git commit that touched the entry, or the page file when no entry backs the route.
 * When none of these is known the route gets no lastmod: an invented date is worse than none.
 */

const CONTENT_EXTENSIONS = /\.(md|mdx)$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const DATE_KEYS = ['updatedDate', 'updated', 'publishedDate'] as const;
const PAGE_UPDATED = /\bupdated=\{\s*new Date\(\s*(['"])(\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?)\1\s*\)\s*\}/;

/** The date in an `updatedDate`, `updated` or `publishedDate` frontmatter field (in that order), or undefined when absent or not a date. */
export function frontmatterDate(source: string): Date | undefined {
  const block = FRONTMATTER.exec(source)?.[1];
  if (block === undefined) return undefined;
  for (const key of DATE_KEYS) {
    const match = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm').exec(block);
    const raw = match?.[1]?.replace(/^["']|["']$/g, '');
    if (raw === undefined || raw === '') continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

/** The date of a literal `updated={new Date('2026-10-06')}` in a page file, or undefined when the page computes or omits it. */
export function pageFileDate(source: string): Date | undefined {
  const raw = PAGE_UPDATED.exec(source)?.[2];
  if (raw === undefined) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export interface ContentFile {
  readonly collection: string;
  /** Path inside the collection without the extension, with forward slashes, for example dream/first-idea. */
  readonly id: string;
  /** Path relative to the repository root, with forward slashes. */
  readonly path: string;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function posix(path: string): string {
  return path.split(sep).join('/');
}

/** Every markdown entry under src/content/<collection>/, skipping underscore folders and files. */
export function indexContent(root: string): ContentFile[] {
  const base = join(root, 'src', 'content');
  return walkFiles(base)
    .map((file) => posix(relative(base, file)))
    .filter((rel) => CONTENT_EXTENSIONS.test(rel) && !rel.split('/').some((part) => part.startsWith('_')))
    .map((rel) => {
      const [collection = '', ...rest] = rel.split('/');
      return { collection, id: rest.join('/').replace(CONTENT_EXTENSIONS, ''), path: `src/content/${rel}` };
    });
}

export interface PageIndex {
  /** Static page files keyed by route, for example /program/ to src/pages/program/index.astro. */
  readonly fixed: ReadonlyMap<string, string>;
  /** Dynamic page files with their route pattern, for example /insights/topic/[topic]/. */
  readonly dynamic: readonly { readonly pattern: string; readonly path: string }[];
}

/** The page files in src/pages that produce HTML routes. */
export function indexPages(root: string): PageIndex {
  const base = join(root, 'src', 'pages');
  const fixed = new Map<string, string>();
  const dynamic: { pattern: string; path: string }[] = [];
  for (const file of walkFiles(base)) {
    const rel = posix(relative(root, file));
    const route = fileToRoute(`/${rel}`);
    if (route === null) continue;
    if (route.dynamic) dynamic.push({ pattern: route.pattern, path: rel });
    else fixed.set(route.pattern, rel);
  }
  return { fixed, dynamic };
}

export type GitDate = (repoRelativePath: string) => Date | undefined;

/** Date of the last commit that touched a file, or undefined when git is absent, the file is untracked or the call fails. */
export function gitCommitDate(root: string): GitDate {
  let available = true;
  return (path) => {
    if (!available) return undefined;
    try {
      const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', path], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 15_000,
      }).trim();
      if (out === '') return undefined;
      const parsed = new Date(out);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    } catch (error) {
      // A failure here is systemic (git missing, not a repository, unsafe directory, shallow-clone limits), not specific
      // to one file, so report it once and stop asking.
      available = false;
      const reason = isNotFound(error) ? 'git is not installed' : `git log failed for ${path}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
      console.warn(`lastmod: ${reason}; routes without a frontmatter date get no lastmod.`);
      return undefined;
    }
  };
}

export interface LastmodOptions {
  readonly root: string;
  /** Preview builds serve under a base path such as /worldenterprise; it is stripped before matching. */
  readonly base?: string | undefined;
  readonly git?: GitDate;
}

function routeSegments(pathname: string, base: string | undefined): string[] {
  const trimmedBase = (base ?? '').replace(/^\/+|\/+$/g, '');
  const parts = pathname.split('/').filter(Boolean);
  if (trimmedBase !== '' && parts[0] === trimmedBase) parts.shift();
  return parts;
}

function lastSegment(id: string): string {
  return id.split('/').at(-1) ?? id;
}

/** Builds `lookup(pathname)` for withLastmod() in src/lib/seo.ts. Indexes the repository once. */
export function createLastmodLookup({ root, base, git = gitCommitDate(root) }: LastmodOptions): (pathname: string) => Date | undefined {
  const content = indexContent(root);
  const pages = indexPages(root);
  const byCollection = new Map<string, ContentFile[]>();
  for (const file of content) byCollection.set(file.collection, [...(byCollection.get(file.collection) ?? []), file]);
  const cache = new Map<string, Date | undefined>();

  function entryFor(route: string, segments: readonly string[]): ContentFile | undefined {
    for (const [pattern, collection] of Object.entries(DYNAMIC_COLLECTIONS)) {
      const params = matchDynamic(pattern, route);
      const slug = params === null ? undefined : Object.values(params)[0];
      if (slug === undefined) continue;
      const found = byCollection.get(collection)?.find((file) => lastSegment(file.id) === slug);
      if (found !== undefined) return found;
    }
    const joined = segments.join('/');
    const last = segments.at(-1) ?? '';
    const first = segments[0] ?? '';
    // Copy for a route sits at the same path, at <path>/index, at <path>/<last>, at <section>/<last> (framework
    // pages) or at <section>/topic-<desk> (the insight topic hubs, route <section>/topic/<desk>).
    const topic = joined.replace(/\/topic\/([^/]+)$/, '/topic-$1');
    const ids = segments.length === 0 ? ['home/index'] : [joined, `${joined}/index`, `${joined}/${last}`, `${first}/${last}`, topic];
    const pagesEntries = byCollection.get('pages') ?? [];
    for (const id of ids) {
      const found = pagesEntries.find((file) => file.id === id);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function resolve(pathname: string): Date | undefined {
    const segments = routeSegments(pathname, base);
    const route = segments.length === 0 ? '/' : `/${segments.join('/')}/`;
    const entry = entryFor(route, segments);
    if (entry !== undefined) {
      const fromFrontmatter = frontmatterDate(readFileSync(join(root, entry.path), 'utf8'));
      if (fromFrontmatter !== undefined) return fromFrontmatter;
      const fromGit = git(entry.path);
      if (fromGit !== undefined) return fromGit;
    }
    const page = pages.fixed.get(route) ?? pages.dynamic.find((candidate) => matchDynamic(candidate.pattern, route) !== null)?.path;
    if (page === undefined) return undefined;
    return pageFileDate(readFileSync(join(root, page), 'utf8')) ?? git(page);
  }

  return (pathname) => {
    if (!cache.has(pathname)) cache.set(pathname, resolve(pathname));
    return cache.get(pathname);
  };
}
