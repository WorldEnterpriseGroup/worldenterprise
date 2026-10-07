import type { SlotId } from '../../assets/photo/slots.ts';

/** Presentation data for the playbook section. Content lives in src/content/playbooks; routes in the ledger. */
export interface PlaybookRef {
  readonly slug: string;
  readonly short: string;
  readonly slot: SlotId;
}

/** The five playbooks in reading order. */
export const PLAYBOOK_SEQUENCE: readonly PlaybookRef[] = [
  { slug: 'validate-the-problem', short: 'Validate the problem', slot: 'pb-1' },
  { slug: 'design-the-product', short: 'Design the product', slot: 'pb-2' },
  { slug: 'build-and-ship-v1', short: 'Build and ship v1', slot: 'pb-3' },
  { slug: 'earn-your-first-customers', short: 'Earn your first customers', slot: 'pb-4' },
  { slug: 'build-repeatable-growth', short: 'Build repeatable growth', slot: 'pb-5' },
];

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
    description: 'Questions and a note format for interviews about past behaviour.',
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

export interface RelatedRef {
  readonly kind: string;
  readonly title: string;
  readonly href: string;
}

/** Related reading per playbook: one insight where it exists, one service line, one reference page. */
export const PLAYBOOK_RELATED: Readonly<Record<string, readonly RelatedRef[]>> = {
  'validate-the-problem': [
    { kind: 'Insight', title: 'Customer discovery interviews without false positives', href: '/insights/customer-discovery-interviews-without-false-positives/' },
    { kind: 'Insight', title: 'Write the problem brief before the code', href: '/insights/write-the-problem-brief-before-the-code/' },
    { kind: 'Service line', title: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/' },
  ],
  'design-the-product': [
    { kind: 'Insight', title: 'Cutting an MVP: the cut-line test', href: '/insights/cutting-an-mvp-the-cut-line-test/' },
    { kind: 'Insight', title: 'Build versus buy for auth, billing and email', href: '/insights/build-versus-buy-for-auth-billing-and-email/' },
    { kind: 'Service line', title: 'Product and IT Development', href: '/services/product-and-it-development/' },
  ],
  'build-and-ship-v1': [
    { kind: 'Insight', title: 'An operating rhythm for a remote offshore team', href: '/insights/an-operating-rhythm-for-a-remote-offshore-team/' },
    { kind: 'Research brief', title: 'SaaS security baseline for year one', href: '/research/saas-security-baseline-year-one/' },
    { kind: 'Research brief', title: 'Accessibility as a launch requirement', href: '/research/accessibility-as-a-launch-requirement/' },
  ],
  'earn-your-first-customers': [
    { kind: 'Insight', title: 'Your first ten customers: a founder-led sequence', href: '/insights/your-first-ten-customers-a-founder-led-sequence/' },
    { kind: 'Insight', title: 'Onboarding is acquisition: time to first value', href: '/insights/onboarding-is-acquisition-time-to-first-value/' },
    { kind: 'Service line', title: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/' },
  ],
  'build-repeatable-growth': [
    { kind: 'Research brief', title: 'Early-stage SaaS metrics definitions', href: '/research/early-stage-saas-metrics-definitions/' },
    { kind: 'Insight', title: 'Support at five customers, not fifty', href: '/insights/support-at-five-customers-not-fifty/' },
    { kind: 'Service line', title: 'Business Management and Operations', href: '/services/business-management-and-operations/' },
  ],
};
