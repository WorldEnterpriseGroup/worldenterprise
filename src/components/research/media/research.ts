/**
 * Diagram content for the research reports (WP-23, #89). Each item restates its report (src/content/research/*.md) and cites the same
 * public source the report cites; nothing here goes beyond the report's text. Figures live in data.ts.
 */
import type { StatSource } from '../../visuals/contracts.ts';
import type { FlowStep } from './FlowDiagram.astro';
import type { Layer } from './LayerStack.astro';
import type { MatrixRow } from './RatingMatrix.astro';
import type { Option } from './OptionGrid.astro';
import type { RuleEvent } from './RuleTimeline.astro';
import type { BridgeStep } from './FormulaBridge.astro';

/** The reports that carry media, in hub order (BRIEF_META order). */
export const REPORT_SLUGS = ['saas-security-baseline-year-one', 'accessibility-as-a-launch-requirement', 'dedicated-team-agency-or-freelancers', 'early-stage-saas-metrics-definitions'] as const;
export type ReportSlug = (typeof REPORT_SLUGS)[number];
export const isReportSlug = (slug: string): slug is ReportSlug => (REPORT_SLUGS as readonly string[]).includes(slug);

const WCAG22: StatSource = { label: 'W3C, Web Content Accessibility Guidelines (WCAG) 2.2', href: 'https://www.w3.org/TR/WCAG22/' };
const S508: StatSource = { label: 'Section508.gov, Laws and policies', href: 'https://www.section508.gov/manage/laws-and-policies/' };
const ADA: StatSource = { label: 'U.S. Department of Justice, ADA.gov, the 2024 web rule under Title II', href: 'https://www.ada.gov/resources/2024-03-08-web-rule/' };
const FR2026: StatSource = { label: 'Federal Register document 2026-07663, as reported by secondary summaries', href: 'https://www.federalregister.gov/d/2026-07663' };

/** accessibility-as-a-launch-requirement.md, "What the sources say". */
export const ACCESSIBILITY_RULES: readonly RuleEvent[] = [
  { date: '2017-01-18', label: 'Section 508 refresh published', detail: 'The Access Board final rule references WCAG 2.0 for federal agencies.', source: S508 },
  { date: '2018-01-18', label: 'Section 508 refresh takes effect', detail: 'Applies when agencies develop, procure, maintain or use technology.', source: S508 },
  { date: '2024-04-24', label: 'DOJ Title II web rule published', detail: 'State and local governments; adopts WCAG 2.1 Level AA.', source: ADA },
  { date: '2024-12-12', label: 'WCAG 2.2 Recommendation', detail: 'Adds criteria such as 2.4.11, 2.5.7, 2.5.8 and 3.3.8. Conforming to 2.2 also meets 2.0 and 2.1.', source: WCAG22 },
  { date: '2026-04-20', label: 'Interim final rule moves the dates', detail: 'Reported by secondary summaries; verify the current rule.', source: FR2026 },
  { date: '2027-04-26', label: 'Compliance date, larger entities', detail: 'Populations of 50,000 or more, per the reported interim rule.', source: FR2026 },
  { date: '2028-04-26', label: 'Compliance date, smaller entities', detail: 'Smaller entities and special districts, per the reported interim rule.', source: FR2026 },
];

/** dedicated-team-agency-or-freelancers.md, "Appendix: decision matrix". */
export const TEAM_MODELS = ['Freelancers', 'Agency', 'Dedicated team'] as const;
export const TEAM_MATRIX: readonly MatrixRow[] = [
  { criterion: 'Control of method', ratings: ['Stronger', 'Weaker', 'Mixed'] },
  { criterion: 'Continuity', ratings: ['Weaker', 'Mixed', 'Stronger'] },
  { criterion: 'Accountability', ratings: ['Weaker', 'Stronger', 'Stronger'] },
  { criterion: 'Management load on you', ratings: ['Weaker', 'Mixed', 'Stronger'] },
  { criterion: 'Scaling', ratings: ['Mixed', 'Mixed', 'Stronger'] },
  { criterion: 'Breadth of skills', ratings: ['Weaker', 'Stronger', 'Stronger'] },
  { criterion: 'Ownership of work', ratings: ['Mixed', 'Stronger', 'Stronger'] },
  { criterion: 'Security acceptance criteria', ratings: ['Mixed', 'Stronger', 'Stronger'] },
  { criterion: 'Cost clarity up front', ratings: ['Mixed', 'Stronger', 'Weaker'] },
  { criterion: 'Exit', ratings: ['Stronger', 'Mixed', 'Mixed'] },
];
export const TEAM_MATRIX_NOTE = 'Editorial judgment from the brief, not a measurement. WE steers dedicated teams, one of the three models, so weight the criteria for your own situation.';

