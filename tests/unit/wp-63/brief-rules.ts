/**
 * The rules a gated brief and its open abstract must meet (the WP-63 page brief and docs/wave8-contracts.md section 5). `checkBrief` is pure:
 * it takes the text of both files and what the registry and the sources ledger say, and returns the problems, so the test can run it over the
 * real briefs and over fabricated ones that break each rule. The sentinel and the shared-run mechanics are the audit's own
 * (scripts/lib/gated-briefs.mjs), so this test and the audit agree on what counts.
 */
import { parse } from 'yaml';
import { frontMatterList, frontMatterScalar, proseOf, readBrief, sharedRun, splitFrontMatter, wordsOf } from '../../../scripts/lib/gated-briefs.mjs';
import { AUDIENCES } from '../../../src/data/families.ts';
import { fetchDate } from '../wp-60/sources.ts';
import type { ClaimRecord, FetchRecord } from '../wp-60/sources.ts';

export const MIN_BRIEF_WORDS = 2500;
export const MAX_BRIEF_WORDS = 4000;
export const MAX_ABSTRACT_WORDS = 300;
export const MIN_SOURCES = 6;
export const REQUIRED_H2 = ['About the evidence', 'What this brief cannot tell you'] as const;

export interface BriefFacts {
  /** The brief file name without `.md`. */
  readonly id: string;
  readonly briefText: string;
  /** The open abstract file, or undefined when the brief has none. */
  readonly abstractText: string | undefined;
  /** What the registry says (src/data/families.ts). */
  readonly audience: readonly string[];
  readonly desks: readonly string[];
  readonly fetches: readonly FetchRecord[];
  readonly claims: readonly ClaimRecord[];
}

interface Source {
  readonly id: string;
  readonly url: string;
  readonly accessed: string;
}

const isoDate = (value: unknown): string => (value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'string' ? value : '');

function yamlOf(raw: string, where: string, problems: string[]): Record<string, unknown> {
  try {
    return (parse(raw) ?? {}) as Record<string, unknown>;
  } catch (error) {
    problems.push(`${where}: the front matter is not valid YAML: ${(error as Error).message}`);
    return {};
  }
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item) => b.includes(item));

