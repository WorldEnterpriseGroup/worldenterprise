import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { DocumentFacts } from './sources.ts';

/** `accessed` parses to a Date when it is an unquoted YAML date, and stays a string when quoted. */
function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value : '';
}

function sourcesOf(value: unknown): DocumentFacts['sources'] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((s) => ({ id: String(s.id ?? ''), url: String(s.url ?? ''), accessed: isoDate(s.accessed) }));
}

/**
 * The sources a document lists: the top-level `sources` (articles, guides) together with `family.sources` (family pages keep theirs inside
 * the `family` object so the strict `pages` schema stays as it is, contracts 8.2). A source named in both lists counts once.
 */
function allSources(data: Record<string, unknown>): DocumentFacts['sources'] {
  const family = typeof data.family === 'object' && data.family !== null ? (data.family as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const out: DocumentFacts['sources'][number][] = [];
  for (const source of [...sourcesOf(data.sources), ...sourcesOf(family.sources)]) {
    const key = `${source.id}\n${source.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/** What the text of a content file says about its own sources and markers; undefined when it has no frontmatter. */
export function documentFactsOf(path: string, raw: string): DocumentFacts | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (match === null) return undefined;
  let data: Record<string, unknown>;
  try {
    data = (parse(match[1] ?? '') ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${path}: the frontmatter is not valid YAML: ${(error as Error).message}`);
  }
  const body = match[2] ?? '';
  const markers = [
    ...[...body.matchAll(/data-claim-allow=["']([^"']+)["']/g)].flatMap((m) => (m[1] ?? '').split(/\s+/).filter(Boolean).map((id) => `claim-allow:${id}`)),
    ...(/\bdata-generic-definition\b/.test(body) ? ['generic-definition'] : []),
  ];
  return { path, sources: allSources(data), noStatistics: data.noStatistics === true, markers };
}

/** `documentFactsOf` for a repo-relative path under `root`; undefined when the file is missing or has no frontmatter. */
export function documentFactsAt(root: string, path: string): DocumentFacts | undefined {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return undefined;
  return documentFactsOf(path, readFileSync(absolute, 'utf8'));
}
