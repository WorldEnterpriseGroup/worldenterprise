import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { pagesSchema } from '../../../src/lib/content-schemas.ts';

/** The comparison pages WP-75 writes, read from disk and parsed with the same schema the build uses. */
export const ROOT = new URL('../../../', import.meta.url).pathname;
export const COMPARE_DIR = join(ROOT, 'src', 'content', 'pages', 'compare');
export const LEDGER_PATH = join(ROOT, '.astro-magazine', 'sources', 'wp-75.json');

export type PageData = ReturnType<typeof pagesSchema.parse>;
export type Family = NonNullable<PageData['family']>;
export type CompareFamily = Extract<Family, { id: 'compare' }>;

export interface ComparePage {
  readonly slug: string;
  /** Repository path, as the sources ledger names it. */
  readonly path: string;
  /** The route the page is served at. */
  readonly route: string;
  readonly data: PageData;
  /** The Markdown body below the frontmatter. */
  readonly body: string;
  /** The raw frontmatter object, before the schema fills defaults. */
  readonly raw: Record<string, unknown>;
}

export function compareFamily(page: ComparePage): CompareFamily {
  const family = page.data.family;
  if (family === undefined || family.id !== 'compare') throw new Error(`${page.path} has no compare family object`);
  return family;
}

export function loadComparePages(): ComparePage[] {
  return readdirSync(COMPARE_DIR)
    .filter((name) => name.endsWith('.mdx'))
    .sort()
    .map((name) => {
      const path = `src/content/pages/compare/${name}`;
      const source = readFileSync(join(ROOT, path), 'utf8');
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
      if (match === null) throw new Error(`${path} has no frontmatter`);
      const raw = parse(match[1] ?? '') as Record<string, unknown>;
      const slug = name.replace(/\.mdx$/, '');
      return { slug, path, route: slug === 'index' ? '/compare/' : `/compare/${slug}/`, data: pagesSchema.parse(raw), body: match[2] ?? '', raw };
    });
}

/** The pages that carry a `family` object: the seven comparisons. The hub is `index.mdx` and carries none. */
export function comparisons(): ComparePage[] {
  return loadComparePages().filter((page) => page.slug !== 'index');
}

/** "U.S." and similar abbreviations must not end a sentence. */
const PROTECTED = /\bU\.S\./g;

export function splitSentences(text: string): string[] {
  const protectedText = text.replace(PROTECTED, 'U\u0001S\u0001');
  return protectedText
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.replace(/\u0001/g, '.').trim())
    .filter((s) => s !== '');
}

/** Every string a reader sees on a comparison page that this package wrote, field by field. Sources are metadata and are excluded. */
export function visibleTexts(page: ComparePage): string[] {
  const texts: string[] = [page.data.title, page.data.description];
  if (page.data.family?.id === 'compare') {
    const family = page.data.family;
    for (const side of family.sides) texts.push(side.name, side.whatItIs, side.whoItFits, side.asksOfFounder, ...side.askThis);
    texts.push(...family.whereEachFits);
    for (const definition of family.definitions) texts.push(definition.term, definition.text);
  }
  for (const line of page.body.split(/\r?\n/)) {
    const text = line.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '').trim();
    if (text !== '') texts.push(text);
  }
  return texts;
}

/** Every sentence of {@link visibleTexts}, in order, without repeats. */
export function pageSentences(page: ComparePage): string[] {
  return [...new Set(visibleTexts(page).flatMap(splitSentences))];
}
