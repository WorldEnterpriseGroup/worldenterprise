import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as partnerCopy from '../../../src/components/partners/copy.ts';

/**
 * The partner journey's words, gathered in one place so the tests can enumerate them (the WP-60 and WP-43 pattern). Each surface is a
 * document of `.astro-magazine/sources/wp-65.json`: the copy module, each partner content file and the network content file. The
 * strings are sentences or short labels; the ledger maps every one.
 */
export interface Surface {
  readonly path: string;
  readonly strings: readonly string[];
}

export const root = new URL('../../../', import.meta.url).pathname;
export const read = (path: string): string => readFileSync(join(root, path), 'utf8');

/** A string split into its sentences, so the ledger maps sentences and not paragraphs. */
export const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

/** Keys whose values are routes, ids or machine tokens, never copy. */
const NOT_COPY = new Set(['id', 'href']);

function copyStrings(): string[] {
  const strings: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') strings.push(...sentencesOf(value));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object' && value !== null) {
      for (const [key, inner] of Object.entries(value)) if (!NOT_COPY.has(key)) visit(inner);
    }
  };
  // The routes and the category ids are tokens; the categories are visited through CATEGORIES, whose label and sentences are copy.
  for (const [name, value] of Object.entries(partnerCopy)) if (name !== 'HREFS' && name !== 'CATEGORY_IDS') visit(value);
  return [...new Set(strings)];
}

export interface ContentFile {
  readonly frontmatter: string;
  readonly body: string;
}

export function contentFile(path: string): ContentFile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(read(path));
  if (match === null) throw new Error(`${path} has no frontmatter block.`);
  return { frontmatter: match[1] ?? '', body: match[2] ?? '' };
}

/** The sentences of a content body: a Markdown heading is one entry (without its marker), every paragraph is split into sentences. */
export function bodyStrings(path: string): string[] {
  const strings: string[] = [];
  for (const block of contentFile(path).body.split(/\n{2,}/)) {
    const text = block.trim();
    if (text === '') continue;
    if (/^#{1,6}\s/.test(text)) strings.push(text.replace(/^#{1,6}\s+/, ''));
    else strings.push(...sentencesOf(text.replace(/\s+/g, ' ')));
  }
  return [...new Set(strings)];
}

export const COPY_MODULE = 'src/components/partners/copy.ts';
export const NETWORK_MDX = 'src/content/pages/network/index.mdx';
export const PARTNER_MDX: readonly string[] = [
  'src/content/pages/network/partners/index.mdx',
  'src/content/pages/network/partners/categories.mdx',
  'src/content/pages/network/partners/how-it-works.mdx',
  'src/content/pages/network/partners/faq.mdx',
  'src/content/pages/network/partners/enquire.mdx',
  'src/content/pages/network/partners/thanks.mdx',
];

export function surfaces(): readonly Surface[] {
  return [
    { path: COPY_MODULE, strings: copyStrings() },
    ...PARTNER_MDX.map((path) => ({ path, strings: bodyStrings(path) })),
    { path: NETWORK_MDX, strings: bodyStrings(NETWORK_MDX) },
  ];
}

/** The six partner routes, with the page file and the content file behind each. */
export const PARTNER_ROUTES: readonly { readonly path: string; readonly layout: 'MarketingLayout' | 'FormLayout'; readonly page: string; readonly content: string }[] = [
  { path: '/network/partners/', layout: 'MarketingLayout', page: 'src/pages/network/partners/index.astro', content: PARTNER_MDX[0] ?? '' },
  { path: '/network/partners/categories/', layout: 'MarketingLayout', page: 'src/pages/network/partners/categories.astro', content: PARTNER_MDX[1] ?? '' },
  { path: '/network/partners/how-it-works/', layout: 'MarketingLayout', page: 'src/pages/network/partners/how-it-works.astro', content: PARTNER_MDX[2] ?? '' },
  { path: '/network/partners/faq/', layout: 'MarketingLayout', page: 'src/pages/network/partners/faq.astro', content: PARTNER_MDX[3] ?? '' },
  { path: '/network/partners/enquire/', layout: 'FormLayout', page: 'src/pages/network/partners/enquire/index.astro', content: PARTNER_MDX[4] ?? '' },
  { path: '/network/partners/enquire/thanks/', layout: 'FormLayout', page: 'src/pages/network/partners/enquire/thanks.astro', content: PARTNER_MDX[5] ?? '' },
];

/** Every file a scan over "the partner and network pages" covers: pages, content, components and the copy module. */
export function scannedFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = `${dir}/${entry.name}`;
      return entry.isDirectory() ? walk(rel) : [rel];
    });
  return [
    ...walk('src/pages/network'),
    ...walk('src/content/pages/network'),
    ...walk('src/components/partners'),
    ...walk('src/components/network'),
  ].filter((file) => /\.(astro|mdx|ts)$/.test(file));
}
