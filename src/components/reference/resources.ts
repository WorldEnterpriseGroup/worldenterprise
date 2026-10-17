import { DESK_DEFINITIONS, deskPath } from '../../data/desks.ts';
import { BRIEFS, COMPARISONS, familyLabel, INDUSTRIES, SEGMENTS } from '../../data/families.ts';
import type { FamilyDefinition } from '../../data/families.ts';

/**
 * The Resources hub (/resources/): the library, playbooks, guides, tools, research, briefs, article desks, founder situations and reference
 * pages in one place, arranged two ways. "Start where you are" is a short curated path through three stages; "Everything, by kind" lists
 * every live page of each library family, derived from the route ledger and the family registries. Nothing is typed twice: a title and a
 * description come from the page's own content entry, so the hub cannot drift from the page it links to.
 *
 * Fail-closed (D-11, W8-29): every list is filtered by the liveness predicate, so a route that is not built is not listed, and a group with
 * nothing live disappears. A live route that has no title is a build error, never a blank card.
 */
export interface ResourceItem {
  readonly title: string;
  readonly path: string;
  readonly description?: string;
}

export interface ResourceGroup {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  readonly items: readonly ResourceItem[];
}

export interface ResourceMeta {
  readonly title: string;
  readonly description?: string;
}

export type MetaLookup = (path: string) => ResourceMeta | undefined;
export type IsLive = (path: string) => boolean;

