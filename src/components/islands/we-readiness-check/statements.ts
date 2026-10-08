/**
 * The twelve readiness statements (SAGE-PLAN 6.8). One source for the self-check island and the checklist guide.
 * Pure data: no Astro imports, so unit tests can load it. Each statement is something the founder can answer
 * with yes or no and back with an artifact that another person could open.
 */
export type ReadinessGroup = 'problem' | 'product' | 'company' | 'communication';

export interface ReadinessStatement {
  readonly id: string;
  readonly group: ReadinessGroup;
  /** First-person statement the founder confirms or does not. */
  readonly statement: string;
  /** The artifact that would show the statement is true. */
  readonly artifact: string;
  /** Where to start when the statement is not yet true. */
  readonly gapTitle: string;
  /** Ledger path of the page that helps. */
  readonly gapHref: string;
}

export const READINESS_GROUPS: Readonly<Record<ReadinessGroup, { readonly title: string; readonly intro: string }>> = {
  problem: {
    title: 'The problem and the customer',
    intro: 'Evidence that a real problem exists and that you have learned about it from the people who have it.',
  },
  product: {
    title: 'The product and the first customers',
    intro: 'Evidence that people use the product, that you can count what happens, and that growth is not a one-off.',
  },
  company: {
    title: 'The company and its records',
    intro: 'Evidence that the company exists on paper, that it owns what it sells, and that the records are in order.',
  },
  communication: {
    title: 'Communication and counsel',
    intro: 'Evidence that you report progress consistently and that you understand what you are about to sign.',
  },
};

export const readinessStatements: readonly ReadinessStatement[] = [
  {
    id: 'problem-stated',
    group: 'problem',
    statement: 'I can state the problem, and who has it, in two plain sentences that a stranger would understand.',
    artifact: 'A one-page problem brief',
    gapTitle: 'Playbook: validate the problem',
    gapHref: '/playbooks/validate-the-problem/',
  },
  {
    id: 'customer-interviews',
    group: 'problem',
    statement: 'I have recorded notes from conversations with people who have the problem, written in one consistent format.',
    artifact: 'Interview notes and a short summary of what they showed',
    gapTitle: 'Template: customer interview guide',
    gapHref: '/library/customer-interview-guide/',
  },
  {
    id: 'product-in-use',
    group: 'product',
    statement: 'A working version of the product exists, and at least one person outside my team has used it.',
    artifact: 'A released version and a note of who used it and what they did',
    gapTitle: 'Playbook: build and ship v1',
    gapHref: '/playbooks/build-and-ship-v1/',
  },
  {
    id: 'first-customers',
    group: 'product',
    statement: 'I know how my first customers found the product, and what each one committed to or paid for.',
    artifact: 'A customer conversation log',
    gapTitle: 'Playbook: earn your first customers',
    gapHref: '/playbooks/earn-your-first-customers/',
  },
  {
    id: 'metrics-defined',
    group: 'product',
    statement: 'My revenue, churn and activation measures are defined in writing and calculated the same way every period.',
    artifact: 'A metrics definitions sheet',
    gapTitle: 'Research brief: early-stage SaaS metrics definitions',
    gapHref: '/research/early-stage-saas-metrics-definitions/',
  },
  {
    id: 'repeatable-channel',
    group: 'product',
    statement: 'I have found customers through at least one channel more than once, and I know what that channel cost me.',
    artifact: 'A channel log with cost and result for each period',
    gapTitle: 'Playbook: build repeatable growth',
    gapHref: '/playbooks/build-repeatable-growth/',
  },
  {
    id: 'ip-assignments',
    group: 'company',
    statement: 'Everyone who has written code, design or content for the company has signed a written assignment of that work.',
    artifact: 'Signed assignment agreements, one per contributor',
    gapTitle: 'Insight: IP, contracts and access diligence',
    gapHref: '/insights/ip-contracts-and-access-diligence-for-small-engineering-teams/',
  },
  {
    id: 'entity-and-ownership',
    group: 'company',
    statement: 'The company is a legal entity, and ownership is recorded in one cap table that is up to date.',
    artifact: 'Formation documents and a current cap table',
    gapTitle: 'Guide: the seed data room',
    gapHref: '/fundability/data-room/',
  },
  {
    id: 'data-room-folder',
    group: 'company',
    statement: 'My core company documents sit in one organized folder that I could share within a day.',
    artifact: 'A data room folder with an index',
    gapTitle: 'Template: seed data room checklist',
    gapHref: '/library/seed-data-room-checklist/',
  },
  {
    id: 'data-inventory',
    group: 'company',
    statement: 'I have a written list of where customer data lives and who can reach it.',
    artifact: 'A data inventory and an access list',
    gapTitle: 'Research brief: SaaS security baseline for year one',
    gapHref: '/research/saas-security-baseline-year-one/',
  },
  {
    id: 'update-habit',
    group: 'communication',
    statement: 'I send, or have drafted, a regular written update on progress to people who follow the company.',
    artifact: 'Two or more dated updates in the same format',
    gapTitle: 'Guide: investor updates',
    gapHref: '/fundability/investor-updates/',
  },
  {
    id: 'safe-with-counsel',
    group: 'communication',
    statement: 'I understand the instruments I may be offered, and I have a list of questions for my own counsel before I sign anything.',
    artifact: 'A written list of questions for your counsel',
    gapTitle: 'Guide: SAFEs in plain language',
    gapHref: '/fundability/safe-explained/',
  },
];
