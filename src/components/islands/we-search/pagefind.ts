/**
 * The Pagefind index, loaded at runtime. It is written to /pagefind/ by the postbuild step, after the Astro build, so it cannot be
 * imported statically: the address comes from a data-pagefind attribute and the module is a same-origin dynamic import. Shared by
 * <we-search> and <we-palette>.
 */
export interface PagefindData {
  readonly url: string;
  readonly excerpt: string;
  readonly meta: Readonly<Record<string, string | undefined>>;
}

export interface PagefindResult {
  data(): Promise<PagefindData>;
}

export interface PagefindApi {
  search(query: string): Promise<{ readonly results: readonly PagefindResult[] }>;
}

export function isPagefindApi(value: unknown): value is PagefindApi {
  return typeof value === 'object' && value !== null && typeof (value as { search?: unknown }).search === 'function';
}

const loads = new Map<string, Promise<PagefindApi>>();

/**
 * Loads the module once per address. A failed load is forgotten, so a later call tries again (the index may simply not have been
 * reachable the first time). Rejects with an Error that says what was wrong.
 */
export function loadPagefind(src: string | null): Promise<PagefindApi> {
  if (src === null || src === '') return Promise.reject(new Error('The search index address is missing.'));
  const known = loads.get(src);
  if (known !== undefined) return known;
  const load = (async (): Promise<PagefindApi> => {
    const mod: unknown = await import(/* @vite-ignore */ src);
    if (!isPagefindApi(mod)) throw new Error('The search index module has no search function.');
    return mod;
  })();
  loads.set(src, load);
  load.catch(() => loads.delete(src));
  return load;
}
