import { listCollectionFiles, listInsightFiles } from '../lib/content-files.ts';
import type { InsightFile } from '../lib/content-files.ts';
import { DESK_DEFINITIONS, DESK_OWNERS, DESKS, deskPath, isDeskId } from './desks.ts';
import type { Desk, DeskId } from './desks.ts';
import { FAMILIES } from './families.ts';
import type { WaveEightOwner } from './families.ts';
import { flags } from './flags.ts';
import { forms } from './forms.ts';
import { site } from './site.ts';

/**
 * The route ledger (SAGE-PLAN 3.2 and 5.6). Nav, sitemap, RSS, search and the HTML site map are generated only
 * from rows where `launch` is true and the route exists (see src/lib/route-state.ts).
 */
export type LayoutName =
  | 'HomeLayout'
  | 'MarketingLayout'
  | 'HubLayout'
  | 'StageLayout'
  | 'ServiceLayout'
  | 'PlaybookLayout'
  | 'GuideLayout'
  | 'ArticleHub'
  | 'ArticleLayout'
  | 'BriefLayout'
  | 'TemplateLayout'
  | 'ToolLayout'
  | 'FormLayout'
  | 'ReferenceLayout'
  | 'LegalLayout';

export type Requirement = 'people' | 'companies' | 'events' | 'dates';

export type RouteOwner =
  | 'WP-01' | 'WP-02' | 'WP-03' | 'WP-04' | 'WP-05' | 'WP-06' | 'WP-07' | 'WP-08'
  | 'WP-09' | 'WP-10' | 'WP-11' | 'WP-12' | 'WP-13'
  | 'WP-40' | 'WP-41' | 'WP-42' | 'WP-43' | 'WP-44' | 'WP-45' | 'WP-46' | 'WP-47' | 'WP-48' | 'WP-49' | 'WP-50'
  | WaveEightOwner;

/** WP-60 to WP-99, the wave 8 packages (docs/wave8-contracts.md, section 1.3). */
export type { WaveEightOwner };

export interface RouteRow {
  /** Site-relative path with trailing slash (or a file name such as /404.html). May contain a dynamic segment for L2 rows. */
  readonly path: string;
  readonly layout: LayoutName;
  /** Final value after derivation and the `requires` assertion. */
  readonly launch: boolean;
  /** Evidence source. A row with `requires` and no `source` is forced to launch:false. */
  readonly source?: string;
  readonly requires?: readonly Requirement[];
  readonly owner: RouteOwner;
  readonly indexable: boolean;
  /** Why a row is not launched, when it is not. */
  readonly reason?: string;
}

interface RawRow extends Omit<RouteRow, 'launch' | 'indexable'> {
  readonly launch?: boolean;
  readonly indexable?: boolean;
}

function row(path: string, layout: LayoutName, owner: RouteOwner, extra: Partial<RawRow> = {}): RawRow {
  return { path, layout, owner, ...extra };
}

/** Applies the `requires`-without-`source` assertion: such a row is never launched. */
export function finalizeRow(raw: RawRow): RouteRow {
  const needsSource = raw.requires !== undefined && raw.requires.length > 0 && raw.source === undefined;
  const requested = raw.launch ?? true;
  const launch = requested && !needsSource;
  const reason = raw.reason ?? (needsSource ? `requires ${raw.requires?.join(', ')} with no source` : undefined);
  return {
    path: raw.path,
    layout: raw.layout,
    owner: raw.owner,
    launch,
    indexable: raw.indexable ?? true,
    ...(raw.source !== undefined ? { source: raw.source } : {}),
    ...(raw.requires !== undefined ? { requires: raw.requires } : {}),
    ...(reason !== undefined && !launch ? { reason } : {}),
  };
}

export { DESKS };
export type { Desk };

/** The owner of an article's row: the owner of its desk. */
function insightOwner(desk: DeskId): RouteOwner {
  return DESK_OWNERS[desk];
}

export const RESEARCH_SLUGS = [
  'saas-security-baseline-year-one',
  'accessibility-as-a-launch-requirement',
  'dedicated-team-agency-or-freelancers',
  'early-stage-saas-metrics-definitions',
] as const;

/** The six library templates of wave 6 in their display order. Later templates are derived from src/content/library/ like every other file. */
export const LIBRARY_SLUGS = [
  'one-page-problem-brief',
  'customer-interview-guide',
  'mvp-cut-line-worksheet',
  'weekly-investor-update-template',
  'seed-data-room-checklist',
  'security-baseline-checklist',
] as const;

