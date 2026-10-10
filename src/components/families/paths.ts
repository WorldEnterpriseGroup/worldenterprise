import type { FamilyData, FamilyLink, PageRef, Registry, RegistryEntry } from './types.ts';

/**
 * Route resolution for the family templates, pure over the registry and the ids of the `pages` collection.
 * A page exists only when the registry names its slug AND a `pages` entry holds it: a slug with no entry makes no route, an
 * entry whose slug is not in the registry makes none either (WP-60's families test fails that file before the build does).
 */

/** Entry id in the `pages` collection for a family slug, for example `industries/fintech`. */
export function entryIdFor(registry: Registry, slug: string): string {
  return `${registry.folder}/${slug}`;
}

/** Entry id of the family hub's own page, for example `industries/index`. */
export function hubEntryId(registry: Registry): string {
  return `${registry.folder}/index`;
}

/** The glob loader may collapse `x/index` to `x`; both spellings name the same entry. */
export function idVariants(id: string): readonly string[] {
  return id.endsWith('/index') ? [id, id.slice(0, -'/index'.length)] : [id];
}

/** True when the collection holds the entry, under either spelling of an index id. */
export function hasEntry(ids: ReadonlySet<string>, id: string): boolean {
  return idVariants(id).some((variant) => ids.has(variant));
}

export interface ResolvedEntry<P extends { readonly id: string }, T extends RegistryEntry = RegistryEntry> {
  readonly entry: T;
  readonly page: P;
}

/**
 * The registry entries that get a route: launched, and holding a `pages` entry. Order follows the registry, never the file system.
 * A page the registry does not list is ignored here; a `launch: false` entry makes no route even when its file exists.
 */
export function resolveEntries<P extends { readonly id: string }, T extends RegistryEntry>(
  registry: Registry<T>,
  pages: readonly P[],
): readonly ResolvedEntry<P, T>[] {
  const byId = new Map(pages.map((page) => [page.id, page] as const));
  const out: ResolvedEntry<P, T>[] = [];
  for (const entry of [...registry.entries].sort((a, b) => a.order - b.order)) {
    if (!entry.launch) continue;
    const page = byId.get(entryIdFor(registry, entry.slug));
    if (page !== undefined) out.push({ entry, page });
  }
  return out;
}

/** The hub's own page entry, or undefined. The hub is optional content: the template carries the structure. */
export function findHubPage<P extends { readonly id: string }>(registry: Registry, pages: readonly P[]): P | undefined {
  const wanted = idVariants(hubEntryId(registry));
  return pages.find((page) => wanted.includes(page.id));
}

/** A family object must belong to the registry and the slug of the route that renders it. Throws a precise message otherwise. */
export function assertFamilyData<D extends FamilyData>(
  registry: Registry,
  slug: string,
  family: FamilyData | undefined,
  expectedId: D['id'],
): D {
  const where = `${entryIdFor(registry, slug)}`;
  if (family === undefined) {
    throw new Error(`${where}: the frontmatter has no \`family\` object, so the ${registry.id} template cannot render it.`);
  }
  if (family.id !== expectedId) {
    throw new Error(`${where}: family.id is "${family.id}" but the ${registry.id} template renders "${expectedId}".`);
  }
  if (family.slug !== slug) {
    throw new Error(`${where}: family.slug is "${family.slug}" but the file name and the registry say "${slug}".`);
  }
  return family as D;
}

/** The hub card of a registry entry. An entry that carries a blocked word is described by its label alone (contracts section 8.1). */
export function cardFor(entry: RegistryEntry, page: PageRef): FamilyLink {
  const link: FamilyLink = { title: entry.label, href: entry.path };
  if (entry.blockedWord !== undefined) return link;
  return { ...link, description: page.description };
}

/** The hub cards: one per routed entry whose route is live in this build, in registry order. */
export function liveCards<P extends PageRef, T extends RegistryEntry>(
  registry: Registry<T>,
  pages: readonly P[],
  isLive: (path: string) => boolean,
): readonly FamilyLink[] {
  return resolveEntries(registry, pages)
    .filter(({ entry }) => isLive(entry.path))
    .map(({ entry, page }) => cardFor(entry, page));
}
