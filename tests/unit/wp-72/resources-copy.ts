import { DESK_DEFINITIONS, deskPath } from '../../../src/data/desks.ts';
import { BRIEFS, COMPARISONS, familyLabel, INDUSTRIES, SEGMENTS } from '../../../src/data/families.ts';
import type { FamilyDefinition, FamilyEntry } from '../../../src/data/families.ts';
import { kindGroups, liveGroups, metaLookup, RESOURCE_STRIP, RESOURCES_COPY, routeOfEntry, STATIC_META } from '../../../src/components/reference/resources.ts';
import type { LedgerRow, ResourceGroup } from '../../../src/components/reference/resources.ts';
import type { DiskEntry } from './disk-meta.ts';
import { sentencesOf } from './page-copy.ts';

/**
 * The words of /resources/ (WP-72), in two kinds.
 *
 * Owned copy is what WP-72 wrote: the page's own strings, each group's title and intro, and the strip. It is the same whichever routes are
 * live, so it is enumerated with every route live and the sentence ledger holds it strictly (no gap, no stale row).
 *
 * Derived copy is a title or description the hub reads from the page it links to (a content entry, a desk, a family label, a static page).
 * Its ledger row is a `page` mapping to that source file. It follows the live routes, so a package that adds a page changes this list
 * without editing WP-72's files: the ledger must hold the derived sentences that exist today, and a derived sentence a later page adds is
 * accepted when its source file really holds it (`derivedSources` names the files that may).
 */
export const STATIC_PAGE_FILES: Readonly<Record<string, string>> = {
  '/library/': 'src/pages/library/index.astro',
  '/glossary/': 'src/pages/glossary/index.astro',
  '/faq/': 'src/pages/faq/index.astro',
  '/search/': 'src/pages/search/index.astro',
};

export interface Derived {
  readonly text: string;
  /** The file the sentence restates. */
  readonly page: string;
}

const placeholder = { title: 'Title' } as const;

/** One synthetic ledger row per member rule of the kind lists, so every kind group appears whichever real pages exist. */
const SYNTHETIC_ROWS: readonly LedgerRow[] = [
  { path: '/library/a/', layout: 'TemplateLayout' },
  { path: '/playbooks/a/', layout: 'PlaybookLayout' },
  { path: '/fundability/a/', layout: 'GuideLayout' },
  { path: '/tools/a/', layout: 'ToolLayout' },
  { path: '/research/a/', layout: 'BriefLayout' },
];

function groupCopy(group: ResourceGroup): string[] {
  return [group.title, ...(group.intro === undefined ? [] : sentencesOf(group.intro))];
}

export function ownedSentences(): string[] {
  const copy = RESOURCES_COPY;
  const page = [
    copy.title,
    copy.eyebrow,
    ...sentencesOf(copy.description),
    ...sentencesOf(copy.lead),
    copy.stage.heading,
    ...sentencesOf(copy.stage.intro),
    copy.kind.heading,
    ...sentencesOf(copy.kind.intro),
    copy.stripLabel,
    copy.openTemplates,
  ];
  const groups = [...liveGroups(() => true, () => placeholder), ...kindGroups(SYNTHETIC_ROWS, () => true, () => placeholder)].flatMap(groupCopy);
  const staticTitles = Object.values(STATIC_META).flatMap((m) => (m.description === undefined ? [m.title] : []));
  return [...new Set([...page, ...groups, ...staticTitles, ...RESOURCE_STRIP.map((i) => i.title)])];
}

/** Every family entry the hub lists, by path: its words come from the registry, never from the page the entry links to. */
export const FAMILY_ENTRIES: ReadonlyMap<string, FamilyEntry> = new Map([BRIEFS, SEGMENTS, INDUSTRIES, COMPARISONS].flatMap((family) => family.entries.map((entry) => [entry.path, entry] as const)));

const familyEntries = (family: FamilyDefinition): Derived[] => family.entries.map((e) => ({ text: familyLabel(e), page: 'src/data/families.ts' }));

/** The titles and descriptions of the items the hub lists, with the file each came from, for the routes `isLive` accepts. */
export function derivedSentences(entries: readonly DiskEntry[], ledger: readonly LedgerRow[], isLive: (path: string) => boolean): Derived[] {
  const byRoute = new Map<string, DiskEntry>();
  for (const entry of entries) {
    const route = routeOfEntry(entry.collection, entry.id);
    if (!byRoute.has(route)) byRoute.set(route, entry);
  }
  const lookup = metaLookup(entries);
  const out: Derived[] = [];
  const groups = [...liveGroups(isLive, lookup), ...kindGroups(ledger, isLive, lookup)];
  for (const group of groups) {
    for (const item of group.items) {
      // A family entry is listed by its registry label alone, so its only source is src/data/families.ts (added below).
      if (FAMILY_ENTRIES.has(item.path)) continue;
      const entry = byRoute.get(item.path);
      const page = entry?.file ?? STATIC_PAGE_FILES[item.path];
      if (page === undefined) continue;
      out.push({ text: item.title, page });
      if (item.description !== undefined) out.push(...sentencesOf(item.description).map((text) => ({ text, page })));
    }
  }
  for (const desk of DESK_DEFINITIONS) {
    if (isLive(deskPath(desk.id))) out.push({ text: desk.name, page: 'src/data/desks.ts' }, ...sentencesOf(desk.blurb).map((text) => ({ text, page: 'src/data/desks.ts' })));
  }
  for (const family of [BRIEFS, SEGMENTS, INDUSTRIES, COMPARISONS]) out.push(...familyEntries(family).filter((_, i) => isLive(family.entries[i]?.path ?? '')));
  const seen = new Set<string>();
  return out.filter((d) => (seen.has(d.text) ? false : (seen.add(d.text), true)));
}

/** The files a derived sentence may be mapped to: every content entry, the desk and family registries, the static pages. */
export function derivedSources(entries: readonly DiskEntry[]): Set<string> {
  return new Set([...entries.map((e) => e.file), 'src/data/desks.ts', 'src/data/families.ts', ...Object.values(STATIC_PAGE_FILES)]);
}