/** The part of a route-ledger row the hub reads. */
export interface LedgerRow {
  readonly path: string;
  readonly layout: string;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Where a title and a description come from
// ---------------------------------------------------------------------------------------------------------------------------------

export type MetaCollection = 'pages' | 'library' | 'guides' | 'playbooks' | 'research';

export interface MetaEntry {
  readonly collection: MetaCollection;
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

/** The route a content entry renders at. A `pages` entry's id is its folder path, and `index` names the folder's own route. */
export function routeOfEntry(collection: MetaCollection, id: string): string {
  const last = id.split('/').at(-1) ?? id;
  switch (collection) {
    case 'library':
      return `/library/${last}/`;
    case 'guides':
      return `/fundability/${last}/`;
    case 'playbooks':
      return `/playbooks/${last}/`;
    case 'research':
      return `/research/${last}/`;
    case 'pages': {
      const folder = id.replace(/(^|\/)index$/, '');
      return folder === '' ? '/' : `/${folder}/`;
    }
  }
}

/**
 * Pages that are built from an `.astro` file and have no content entry, so their words live here. A content entry of the same route wins,
 * so a package that later gives one of them a `pages` entry changes the hub without editing this file.
 */
export const STATIC_META: Readonly<Record<string, ResourceMeta>> = {
  '/library/': {
    title: 'Templates and checklists',
    description: 'Documents you can use today. Copy them, print them or download them as Markdown.',
  },
  '/glossary/': {
    title: 'Glossary',
    description: 'Plain definitions of the funding, finance, product, legal and security terms early-stage SaaS founders meet, plus the words WE uses.',
  },
  '/faq/': {
    title: 'FAQ',
    description: 'Short, plain answers about World Enterprise: what a seat is, how the remote model works, what WE does not do, and how to apply.',
  },
  '/search/': {
    title: 'Search',
    description: 'Search every public page of World Enterprise: program, services, playbooks, templates, research and reference.',
  },
  '/briefs/': { title: 'All briefs' },
  '/industries/': { title: 'All industries' },
  '/compare/': { title: 'All comparisons' },
};

/** A lookup over the content entries of the build, then the static rows. */
export function metaLookup(entries: readonly MetaEntry[], fallback: Readonly<Record<string, ResourceMeta>> = STATIC_META): MetaLookup {
  const byPath = new Map<string, ResourceMeta>();
  for (const entry of entries) {
    byPath.set(routeOfEntry(entry.collection, entry.id), entry.description === undefined ? { title: entry.title } : { title: entry.title, description: entry.description });
  }
  return (path) => byPath.get(path) ?? fallback[path];
}

function toItem(path: string, meta: MetaLookup): ResourceItem {
  const found = meta(path);
  if (found === undefined) throw new Error(`Resources hub: ${path} is live but has no title. Give it a content entry or a row in STATIC_META.`);
  return found.description === undefined ? { title: found.title, path } : { title: found.title, path, description: found.description };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Start where you are
// ---------------------------------------------------------------------------------------------------------------------------------

interface StageSpec {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly paths: readonly string[];
}

/** Three stages and a short path through each. A route appears in one stage at most. */
const STAGE_SPECS: readonly StageSpec[] = [
  {
    id: 'before',
    title: 'Before you apply',
    intro: 'Understand the program and test your own idea first.',
    paths: ['/journey/', '/program/how-it-works/', '/playbooks/validate-the-problem/', '/library/one-page-problem-brief/', '/tools/team-composer/', '/faq/'],
  },
  {
    id: 'build',
    title: 'While you build',
    intro: 'Templates, playbooks and tools for making a first release.',
    paths: ['/playbooks/build-and-ship-v1/', '/library/', '/library/mvp-cut-line-worksheet/', '/tools/metrics-calculator/', '/playbooks/earn-your-first-customers/', '/glossary/'],
  },
  {
    id: 'raise',
    title: 'When you prepare to raise',
    intro: 'Evidence, updates and the terms investors use.',
    paths: [
      '/fundability/',
      '/fundability/investor-readiness-checklist/',
      '/library/seed-data-room-checklist/',
      '/tools/evidence-room/',
      '/library/weekly-investor-update-template/',
      '/fundability/safe-explained/',
    ],
  },
];

/** The stage groups with only the live routes. Groups with nothing live are dropped. */
export function liveGroups(isLive: IsLive, meta: MetaLookup = (path) => STATIC_META[path]): ResourceGroup[] {
  return STAGE_SPECS.map((spec) => ({
    id: spec.id,
    title: spec.title,
    intro: spec.intro,
    items: spec.paths.filter(isLive).map((path) => toItem(path, meta)),
  })).filter((group) => group.items.length > 0);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Everything, by kind
// ---------------------------------------------------------------------------------------------------------------------------------

type Members =
  | { readonly kind: 'ledger'; readonly layout: string; readonly prefix: string }
  | { readonly kind: 'desks' }
  | { readonly kind: 'family'; readonly family: FamilyDefinition }
  | { readonly kind: 'paths'; readonly paths: readonly string[] };

interface KindSpec {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  /** The family's own hub, listed first when it is live. */
  readonly hub?: string;
  readonly members: Members;
}

/** The library families, in the order a founder meets them. Each intro restates the hub page it leads to. */
const KIND_SPECS: readonly KindSpec[] = [
  {
    id: 'templates',
    title: 'Templates and checklists',
    intro: 'Documents you can use today. Copy them, print them or download them as Markdown.',
    hub: '/library/',
    members: { kind: 'ledger', layout: 'TemplateLayout', prefix: '/library/' },
  },
  {
    id: 'playbooks',
    title: 'Playbooks',
    intro: 'Step-by-step playbooks for building a SaaS company, from validating the problem to repeatable growth.',
    hub: '/playbooks/',
    members: { kind: 'ledger', layout: 'PlaybookLayout', prefix: '/playbooks/' },
  },
  {
    id: 'guides',
    title: 'Investor readiness guides',
    intro: 'What investor readiness means for an early SaaS company, and guides to the checklist, the data room, SAFEs and investor updates.',
    hub: '/fundability/',
    members: { kind: 'ledger', layout: 'GuideLayout', prefix: '/fundability/' },
  },
  {
    id: 'tools',
    title: 'Tools',
    intro: 'Tools that run in your browser. Your numbers and choices stay on the page.',
    hub: '/tools/',
    members: { kind: 'ledger', layout: 'ToolLayout', prefix: '/tools/' },
  },
  {
    id: 'research',
    title: 'Research briefs',
    intro: 'Designed reports with methodology, limitations and sources, for founders building software.',
    hub: '/research/',
    members: { kind: 'ledger', layout: 'BriefLayout', prefix: '/research/' },
  },
  { id: 'briefs', title: 'Briefs by topic', hub: '/briefs/', members: { kind: 'family', family: BRIEFS } },
  {
    id: 'articles',
    title: 'Articles by desk',
    intro: 'Practical, sourced articles on validating, building, growing and preparing a SaaS company.',
    hub: '/insights/',
    members: { kind: 'desks' },
  },
  { id: 'situations', title: 'By founder situation', hub: '/founders/', members: { kind: 'family', family: SEGMENTS } },
  { id: 'industries', title: 'By industry', hub: '/industries/', members: { kind: 'family', family: INDUSTRIES } },
  { id: 'compare', title: 'Compare your options', hub: '/compare/', members: { kind: 'family', family: COMPARISONS } },
  { id: 'reference', title: 'Reference', members: { kind: 'paths', paths: ['/glossary/', '/faq/', '/search/'] } },
];

function membersOf(spec: KindSpec, ledger: readonly LedgerRow[], isLive: IsLive, meta: MetaLookup): ResourceItem[] {
  const { members } = spec;
  switch (members.kind) {
    case 'ledger':
      return ledger
        .filter((row) => row.layout === members.layout && row.path.startsWith(members.prefix) && row.path !== members.prefix && isLive(row.path))
        .map((row) => toItem(row.path, meta));
    case 'desks':
      return DESK_DEFINITIONS.filter((desk) => isLive(deskPath(desk.id))).map((desk) => ({ title: desk.name, path: deskPath(desk.id), description: desk.blurb }));
    case 'family':
      // A family entry is listed by its registry label alone: an entry that carries a blocked word is never shown from a title or description.
      return members.family.entries.filter((entry) => isLive(entry.path)).map((entry) => ({ title: familyLabel(entry), path: entry.path }));
    case 'paths':
      return members.paths.filter(isLive).map((path) => toItem(path, meta));
  }
}

/** One group per library family, each with its hub first and then every live member. Groups with nothing live are dropped. */
export function kindGroups(ledger: readonly LedgerRow[], isLive: IsLive, meta: MetaLookup): ResourceGroup[] {
  const groups: ResourceGroup[] = [];
  for (const spec of KIND_SPECS) {
    const hub = spec.hub !== undefined && isLive(spec.hub) ? [toItem(spec.hub, meta)] : [];
    const items = [...hub, ...membersOf(spec, ledger, isLive, meta)];
    if (items.length === 0) continue;
    groups.push(spec.intro === undefined ? { id: spec.id, title: spec.title, items } : { id: spec.id, title: spec.title, intro: spec.intro, items });
  }
  return groups;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The page's own words
// ---------------------------------------------------------------------------------------------------------------------------------

/** The words of /resources/ apart from the lists: the sentence ledger traces each one (.astro-magazine/sources/wp-72.json). */
export const RESOURCES_COPY = {
  title: 'Resources',
  eyebrow: 'Resources',
  description: 'Playbooks, templates, guides, tools, research, briefs and reference pages for founders, arranged by where you are and by kind.',
  lead: 'Find the playbook, template, guide or tool for the stage you are at.',
  stage: { heading: 'Start where you are', intro: 'Pick the stage that sounds like you. Each list points to pages already on this site.' },
  kind: { heading: 'Everything, by kind', intro: 'Every playbook, template, guide, tool, brief and article desk that is live on this site.' },
  stripLabel: 'About these resources',
  openTemplates: 'Open the templates',
} as const;

/** Links under the lists. Shown only when live. */
export const RESOURCE_STRIP: readonly ResourceItem[] = [
  { title: 'Editorial policy', path: '/about/editorial-policy/' },
  { title: 'RSS feed', path: '/rss.xml' },
];
