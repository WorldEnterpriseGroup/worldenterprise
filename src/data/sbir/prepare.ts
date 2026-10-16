/**
 * The preparation path for /sbir-sttr/prepare/ (WP-34, #83): the registration steps, the eligibility checklist, the readiness
 * checklist and the long timeline from first registration to Phase III. Durations are the programs' published ones; the one derived
 * duration (median months from a company's first Phase I award to its first Phase II award) comes from the SBIR.gov award data.
 */
import { AGGREGATES } from './aggregates.ts';
import type { SbirSourceId } from './sources.ts';

export interface Lane {
  readonly id: string;
  readonly label: string;
  /** Month the lane starts, counted from the first registration. */
  readonly from: number;
  readonly to: number;
  readonly note: string;
  /** True when the lane has no end: the work goes on after Phase III begins. */
  readonly open?: boolean;
  readonly kind: 'prepare' | 'wait' | 'funded' | 'market';
  readonly sources: readonly SbirSourceId[];
}

export const MEDIAN_GAP_MONTHS = AGGREGATES.phaseGap.medianMonths;
/** Months from first registration to a first award in the illustration. A planning assumption, stated on the page. */
export const FIRST_AWARD_MONTH = 9;
export const PHASE2_START_MONTH = FIRST_AWARD_MONTH + Math.round(MEDIAN_GAP_MONTHS);
export const PHASE2_END_MONTH = PHASE2_START_MONTH + 24;
export const TIMELINE_MONTHS = 60;

export const LANES: readonly Lane[] = [
  {
    id: 'register',
    label: 'Register',
    from: 0,
    to: 1,
    kind: 'prepare',
    note: 'A SAM.gov entity registration and Unique Entity ID, the SBA company registry and a Login.gov account. SAM.gov advises allowing at least ten business days, and registrations are renewed every year.',
    sources: ['sam-checklist', 'sbir-apply'],
  },
  {
    id: 'learn',
    label: 'Choose an agency and a topic',
    from: 0,
    to: 4,
    kind: 'prepare',
    note: 'Read the open solicitations, talk to the agency’s program staff, and decide which of the eleven programs fits the work.',
    sources: ['sbir-agencies'],
  },
  {
    id: 'write',
    label: 'Write and submit',
    from: 3,
    to: 6,
    kind: 'prepare',
    note: 'A technical plan, a commercialization plan, a budget and a team. Some agencies start with a short pitch or white paper.',
    sources: ['nsf-seed-fund', 'nasa-sbir'],
  },
  {
    id: 'review',
    label: 'Review and decision',
    from: 6,
    to: FIRST_AWARD_MONTH,
    kind: 'wait',
    note: 'NASA’s published schedule runs from about one month to ten months between a close date and a selection, depending on the opportunity.',
    sources: ['nasa-sbir'],
  },
  {
    id: 'phase1',
    label: 'Phase I work',
    from: FIRST_AWARD_MONTH,
    to: FIRST_AWARD_MONTH + 6,
    kind: 'funded',
    note: 'Six months is normal for SBIR and a year for STTR. A proof of concept, not a product.',
    sources: ['sbir-policy-directive', 'sbir-apply'],
  },
  {
    id: 'bridge',
    label: 'Phase II proposal and the wait',
    from: FIRST_AWARD_MONTH + 6,
    to: PHASE2_START_MONTH,
    kind: 'wait',
    note: `In the award data the median company took ${MEDIAN_GAP_MONTHS} months from its first Phase I award to its first Phase II award, so a Phase II usually begins about month ${PHASE2_START_MONTH}.`,
    sources: ['sbir-award-data'],
  },
  {
    id: 'phase2',
    label: 'Phase II work',
    from: PHASE2_START_MONTH,
    to: PHASE2_END_MONTH,
    kind: 'funded',
    note: 'Two years is normal. The development that turns a proof of concept into something a customer can use.',
    sources: ['sbir-apply', 'sbir-policy-directive'],
  },
  {
    id: 'phase3',
    label: 'Phase III: sell the result',
    from: PHASE2_END_MONTH,
    to: TIMELINE_MONTHS,
    open: true,
    kind: 'market',
    note: 'No SBIR or STTR money is awarded in Phase III. The company sells to the private sector or to a federal buyer, and the work goes on.',
    sources: ['sbir-apply'],
  },
];

export interface Step {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly sources: readonly SbirSourceId[];
}

