// The words WP-64 puts on the site, gathered in one place so tests can enumerate them. Every string here must be mapped in
// .astro-magazine/sources/wp-64.json (ledger.test.ts) and must pass the claims denylist (claims.test.ts).
import { readFileSync } from 'node:fs';
import * as copy from '../../../src/components/investors/copy.ts';
import { INVESTOR_FAQ } from '../../../src/components/investors/faq.ts';
import { INTRODUCTIONS_READINESS } from '../../../src/components/blocks/introductions.ts';
import { READINESS_GROUPS, readinessStatements } from '../../../src/components/islands/we-readiness-check/statements.ts';

export interface Surface {
  /** The repository path of the document the strings belong to: the key of documents[] in the sources file. */
  readonly path: string;
  readonly strings: readonly string[];
}

/** The page content files, with the route each is rendered on. */
export const MDX_PAGES: readonly { readonly path: string; readonly route: string }[] = [
  { path: 'src/content/pages/investors/index.mdx', route: '/investors/' },
  { path: 'src/content/pages/investors/meet-startups/index.mdx', route: '/investors/meet-startups/' },
  { path: 'src/content/pages/investors/what-you-can-see/index.mdx', route: '/investors/what-you-can-see/' },
  { path: 'src/content/pages/investors/readiness-criteria/index.mdx', route: '/investors/readiness-criteria/' },
  { path: 'src/content/pages/investors/showcase-format/index.mdx', route: '/investors/showcase-format/' },
  { path: 'src/content/pages/investors/faq/index.mdx', route: '/investors/faq/' },
  { path: 'src/content/pages/investors/interest/index.mdx', route: '/investors/interest/' },
  { path: 'src/content/pages/investors/interest/thanks.mdx', route: '/investors/interest/thanks/' },
];

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

/** Split a string into sentences. A colon or a semicolon does not end one. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** The keys that hold a machine token, a path or an id, never copy. */
const NON_COPY_KEYS: ReadonlySet<string> = new Set(['href', 'scope', 'id', 'claims']);

/** Every string of a copy module that a reader sees, split into sentences. */
function copyStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(...sentencesOf(value));
  else if (Array.isArray(value)) for (const item of value) copyStrings(item, into);
  else if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) if (!NON_COPY_KEYS.has(key)) copyStrings(inner, into);
  }
  return into;
}

export interface MdxPage {
  readonly frontmatter: Readonly<Record<string, string>>;
  /** The sentences of the body, with the import lines and the component tags taken out. */
  readonly body: readonly string[];
}

/** The front matter fields that publish text, and the sentences of the body of an mdx file. */
export function parseMdx(path: string): MdxPage {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(read(path));
  if (match === null) throw new Error(`${path}: no front matter`);
  const frontmatter: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const field = /^(title|description|eyebrow):\s*(.*)$/.exec(line);
    if (field !== null) frontmatter[field[1] ?? ''] = (field[2] ?? '').replace(/^"(.*)"$/, '$1');
  }
  const body = (match[2] ?? '')
    .split('\n')
    .filter((line) => !/^import\s/.test(line))
    .join('\n')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').replace(/^#{1,6}\s+/, '').trim())
    .filter((p) => p !== '');
  return { frontmatter, body: body.flatMap(sentencesOf) };
}

export function surfaces(): Surface[] {
  const out: Surface[] = [
    { path: 'src/components/investors/copy.ts', strings: [...new Set(copyStrings(copy))] },
    {
      path: 'src/components/investors/faq.ts',
      strings: [...new Set(INVESTOR_FAQ.flatMap((item) => [item.question, ...sentencesOf(item.answer)]))],
    },
    {
      path: 'src/components/blocks/introductions.ts',
      strings: [...new Set(INTRODUCTIONS_READINESS.flatMap((c) => [c.artifact, ...sentencesOf(c.inPlace)]))],
    },
    {
      path: 'src/components/islands/we-readiness-check/statements.ts',
      strings: [...new Set([...Object.values(READINESS_GROUPS).map((g) => g.title), ...readinessStatements.flatMap((s) => sentencesOf(s.statement))])],
    },
  ];
  for (const page of MDX_PAGES) {
    const { frontmatter, body } = parseMdx(page.path);
    const { title, eyebrow, description } = frontmatter;
    const fields = [title, eyebrow].filter((f): f is string => f !== undefined);
    out.push({ path: page.path, strings: [...new Set([...fields, ...sentencesOf(description ?? ''), ...body])] });
  }
  return out;
}
