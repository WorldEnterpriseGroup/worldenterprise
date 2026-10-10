/**
 * The words WP-76 puts on the site, gathered in one place so the tests can enumerate them. Every string here is mapped in
 * .astro-magazine/sources/wp-76.json (copy-ledger.test.ts) and runs through the claims denylist (copy-guard.test.ts).
 *
 * Text that WP-49 wrote and this package left as it was (the three older hub cards, the call-to-action band, the hub body) is not new
 * copy and is listed in UNCHANGED, the WP-43 precedent. A sentence leaves that list only by being edited.
 */

import { readFileSync } from 'node:fs';
import * as toolCopy from '../../../src/components/tools/copy.ts';
import { HUB, TOOLS } from '../../../src/components/tools/registry.ts';
import { FORMULAS, FORMULAS_PAGE, INPUTS, ISLAND, PAGE, RESULTS } from '../../../src/components/islands/we-runway/spec.ts';

export interface Surface {
  /** The repository path the strings belong to: the key the ledger uses. */
  readonly path: string;
  readonly strings: readonly string[];
}

const root = new URL('../../../', import.meta.url);
export const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

/** A string split into its sentences, so the ledger maps sentences and not paragraphs. A colon or a semicolon does not end one. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

const split = (...texts: readonly string[]): string[] => texts.flatMap(sentencesOf);

/** Front matter text fields, and the body of an MDX file as headings and sentences with the components flattened to their text. */
export function mdx(path: string): { frontmatter: Record<string, string>; body: string[] } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(read(path));
  if (match === null) throw new Error(`${path}: no front matter`);
  const frontmatter: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const field = /^(title|description|eyebrow):\s*(.*)$/.exec(line);
    if (field !== null) frontmatter[field[1] ?? ''] = (field[2] ?? '').replace(/^"(.*)"$/, '$1');
  }
  const body: string[] = [];
  const text = (match[2] ?? '').replace(/^import .*$/gm, '').replace(/<MaybeLink\b[^>]*>([\s\S]*?)<\/MaybeLink>/g, '$1');
  for (const block of text.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b !== '')) {
    const heading = /^#{2,4}\s+(.+)$/.exec(block);
    if (heading !== null) body.push(heading[1] ?? '');
    else body.push(...sentencesOf(block.replace(/\s+/g, ' ')));
  }
  return { frontmatter, body };
}

/** Strings of a module's default and named string exports, nested arrays and objects included. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return sentencesOf(value);
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

/** The hub copy and cards WP-49 wrote, which this package did not change. */
export const UNCHANGED: ReadonlySet<string> = new Set([
  'Team Composer',
  'Sketch',
  'Choose the roles your SaaS team needs and how many seats each role takes, then carry the sketch to the application.',
  'No sign-up, no price.',
  'Metrics calculator',
  'Calculate',
  'Type one month of your numbers and see net new MRR, gross revenue churn, quick ratio, CAC payback, LTV to CAC and runway, with every formula shown.',
  'Evidence room builder',
  'Prepare',
  'Work through a checklist built from the data room and investor readiness guides.',
  'Filter by stage, tick items off, then print the list or copy it as Markdown.',
  'Open the metrics calculator',
  'Compose your team',
  'Prepare with a team that steers the work',
  'Service Line F covers fundability and investor readiness inside the program.',
  'WE prepares the evidence.',
  'The raise itself, and the legal advice around it, stay with you and your own counsel.',
  'See Service Line F',
  'Apply',
]);

const withoutUnchanged = (strings: readonly string[]): string[] => strings.filter((s) => !UNCHANGED.has(s));

const unique = (strings: readonly string[]): string[] => [...new Set(strings)];

/** The files whose strings are ledgered, each with every sentence it holds. */
export function surfaces(): Surface[] {
  const hub = mdx('src/content/pages/tools/index.mdx');
  const runway = mdx('src/content/pages/tools/runway-calculator.mdx');
  return [
    { path: 'src/components/tools/copy.ts', strings: unique(stringsIn(toolCopy)) },
    {
      path: 'src/components/tools/registry.ts',
      strings: unique(
        withoutUnchanged([
          ...TOOLS.flatMap((tool) => [tool.title, tool.eyebrow, ...sentencesOf(tool.summary)]),
          ...split(HUB.lead, HUB.primary, HUB.secondary, HUB.ctaTitle, HUB.ctaText, HUB.ctaPrimary, HUB.ctaSecondary),
        ]),
      ),
    },
    {
      path: 'src/components/islands/we-runway/spec.ts',
      strings: unique([
        ...INPUTS.flatMap((input) => [input.label, ...sentencesOf(input.hint)]),
        ...RESULTS.map((result) => result.name),
        ...stringsIn(ISLAND),
        ...FORMULAS.flatMap((row) => [row.name, ...sentencesOf(row.formula), ...row.assumptions.flatMap(sentencesOf)]),
        ...stringsIn(FORMULAS_PAGE),
        ...stringsIn(PAGE),
      ]),
    },
    // Only the description changed on the hub page: its body is WP-49's.
    { path: 'src/content/pages/tools/index.mdx', strings: sentencesOf(hub.frontmatter['description'] ?? '') },
    {
      path: 'src/content/pages/tools/runway-calculator.mdx',
      strings: unique([...Object.values(runway.frontmatter).flatMap(sentencesOf), ...runway.body]),
    },
  ];
}

/** The strings that need no mapping because they are not page copy, but still run through the claims denylist: the markup text of each file. */
export const MARKUP_FILES: readonly string[] = [
  'src/pages/tools/index.astro',
  'src/pages/tools/runway-calculator.astro',
  'src/components/islands/we-runway/RunwayCalculator.astro',
  'src/components/tools/ToolField.astro',
  'src/components/tools/ToolResult.astro',
  'src/components/tools/ToolPrivacy.astro',
  'src/components/tools/ToolFormulas.astro',
];
