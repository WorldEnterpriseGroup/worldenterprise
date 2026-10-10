import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { INDUSTRIES } from '../../../src/data/families.ts';
import { pagesSchema } from '../../../src/lib/content-schemas.ts';
import type { ClaimRecord, SourcesFile } from '../wp-60/sources.ts';

/** What the WP-74 tests share: the page files, their frontmatter as the build parses it, and the sentences a reader sees. */
export const root = new URL('../../../', import.meta.url).pathname;
export const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

export const FOLDER = 'src/content/pages/industries';
export const HUB_PATH = `${FOLDER}/index.mdx`;
export const SCOPE_PATH = 'src/components/industries/scope-copy.ts';
export const LEDGER_PATH = '.astro-magazine/sources/wp-74.json';

export const industrySlugs: readonly string[] = INDUSTRIES.entries.map((e) => e.slug);
export const pagePath = (slug: string): string => `${FOLDER}/${slug}.mdx`;

export type PageData = ReturnType<typeof pagesSchema.parse>;
export type IndustryFamily = Extract<NonNullable<PageData['family']>, { id: 'industries' }>;

export interface PageFile {
  readonly path: string;
  readonly raw: string;
  readonly front: unknown;
  readonly body: string;
}

/** A content file split into its frontmatter (parsed as YAML) and its body. */
export function pageFile(path: string): PageFile {
  const raw = read(path);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (match?.[1] === undefined || match[2] === undefined) throw new Error(`${path} has no frontmatter block.`);
  return { path, raw, front: parse(match[1]) as unknown, body: match[2] };
}

export function parsedPage(path: string): { readonly file: PageFile; readonly data: PageData } {
  const file = pageFile(path);
  return { file, data: pagesSchema.parse(file.front) };
}

export function familyOf(path: string): IndustryFamily {
  const family = parsedPage(path).data.family;
  if (family === undefined || family.id !== 'industries') throw new Error(`${path} has no industries family object.`);
  return family;
}

/** The same splitter the generator used: a sentence ends at . ? or ! and the next one starts with a capital letter or an opening quote. */
export const sentencesOf = (text: string): string[] => text.split(/(?<=[.?!])\s+(?=[A-Z"“])/).map((s) => s.trim()).filter((s) => s !== '');

/** The body paragraphs that are copy: not the import line, not the scope component, not a heading. */
export function bodyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '' && !p.startsWith('import ') && !p.startsWith('<SeatScope') && !p.startsWith('#'));
}

/**
 * The sentences of one page, in the order a reader meets them (the title as a label first): the lead the template shows, the body, the
 * buyer, each perimeter item, each data question and the sales cycle. The sources list shows titles, not sentences.
 */
export function pageSentences(path: string): string[] {
  const { file, data } = parsedPage(path);
  const out: string[] = [data.title, ...sentencesOf(data.description), ...bodyParagraphs(file.body).flatMap(sentencesOf)];
  const family = data.family;
  if (family !== undefined && family.id === 'industries') {
    out.push(...sentencesOf(family.buyer));
    for (const item of family.perimeter) out.push(...sentencesOf(item.text));
    for (const question of family.dataQuestions) out.push(question);
    out.push(...sentencesOf(family.salesCycle));
  }
  return out;
}

/** Everything a page says in words, for the scans that look at the text and not its structure. */
export function pageText(path: string): string {
  return pageSentences(path).join('\n');
}

export const allPagePaths: readonly string[] = [...industrySlugs.map(pagePath), HUB_PATH];

export const ledger = (): SourcesFile => JSON.parse(read(LEDGER_PATH)) as SourcesFile;

/** A regulatory statement of a page, with the path of the page that holds it. */
export interface PerimeterClaim extends ClaimRecord {
  readonly path: string;
}

/** The `claims` of every document of the ledger, each with its page path. */
export function perimeterClaims(file: SourcesFile = ledger()): PerimeterClaim[] {
  return (file.documents ?? []).flatMap((doc) => (doc.claims ?? []).map((claim) => ({ ...claim, path: doc.path })));
}