/** The collection files the ledger derives rows from (one row per file), read from disk by `buildRoutes`. */
export interface ContentListing {
  readonly insights: readonly InsightFile[];
  /** File names relative to the collection folder: 'validate-the-problem.mdx'. */
  readonly playbooks: readonly string[];
  readonly guides: readonly string[];
  readonly library: readonly string[];
}

/** The playbooks, guides and library templates that existed before wave 8 come first, in their original order; new files follow by name. */
const LEGACY_ORDER: Readonly<Record<'playbooks' | 'guides' | 'library', readonly string[]>> = {
  playbooks: ['validate-the-problem', 'design-the-product', 'build-and-ship-v1', 'earn-your-first-customers', 'build-repeatable-growth'],
  guides: ['investor-readiness-checklist', 'data-room', 'safe-explained', 'investor-updates'],
  library: LIBRARY_SLUGS,
};

/** Slugs of a collection whose entries sit directly in its folder, in legacy order; a nested file is a mistake the ledger refuses. */
function flatSlugs(collection: keyof typeof LEGACY_ORDER, files: readonly string[]): string[] {
  const legacy = LEGACY_ORDER[collection];
  const slugs = files.map((file) => {
    if (file.includes('/')) throw new Error(`src/content/${collection}/${file}: entries of this collection sit directly in its folder.`);
    return file.replace(/\.mdx?$/, '');
  });
  const rank = (slug: string): number => {
    const at = legacy.indexOf(slug);
    return at === -1 ? legacy.length : at;
  };
  return slugs.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** A slug that would collide with a fixed route under /insights/ (the topic pages). */
const RESERVED_INSIGHT_SLUGS: readonly string[] = ['topic'];

/** Checks the article files against the desk registry: a known desk, a slug unique across every desk. Throws one message listing all. */
export function assertInsightFiles(files: readonly InsightFile[]): void {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const f of files) {
    if (!isDeskId(f.desk)) problems.push(`${f.file}: "${f.desk}" is not a desk (src/data/desks.ts).`);
    if (RESERVED_INSIGHT_SLUGS.includes(f.slug)) problems.push(`${f.file}: "${f.slug}" is a reserved slug.`);
    const first = seen.get(f.slug);
    if (first !== undefined) problems.push(`${f.file}: the slug "${f.slug}" is already used by ${first}.`);
    else seen.set(f.slug, f.file);
  }
  if (problems.length > 0) throw new Error(`Insight files do not match the desk registry:\n- ${problems.join('\n- ')}`);
}

/** Article slugs ordered by desk, then by name. */
export function insightSlugs(files: readonly InsightFile[]): string[] {
  assertInsightFiles(files);
  const rank = (desk: string): number => DESKS.indexOf(desk as DeskId);
  return [...files].sort((a, b) => rank(a.desk) - rank(b.desk) || a.slug.localeCompare(b.slug)).map((f) => f.slug);
}

/** One topic row per desk. A desk with no article has no page, so its row is not launched until the first article exists. */
function deskRows(files: readonly InsightFile[]): RawRow[] {
  return DESK_DEFINITIONS.map((d) => {
    const held = files.some((f) => f.desk === d.id);
    return row(deskPath(d.id), 'ArticleHub', d.owner, held ? {} : { launch: false, reason: `the ${d.name} desk holds no article yet` });
  });
}

/** Hub rows and one row per registry entry. A row is inert until its page exists; `launch` is the registry's flag. */
function familyRows(): RawRow[] {
  return FAMILIES.flatMap((family) => [
    ...(family.hub !== undefined ? [row(family.hub.path, 'HubLayout', family.hub.owner)] : []),
    ...family.entries.map((e) => row(e.path, 'MarketingLayout', e.owner, e.launch ? {} : { launch: false, ...(e.reason !== undefined ? { reason: e.reason } : {}) })),
  ]);
}