/** The problems with one brief and its abstract. An empty list means both hold. */
export function checkBrief(facts: BriefFacts): string[] {
  const problems: string[] = [];
  const at = `${facts.id}`;
  const { raw, body } = splitFrontMatter(facts.briefText) as { raw: string; body: string };
  const brief = readBrief(`${facts.id}.md`, facts.briefText) as { errors: string[]; sentinel: string | null };
  for (const error of brief.errors) problems.push(`${at}: ${error}`);

  // Audience: a flow list of ids in the enum, equal to the registry's.
  const audience = frontMatterList(raw, 'audience') as string[] | null;
  if (audience === null || audience.length === 0) problems.push(`${at}: front matter has no audience list`);
  else {
    for (const a of audience) if (!(AUDIENCES as readonly string[]).includes(a)) problems.push(`${at}: audience "${a}" is not one of ${AUDIENCES.join(', ')}`);
    if (!sameSet(audience, facts.audience)) problems.push(`${at}: audience [${audience.join(', ')}] differs from the registry [${facts.audience.join(', ')}]`);
  }
  if (frontMatterScalar(raw, 'version') === null) problems.push(`${at}: front matter has no version`);
  if (frontMatterScalar(raw, 'updated') === null) problems.push(`${at}: front matter has no updated date`);

  // Length: whitespace-separated words of the body, headings and table included.
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < MIN_BRIEF_WORDS || words > MAX_BRIEF_WORDS) problems.push(`${at}: the brief has ${words} words; it must have ${MIN_BRIEF_WORDS} to ${MAX_BRIEF_WORDS}`);

  // The two sections every brief carries, as H2s.
  const h2 = [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => (m[1] ?? '').toLowerCase());
  for (const heading of REQUIRED_H2) if (!h2.includes(heading.toLowerCase())) problems.push(`${at}: the brief has no "## ${heading}" section`);

  // No image, in Markdown or HTML: a brief is text.
  if (/!\[[^\]]*\]\(/.test(body) || /<img\b/i.test(body)) problems.push(`${at}: the brief carries an image`);

  // Sources: at least six distinct, each fetched (a record with the same URL and date), each listed in the body.
  const front = yamlOf(raw, at, problems);
  const sources: Source[] = (Array.isArray(front.sources) ? (front.sources as Record<string, unknown>[]) : []).map((s) => ({ id: String(s.id ?? ''), url: String(s.url ?? ''), accessed: isoDate(s.accessed) }));
  const distinct = new Set(sources.map((s) => s.url));
  if (distinct.size < MIN_SOURCES) problems.push(`${at}: the brief has ${distinct.size} distinct sources; at least ${MIN_SOURCES}`);
  for (const source of sources) {
    const record = facts.fetches.find((f) => f.url === source.url);
    if (record === undefined) problems.push(`${at}: ${source.url} has no fetch record in the sources ledger`);
    else if (fetchDate(record.fetchedAt) !== source.accessed) problems.push(`${at}: ${source.id} says accessed ${source.accessed}, the ledger says ${fetchDate(record.fetchedAt) ?? 'no date'}`);
    if (!body.includes(source.url)) problems.push(`${at}: ${source.url} is in the front matter but not in the Sources section`);
  }

  // Claims: every sentence the ledger lists is a literal substring of the brief.
  const flat = body.replace(/\s+/g, ' ');
  for (const claim of facts.claims) {
    if (!flat.includes(claim.sentence.replace(/\s+/g, ' '))) problems.push(`${at}: claim ${claim.id} names a sentence that is not in the brief`);
  }

  // The open abstract.
  if (facts.abstractText === undefined) {
    problems.push(`${at}: the brief has no open abstract in src/content/briefs/`);
    return problems;
  }
  const abstract = splitFrontMatter(facts.abstractText) as { raw: string; body: string };
  const abstractWords = wordsOf(abstract.body).length;
  if (abstractWords > MAX_ABSTRACT_WORDS) problems.push(`${at}: the abstract has ${abstractWords} words; at most ${MAX_ABSTRACT_WORDS}`);
  if ((sharedRun(abstract.body, proseOf(body)) as number) >= 0) problems.push(`${at}: the abstract shares a 10-word run with the brief`);
  if (brief.sentinel !== null && (sharedRun(abstract.body, brief.sentinel, 6) as number) >= 0) problems.push(`${at}: the abstract repeats the sentinel`);
  const meta = yamlOf(abstract.raw, `${at} abstract`, problems);
  const outline = Array.isArray(meta.outline) ? (meta.outline as unknown[]).map(String) : [];
  if (outline.length === 0) problems.push(`${at}: the abstract has no outline`);
  const topics = Array.isArray(meta.topics) ? (meta.topics as unknown[]).map(String) : [];
  if (!sameSet(topics, facts.desks)) problems.push(`${at}: the abstract topics [${topics.join(', ')}] differ from the registry desks [${facts.desks.join(', ')}]`);
  const abstractAudience = Array.isArray(meta.audience) ? (meta.audience as unknown[]).map(String) : [];
  for (const a of abstractAudience) if (!(AUDIENCES as readonly string[]).includes(a)) problems.push(`${at}: the abstract audience "${a}" is not one of ${AUDIENCES.join(', ')}`);
  if (!sameSet(abstractAudience, facts.audience)) problems.push(`${at}: the abstract audience [${abstractAudience.join(', ')}] differs from the registry [${facts.audience.join(', ')}]`);
  // The outline names real sections: every title is an H2 of the brief, in the brief's order.
  const titles = [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1] ?? '');
  let cursor = 0;
  for (const title of outline) {
    const found = titles.indexOf(title, cursor);
    if (found === -1) problems.push(`${at}: outline title "${title}" is not a section of the brief, in order`);
    else cursor = found + 1;
  }
  return problems;
}
