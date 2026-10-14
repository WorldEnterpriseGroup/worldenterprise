import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { faqSchema } from '../../../src/lib/content-schemas.ts';

/**
 * The FAQ data, read the way the build reads it, for the WP-78 tests. `src/data/faq.yaml` holds the 18 original entries first (general, no
 * audience, pinned byte for byte by tests/unit/wp-60/reference-data.test.ts) and the audience entries WP-78 adds after them.
 */
export const root = new URL('../../../', import.meta.url).pathname;
export const read = (path: string): string => readFileSync(join(root, path), 'utf8');

export type FaqRow = ReturnType<typeof faqSchema.parse>;

export function faqRows(): FaqRow[] {
  const raw = parse(read('src/data/faq.yaml')) as unknown;
  if (!Array.isArray(raw)) throw new Error('src/data/faq.yaml is not a list.');
  return raw.map((entry) => faqSchema.parse(entry));
}

/** The ids of the 18 entries that existed before WP-78, from the pin that WP-60 keeps. */
export function originalIds(): string[] {
  const pin = JSON.parse(read('tests/unit/wp-60/fixtures/reference-originals.json')) as { faq: Record<string, string> };
  return Object.keys(pin.faq);
}

/** The entries WP-78 added: every entry that is not one of the originals, in file order. */
export function newRows(): FaqRow[] {
  const originals = new Set(originalIds());
  return faqRows().filter((row) => !originals.has(row.id));
}

/** A string split into its sentences: a full stop, question mark or exclamation mark followed by a capital letter. */
export const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

/** Every sentence of every new entry's question and answer, once each, in file order. */
export function newSentences(): string[] {
  const all: string[] = [];
  for (const row of newRows()) all.push(...sentencesOf(row.question), ...sentencesOf(row.answer));
  return [...new Set(all)];
}
