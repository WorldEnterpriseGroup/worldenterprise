/**
 * The gated-brief page plan, as pure functions (docs/wave8-contracts.md section 5). The registry entries and the open abstracts are
 * parameters, never imports of `astro:content`, so a unit test can run the same code on fixtures of 1, 3 and 10 abstracts and on a
 * registry entry whose `launch` is false. A brief has a squeeze route exactly when its registry entry launches and its open abstract
 * exists and is not a draft: the full text under infra/intake/briefs/ plays no part here.
 */
import { AUDIENCES } from '../../data/families.ts';
import type { Audience } from '../../data/families.ts';
import type { DeskId } from '../../data/desks.ts';

/** The registry fields the plan reads (a subset of `BriefEntry` in src/data/families.ts). */
export interface BriefRegistryRow {
  readonly slug: string;
  readonly path: string;
  readonly label: string;
  readonly order: number;
  readonly launch: boolean;
  readonly audience: readonly Audience[];
  readonly desks: readonly DeskId[];
}

/** The open abstract of a brief: the validated front matter and the short body, nothing else. */
export interface BriefAbstract {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly subtitle: string;
    readonly description: string;
    readonly topics: readonly DeskId[];
    readonly audience: readonly Audience[];
    readonly outline: readonly string[];
    readonly updated: Date;
    readonly draft?: boolean | undefined;
  };
  readonly body?: string | undefined;
}

/** A brief that has a live squeeze page: its registry row joined to its abstract. */
export interface LiveBrief<A extends BriefAbstract = BriefAbstract> {
  readonly row: BriefRegistryRow;
  readonly abstract: A;
}

export interface AudienceGroup<A extends BriefAbstract = BriefAbstract> {
  readonly audience: Audience;
  readonly briefs: readonly LiveBrief<A>[];
}

/** How many related briefs a squeeze page links to. */
export const RELATED_LIMIT = 3;

/**
 * The briefs that have a squeeze page, in registry order. An abstract whose id is not in the registry is a content error and throws:
 * the request form would have no brief to send. A cut entry (`launch: false`) and a draft abstract yield nothing.
 */
export function liveBriefs<A extends BriefAbstract>(registry: readonly BriefRegistryRow[], abstracts: readonly A[], opts: { readonly includeDrafts?: boolean } = {}): readonly LiveBrief<A>[] {
  const byId = new Map(registry.map((row) => [row.slug, row]));
  const seen = new Set<string>();
  const found: LiveBrief<A>[] = [];
  for (const abstract of abstracts) {
    const row = byId.get(abstract.id);
    if (row === undefined) {
      throw new Error(`Brief abstract "${abstract.id}" is not in the registry (src/data/families.ts: ${registry.map((r) => r.slug).join(', ')}).`);
    }
    if (seen.has(abstract.id)) throw new Error(`Brief abstract "${abstract.id}" appears twice.`);
    seen.add(abstract.id);
    if (!row.launch) continue;
    if (abstract.data.draft === true && opts.includeDrafts !== true) continue;
    found.push({ row, abstract });
  }
  return found.sort((a, b) => a.row.order - b.row.order);
}

/** One `getStaticPaths` entry per live brief. The param is the registry id, which is also the form's `briefId`. */
export function staticPaths<A extends BriefAbstract>(registry: readonly BriefRegistryRow[], abstracts: readonly A[], opts: { readonly includeDrafts?: boolean } = {}): readonly { readonly params: { readonly id: string }; readonly props: { readonly brief: LiveBrief<A> } }[] {
  return liveBriefs(registry, abstracts, opts).map((brief) => ({ params: { id: brief.row.slug }, props: { brief } }));
}

/**
 * The live briefs grouped by audience, in the order of `AUDIENCES`. A brief written for several audiences is listed under each of
 * them. An audience with no live brief is left out, so the hub never shows an empty heading.
 */
export function groupByAudience<A extends BriefAbstract>(live: readonly LiveBrief<A>[]): readonly AudienceGroup<A>[] {
  const groups: AudienceGroup<A>[] = [];
  for (const audience of AUDIENCES) {
    const briefs = live.filter((entry) => entry.row.audience.includes(audience));
    if (briefs.length > 0) groups.push({ audience, briefs });
  }
  return groups;
}

/**
 * Other live briefs to offer on a squeeze page: those sharing a desk first, then those sharing an audience, then registry order.
 * Never the brief itself, never more than `limit`, and never a brief without a live page.
 */
export function relatedFor<A extends BriefAbstract>(id: string, live: readonly LiveBrief<A>[], limit: number = RELATED_LIMIT): readonly LiveBrief<A>[] {
  const self = live.find((entry) => entry.row.slug === id);
  if (self === undefined) return [];
  const score = (other: LiveBrief<A>): number => {
    const sharedDesks = other.row.desks.filter((desk) => self.row.desks.includes(desk)).length;
    const sharedAudience = other.row.audience.filter((audience) => self.row.audience.includes(audience)).length;
    return sharedDesks * 10 + sharedAudience;
  };
  return live
    .filter((entry) => entry.row.slug !== id)
    .map((entry) => ({ entry, score: score(entry) }))
    .sort((a, b) => b.score - a.score || a.entry.row.order - b.entry.row.order)
    .slice(0, Math.max(0, limit))
    .map(({ entry }) => entry);
}

/** Section count for the depth strip: the number of titles in the abstract's outline. */
export function sectionCount(abstract: BriefAbstract): number {
  return abstract.data.outline.length;
}
