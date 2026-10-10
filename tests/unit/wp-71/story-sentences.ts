// The words WP-71 puts on the brand story page, the brand kit page and the press page, gathered in one place so tests can enumerate them.
// Every string here must be mapped in .astro-magazine/sources/wp-71.json (story-sources.test.ts) and must pass the claims denylist.
import { readFileSync } from 'node:fs';
import { site } from '../../../src/data/site.ts';
import { pressBoilerplate } from '../../../src/pages/press/_boilerplate.ts';
import { HINT_WITH_BUTTON, MESSAGES } from '../../../src/scripts/brand-copy.ts';

export interface Surface {
  /** The page or component the strings appear on. */
  readonly where: string;
  readonly strings: readonly string[];
}

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

/** Phrases that contain a full stop but are not a sentence boundary. */
const PROTECTED: readonly string[] = [site.motto, 'WE Dream. WE Build. WE Grow'];

/** Split a paragraph into sentences. A colon or a semicolon does not end one, and the motto stays whole. */
export function sentencesOf(text: string): string[] {
  let guarded = text;
  const holders: string[] = [];
  for (const phrase of PROTECTED) {
    guarded = guarded.split(phrase).join(`\u0000${holders.push(phrase) - 1}\u0000`);
  }
  return guarded
    .split(/(?<=[.?!\u0000])\s+(?=[A-Z\u0000])/)
    .map((s) => s.replace(/\u0000(\d+)\u0000/g, (_, index: string) => holders[Number(index)] ?? ''))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s !== '');
}

/** Front matter fields that publish text, and the body of an mdx file as one string per block. */
export function mdx(path: string): { readonly frontmatter: readonly string[]; readonly blocks: readonly string[] } {
  const text = read(path);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) throw new Error(`${path}: no front matter`);
  const frontmatter: string[] = [];
  for (const line of (match[1] ?? '').split('\n')) {
    const field = /^(title|description|eyebrow):\s*(.*)$/.exec(line);
    if (field !== null) frontmatter.push((field[2] ?? '').replace(/^"(.*)"$/, '$1'));
  }
  const blocks = (match[2] ?? '')
    .split(/\n{2,}/)
    // A list is one string per item; any other block (a paragraph wrapped over several lines, a heading) is one string.
    .flatMap((block) => (block.split('\n').every((line) => /^\s*[-*]\s/.test(line)) ? block.split('\n') : [block]))
    .map((line) => line.replace(/^\s*[-*]\s+/, '').replace(/^#{1,6}\s+/, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');
  return { frontmatter, blocks };
}

/** Removes every `{...}` expression, innermost braces included, and returns the removed bodies. */
function stripExpressions(template: string): { readonly text: string; readonly expressions: readonly string[] } {
  let out = '';
  const expressions: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of template) {
    if (char === '{') {
      if (depth === 0) current = '';
      else current += char;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) expressions.push(current);
      else current += char;
    } else if (depth > 0) current += char;
    else out += char;
  }
  if (depth !== 0) throw new Error('unbalanced braces in an astro template');
  return { text: out, expressions };
}

const BLOCK_TAGS = /<\/?(p|li|ul|ol|h[1-6]|figure|figcaption|div|section|Section|aside|nav|Fragment|PageShell|DataTable|WeBrandCopy|Lockup|pre|td|th|tr|table|small|br)\b[^>]*\/?>/g;

/** The attribute names whose plain string values are published text. */
const TEXT_ATTRIBUTES = ['lead', 'label', 'caption', 'title', 'text', 'aria-label', 'alt'];

/**
 * The published strings of an astro page: the text of every block, the plain-string attributes that carry text and the capitalized
 * string literals inside `{...}` expressions (button labels, table headers, cell fallbacks). Frontmatter, style and script are skipped.
 */
export function astroStrings(source: string): string[] {
  const template = source.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<style\b[\s\S]*?<\/style>/g, '').replace(/<script\b[\s\S]*?<\/script>/g, '');
  const out: string[] = [];
  const { text, expressions } = stripExpressions(template);
  for (const name of TEXT_ATTRIBUTES) {
    for (const match of text.matchAll(new RegExp(`(?:^|\\s)${name}="([^"]+)"`, 'g'))) out.push((match[1] ?? '').trim());
  }
  for (const expression of expressions) {
    for (const literal of expression.matchAll(/'([A-Z][^'$]*)'/g)) out.push((literal[1] ?? '').trim());
  }
  // Block tags end a run of text; inline tags (links, emphasis) do not, so a sentence that contains a link stays whole.
  const lines = text
    .replace(BLOCK_TAGS, '\u0001')
    .replace(/<[^>]*>/g, '')
    .split('\u0001')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => /[A-Za-z]/.test(line));
  for (const line of lines) out.push(...sentencesOf(line));
  return out;
}

const mdxSurface = (where: string, path: string): Surface => {
  const { frontmatter, blocks } = mdx(path);
  return { where, strings: [...frontmatter, ...blocks.flatMap((block) => sentencesOf(block))] };
};

/** The new sentences on the press page: the link to the brand kit, rendered only while the kit is live. */
export const PRESS_LINK_SENTENCES: readonly string[] = ['Read the brand kit for usage rules, colors and type.'];

/** Interface text of the copy island: the script's messages and the host's no-JavaScript hint. Denylist-scanned; it states no fact about WE. */
export function interfaceStrings(): string[] {
  return [...Object.values(MESSAGES), HINT_WITH_BUTTON, 'Copy', ...astroStrings(read('src/components/islands/we-brand-copy/WeBrandCopy.astro'))];
}

export function surfaces(): Surface[] {
  return [
    mdxSurface('src/content/pages/about/brand-story.mdx', 'src/content/pages/about/brand-story.mdx'),
    { where: 'src/pages/about/brand-story/index.astro', strings: astroStrings(read('src/pages/about/brand-story/index.astro')) },
    mdxSurface('src/content/pages/press/brand-kit.mdx', 'src/content/pages/press/brand-kit.mdx'),
    { where: 'src/pages/press/[kit].astro', strings: astroStrings(read('src/pages/press/[kit].astro')) },
    { where: 'src/pages/press/_boilerplate.ts', strings: sentencesOf(pressBoilerplate()) },
    { where: 'src/pages/press/index.astro (brand kit link)', strings: PRESS_LINK_SENTENCES },
  ];
}
