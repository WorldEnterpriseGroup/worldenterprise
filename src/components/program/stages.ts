/**
 * Dream, Build and Grow as data (SAGE-PLAN 7.1). Three altitudes of the same map: survey, blueprint, territory.
 * Exit evidence lists inspectable artifacts, never outcomes. No durations, no numbered milestones, no promise of
 * funding (claims C-04, C-05, C-10, C-16).
 */
import type { SlotId } from '../../assets/photo/slots.ts';

export type StageId = 'dream' | 'build' | 'grow';
export type Altitude = 'Survey' | 'Blueprint' | 'Territory';
export type ServiceLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface ArtifactLink {
  readonly title: string;
  /** Ledger path of the artifact. Every path here must be a launch:true ledger row (unit test). */
  readonly path: string;
  readonly kind: 'Playbook' | 'Template' | 'Guide' | 'Insight';
  readonly note: string;
}

export interface Activity {
  readonly title: string;
  readonly body: string;
}

export interface Stage {
  readonly id: StageId;
  readonly path: string;
  /** Page title and h1. Kept within 31 characters so the full title stays within 60. */
  readonly title: string;
  readonly name: string;
  readonly altitude: Altitude;
  readonly promise: string;
  /** Short statement of what the altitude looks like. */
  readonly altitudeNote: string;
  readonly description: string;
  readonly slot: SlotId;
  readonly activities: readonly Activity[];
  readonly artifacts: readonly ArtifactLink[];
  readonly exitEvidence: readonly string[];
  readonly limits: readonly string[];
  readonly lines: readonly { readonly line: ServiceLetter; readonly title: string; readonly path: string; readonly note: string }[];
}

