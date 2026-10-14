import { parse } from 'yaml';
import { slugify } from '../wp-60/sources.ts';

/**
 * Enumerates the sentences of a playbook file for the sentence ledger (docs/wave8-contracts.md, section 9). The playbook files use only
 * a small part of MDX on purpose: H2 headings, paragraphs, bullet lists, one `Callout` per file and `DataTable` blocks whose columns and
 * rows are JSON literals. A file that steps outside that shape fails here loudly, never silently, so a sentence cannot hide from the ledger.
 */

/** Where an entry came from. The ledger maps by kind and area; the label rule reads the kind. */
export type EntryKind = 'title' | 'heading' | 'caption' | 'column' | 'cell' | 'prose' | 'item' | 'link';

export interface Entry {
  readonly text: string;
  readonly kind: EntryKind;
  /** `front` (frontmatter), `intro` (before the first H2), the slug of the current H2, and `<slug>#example` inside the Callout. */
  readonly area: string;
  /** The internal route a bullet links to (`/insights/<slug>/`), when the bullet is one link. */
  readonly route?: string;
  /** The external URL a bullet links to, when the bullet is one link. */
  readonly external?: string;
}

/** A string split into its sentences, so the ledger maps sentences and not paragraphs (the wp-72 pattern). */
export const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

/** Link markup reduced to the words a reader sees. */
export function plain(text: string): string {
  return text
    .replace(/<MaybeLink\s+path="[^"]*"\s*>([\s\S]*?)<\/MaybeLink>/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMPONENT_LINE = /^\s*</;
const ALLOWED_TAGS: ReadonlySet<string> = new Set(['Callout', 'DataTable']);

interface Frontmatter {
  readonly data: Record<string, unknown>;
  readonly body: string;
}

export function splitFrontmatter(path: string, raw: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (match === null) throw new Error(`${path}: no frontmatter`);
  try {
    return { data: (parse(match[1] ?? '') ?? {}) as Record<string, unknown>, body: match[2] ?? '' };
  } catch (error) {
    throw new Error(`${path}: the frontmatter is not valid YAML: ${(error as Error).message}`);
  }
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The frontmatter strings of a playbook that read as copy: title, description, each step and each artifact. */
function frontEntries(data: Record<string, unknown>): Entry[] {
  const out: Entry[] = [];
  const push = (text: string, kind: EntryKind): void => {
    for (const sentence of sentencesOf(text)) out.push({ text: sentence, kind, area: 'front' });
  };
  push(asString(data.title), 'title');
  push(asString(data.description), 'prose');
  for (const step of (Array.isArray(data.steps) ? data.steps : []) as Record<string, unknown>[]) {
    push(asString(step.title), 'title');
    push(asString(step.body), 'prose');
  }
  for (const artifact of Array.isArray(data.artifacts) ? data.artifacts : []) push(asString(artifact), 'item');
  return out;
}

/** The JSON literal inside `name={...}` of a `DataTable` block. */
function literal(path: string, block: string, name: 'columns' | 'rows'): unknown {
  const start = block.indexOf(`${name}={`);
  if (start === -1) throw new Error(`${path}: a DataTable has no ${name}`);
  let depth = 0;
  const from = start + name.length + 2;
  for (let i = from; i < block.length; i += 1) {
    const ch = block[i];
    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        const text = block.slice(from, i + 1);
        try {
          return JSON.parse(text);
        } catch (error) {
          throw new Error(`${path}: DataTable ${name} is not a JSON literal: ${(error as Error).message}`);
        }
      }
    }
  }
  throw new Error(`${path}: DataTable ${name} is not closed`);
}

function tableEntries(path: string, block: string, area: string): Entry[] {
  const out: Entry[] = [];
  const caption = /caption="([^"]*)"/.exec(block)?.[1];
  if (caption !== undefined) out.push({ text: caption, kind: 'caption', area });
  const columns = literal(path, block, 'columns');
  const rows = literal(path, block, 'rows');
  if (!Array.isArray(columns) || !columns.every((c) => typeof c === 'string')) throw new Error(`${path}: DataTable columns must be strings`);
  if (!Array.isArray(rows)) throw new Error(`${path}: DataTable rows must be an array`);
  for (const column of columns as string[]) out.push({ text: column, kind: 'column', area });
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== columns.length || !row.every((c) => typeof c === 'string')) {
      throw new Error(`${path}: a DataTable row must be ${columns.length} strings`);
    }
    for (const cell of row as string[]) for (const sentence of sentencesOf(cell)) out.push({ text: sentence, kind: 'cell', area });
  }
  return out;
}

