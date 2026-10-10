import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * The words of a journey page, read from the content file and nothing else. The template's own sentences (the note under the hero,
 * the section headings, the checklist note) are WP-71's and are traced in `.astro-magazine/sources/wp-71.json`, so they are not read
 * here. What this module reads is what WP-72 wrote: the title, the description, the family questions and checklist, and the body.
 */
export const JOURNEY_FILES = [
  'src/content/pages/journey/index.mdx',
  'src/content/pages/journey/after-you-apply.mdx',
  'src/content/pages/journey/first-months.mdx',
  'src/content/pages/journey/onboarding-checklist.mdx',
] as const;

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly href?: string;
}

export interface JourneyFrontmatter {
  readonly title: string;
  readonly description: string;
  readonly eyebrow?: string;
  readonly updated: string;
  readonly claimsUsed?: readonly string[];
  readonly family: {
    readonly id: string;
    readonly slug: string;
    readonly stage: string;
    readonly step?: number;
    readonly questions: readonly string[];
    readonly checklist?: readonly ChecklistItem[];
  };
}

export interface JourneyDocument {
  readonly path: string;
  readonly frontmatter: JourneyFrontmatter;
  /** The body without its import lines. */
  readonly body: string;
}

/** A string split into its sentences, so the ledger maps sentences and not paragraphs. */
export const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

export function readJourneyDocument(root: string, path: string): JourneyDocument {
  const text = readFileSync(join(root, path), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) throw new Error(`${path} has no frontmatter block.`);
  const frontmatter = parse(match[1]) as JourneyFrontmatter;
  const body = match[2]
    .split('\n')
    .filter((line) => !/^import\s/.test(line))
    .join('\n');
  return { path, frontmatter, body };
}

/** One line of Markdown as the reader sees it: links and component tags reduced to their text, list and heading marks dropped. */
function plain(line: string): string {
  return line
    .replace(/<MaybeLink\b[^>]*>([\s\S]*?)<\/MaybeLink>/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/[*_`]/g, '')
    .trim();
}

/** The headings of the body, in order, with the level each was written at. */
export function headingsOf(body: string): { level: number; text: string }[] {
  return [...body.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((m) => ({ level: (m[1] ?? '').length, text: plain(m[2] ?? '') }));
}

/** The sentences the body holds, blocks first: a heading, a list item or a paragraph each split on their own. */
export function bodySentences(body: string): string[] {
  const out: string[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const isList = lines.every((l) => /^[-*]\s+/.test(l));
    const isHeading = lines.length === 1 && /^#{1,6}\s+/.test(lines[0] ?? '');
    if (isList || isHeading) {
      for (const line of lines) out.push(...(isHeading ? [plain(line)] : sentencesOf(plain(line))));
    } else {
      out.push(...sentencesOf(plain(lines.join(' '))));
    }
  }
  return out.filter((s) => s !== '');
}

/** Every sentence of a journey document: title, description, eyebrow, questions, checklist items, then the body. */
export function documentSentences(doc: JourneyDocument): string[] {
  const { title, description, eyebrow, family } = doc.frontmatter;
  const all = [
    title,
    ...sentencesOf(description),
    ...(eyebrow === undefined ? [] : [eyebrow]),
    ...family.questions,
    ...(family.checklist ?? []).map((item) => item.text),
    ...bodySentences(doc.body),
  ];
  return [...new Set(all)];
}