function rawRows(listing: ContentListing): readonly RawRow[] {
  return [
    // Home
    row('/', 'HomeLayout', 'WP-01'),

    // Program (8)
    row('/program/', 'HubLayout', 'WP-01'),
    row('/program/how-it-works/', 'StageLayout', 'WP-01'),
    row('/program/digital-incubation-model/', 'StageLayout', 'WP-01'),
    row('/program/dedicated-teams/', 'StageLayout', 'WP-01'),
    row('/program/who-its-for/', 'StageLayout', 'WP-01'),
    row('/program/dream/', 'StageLayout', 'WP-01'),
    row('/program/build/', 'StageLayout', 'WP-01'),
    row('/program/grow/', 'StageLayout', 'WP-01'),

    // Apply (2), Pricing (1), Tools (1)
    row('/apply/', 'FormLayout', 'WP-03'),
    row('/apply/thanks/', 'FormLayout', 'WP-03', { indexable: false }),
    row('/pricing/', 'ToolLayout', 'WP-03'),
    row('/tools/team-composer/', 'ToolLayout', 'WP-03'),

    // Services (8)
    row('/services/', 'HubLayout', 'WP-02'),
    row('/services/brand-and-identity/', 'ServiceLayout', 'WP-02'),
    row('/services/product-and-it-development/', 'ServiceLayout', 'WP-02'),
    row('/services/customer-and-market-development/', 'ServiceLayout', 'WP-02'),
    row('/services/business-management-and-operations/', 'ServiceLayout', 'WP-02'),
    row('/services/digital-incubation/', 'ServiceLayout', 'WP-02'),
    row('/services/fundability-and-investor-readiness/', 'ServiceLayout', 'WP-02'),
    row('/services/professional-services-coordination/', 'ServiceLayout', 'WP-02'),

    // Playbooks: the hub and one row per file in src/content/playbooks/
    row('/playbooks/', 'HubLayout', 'WP-04'),
    ...flatSlugs('playbooks', listing.playbooks).map((slug) => row(`/playbooks/${slug}/`, 'PlaybookLayout', 'WP-86')),

    // Fundability and Trust: the hub, one row per guide in src/content/guides/, and the trust hub
    row('/fundability/', 'HubLayout', 'WP-04'),
    ...flatSlugs('guides', listing.guides).map((slug) => row(`/fundability/${slug}/`, 'GuideLayout', 'WP-87')),
    row('/trust/', 'HubLayout', 'WP-04'),

    // Resources hub (1)
    row('/resources/', 'HubLayout', 'WP-08'),

    // Insights: the hub, one topic row per desk (desks.ts) and one row per article file (src/content/insights/<desk>/)
    row('/insights/', 'ArticleHub', 'WP-05'),
    ...deskRows(listing.insights),
    ...insightRows(listing.insights),

    // Research (5)
    row('/research/', 'HubLayout', 'WP-07'),
    ...RESEARCH_SLUGS.map((slug) => row(`/research/${slug}/`, 'BriefLayout', 'WP-07')),

    // Library: the hub and one row per file in src/content/library/
    row('/library/', 'HubLayout', 'WP-08'),
    ...flatSlugs('library', listing.library).map((slug) => row(`/library/${slug}/`, 'TemplateLayout', 'WP-87')),

    // Reference (4). The newsletter page launches only when its endpoint exists. Search is the fourth noindex route (W-4).
    row('/glossary/', 'ReferenceLayout', 'WP-08'),
    row('/faq/', 'ReferenceLayout', 'WP-08'),
    row('/newsletter/', 'ReferenceLayout', 'WP-08', { launch: forms.newsletter.mode !== 'disabled', reason: 'newsletter endpoint not configured' }),
    row('/search/', 'ReferenceLayout', 'WP-08', { indexable: false }),

    // Network (4)
    row('/network/', 'HubLayout', 'WP-11'),
    row('/founders/', 'MarketingLayout', 'WP-11'),
    row('/network/operators/', 'MarketingLayout', 'WP-11'),
    row('/investors/', 'MarketingLayout', 'WP-11'),

    // About (6)
    row('/about/', 'MarketingLayout', 'WP-10'),
    row('/about/manifesto/', 'MarketingLayout', 'WP-10'),
    row('/about/frameworks/', 'MarketingLayout', 'WP-10'),
    row('/about/frameworks/android-ops/', 'MarketingLayout', 'WP-10'),
    row('/about/frameworks/orbital/', 'MarketingLayout', 'WP-10'),
    row('/about/editorial-policy/', 'MarketingLayout', 'WP-10'),

    // Company (2)
    row('/press/', 'MarketingLayout', 'WP-10'),
    row('/contact/', 'FormLayout', 'WP-03'),

    // Legal (3). Terms ship only when counsel signs (flags.legalTerms).
    row('/legal/privacy/', 'LegalLayout', 'WP-10'),
    row('/legal/terms/', 'LegalLayout', 'WP-10', { launch: flags.legalTerms, reason: 'terms of use await counsel sign-off (C-23)' }),
    row('/legal/accessibility/', 'LegalLayout', 'WP-10'),

    // Utility (2)
    row('/sitemap/', 'ReferenceLayout', 'WP-09', { indexable: false }),
    row('/404.html', 'ReferenceLayout', 'WP-09', { indexable: false }),

    // Wave 7 (9), registered ahead of their pages by WP-40 so no page-owning package edits this file (docs/wave7-contracts.md, section 5).
    // A launched row with no page is inert: out of nav and sitemap, a warning in audit:ledger. The page file makes it live.
    row('/program/how-we-decide/', 'StageLayout', 'WP-43'),
    row('/about/facts/', 'MarketingLayout', 'WP-41'),
    row('/tools/', 'HubLayout', 'WP-49'),
    row('/tools/metrics-calculator/', 'ToolLayout', 'WP-49'),
    row('/tools/evidence-room/', 'ToolLayout', 'WP-49'),
    // WP-48 was deferred in wave 7 and its four pages do not exist; wave 8 flips them to launch:false (contracts section 10). A future package that writes a page
    // flips its row back to launch:true in the same change. WP-55 (wave 9, D-16 revised) absorbed WP-48 and wrote the UBF page; the row keeps the
    // WP-48 owner because RouteOwner names no wave 9 package.
    row('/about/frameworks/ubf/', 'MarketingLayout', 'WP-48'),
    row('/star/', 'MarketingLayout', 'WP-48', { launch: false, reason: 'the framework pages (WP-48) were deferred in wave 7 and are not part of wave 8' }),
    row('/shift/', 'MarketingLayout', 'WP-48', { launch: false, reason: 'the framework pages (WP-48) were deferred in wave 7 and are not part of wave 8' }),
    row('/android/', 'MarketingLayout', 'WP-48', { launch: false, reason: 'the framework pages (WP-48) were deferred in wave 7 and are not part of wave 8' }),

    // Wave 8 (docs/wave8-contracts.md, section 1.2), registered ahead of the pages by WP-60 so no page-owning package edits this file.
    // A launched row with no page is inert: out of nav and sitemap, a warning in audit:ledger. The page file makes it live.
    // Briefs: the hub is a family hub (below); the squeeze pages derive from the registry; the thanks page is fixed and noindex.
    row('/briefs/thanks/', 'FormLayout', 'WP-63', { indexable: false }),

    // Investors (WP-64). The hub `/investors/` exists above. Inbound pages name no company (D-21).
    row('/investors/meet-startups/', 'MarketingLayout', 'WP-64'),
    row('/investors/what-you-can-see/', 'MarketingLayout', 'WP-64'),
    row('/investors/readiness-criteria/', 'MarketingLayout', 'WP-64'),
    row('/investors/showcase-format/', 'MarketingLayout', 'WP-64'),
    row('/investors/faq/', 'MarketingLayout', 'WP-64'),
    row('/investors/interest/', 'FormLayout', 'WP-64'),
    row('/investors/interest/thanks/', 'FormLayout', 'WP-64', { indexable: false }),

    // Partners (WP-65). D-21: the hub launches without naming anyone, so it has its own source instead of `requires: ['companies']`.
    row('/network/partners/', 'MarketingLayout', 'WP-65', { source: 'D-21 (.astro-magazine/decisions.md): an inbound partner page names no company' }),
    row('/network/partners/categories/', 'MarketingLayout', 'WP-65'),
    row('/network/partners/how-it-works/', 'MarketingLayout', 'WP-65'),
    row('/network/partners/faq/', 'MarketingLayout', 'WP-65'),
    row('/network/partners/enquire/', 'FormLayout', 'WP-65'),
    row('/network/partners/enquire/thanks/', 'FormLayout', 'WP-65', { indexable: false }),

    // Brand story (WP-71) and the extra tools (WP-76). `/press/brand-kit/` stays an L2 row below, owned by WP-71.
    row('/about/brand-story/', 'MarketingLayout', 'WP-71'),
    row('/tools/runway-calculator/', 'ToolLayout', 'WP-76'),
    row('/tools/pricing-page-checker/', 'ToolLayout', 'WP-76'),
    row('/tools/cap-table-explainer/', 'ToolLayout', 'WP-76'),

    // Page families, derived from src/data/families.ts. Each row is inert until its page exists.
    ...familyRows(),
  ];
}

