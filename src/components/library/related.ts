/**
 * Related pages shown on each template, gated by the caller on route state so a link never points at a page that
 * does not exist. Keys are library slugs.
 */
export interface RelatedLink {
  readonly label: string;
  readonly path: string;
}

export const RELATED_BY_TEMPLATE: Readonly<Record<string, readonly RelatedLink[]>> = {
  'one-page-problem-brief': [
    { label: 'Playbook: validate the problem', path: '/playbooks/validate-the-problem/' },
    { label: 'Customer interview guide', path: '/library/customer-interview-guide/' },
  ],
  'customer-interview-guide': [
    { label: 'Playbook: validate the problem', path: '/playbooks/validate-the-problem/' },
    { label: 'One-page problem brief', path: '/library/one-page-problem-brief/' },
  ],
  'mvp-cut-line-worksheet': [
    { label: 'Playbook: build and ship v1', path: '/playbooks/build-and-ship-v1/' },
    { label: 'One-page problem brief', path: '/library/one-page-problem-brief/' },
  ],
  'weekly-investor-update-template': [
    { label: 'Investor updates guide', path: '/fundability/investor-updates/' },
    { label: 'Early-stage SaaS metrics definitions', path: '/research/early-stage-saas-metrics-definitions/' },
  ],
  'seed-data-room-checklist': [
    { label: 'The seed data room guide', path: '/fundability/data-room/' },
    { label: 'Investor readiness checklist', path: '/fundability/investor-readiness-checklist/' },
  ],
  'security-baseline-checklist': [
    { label: 'Research brief: a SaaS security baseline for year one', path: '/research/saas-security-baseline-year-one/' },
    { label: 'Trust center', path: '/trust/' },
  ],
  'landing-page-brief': [
    { label: 'Writing a landing page that says what the product does', path: '/insights/writing-a-landing-page-that-says-what-the-product-does/' },
    { label: 'Landing page tests you can read', path: '/insights/landing-page-tests-you-can-read/' },
  ],
  'pricing-page-checklist': [
    { label: 'Pricing page fundamentals for a first SaaS', path: '/insights/pricing-page-fundamentals-for-a-first-saas/' },
    { label: 'Pricing page checker', path: '/tools/pricing-page-checker/' },
    { label: 'Pricing experiments guide', path: '/fundability/pricing-experiments/' },
  ],
  'job-description-template': [
    { label: 'Writing a job description people can answer', path: '/insights/writing-a-job-description-people-can-answer/' },
    { label: 'Structured interviews for a small team', path: '/insights/structured-interviews-for-a-small-team/' },
  ],
  'outreach-sequence-worksheet': [
    { label: 'Cold outreach that follows CAN-SPAM', path: '/insights/cold-outreach-that-follows-can-spam/' },
    { label: 'Customer interview synthesis guide', path: '/fundability/customer-interview-synthesis/' },
  ],
  'interview-synthesis-sheet': [
    { label: 'Customer interview synthesis guide', path: '/fundability/customer-interview-synthesis/' },
    { label: 'Customer interview guide', path: '/library/customer-interview-guide/' },
    { label: 'Customer discovery interviews without false positives', path: '/insights/customer-discovery-interviews-without-false-positives/' },
  ],
  'decision-log': [
    { label: 'The seed data room guide', path: '/fundability/data-room/' },
    { label: 'Investor readiness checklist', path: '/fundability/investor-readiness-checklist/' },
  ],
};

/** Templates whose subject is investor preparation carry the no-funding disclaimer (claim C-05). */
export const FUNDING_RELATED: ReadonlySet<string> = new Set(['weekly-investor-update-template', 'seed-data-room-checklist']);

export function relatedFor(slug: string, isLive: (path: string) => boolean): RelatedLink[] {
  return (RELATED_BY_TEMPLATE[slug] ?? []).filter((link) => isLive(link.path));
}
