import { parse } from 'yaml';
import { countWords } from '../../../src/lib/content-files.ts';
import { insightsSchema } from '../../../src/lib/content-schemas.ts';

/**
 * The article rubric (docs/wave8-contracts.md, section 2, "Article file rules"). `checkArticle` is pure: it takes the path, the raw file
 * text and the facts about the site it needs, and returns the problems, so the test can run it over every real article and over
 * fabricated ones to prove it can fail. Every package that writes an article is held to it by `article-rubric.test.ts`.
 */

export const MIN_WORDS = 1200;
export const MAX_WORDS = 1800;
export const LIMITS_HEADING = 'What this article cannot tell you';
export const MIN_INTERNAL_LINKS = 3;

/**
 * The claims scan of scripts/audit-claims.mjs: the rules and the context rules, with their markers (`data-claim-allow`,
 * `data-generic-definition`) and allowed paths, exactly as the built-output audit applies them. Passing the function in keeps this file pure.
 */
export type ClaimsScan = (text: string, route: string) => readonly { readonly rule: string }[];

export interface RubricContext {
  /** The routes that are live (a page file and, for a dynamic page, a published entry), for the internal-link rule. Files supply them, so an article on the same branch counts. */
  readonly livePaths: ReadonlySet<string>;
  readonly playbookSlugs: ReadonlySet<string>;
  readonly templateSlugs: ReadonlySet<string>;
  readonly scanClaims: ClaimsScan;
}

export interface Problem {
  /** A stable rule name, so a waiver can name it. */
  readonly rule: string;
  readonly message: string;
}

const EMOJI = /\p{Extended_Pictographic}/u;
/** Desks whose articles may be read as advice: legal, funding and fundable ones say what a thing is and what to ask counsel. */
const ADVICE_DESKS: readonly string[] = ['legal', 'funding', 'fundable'];
const ADVICE = /\byou (?:should|must|need to|ought to) (?:sign|accept|file|incorporate|issue|elect|raise|take|invest|choose|use|pick|buy|sell|grant)\b/i;

export function splitFrontmatter(raw: string): { readonly front: string; readonly body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  return match === null ? null : { front: match[1] ?? '', body: match[2] ?? '' };
}

const withSlash = (target: string): string => {
  const path = target.split(/[?#]/)[0] ?? '';
  return path.endsWith('/') ? path : `${path}/`;
};

/**
 * Internal link targets in a body, without the query or fragment: `<MaybeLink path="/path/">` (either quote), the component that honours
 * PATH_BASE and that contracts section 2 prescribes, and the Markdown `](/path/)` and `href="/path/"` forms, which `link-form` rejects.
 */
export function internalLinks(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(/<MaybeLink\b[^>]*?\bpath=["'](\/[^"']*)["']|\]\((\/[^)\s]*)\)|\bhref=["'](\/[^"']*)["']/g)) {
    found.push(withSlash(match[1] ?? match[2] ?? match[3] ?? ''));
  }
  return found;
}

/** Root-relative Markdown and href links bypass `href()` and break on the PATH_BASE preview, so an article uses `<MaybeLink>` instead. */
export function bypassingLinks(body: string): string[] {
  return [...body.matchAll(/\]\((\/[^)\s]*)\)|\bhref=["'](\/[^"']*)["']/g)].map((m) => m[1] ?? m[2] ?? '');
}

/** The problems with one article: an empty list means it passes. `path` is relative to the repository root. */
export function checkArticle(path: string, raw: string, ctx: RubricContext): Problem[] {
  const problems: Problem[] = [];
  const add = (rule: string, message: string): void => {
    problems.push({ rule, message });
  };

  const place = /^src\/content\/insights\/([^/]+)\/([^/]+?)\.mdx?$/.exec(path);
  if (place === null) {
    add('path', 'an article sits in src/content/insights/<desk>/<slug>.md(x)');
    return problems;
  }
  const folder = place[1] ?? '';

  const parts = splitFrontmatter(raw);
  if (parts === null) {
    add('frontmatter', 'the file has no frontmatter block');
    return problems;
  }
  let data: Record<string, unknown>;
  try {
    data = (parse(parts.front) ?? {}) as Record<string, unknown>;
  } catch (error) {
    add('frontmatter', `the frontmatter is not valid YAML: ${(error as Error).message}`);
    return problems;
  }

  const parsed = insightsSchema.safeParse(data);
  if (!parsed.success) add('schema', parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '));

  if (data.topic !== folder) add('desk-folder', `the folder "${folder}" must equal the frontmatter topic "${String(data.topic)}"`);
  if (data.draft === true) add('draft', 'a published article has draft: false');
  if (data.cover !== undefined) add('cover', 'no cover: covers come from the photography lane');

  const sources = Array.isArray(data.sources) ? (data.sources as { id?: string; url?: string }[]) : [];
  if (data.noStatistics !== true && sources.length < 2) add('sources', 'at least two sources, or noStatistics: true');
  const ids = sources.map((s) => s.id);
  if (new Set(ids).size !== ids.length) add('sources', 'source ids must be unique');
  for (const s of sources) if (!/^https:\/\//.test(s.url ?? '')) add('sources', `source "${s.id}" needs an https URL`);
  for (const e of Array.isArray(data.evidence) ? (data.evidence as string[]) : []) if (!ids.includes(e)) add('sources', `evidence "${e}" names no listed source`);

  const services = Array.isArray(data.relatedServices) ? data.relatedServices : [];
  if (services.length === 0) add('related', 'name at least one related service line');
  if (typeof data.relatedPlaybook === 'string' && !ctx.playbookSlugs.has(data.relatedPlaybook)) add('related', `relatedPlaybook "${data.relatedPlaybook}" is not a playbook`);
  if (typeof data.relatedTemplate === 'string' && !ctx.templateSlugs.has(data.relatedTemplate)) add('related', `relatedTemplate "${data.relatedTemplate}" is not a library template`);

  const words = countWords(parts.body);
  if (words < MIN_WORDS || words > MAX_WORDS) add('words', `${words} words; an article is ${MIN_WORDS} to ${MAX_WORDS}`);

  const headings = [...parts.body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1]);
  if (!headings.includes(LIMITS_HEADING)) add('cannot-tell-you', `needs the H2 "${LIMITS_HEADING}"`);

  // Only a route that is live counts. A page still pending belongs in `related`: a link to it would be dead on the day the article ships.
  const links = internalLinks(parts.body).filter((l) => ctx.livePaths.has(l));
  if (links.length < MIN_INTERNAL_LINKS) add('internal-links', `${links.length} internal links to live routes; at least ${MIN_INTERNAL_LINKS}`);
  for (const bypass of bypassingLinks(parts.body)) add('link-form', `${bypass} is a root-relative link; use <MaybeLink path="${bypass}"> so it honours the preview base path`);

  const slug = place[2] ?? '';
  for (const hit of ctx.scanClaims(raw, `/insights/${slug}/`)) add('denylist', `matches claims rule ${hit.rule}`);
  if (EMOJI.test(raw)) add('style', 'no emoji');
  if (/!\s/u.test(parts.body.replace(/!\[[^\]]*\]/g, ''))) add('style', 'no exclamation marks');
  if (typeof data.topic === 'string' && ADVICE_DESKS.includes(data.topic) && ADVICE.test(parts.body)) {
    add('advice', 'a legal or funding article says what a thing is and what to ask counsel; it never says what the reader should do');
  }
  return problems;
}
