import { DESK_DEFINITIONS, deskPath } from '../../data/desks.ts';
import { FAMILIES, familyLabel } from '../../data/families.ts';
import type { FamilyId } from '../../data/families.ts';
import type { LlmsGroup, LlmsPage } from '../../lib/llms.ts';
import type { RenderedTwin } from '../../lib/markdown-twins.ts';

/**
 * What the two llms files list, derived from the registries (src/data/desks.ts, src/data/families.ts) and the route state, so a new
 * desk or family appears with no edit here and a route that is not live drops out. Pure: `isLive` is injected. The page text of a
 * group is never read here; a family entry is listed by its registry label, which is what keeps a blocked word (C-13-peers) out of
 * every generated list.
 */

/** The name of each family where a list shows it as a heading. */
export const FAMILY_LABELS: Readonly<Record<FamilyId, string>> = {
  segments: 'Founder segments',
  industries: 'Industries',
  compare: 'Comparisons',
  journey: 'Journey',
  briefs: 'Briefs',
};

/** The insight desks with a live topic page, in registry order. The hub carries the desk blurb. */
export function deskGroups(isLive: (route: string) => boolean): readonly LlmsGroup[] {
  return DESK_DEFINITIONS.filter((desk) => isLive(deskPath(desk.id))).map((desk) => ({
    label: desk.name,
    hub: { route: deskPath(desk.id), title: desk.name, description: desk.blurb },
    pages: [],
  }));
}

/** Every page family that has a live hub or a live entry, in registry order, with its live entries by label. */
export function familyGroups(isLive: (route: string) => boolean): readonly LlmsGroup[] {
  return FAMILIES.map((family): LlmsGroup => {
    const hub: LlmsPage | undefined =
      family.hub !== undefined && isLive(family.hub.path) ? { route: family.hub.path, title: FAMILY_LABELS[family.id] } : undefined;
    const pages = family.entries.filter((entry) => isLive(entry.path)).map((entry): LlmsPage => ({ route: entry.path, title: familyLabel(entry) }));
    return { label: FAMILY_LABELS[family.id], hub, pages };
  }).filter((group) => group.hub !== undefined || group.pages.length > 0);
}

export interface FullTierInput {
  /** The rendered twin of every route that has one. */
  readonly twins: ReadonlyMap<string, RenderedTwin>;
  /** The curated first tier, in reading order: the pages a reader of the full file needs whatever else is added. */
  readonly curated: readonly string[];
  readonly isLive: (route: string) => boolean;
}

/**
 * The candidates of /llms-full.txt in order of importance: the curated pages, then one page per family (its hub, or its first live
 * entry when the family has no hub twin) and one page per desk. Articles are never candidates: they are linked from llms.txt, which
 * is how the file stays a small share of its cap at any number of articles.
 */
export function fullTiers(input: FullTierInput): readonly (readonly RenderedTwin[])[] {
  const pick = (routes: readonly string[]): RenderedTwin[] =>
    routes.flatMap((route) => {
      const twin = input.twins.get(route);
      return twin === undefined || !input.isLive(route) ? [] : [twin];
    });
  const familyRoutes = FAMILIES.map((family) => {
    const candidates = [...(family.hub === undefined ? [] : [family.hub.path]), ...family.entries.map((entry) => entry.path)];
    return candidates.find((route) => input.twins.has(route) && input.isLive(route));
  }).filter((route): route is string => route !== undefined);
  const deskRoutes = DESK_DEFINITIONS.map((desk) => deskPath(desk.id));
  return [pick(input.curated), pick(familyRoutes), pick(deskRoutes)];
}
