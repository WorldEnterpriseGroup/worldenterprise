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