export const STAGES: readonly Stage[] = [
  {
    id: 'dream',
    path: '/program/dream/',
    title: 'Dream: validate the problem',
    name: 'Dream',
    altitude: 'Survey',
    promise: 'Validate the problem and the customer before anything is built.',
    altitudeNote: 'The survey altitude: see the whole territory before you choose where to dig.',
    description:
      'Dream is the first stage of the WE program: frame the problem, talk to real customers and decide on evidence whether to build, change course or stop.',
    slot: 'stage-dream',
    activities: [
      { title: 'Frame the problem', body: 'Write the problem the way a customer would describe it, then test whether it is a business or only a feature.' },
      { title: 'Talk to customers', body: 'Run structured interviews that look for evidence of the problem, not for polite agreement with your idea.' },
      { title: 'Size the market from the bottom up', body: 'Count the customers you can actually reach and what they pay for today. WE does not borrow top-down figures from reports.' },
      { title: 'Decide on the evidence', body: 'Choose to stop, change direction or move to Build, and write down what the choice rests on.' },
    ],
    artifacts: [
      { title: 'Validate the problem', path: '/playbooks/validate-the-problem/', kind: 'Playbook', note: 'The steps of this stage, in order.' },
      { title: 'One-page problem brief', path: '/library/one-page-problem-brief/', kind: 'Template', note: 'The problem, the customer and the current alternative on one page.' },
      { title: 'Customer interview guide', path: '/library/customer-interview-guide/', kind: 'Template', note: 'Questions and a note format for honest interviews.' },
      {
        title: 'Customer discovery interviews without false positives',
        path: '/insights/customer-discovery-interviews-without-false-positives/',
        kind: 'Insight',
        note: 'Why friendly interviews mislead, and how to avoid it.',
      },
    ],
    exitEvidence: [
      'A written problem brief that names the customer, the problem and what the customer does about it today.',
      'Interview notes from real customers, kept in one place together with the questions that were asked.',
      'A ranked list of the assumptions that are still untested, ordered by how much each would change the plan.',
      'A written decision to stop, change course or proceed to Build, with the evidence it rests on.',
    ],
    limits: [
      'Dream does not predict whether the idea will succeed. It exists to find out.',
      'It does not replace your own conversations with customers. WE helps you structure and review that work.',
      'It does not produce market-size figures from third-party reports. Sizing is built from counts you can check.',
    ],
    lines: [
      { line: 'C', title: 'Customer Relations and Market Development', path: '/services/customer-and-market-development/', note: 'Discovery, pilots and pipeline discipline.' },
      { line: 'E', title: 'Digital Incubation', path: '/services/digital-incubation/', note: 'The workspace, curriculum and coaching around the work.' },
    ],
  },
  {
    id: 'build',
    path: '/program/build/',
    title: 'Build: ship the first product',
    name: 'Build',
    altitude: 'Blueprint',
    promise: 'Turn the validated idea into a product that ships.',
    altitudeNote: 'The blueprint altitude: draw what will be built, then build only that.',
    description:
      'Build is the second stage of the WE program: design the product, cut the first release to what matters, and ship it with a dedicated team steered by WE.',
    slot: 'stage-build',
    activities: [
      { title: 'Design the product', body: 'Turn the validated problem into the flows and screens a customer needs to get one job done.' },
      { title: 'Cut the first release', body: 'Apply a cut line to the scope so the first release contains what the evidence supports and nothing more.' },
      { title: 'Defer architecture you do not need yet', body: 'Make the decisions the first release requires and write down the ones that can wait.' },
      { title: 'Build and ship in reviewed cycles', body: 'The dedicated team works in cycles. Each ends with something you can open, and a review with you.' },
      { title: 'Set the baseline', body: 'Fill in a security and accessibility checklist early, so gaps are known while they are cheap to close.' },
    ],
    artifacts: [
      { title: 'Design the product', path: '/playbooks/design-the-product/', kind: 'Playbook', note: 'From a validated problem to a design the team can build.' },
      { title: 'Build and ship v1', path: '/playbooks/build-and-ship-v1/', kind: 'Playbook', note: 'Cycles, reviews and release for the first version.' },
      { title: 'MVP cut-line worksheet', path: '/library/mvp-cut-line-worksheet/', kind: 'Template', note: 'A worksheet for deciding what is in and out.' },
      { title: 'Security baseline checklist', path: '/library/security-baseline-checklist/', kind: 'Template', note: 'A working checklist, not a certification.' },
      { title: 'Cutting an MVP: the cut-line test', path: '/insights/cutting-an-mvp-the-cut-line-test/', kind: 'Insight', note: 'How to say no to features without losing the point.' },
    ],
    exitEvidence: [
      'A written first-release scope with an explicit cut line and the reason for each exclusion.',
      'A running first release that a real customer can open and use.',
      'A list of build-versus-buy decisions, with the reason for each.',
      'A register of the repositories, accounts and documents for the product, so you always know where everything lives.',
      'A security and accessibility baseline checklist, filled in honestly, with open items marked as open.',
    ],
    limits: [
      'Build does not include production operations or round-the-clock support.',
      'It does not promise a ship date. Dates depend on scope and on decisions only you can make.',
      'The baseline checklist is a working tool. It is not an audit or an attestation, and it does not show that the product meets any outside standard.',
    ],
    lines: [
      { line: 'B', title: 'Product and IT Development', path: '/services/product-and-it-development/', note: 'Design, build and release your SaaS.' },
      { line: 'D', title: 'Business Management and Operations', path: '/services/business-management-and-operations/', note: 'Cadence, goals, metrics and the weekly rhythm.' },
    ],
  },
  {
    id: 'grow',
    path: '/program/grow/',
    title: 'Grow: earn customers',
    name: 'Grow',
    altitude: 'Territory',
    promise: 'Earn customers and become a company an investor can examine.',
    altitudeNote: 'The territory altitude: you are on the ground, with customers and a record of what happened.',
    description:
      'Grow is the third stage of the WE program: win first customers, report metrics consistently and assemble the evidence investors ask for. No promise of funding.',
    slot: 'stage-grow',
    activities: [
      { title: 'Win the first customers by hand', body: 'Work a founder-led sequence, one customer at a time, and record what each conversation taught you.' },
      { title: 'Shorten the path to first value', body: 'Treat onboarding as acquisition: a customer who reaches value quickly is the one who stays.' },
      { title: 'Set up pricing and support', body: 'Publish a pricing page a customer can follow and a support loop sized for a handful of customers.' },
      { title: 'Report metrics consistently', body: 'Write each metric down with its definition and its source, then report it the same way every time.' },
      { title: 'Assemble the investor evidence', body: 'Build the data room and the update habit that serious investors expect, and mark the gaps instead of hiding them.' },
    ],
    artifacts: [
      { title: 'Earn your first customers', path: '/playbooks/earn-your-first-customers/', kind: 'Playbook', note: 'A founder-led sequence for the first customers.' },
      { title: 'Build repeatable growth', path: '/playbooks/build-repeatable-growth/', kind: 'Playbook', note: 'Turning early wins into a process you can repeat.' },
      { title: 'Weekly investor update template', path: '/library/weekly-investor-update-template/', kind: 'Template', note: 'A short, regular update written from real data.' },
      { title: 'Seed data room checklist', path: '/library/seed-data-room-checklist/', kind: 'Template', note: 'What an organised data room contains.' },
      { title: 'Investor readiness checklist', path: '/fundability/investor-readiness-checklist/', kind: 'Guide', note: 'The evidence a serious investor asks for.' },
    ],
    exitEvidence: [
      'A customer log: who was approached, what happened and what each customer said.',
      'Metric definitions written down, with each reported number tied to the place it came from.',
      'A data room index in which every folder is populated or marked with the reason it is empty.',
      'A recent investor update drafted from real data and reviewed with you.',
      'A completed readiness checklist with the remaining gaps listed.',
    ],
    limits: [
      'WE does not promise introductions to investors and does not run a raise on your behalf.',
      'It does not give legal, tax or financial advice. Your counsel and accountant are your own, and WE coordinates with them.',
      'It does not report growth figures for the program or for any company.',
    ],
    lines: [
      { line: 'C', title: 'Customer Relations and Market Development', path: '/services/customer-and-market-development/', note: 'Pilots, pipeline discipline and partner mapping.' },
      { line: 'F', title: 'Fundability and Investor Readiness', path: '/services/fundability-and-investor-readiness/', note: 'The evidence a serious investor asks for.' },
      { line: 'G', title: 'Professional-Services Coordination', path: '/services/professional-services-coordination/', note: 'WE coordinates your own counsel, accountant and specialists.' },
    ],
  },
] as const;

export function getStage(id: StageId): Stage {
  const stage = STAGES.find((s) => s.id === id);
  if (stage === undefined) throw new Error(`Unknown stage "${id}".`);
  return stage;
}

export function nextStage(id: StageId): Stage | undefined {
  const index = STAGES.findIndex((s) => s.id === id);
  return STAGES[index + 1];
}
