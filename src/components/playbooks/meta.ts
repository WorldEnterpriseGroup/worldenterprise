import type { SlotId } from '../../assets/photo/slots.ts';
import { BRIEFS } from '../../data/families.ts';
import { TOOLS } from '../tools/registry.ts';

/** Presentation data for the playbook section. Content lives in src/content/playbooks; routes in the ledger. */
export interface PlaybookRef {
  readonly slug: string;
  readonly short: string;
  /** The photo slot of the page. The five original playbooks have one; a later playbook has none and its hero uses the trail art. */
  readonly slot?: SlotId;
}

/**
 * The ten playbooks in reading order, one chain with one terminal. The order here and the `order` field of each playbook file agree
 * (the unit tests hold them to it). A playbook whose route is not live in a build drops out of the chain at render time: the one
 * before it points at the next live one, and the last live one is the terminal.
 */
export const PLAYBOOK_SEQUENCE: readonly PlaybookRef[] = [
  { slug: 'validate-the-problem', short: 'Validate the problem', slot: 'pb-1' },
  { slug: 'design-the-product', short: 'Design the product', slot: 'pb-2' },
  { slug: 'set-up-the-company', short: 'Set up the company' },
  { slug: 'build-and-ship-v1', short: 'Build and ship v1', slot: 'pb-3' },
  { slug: 'hire-your-first-team-member', short: 'Hire your first team member' },
  { slug: 'price-your-first-saas-product', short: 'Price your first SaaS product' },
  { slug: 'earn-your-first-customers', short: 'Earn your first customers', slot: 'pb-4' },
  { slug: 'run-your-first-outbound-sequence', short: 'Run your first outbound sequence' },
  { slug: 'build-repeatable-growth', short: 'Build repeatable growth', slot: 'pb-5' },
  { slug: 'prepare-for-investor-conversations', short: 'Prepare for investor conversations' },
];

/** The playbooks whose route is live, in reading order. `isLive` is the route-state predicate of the build. */
export function liveSequence(isLive: (path: string) => boolean): readonly PlaybookRef[] {
  return PLAYBOOK_SEQUENCE.filter((p) => isLive(`/playbooks/${p.slug}/`));
}

/** The playbook after `slug` in the live chain, or undefined for the terminal and for a slug that is not in the chain. */
export function nextLive(slug: string, isLive: (path: string) => boolean): PlaybookRef | undefined {
  const live = liveSequence(isLive);
  const index = live.findIndex((p) => p.slug === slug);
  return index === -1 ? undefined : live[index + 1];
}

export interface LibraryRef {
  readonly title: string;
  readonly description: string;
}

/** Library templates a playbook can point to. Slugs match LIBRARY_SLUGS in the route ledger. */
export const LIBRARY_REFS: Readonly<Record<string, LibraryRef>> = {
  'one-page-problem-brief': {
    title: 'One-page problem brief',
    description: 'A template for stating the problem, the customer and the evidence on one page.',
  },
  'customer-interview-guide': {
    title: 'Customer interview guide',
    description: 'Questions and a note format for interviews about past behavior.',
  },
  'mvp-cut-line-worksheet': {
    title: 'MVP cut-line worksheet',
    description: 'A worksheet for sorting features above and below the line for version one.',
  },
  'weekly-investor-update-template': {
    title: 'Weekly investor update template',
    description: 'A fixed structure for a short progress update, usable weekly or monthly.',
  },
  'seed-data-room-checklist': {
    title: 'Seed data room checklist',
    description: 'A folder-by-folder checklist of the records a seed data room usually holds.',
  },
  'security-baseline-checklist': {
    title: 'Security baseline checklist',
    description: 'A year-one checklist written against public security standards.',
  },
};

/** The founder tools each playbook points to, by route. Titles and summaries come from the tools registry, so there is one wording. */
export const PLAYBOOK_TOOLS: Readonly<Record<string, readonly string[]>> = {
  'set-up-the-company': ['/tools/cap-table-explainer/'],
  'build-and-ship-v1': ['/tools/team-composer/'],
  'hire-your-first-team-member': ['/tools/team-composer/'],
  'price-your-first-saas-product': ['/tools/pricing-page-checker/', '/tools/metrics-calculator/'],
  'earn-your-first-customers': ['/tools/metrics-calculator/'],
  'build-repeatable-growth': ['/tools/metrics-calculator/', '/tools/runway-calculator/'],
  'prepare-for-investor-conversations': ['/tools/evidence-room/', '/tools/runway-calculator/', '/tools/cap-table-explainer/'],
};

/** The gated briefs each playbook points to, by brief id in the families registry. A brief whose page is not live is dropped. */
export const PLAYBOOK_BRIEFS: Readonly<Record<string, readonly string[]>> = {
  'set-up-the-company': ['company-setup'],
  'hire-your-first-team-member': ['first-hires'],
  'earn-your-first-customers': ['first-100-customers'],
  'run-your-first-outbound-sequence': ['first-100-customers'],
  'prepare-for-investor-conversations': ['pre-seed-evidence-pack', 'funding-paths'],
};

export interface ArtifactRef {
  readonly title: string;
  readonly href: string;
  readonly description?: string;
}

/**
 * Every template, tool and brief a playbook can open, before liveness is applied: the playbook's own `relatedLibrary`, then its tools,
 * then its briefs. The page passes the list through `liveItems`, so a route that is not live in the build is never linked.
 */