/** The article rows, ordered by desk. The owner is the desk's owner (src/data/desks.ts). */
function insightRows(files: readonly InsightFile[]): RawRow[] {
  const bySlug = new Map(files.map((f) => [f.slug, f]));
  return insightSlugs(files).map((slug) => {
    const desk = bySlug.get(slug)?.desk;
    if (desk === undefined || !isDeskId(desk)) throw new Error(`Insight "${slug}" has no desk.`);
    return row(`/insights/${slug}/`, 'ArticleLayout', insightOwner(desk));
  });
}

/** Reads the collection folders under `root` (the repository root) and builds the ledger. */
export function buildRoutes(root: string): readonly RouteRow[] {
  const listing: ContentListing = {
    insights: listInsightFiles(root),
    playbooks: listCollectionFiles(root, 'playbooks'),
    guides: listCollectionFiles(root, 'guides'),
    library: listCollectionFiles(root, 'library'),
  };
  return rawRows(listing).map(finalizeRow);
}

/**
 * The launch-candidate rows: the fixed pages, plus one row per article, playbook, guide and library template file, one per desk and one
 * per registry entry. No count is pinned anywhere (decision D-20): tests assert invariants.
 */
export const routes: readonly RouteRow[] = buildRoutes(process.cwd());

/** Specified but not built, not in nav, sitemap or search (SAGE-PLAN 5.7). Each needs a real source before it can launch. */
export const L2_RESERVED: readonly RouteRow[] = [
  row('/founders/stories/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/founders/portfolio/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/case-studies/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/network/delivery-partners/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/about/team/', 'MarketingLayout', 'WP-10', { requires: ['people'] }),
  row('/careers/', 'MarketingLayout', 'WP-10', { requires: ['dates'] }),
  row('/events/', 'HubLayout', 'WP-08', { requires: ['events', 'dates'] }),
  row('/program/cohorts/', 'StageLayout', 'WP-01', { requires: ['dates'] }),
  row('/program/demo-day/', 'StageLayout', 'WP-01', { requires: ['dates', 'events'] }),
  row('/press/brand-kit/', 'MarketingLayout', 'WP-71', { launch: false, reason: 'needs whitelab brand-usage sign-off (OP-BRAND)' }),
  row('/people/[slug]/', 'MarketingLayout', 'WP-11', { requires: ['people'] }),
].map(finalizeRow);

