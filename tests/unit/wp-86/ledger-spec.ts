import type { FetchRecord } from '../wp-60/sources.ts';

/**
 * What `.astro-magazine/sources/wp-86.json` is generated from (`node tests/unit/wp-86/build-ledger.ts`). The playbook files are page copy, so
 * every sentence maps to one claim, one existing page or one decision (docs/wave8-contracts.md, section 9). The mapping is by area, because
 * each area of a playbook draws on one article: the steps and the common mistakes name the article that covers them, the Sources list maps
 * each bullet to the page it names, the WE paragraph restates the service line (C-04), the example is a consideration (W8-24) and a
 * sentence from an outside source maps to the source rule (W8-9) with a `facts` entry that names the fetch and quotes it.
 */

export const FETCHES: readonly FetchRecord[] = [
  { id: 'irs-ein', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number', title: 'Get an employer identification number | Internal Revenue Service', publisher: 'Internal Revenue Service', fetchedAt: '2026-10-10T21:55:09.825Z', status: 200, tool: 'WebFetch' },
  { id: 'irs-contractor', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee', title: 'Independent contractor (self-employed) or employee?', publisher: 'Internal Revenue Service', fetchedAt: '2026-10-10T22:14:00.000Z', status: 200, tool: 'WebFetch' },
  { id: 'uscis-i9', url: 'https://www.uscis.gov/i-9-central/completing-form-i-9/completing-section-2-employer-review-and-attestation', title: 'Completing Section 2, Employer Review and Attestation | USCIS', publisher: 'U.S. Citizenship and Immigration Services', fetchedAt: '2026-10-10T21:55:25.654Z', status: 200, tool: 'WebFetch' },
  { id: 'ftc-can-spam', url: 'https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business', title: 'CAN-SPAM Act: A Compliance Guide for Business', publisher: 'Federal Trade Commission', fetchedAt: '2026-10-10T21:55:11.815Z', status: 200, tool: 'WebFetch' },
  { id: 'sec-exempt', url: 'https://www.sec.gov/resources-small-businesses/exempt-offerings', title: 'Exempt Offerings', publisher: 'U.S. Securities and Exchange Commission', fetchedAt: '2026-10-10T21:55:40.375Z', status: 200, tool: 'WebFetch' },
  { id: 'w3c-wcag22', url: 'https://www.w3.org/TR/WCAG22/', title: 'Web Content Accessibility Guidelines (WCAG) 2.2', publisher: 'World Wide Web Consortium', fetchedAt: '2026-10-10T21:55:27.185Z', status: 200, tool: 'WebFetch' },
  { id: 'nist-ssdf', url: 'https://csrc.nist.gov/pubs/sp/800/218/final', title: 'Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities (NIST SP 800-218)', publisher: 'National Institute of Standards and Technology', fetchedAt: '2026-10-10T21:55:28.242Z', status: 200, tool: 'WebFetch' },
];

/** A sentence of a playbook that states something an outside page says. `quotes` are verbatim fragments of the fetched page, 25 words at most each. */
export interface Fact {
  readonly slug: string;
  readonly sentence: string;
  readonly fetchId: string;
  readonly quotes: readonly string[];
}

export const FACTS: readonly Fact[] = [
  {
    slug: 'build-and-ship-v1',
    sentence: "The W3C's Web Content Accessibility Guidelines (WCAG) 2.2 cover a wide range of recommendations for making web content more accessible, and the document is a W3C Recommendation dated 12 December 2024.",
    fetchId: 'w3c-wcag22',
    quotes: ['Web Content Accessibility Guidelines (WCAG) 2.2 covers a wide range of recommendations for making web content more accessible', 'W3C Recommendation 12 December 2024'],
  },
  {
    slug: 'build-and-ship-v1',
    sentence: "NIST's Secure Software Development Framework, published as SP 800-218, describes a core set of high-level secure software development practices that can be integrated into each SDLC implementation.",
    fetchId: 'nist-ssdf',
    quotes: ['a core set of high-level secure software development practices that can be integrated into each SDLC implementation.'],
  },
  {
    slug: 'set-up-the-company',
    sentence: 'The IRS says that businesses, organizations and some retirement trusts need an employer identification number (EIN) to manage their taxes, and its list of reasons to get one includes hiring employees.',
    fetchId: 'irs-ein',
    quotes: ['Businesses, organizations and some retirement trusts need an EIN to manage their taxes.', 'Generally, you need an EIN to:', 'Hire employees'],
  },
  {
    slug: 'hire-your-first-team-member',
    sentence: 'The IRS asks whether the company controls, or has the right to control, what the worker does and how the job is done.',
    fetchId: 'irs-contractor',
    quotes: ['Does the company control or have the right to control what the worker does and how the worker does his or her job?'],
  },
  {
    slug: 'hire-your-first-team-member',
    sentence: "The IRS asks whether the business aspects of the worker's job are controlled by the payer.",
    fetchId: 'irs-contractor',
    quotes: ["Are the business aspects of the worker's job controlled by the payer?"],
  },
  {
    slug: 'hire-your-first-team-member',
    sentence: 'The IRS asks about written contracts, employee-type benefits and whether the relationship will continue.',
    fetchId: 'irs-contractor',
    quotes: ['Are there written contracts or employee type benefits (that is, pension plan, insurance, vacation pay, etc.)?', 'Will the relationship continue and is the work performed a key aspect of the business?'],
  },
  {
    slug: 'hire-your-first-team-member',
    sentence: 'The IRS says that facts that provide evidence of the degree of control and independence fall into three categories, which it labels behavioral, financial and type of relationship.',
    fetchId: 'irs-contractor',
    quotes: ['Facts that provide evidence of the degree of control and independence fall into three categories:'],
  },
  {
    slug: 'hire-your-first-team-member',
    sentence: 'For an employee, USCIS describes a step to complete and sign Section 2 of Form I-9, Employment Eligibility Verification, within 3 business days of the date of hire of the employee.',
    fetchId: 'uscis-i9',
    quotes: ['complete and sign Section 2 of Form I-9, Employment Eligibility Verification, within 3 business days', 'within 3 business days of the date of hire of your employee'],
  },
  {
    slug: 'run-your-first-outbound-sequence',
    sentence: 'The Federal Trade Commission publishes a compliance guide for businesses on the CAN-SPAM Act.',
    fetchId: 'ftc-can-spam',
    quotes: ['CAN-SPAM Act: A Compliance Guide for Business'],
  },
  {
    slug: 'run-your-first-outbound-sequence',
    sentence: 'Among its points, it says not to use false or misleading header information, and it says your message must include your valid physical postal address.',
    fetchId: 'ftc-can-spam',
    quotes: ['Don’t use false or misleading header information.', 'Your message must include your valid physical postal address.'],
  },
  {
    slug: 'run-your-first-outbound-sequence',
    sentence: "It also says to tell recipients how to opt out of receiving future marketing email from you, and that you must honor a recipient's opt-out request within 10 business days.",
    fetchId: 'ftc-can-spam',
    quotes: ['Tell recipients how to opt out of receiving future marketing email from you.', 'You must honor a recipient’s opt-out request within 10 business days.'],
  },
  {
    slug: 'prepare-for-investor-conversations',
    sentence: 'The Securities and Exchange Commission (SEC) says that every offer and sale of securities must either be registered under the Securities Act of 1933 or rely on an available exemption from registration.',
    fetchId: 'sec-exempt',
    quotes: ['Every offer and sale of securities must either be registered under the Securities Act of 1933 or rely on an available exemption from registration'],
  },
];

export interface Mapping {
  readonly page?: string;
  readonly decision?: string;
  readonly claim?: string;
}

/** One article (or research brief, or template) per area. A value is a slug the generator resolves to a file under src/content. */
export interface AreaPages {
  /** Frontmatter: the steps and the artifacts. */
  readonly front: string;
  /** Text before the first H2, when the file has any. */
  readonly intro?: string;
  readonly good: string;
  readonly decision: string;
  readonly mistakes: string;
  readonly evidence: string;
  /** Extra H2 areas by slug, each a page slug or a decision id. */
  readonly extra?: Readonly<Record<string, Mapping | string>>;
}

export const PLAYBOOKS: Readonly<Record<string, AreaPages>> = {
  'validate-the-problem': {
    front: 'customer-discovery-interviews-without-false-positives',
    good: 'write-the-problem-brief-before-the-code',
    decision: 'kill-criteria-deciding-in-advance-when-to-stop',
    mistakes: 'customer-discovery-interviews-without-false-positives',
    evidence: 'write-the-problem-brief-before-the-code',
  },
  'design-the-product': {
    front: 'cutting-an-mvp-the-cut-line-test',
    good: 'cutting-an-mvp-the-cut-line-test',
    decision: 'cutting-an-mvp-the-cut-line-test',
    mistakes: 'writing-a-product-requirements-document-people-read',
    evidence: 'architecture-decisions-to-defer-in-the-first-six-months',
  },
  'set-up-the-company': {
    intro: 'questions-to-ask-your-counsel-before-you-sign',
    front: 'questions-to-ask-your-counsel-before-you-sign',
    good: 'questions-to-ask-your-counsel-before-you-sign',
    decision: 'choosing-an-entity-llc-or-c-corporation',
    mistakes: 'founder-ip-assignment-and-confidentiality-agreements',
    evidence: 'cap-table-basics-for-founders',
    extra: { 'the-tax-identifier': { decision: 'W8-9' } },
  },
  'build-and-ship-v1': {
    front: 'an-operating-rhythm-for-a-remote-offshore-team',
    good: 'an-operating-rhythm-for-a-remote-offshore-team',
    decision: 'shipping-safely-with-feature-flags-and-rollback',
    mistakes: 'estimating-a-first-release-ranges-and-what-they-hide',
    evidence: 'an-operating-rhythm-for-a-remote-offshore-team',
    extra: { 'standards-to-build-against': { decision: 'W8-9' } },
  },
  'hire-your-first-team-member': {
    intro: 'contractors-and-employees-the-classification-tests',
    front: 'your-first-hire-what-to-settle-before-you-write-the-job',
    good: 'structured-interviews-for-a-small-team',
    decision: 'contractors-and-employees-the-classification-tests',
    mistakes: 'your-first-hire-what-to-settle-before-you-write-the-job',
    evidence: 'onboarding-a-new-team-member-what-to-prepare-before-day-one',
    extra: { 'facts-to-know-before-you-ask': { decision: 'W8-9' } },
  },
  'price-your-first-saas-product': {
    intro: 'pricing-a-first-saas-value-packaging-and-the-questions-to-ask',
    front: 'pricing-a-first-saas-value-packaging-and-the-questions-to-ask',
    good: 'pricing-a-first-saas-value-packaging-and-the-questions-to-ask',
    decision: 'usage-based-seat-based-and-hybrid-pricing-models',
    mistakes: 'a-technical-founders-blind-spots-selling-pricing-and-saying-no',
    evidence: 'pricing-page-fundamentals-for-a-first-saas',
  },
  'earn-your-first-customers': {
    front: 'your-first-ten-customers-a-founder-led-sequence',
    good: 'your-first-ten-customers-a-founder-led-sequence',
    decision: 'customers-as-capital-pilots-prepayment-and-design-partners',
    mistakes: 'your-first-ten-customers-a-founder-led-sequence',
    evidence: 'onboarding-is-acquisition-time-to-first-value',
  },
  'run-your-first-outbound-sequence': {
    intro: 'cold-outreach-that-follows-can-spam',
    front: 'cold-outreach-that-follows-can-spam',
    good: 'cold-outreach-that-follows-can-spam',
    decision: 'choosing-your-first-channels',
    mistakes: 'cold-outreach-that-follows-can-spam',
    evidence: 'founder-led-sales-calls-a-structure',
    extra: { 'what-the-ftc-s-compliance-guide-says': { decision: 'W8-9' } },
  },
  'build-repeatable-growth': {
    front: 'choosing-your-first-channels',
    good: 'early-stage-saas-metrics-definitions',
    decision: 'retention-basics-for-a-first-saas',
    mistakes: 'early-stage-saas-metrics-definitions',
    evidence: 'weekly-investor-update-template',
  },
  'prepare-for-investor-conversations': {
    intro: 'questions-to-ask-your-counsel-before-you-sign',
    front: 'funding-a-software-startup-the-routes',
    good: 'evidence-over-narrative-what-diligence-actually-tests',
    decision: 'ordering-a-pre-seed-evidence-pack',
    mistakes: 'funding-a-software-startup-the-routes',
    evidence: 'ordering-a-pre-seed-evidence-pack',
    extra: {
      'questions-to-ask-your-counsel': 'questions-to-ask-your-counsel-before-you-sign',
      'what-a-public-regulator-says': { decision: 'W8-9' },
    },
  },
};

/** The hub page: its sentences are about the playbooks as a set, so they map to the chain registry and the playbook template. */
export const HUB_PAGE = 'src/content/pages/playbooks/index.mdx';
export const HUB_COPY = 'src/components/playbooks/meta.ts';
export const HUB_LEAD = 'Step-by-step playbooks for building a SaaS company, in the order the work usually comes. Each one gives the steps, what good looks like, a decision aid, the mistakes that cost founders the most time and the evidence to check before you move on.';
export const CHAIN_REGISTRY = 'src/components/playbooks/meta.ts';
export const TEMPLATE_PLAYBOOK = 'src/content/playbooks/validate-the-problem.mdx';

/** Sentences that restate a registered claim wherever they appear. */
export const CLAIM_SENTENCES: Readonly<Record<string, string>> = {
  'WE makes no promise of funding.': 'C-05',
};
