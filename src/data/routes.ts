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
  | 'WP-09' | 'WP-10' | 'WP-11' | 'WP-12' | 'WP-13';

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

export const INSIGHT_SLUGS = [
  'is-your-saas-idea-a-business-or-a-feature',
  'customer-discovery-interviews-without-false-positives',
  'bottom-up-market-sizing-for-a-first-saas',
  'write-the-problem-brief-before-the-code',
  'what-a-dedicated-team-seat-is-and-is-not',
  'cutting-an-mvp-the-cut-line-test',
  'architecture-decisions-to-defer-in-the-first-six-months',
  'an-operating-rhythm-for-a-remote-offshore-team',
  'build-versus-buy-for-auth-billing-and-email',
  'your-first-ten-customers-a-founder-led-sequence',
  'onboarding-is-acquisition-time-to-first-value',
  'pricing-page-fundamentals-for-a-first-saas',
  'support-at-five-customers-not-fifty',
  'evidence-over-narrative-what-diligence-actually-tests',
  'ip-contracts-and-access-diligence-for-small-engineering-teams',
  'questions-to-ask-your-counsel-before-you-sign',
  'the-founder-time-budget-of-a-raise',
  'choosing-the-right-first-investors-for-a-saas-company',
] as const;

export const DESKS = ['dream', 'build', 'grow', 'fundable'] as const;
export type Desk = (typeof DESKS)[number];

/** Owner of the content of each insight, by position in INSIGHT_SLUGS (desks of four, five, four and five). */
function insightOwner(index: number): RouteOwner {
  return index < 9 ? 'WP-05' : 'WP-06';
}

export const RESEARCH_SLUGS = [
  'saas-security-baseline-year-one',
  'accessibility-as-a-launch-requirement',
  'dedicated-team-agency-or-freelancers',
  'early-stage-saas-metrics-definitions',
] as const;

export const LIBRARY_SLUGS = [
  'one-page-problem-brief',
  'customer-interview-guide',
  'mvp-cut-line-worksheet',
  'weekly-investor-update-template',
  'seed-data-room-checklist',
  'security-baseline-checklist',
] as const;

const RAW_ROWS: readonly RawRow[] = [
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

  // Playbooks (6)
  row('/playbooks/', 'HubLayout', 'WP-04'),
  row('/playbooks/validate-the-problem/', 'PlaybookLayout', 'WP-04'),
  row('/playbooks/design-the-product/', 'PlaybookLayout', 'WP-04'),
  row('/playbooks/build-and-ship-v1/', 'PlaybookLayout', 'WP-04'),
  row('/playbooks/earn-your-first-customers/', 'PlaybookLayout', 'WP-04'),
  row('/playbooks/build-repeatable-growth/', 'PlaybookLayout', 'WP-04'),

  // Fundability (5) and Trust (1)
  row('/fundability/', 'HubLayout', 'WP-04'),
  row('/fundability/investor-readiness-checklist/', 'GuideLayout', 'WP-04'),
  row('/fundability/data-room/', 'GuideLayout', 'WP-04'),
  row('/fundability/safe-explained/', 'GuideLayout', 'WP-04'),
  row('/fundability/investor-updates/', 'GuideLayout', 'WP-04'),
  row('/trust/', 'HubLayout', 'WP-04'),

  // Resources hub (1)
  row('/resources/', 'HubLayout', 'WP-08'),

  // Insights (23): hub, four topic hubs, eighteen articles
  row('/insights/', 'ArticleHub', 'WP-05'),
  ...DESKS.map((desk, i) => row(`/insights/topic/${desk}/`, 'ArticleHub', i < 2 ? 'WP-05' : 'WP-06')),
  ...INSIGHT_SLUGS.map((slug, i) => row(`/insights/${slug}/`, 'ArticleLayout', insightOwner(i))),

  // Research (5)
  row('/research/', 'HubLayout', 'WP-07'),
  ...RESEARCH_SLUGS.map((slug) => row(`/research/${slug}/`, 'BriefLayout', 'WP-07')),

  // Library (7)
  row('/library/', 'HubLayout', 'WP-08'),
  ...LIBRARY_SLUGS.map((slug) => row(`/library/${slug}/`, 'TemplateLayout', 'WP-08')),

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
];

/** The 90 launch-candidate rows. */
export const routes: readonly RouteRow[] = RAW_ROWS.map(finalizeRow);

/** Specified but not built, not in nav, sitemap or search (SAGE-PLAN 5.7). Each needs a real source before it can launch. */
export const L2_RESERVED: readonly RouteRow[] = [
  row('/founders/stories/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/founders/portfolio/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/case-studies/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/network/partners/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/network/delivery-partners/', 'MarketingLayout', 'WP-11', { requires: ['companies'] }),
  row('/about/team/', 'MarketingLayout', 'WP-10', { requires: ['people'] }),
  row('/careers/', 'MarketingLayout', 'WP-10', { requires: ['dates'] }),
  row('/events/', 'HubLayout', 'WP-08', { requires: ['events', 'dates'] }),
  row('/program/cohorts/', 'StageLayout', 'WP-01', { requires: ['dates'] }),
  row('/program/demo-day/', 'StageLayout', 'WP-01', { requires: ['dates', 'events'] }),
  row('/press/brand-kit/', 'MarketingLayout', 'WP-10', { launch: false, reason: 'needs whitelab brand-usage sign-off' }),
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
