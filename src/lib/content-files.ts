import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { walkFiles } from './page-files.ts';

/**
 * The content files under src/content, read from disk with `node:fs` and nothing else. The route ledger (src/data/routes.ts) has to
 * import under plain Node for scripts/lib/export-ledger.mjs and `node --test`, where `astro:content` does not exist, so the ledger
 * reads the folders the way src/lib/page-files.ts reads the page files. Frontmatter is not parsed here: the ledger needs file names.
 */

const CONTENT_EXTENSIONS = /\.mdx?$/;

/** Word count of prose: strips frontmatter-free MDX imports, JSX tags and markdown punctuation. */
export function countWords(body: string): number {
  const text = body
    .replace(/^import .*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|\-]{1,}/g, ' ');
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** A slug in a file name: lower-case words joined by hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface InsightFile {
  /** The desk folder the file sits in. */
  readonly desk: string;
  /** The file name without its extension: the route slug. */
  readonly slug: string;
  /** Path relative to the repository root, with forward slashes. */
  readonly file: string;
}

function posix(path: string): string {
  return path.split(sep).join('/');
}

/** The content directory, after proving the root is the repository root (a wrong working directory must fail, not read as empty). */
function contentRoot(root: string): string {
  const dir = join(root, 'src', 'content');
  if (!existsSync(dir)) {
    throw new Error(`No content directory at ${dir}. Build, dev and tests must run from the repository root.`);
  }
  return dir;
}

/** Markdown and MDX files below src/content/<collection>, as paths relative to that folder, sorted. A missing collection is empty. */
export function listCollectionFiles(root: string, collection: string): string[] {
  const base = join(contentRoot(root), collection);
  return walkFiles(base)
    .filter((file) => CONTENT_EXTENSIONS.test(file))
    .map((file) => posix(relative(base, file)))
    .sort();
}

/** The `title` of a Markdown or MDX file, read from its frontmatter (a plain, single-quoted or double-quoted scalar), or undefined. */
export function frontmatterTitle(raw: string): string | undefined {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1];
  const line = block === undefined ? undefined : /^title:[ \t]*(.+?)[ \t]*$/m.exec(block)?.[1];
  if (line === undefined) return undefined;
  const quoted = /^(["'])(.*)\1$/.exec(line);
  if (quoted === null) return line;
  return quoted[1] === '"' ? quoted[2]?.replace(/\\(["\\])/g, '$1') : quoted[2]?.replace(/''/g, "'");
}

/** Slug to frontmatter title for a flat collection (`playbooks`, `library`). A file without a title throws. */
export function listCollectionTitles(root: string, collection: string): Readonly<Record<string, string>> {
  const base = join(contentRoot(root), collection);
  const titles: Record<string, string> = {};
  for (const rel of listCollectionFiles(root, collection)) {
    const slug = rel.replace(CONTENT_EXTENSIONS, '');
    const title = frontmatterTitle(readFileSync(join(base, rel), 'utf8'));
    if (title === undefined || title === '') throw new Error(`src/content/${collection}/${rel}: the frontmatter has no title.`);
    titles[slug] = title;
  }
  return titles;
}

/** The slugs of the `pages` entries directly in one folder (`founders` gives `first-time-founders`, `index`, ...), sorted. */
export function listPageSlugs(root: string, folder: string): string[] {
  const prefix = `${folder}/`;
  return listCollectionFiles(root, 'pages')
    .filter((file) => file.startsWith(prefix) && !file.slice(prefix.length).includes('/'))
    .map((file) => file.slice(prefix.length).replace(CONTENT_EXTENSIONS, ''));
}

/** The ids of the `briefs` entries (`funding-paths`, ...), sorted. */
export function listBriefIds(root: string): string[] {
  return listCollectionFiles(root, 'briefs').map((file) => file.replace(CONTENT_EXTENSIONS, ''));
}

/**
 * Every article as `<desk>/<slug>`. A file anywhere else (no desk folder, a deeper folder) or with a name that is not a slug throws,
 * so a misplaced article fails the ledger loudly instead of silently having no route.
 */
export function listInsightFiles(root: string): InsightFile[] {
  return listCollectionFiles(root, 'insights').map((rel) => {
    const parts = rel.split('/');
    const name = parts.at(-1) ?? rel;
    const file = `src/content/insights/${rel}`;
    if (parts.length !== 2) {
      throw new Error(`${file}: an article sits in src/content/insights/<desk>/<slug>.md(x), one folder deep.`);
    }
    const slug = name.replace(CONTENT_EXTENSIONS, '');
    if (!SLUG_PATTERN.test(slug)) throw new Error(`${file}: "${slug}" is not a slug (lower-case words joined by hyphens).`);
    return { desk: parts[0] as string, slug, file };
  });
}