export function artifactRefs(slug: string, relatedLibrary: readonly string[]): ArtifactRef[] {
  const templates = relatedLibrary.map((id) => ({
    title: LIBRARY_REFS[id]?.title ?? id,
    ...(LIBRARY_REFS[id] !== undefined ? { description: LIBRARY_REFS[id].description } : {}),
    href: `/library/${id}/`,
  }));
  const tools = (PLAYBOOK_TOOLS[slug] ?? []).flatMap((href) => {
    const tool = TOOLS.find((t) => t.href === href);
    return tool === undefined ? [] : [{ title: tool.title, description: tool.summary, href: tool.href }];
  });
  const briefs = (PLAYBOOK_BRIEFS[slug] ?? []).flatMap((id) => {
    const brief = BRIEFS.entries.find((e) => e.slug === id);
    return brief === undefined ? [] : [{ title: `Brief: ${brief.label}`, href: brief.path }];
  });
  return [...templates, ...tools, ...briefs];
}

export interface RelatedRef {
  readonly kind: string;
  readonly title: string;
  readonly href: string;
}

/** Related reading per playbook: articles and research where they exist, and one service line. */
export const PLAYBOOK_RELATED: Readonly<Record<string, readonly RelatedRef[]>> = {
  'validate-the-problem': [
    { kind: 'Insight', title: 'Customer discovery interviews without false positives', href: '/insights/customer-discovery-interviews-without-false-positives/' },
    { kind: 'Insight', title: 'Write the problem brief before the code', href: '/insights/write-the-problem-brief-before-the-code/' },
    { kind: 'Service line', title: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/' },
  ],
  'design-the-product': [
    { kind: 'Insight', title: 'Cutting an MVP with the cut-line test', href: '/insights/cutting-an-mvp-the-cut-line-test/' },
    { kind: 'Insight', title: 'Build versus buy for auth, billing and email', href: '/insights/build-versus-buy-for-auth-billing-and-email/' },
    { kind: 'Service line', title: 'Product and IT Development', href: '/services/product-and-it-development/' },
  ],
  'set-up-the-company': [
    { kind: 'Insight', title: 'Choosing an entity: LLC or C corporation', href: '/insights/choosing-an-entity-llc-or-c-corporation/' },
    { kind: 'Insight', title: 'Founder equity splits and vesting', href: '/insights/founder-equity-splits-and-vesting/' },
    { kind: 'Service line', title: 'Professional-Services Coordination', href: '/services/professional-services-coordination/' },
  ],
  'build-and-ship-v1': [
    { kind: 'Insight', title: 'An operating rhythm for a remote offshore team', href: '/insights/an-operating-rhythm-for-a-remote-offshore-team/' },
    { kind: 'Research brief', title: 'Security baseline for year one', href: '/research/saas-security-baseline-year-one/' },
    { kind: 'Research brief', title: 'Accessibility at launch', href: '/research/accessibility-as-a-launch-requirement/' },
  ],
  'hire-your-first-team-member': [
    { kind: 'Insight', title: 'Your first hire: what to settle before you write the job', href: '/insights/your-first-hire-what-to-settle-before-you-write-the-job/' },
    { kind: 'Insight', title: 'Contractors and employees: the classification tests', href: '/insights/contractors-and-employees-the-classification-tests/' },
    { kind: 'Service line', title: 'Business Management and Operations', href: '/services/business-management-and-operations/' },
  ],
  'price-your-first-saas-product': [
    { kind: 'Insight', title: 'Pricing a first SaaS: value, packaging and the questions to ask', href: '/insights/pricing-a-first-saas-value-packaging-and-the-questions-to-ask/' },
    { kind: 'Insight', title: 'Usage-based, seat-based and hybrid pricing models', href: '/insights/usage-based-seat-based-and-hybrid-pricing-models/' },
    { kind: 'Service line', title: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/' },
  ],
  'earn-your-first-customers': [
    { kind: 'Insight', title: 'Your first ten customers: a founder-led sequence', href: '/insights/your-first-ten-customers-a-founder-led-sequence/' },
    { kind: 'Insight', title: 'Onboarding is acquisition: time to first value', href: '/insights/onboarding-is-acquisition-time-to-first-value/' },
    { kind: 'Service line', title: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/' },
  ],
  'run-your-first-outbound-sequence': [
    { kind: 'Insight', title: 'Cold outreach that follows CAN-SPAM', href: '/insights/cold-outreach-that-follows-can-spam/' },
    { kind: 'Insight', title: 'Founder-led sales calls: a structure', href: '/insights/founder-led-sales-calls-a-structure/' },
    { kind: 'Service line', title: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/' },
  ],
  'build-repeatable-growth': [
    { kind: 'Research brief', title: 'SaaS metrics definitions', href: '/research/early-stage-saas-metrics-definitions/' },
    { kind: 'Insight', title: 'Support at five customers, not fifty', href: '/insights/support-at-five-customers-not-fifty/' },
    { kind: 'Service line', title: 'Business Management and Operations', href: '/services/business-management-and-operations/' },
  ],
  'prepare-for-investor-conversations': [
    { kind: 'Insight', title: 'Choosing the right first investors for a SaaS company', href: '/insights/choosing-the-right-first-investors-for-a-saas-company/' },
    { kind: 'Insight', title: 'Evidence over narrative: what diligence actually tests', href: '/insights/evidence-over-narrative-what-diligence-actually-tests/' },
    { kind: 'Service line', title: 'Fundability and Investor Readiness', href: '/services/fundability-and-investor-readiness/' },
  ],
};