export const REGISTRATION_STEPS: readonly Step[] = [
  {
    id: 'uei',
    title: 'Get a Unique Entity ID and register in SAM.gov',
    body: 'You must have a Unique Entity ID from SAM.gov to receive SBIR or STTR awards. SAM.gov does not charge for the ID or for registration. Allow at least ten business days for the registration to go active, start early, and put the yearly renewal in a calendar.',
    sources: ['sbir-apply', 'sam-checklist'],
  },
  {
    id: 'registry',
    title: 'Register the company on SBIR.gov',
    body: 'SBIR.gov asks for a company registration, and its login now runs through a new identity verification step. Applicants use the external user login.',
    sources: ['sbir-apply', 'sbir-about'],
  },
  {
    id: 'login',
    title: 'Have a Login.gov account ready',
    body: 'Federal sign-in for these programs goes through Login.gov identity verification. Set it up before a deadline week, because verification can take longer than expected.',
    sources: ['sbir-about'],
  },
  {
    id: 'agency',
    title: 'Create the agency accounts you need',
    body: 'Each agency runs its own portal: DSIP for DoD, the NIH grants system for HHS, and each program’s own site for the rest. Plan for one registration per agency.',
    sources: ['sbir-agencies'],
  },
];

export interface Check {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly sources: readonly SbirSourceId[];
}

export const ELIGIBILITY: readonly Check[] = [
  {
    id: 'for-profit-us',
    label: 'The company is a for-profit business located in the United States.',
    hint: 'A student project must be set up as a company before it applies.',
    sources: ['sbir-apply'],
  },
  {
    id: 'size',
    label: 'The company has fewer than 500 employees.',
    hint: 'SBIR.gov notes that most applicants have fewer than ten.',
    sources: ['sbir-apply'],
  },
  {
    id: 'ownership',
    label: 'The company is owned and controlled by U.S. citizens or lawful permanent residents.',
    hint: 'Some additional restrictions apply with venture capital ownership: NIH, DOE and NSF may award up to 25 percent of their SBIR funds to companies majority-owned by several venture, hedge or private equity firms, and other agencies up to 15 percent. Check the current rules with the agency and your own counsel.',
    sources: ['sbir-apply', 'sbir-policy-directive'],
  },
  {
    id: 'pi',
    label: 'The principal investigator works mainly for the company.',
    hint: 'More than half of the investigator’s time must be with the company (for STTR, with the research institution).',
    sources: ['sbir-policy-directive'],
  },
  {
    id: 'work',
    label: 'The company will do most of the research itself.',
    hint: 'SBIR: at least two thirds of Phase I and half of Phase II. STTR: at least 40 percent by the company and 30 percent by the research institution.',
    sources: ['sbir-policy-directive'],
  },
  {
    id: 'foreign',
    label: 'Owners and key personnel are ready for foreign-risk screening.',
    hint: 'SBA says the 2026 law protects against foreign adversaries, and DOE and NIH publish foreign risk pages. Gather the facts about ownership and key people before the proposal, not during it.',
    sources: ['doe-sbir', 'nih-seed'],
  },
];

export const READINESS: readonly Check[] = [
  {
    id: 'problem',
    label: 'We can state the technical risk in one page.',
    hint: 'Phase I exists to answer a question of feasibility. If the question is not sharp, the proposal will not be either.',
    sources: ['sbir-apply'],
  },
  {
    id: 'customer',
    label: 'We can name who would buy the result, and why.',
    hint: 'Every agency scores commercial potential, whether the buyer is a hospital system, a program office or a farm cooperative.',
    sources: ['nsf-seed-fund'],
  },
  {
    id: 'agency',
    label: 'We have read the current solicitation for the agency we chose.',
    hint: 'Topics, page limits, review criteria and dates all change from one solicitation to the next.',
    sources: ['nasa-sbir', 'sbir-agencies'],
  },
  {
    id: 'partner',
    label: 'For STTR: a research institution has agreed to partner, in writing.',
    hint: 'STTR requires a formal partnership with a university, a nonprofit research organization or a federally funded research center.',
    sources: ['sbir-apply'],
  },
  {
    id: 'team',
    label: 'The team and the budget match the work.',
    hint: 'A realistic budget inside the award range, and people whose time is already committed to it.',
    sources: ['sbir-apply'],
  },
  {
    id: 'runway',
    label: 'We can fund the months between awards.',
    hint: 'The median gap from a first Phase I award to a first Phase II award is well over a year. Plan the runway for the wait, not only for the work.',
    sources: ['sbir-award-data'],
  },
  {
    id: 'help',
    label: 'We have talked to a local adviser.',
    hint: 'Small Business Development Centers, state FAST programs and APEX Accelerators help with registration and proposals.',
    sources: ['sba-sbdc', 'sbir-fast', 'apex-search'],
  },
];
