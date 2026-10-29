/**
 * Pure helpers for <we-search>. No DOM access, so node --test can run them.
 */
export const MAX_QUERY_LENGTH = 200;

/** Reads the `q` parameter from a location.search string. Returns '' when absent. */
export function readQuery(search: string): string {
  const value = new URLSearchParams(search).get('q') ?? '';
  return normalizeQuery(value);
}

/** Collapses whitespace, trims, and caps the length. */
export function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

/** Returns a URL search string ("" or "?q=...") for the given query, keeping other parameters. */
export function withQuery(search: string, query: string): string {
  const params = new URLSearchParams(search);
  const q = normalizeQuery(query);
  if (q === '') params.delete('q');
  else params.set('q', q);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** "/worldenterprise/" or "/" to "/worldenterprise" or "". */
export function normalizeBase(base: string): string {
  const trimmed = base.trim().replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '' : `/${trimmed}`;
}

/**
 * Pagefind returns URLs relative to the indexed site root ("/program/"). A preview build is served below a base
 * path, so the base is prefixed unless the URL already carries it.
 */
export function resolveResultUrl(url: string, base: string): string {
  const prefix = normalizeBase(base);
  if (!url.startsWith('/') || prefix === '') return url;
  return url === prefix || url.startsWith(`${prefix}/`) ? url : `${prefix}${url}`;
}

export function resultsStatus(count: number, query: string): string {
  if (count === 0) return `No results for “${query}”.`;
  return count === 1 ? `1 result for “${query}”.` : `${count} results for “${query}”.`;
}

export type ResultKind = 'article' | 'research' | 'playbook' | 'guide' | 'template' | 'faq' | 'glossary';

interface KindRow {
  readonly id: ResultKind;
  /** Plural, as the chip says it. */
  readonly label: string;
  /** As a status line and a result badge say it. */
  readonly singular: string;
  readonly prefix: string;
}

/** The result types, in chip order, and the route prefix that says which one a page is. Every other page has no type. */
export const RESULT_KINDS: readonly KindRow[] = [
  { id: 'article', label: 'Articles', singular: 'Article', prefix: '/insights/' },
  { id: 'research', label: 'Research', singular: 'Research', prefix: '/research/' },
  { id: 'playbook', label: 'Playbooks', singular: 'Playbook', prefix: '/playbooks/' },
  { id: 'guide', label: 'Guides', singular: 'Guide', prefix: '/fundability/' },
  { id: 'template', label: 'Templates', singular: 'Template', prefix: '/library/' },
  { id: 'faq', label: 'FAQ', singular: 'FAQ', prefix: '/faq/' },
  { id: 'glossary', label: 'Glossary', singular: 'Glossary', prefix: '/glossary/' },
];

/**
 * The type of a result, from its URL as Pagefind returns it (site-relative, with or without the preview base path). The base is
 * removed before the prefix is read, so "/worldenterprise/insights/x/" is an article as "/insights/x/" is. Returns null for any page
 * that is not one of the types, and for an absolute URL.
 */
export function resultKind(url: string, base = ''): ResultKind | null {
  if (!url.startsWith('/')) return null;
  const prefix = normalizeBase(base);
  const path = prefix !== '' && (url === prefix || url.startsWith(`${prefix}/`)) ? url.slice(prefix.length) || '/' : url;
  const hit = RESULT_KINDS.find((kind) => path === kind.prefix.slice(0, -1) || path.startsWith(kind.prefix));
  return hit?.id ?? null;
}

export function isResultKind(value: string): value is ResultKind {
  return RESULT_KINDS.some((kind) => kind.id === value);
}

export function kindLabel(kind: ResultKind): string {
  return RESULT_KINDS.find((row) => row.id === kind)?.singular ?? kind;
}

/** Reads the `type` parameter. An unknown value is ignored, so a stale link still opens the page. */
export function readType(search: string): ResultKind | null {
  const value = new URLSearchParams(search).get('type') ?? '';
  return isResultKind(value) ? value : null;
}

/** Returns a URL search string with `type` set or removed, keeping every other parameter. */
export function withType(search: string, kind: ResultKind | null): string {
  const params = new URLSearchParams(search);
  if (kind === null) params.delete('type');
  else params.set('type', kind);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** The kinds present among `urls`, in chip order. */
export function kindsPresent(urls: readonly string[], base = ''): readonly ResultKind[] {
  const present = new Set<ResultKind>();
  for (const url of urls) {
    const kind = resultKind(url, base);
    if (kind !== null) present.add(kind);
  }
  return RESULT_KINDS.filter((row) => present.has(row.id)).map((row) => row.id);
}

/** Status line for a list filtered to one type: "3 Playbook results for “x”." */
export function filteredStatus(count: number, query: string, kind: ResultKind): string {
  const noun = kindLabel(kind);
  if (count === 0) return `No ${noun} results for “${query}”.`;
  return count === 1 ? `1 ${noun} result for “${query}”.` : `${count} ${noun} results for “${query}”.`;
}

/**
 * Status line for a filtered list whose count is not final: the rows of the type read so far are on screen and the rest of the index
 * is still being read. "10 Article results for “x” so far. Counting the rest."
 */
export function partialStatus(count: number, query: string, kind: ResultKind, tail = 'Counting the rest.'): string {
  const noun = kindLabel(kind);
  return `${count} ${noun} ${count === 1 ? 'result' : 'results'} for “${query}” so far. ${tail}`;
}
