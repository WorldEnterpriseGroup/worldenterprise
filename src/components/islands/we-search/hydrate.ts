/**
 * How <we-search> reads the data of its results. Pagefind can be filtered by URL only once a result's data is fetched, so the result
 * types (the chips and the filter) come from fetched rows. Pure, so node --test can run it.
 *
 * The rows are fetched in chunks, in order, up to a ceiling. A chunk is one round of parallel fetches; the chips are updated after each
 * chunk, and a filter stops fetching as soon as it has a page of matches. The ceiling is above the size of the site's index (about 300
 * routes at 120 articles and eight page families), so in practice every match is read; a search with more matches says so.
 */

/** Results fetched in one round. */
export const HYDRATE_CHUNK = 50;

/** The most results whose data is read for the chips and the filter. */
export const HYDRATE_CEILING = 500;

/** How many of `total` results are read: all of them, up to the ceiling. */
export function hydrationLimit(total: number, ceiling: number = HYDRATE_CEILING): number {
  return Math.max(0, Math.min(total, ceiling));
}

/** The end positions of each round for `total` results: 50, 100, ... and the limit last. Empty for no results. */
export function chunkEnds(total: number, chunk: number = HYDRATE_CHUNK, ceiling: number = HYDRATE_CEILING): readonly number[] {
  const limit = hydrationLimit(total, ceiling);
  const ends: number[] = [];
  for (let end = Math.min(chunk, limit); end > 0; end = end >= limit ? 0 : Math.min(end + chunk, limit)) ends.push(end);
  return ends;
}

/** What a filtered status line adds when the search has more matches than are read, or the empty string. */
export function coverageNote(total: number, ceiling: number = HYDRATE_CEILING): string {
  return total > ceiling ? ` The filter covers the first ${ceiling} matches.` : '';
}