/** "The three models". */
export const TEAM_OPTIONS: readonly Option[] = [
  { label: 'Freelancers', text: 'Individual contractors you find, brief, manage and replace yourself.', icon: 'contact', meta: 'Fits narrow, well-specified tasks' },
  { label: 'Agency', text: 'A firm that staffs and manages its own people to deliver a scoped outcome.', icon: 'document', meta: 'Fits a defined outcome with an acceptance test' },
  { label: 'Dedicated team', text: 'People assigned to you for a continuing period, steered and managed by the provider.', icon: 'team', meta: 'Fits product work whose direction changes' },
];

/** "Methodology": questions to answer before choosing. */
export const TEAM_QUESTIONS: readonly FlowStep[] = [
  { label: 'Specification or product?', text: 'Is the work finished, or still being discovered?' },
  { label: 'Who sets direction?', text: 'Day to day, and do they have the time?' },
  { label: 'Which skills together?', text: 'And how many people is that?' },
  { label: 'Where is ownership written?', text: 'And who signs?' },
  { label: 'Which security criteria?', text: 'And who checks them?' },
  { label: 'What does stopping look like?', text: 'And what do you take with you?' },
];

/** saas-security-baseline-year-one.md, the summary table and "how the three fit together". Top layer first. */
export const SECURITY_LAYERS: readonly Layer[] = [
  { name: 'AICPA Trust Services Criteria', text: 'How will an outside CPA describe our controls to a customer? Decide later and separately.', tag: 'Reporting frame' },
  { name: 'NIST SP 800-218, the SSDF', text: 'How should the way we make software reduce vulnerabilities? Names the team’s habits.', tag: 'Process vocabulary' },
  { name: 'OWASP ASVS', text: 'What must the application itself do, and how is that tested?', tag: 'Test plan' },
];

/** "Analysis: a year-one sequence" (a recommendation; quarters are a planning device). */
export const SECURITY_YEAR: readonly FlowStep[] = [
  { label: 'Quarter 1: decide and inventory', text: 'Choose an ASVS level with a written reason; list components, services and production access.' },
  { label: 'Quarter 2: build the habits', text: 'Write the review and release practice in SSDF terms; check new work against ASVS chapters.' },
  { label: 'Quarter 3: verify and fix', text: 'A structured pass against the level; a gap register with owners; fix the riskiest first.' },
  { label: 'Quarter 4: decide on assurance', text: 'Decide whether an attestation is worth it, and which categories are in scope.' },
];

/** early-stage-saas-metrics-definitions.md, net revenue retention (Stripe's formula). */
export const NRR_BRIDGE: readonly BridgeStep[] = [
  { label: 'Beginning recurring revenue', kind: 'base', size: 0.72 },
  { label: 'Revenue from upgrades', kind: 'add', size: 0.16 },
  { label: 'Lost from downgrades', kind: 'subtract', size: 0.07 },
  { label: 'Lost from churn', kind: 'subtract', size: 0.1 },
  { label: 'Recurring revenue from the same customers at the end', kind: 'base', size: 0.71 },
];
export const NRR_FORMULA = 'NRR = [(beginning recurring revenue - MRR lost from churn - MRR lost from downgrades + revenue from upgrades) / beginning recurring revenue] x 100';
export const NRR_NOTE = 'A schematic of the formula as Stripe publishes it: bar heights are illustrative, not data. Existing customers only; new customers never enter it.';

/** "Appendix: formula table". */
export const METRIC_FORMULAS: readonly Option[] = [
  { label: 'MRR', text: 'Average monthly client payment times the number of clients; one-time fees excluded.', icon: 'calendar', meta: 'Define "client" and "payment"' },
  { label: 'ARR', text: 'Recurring revenue on an annual basis.', icon: 'clock', meta: 'Converting from MRR is a stated convention' },
  { label: 'Customer churn', text: '(Customers lost / total customers during the period) x 100.', icon: 'gate', meta: 'State the period and the population' },
  { label: 'NRR', text: 'Revenue kept from existing customers over the period, as drawn above.', icon: 'report', meta: 'Existing customers only' },
  { label: 'CAC', text: 'Marketing cost / customers acquired; an extended form adds wages, software and overhead.', icon: 'contact', meta: 'Label which form is used' },
  { label: 'CLV', text: 'Margin x (retention / (1 + discount - retention)).', icon: 'data', meta: 'Basic form only' },
];