/** The entry for a bullet: its sentences, and the link when the whole bullet is one link. */
function bulletEntries(text: string, area: string): Entry[] {
  const mayBe = /^<MaybeLink\s+path="([^"]*)"\s*>([\s\S]*?)<\/MaybeLink>$/.exec(text.trim());
  if (mayBe !== null) return [{ text: plain(mayBe[2] ?? ''), kind: 'link', area, route: mayBe[1] ?? '' }];
  const md = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(text.trim());
  if (md !== null) return [{ text: (md[1] ?? '').trim(), kind: 'link', area, external: md[2] ?? '' }];
  return sentencesOf(plain(text)).map((sentence) => ({ text: sentence, kind: 'item' as const, area }));
}

/** Every sentence of a playbook file, in reading order, with duplicates kept (the ledger keeps the first). */
export function enumeratePlaybook(path: string, raw: string): Entry[] {
  const { data, body } = splitFrontmatter(path, raw);
  const out: Entry[] = frontEntries(data);
  const lines = body.split(/\r?\n/);
  let area = 'intro';
  let inCallout = false;
  let paragraph: string[] = [];
  let tableLines: string[] | undefined;

  const flush = (): void => {
    if (paragraph.length === 0) return;
    for (const sentence of sentencesOf(plain(paragraph.join(' ')))) out.push({ text: sentence, kind: 'prose', area: inCallout ? `${area}#example` : area });
    paragraph = [];
  };

  for (const line of lines) {
    if (tableLines !== undefined) {
      tableLines.push(line);
      if (/^\/>\s*$/.test(line)) {
        out.push(...tableEntries(path, tableLines.join('\n'), area));
        tableLines = undefined;
      }
      continue;
    }
    if (/^import\s/.test(line)) continue;
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      flush();
      if (heading[1] !== '##') throw new Error(`${path}: only H2 headings are allowed in a playbook body, found "${line}"`);
      area = slugify(heading[2] ?? '');
      out.push({ text: heading[2] ?? '', kind: 'heading', area });
      continue;
    }
    const open = /^<([A-Za-z]+)\b/.exec(line);
    if (open !== null && !line.startsWith('<MaybeLink')) {
      flush();
      const tag = open[1] ?? '';
      if (!ALLOWED_TAGS.has(tag)) throw new Error(`${path}: component <${tag}> is not one the ledger can enumerate`);
      if (tag === 'DataTable') {
        tableLines = [line];
        continue;
      }
      const title = /title="([^"]*)"/.exec(line)?.[1];
      if (title !== undefined) out.push({ text: title, kind: 'title', area: `${area}#example` });
      inCallout = true;
      continue;
    }
    if (/^<\/Callout>\s*$/.test(line)) {
      flush();
      inCallout = false;
      continue;
    }
    if (COMPONENT_LINE.test(line) && !line.startsWith('<MaybeLink')) throw new Error(`${path}: unexpected markup "${line}"`);
    const bullet = /^-\s+(.+)$/.exec(line);
    if (bullet !== null) {
      flush();
      out.push(...bulletEntries(bullet[1] ?? '', area));
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  if (tableLines !== undefined) throw new Error(`${path}: a DataTable is not closed`);
  if (inCallout) throw new Error(`${path}: a Callout is not closed`);
  return out;
}

/** The entries with duplicate texts removed, first occurrence kept: the ledger lists a sentence once per document. */
export function uniqueEntries(entries: readonly Entry[]): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.text)) continue;
    seen.add(entry.text);
    out.push(entry);
  }
  return out;
}

/** The sentences of the hub page: its title, description, eyebrow and body paragraphs. */
export function enumerateHub(path: string, raw: string): Entry[] {
  const { data, body } = splitFrontmatter(path, raw);
  const out: Entry[] = [
    { text: asString(data.title), kind: 'title', area: 'front' },
    ...sentencesOf(asString(data.description)).map((text) => ({ text, kind: 'prose' as const, area: 'front' })),
    { text: asString(data.eyebrow), kind: 'title', area: 'front' },
  ];
  for (const paragraph of body.split(/\n\s*\n/)) {
    const text = plain(paragraph);
    if (text === '') continue;
    if (/^[<#]/.test(text) || text.startsWith('import ')) throw new Error(`${path}: the hub body is plain paragraphs only, found "${text.slice(0, 40)}"`);
    for (const sentence of sentencesOf(text)) out.push({ text: sentence, kind: 'prose', area: 'intro' });
  }
  return out;
}