export interface MachineRoute {
  readonly path: string;
  readonly owner: RouteOwner | 'WP-00';
  readonly launch: boolean;
  /** Built after `astro build` (Pagefind) or by an integration rather than by a page file. */
  readonly generated: 'page' | 'integration' | 'postbuild' | 'public';
}

/** Non-HTML routes (WP-09). The security.txt row launches only once site.securityContact is confirmed. */
export const MACHINE_ROUTES: readonly MachineRoute[] = [
  { path: '/robots.txt', owner: 'WP-09', launch: true, generated: 'page' },
  { path: '/sitemap-index.xml', owner: 'WP-09', launch: true, generated: 'integration' },
  { path: '/sitemap-0.xml', owner: 'WP-09', launch: true, generated: 'integration' },
  { path: '/rss.xml', owner: 'WP-09', launch: true, generated: 'page' },
  { path: '/llms.txt', owner: 'WP-41', launch: true, generated: 'page' },
  { path: '/llms-full.txt', owner: 'WP-41', launch: true, generated: 'page' },
  { path: '/.well-known/security.txt', owner: 'WP-09', launch: site.securityContact !== null, generated: 'page' },
  { path: '/pagefind/', owner: 'WP-08', launch: true, generated: 'postbuild' },
  { path: '/favicon.svg', owner: 'WP-00', launch: true, generated: 'public' },
  { path: '/apple-touch-icon.png', owner: 'WP-00', launch: true, generated: 'public' },
];

/** Dev and preview only. Built when PUBLIC_STYLEGUIDE=1, never in the production release. */
export const STYLEGUIDE_PATH = '/styleguide/';

const BY_PATH: ReadonlyMap<string, RouteRow> = new Map(routes.map((r) => [r.path, r]));

export function getRoute(path: string): RouteRow | undefined {
  return BY_PATH.get(path);
}

export function assertLedger(): void {
  if (BY_PATH.size !== routes.length) throw new Error('Route ledger contains duplicate paths.');
  for (const r of routes) {
    if (r.requires !== undefined && r.requires.length > 0 && r.source === undefined && r.launch) {
      throw new Error(`Route ${r.path} requires ${r.requires.join(', ')} with no source but is launched.`);
    }
  }
}

assertLedger();
