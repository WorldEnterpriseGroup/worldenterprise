/**
 * The words of the readiness review form, in one place (WP-43, revised by WP-54). ApplyForm.astro renders them and
 * /program/how-we-decide/ lists them under "What you can send", so the page and the form cannot say different things. Pure data, free
 * of Astro globals. The answers of the context questions live in src/data/forms.ts, because the message lines are built from them.
 */
import { APPLY_CONTEXT, SITUATIONS } from '../../data/forms.ts';
import type { ApplyContextKey, ContextChoice, SituationId } from '../../data/forms.ts';

export interface FieldCopy {
  readonly label: string;
  readonly hint?: string;
}

/** The stage values are the closed enum of the intake contract (STAGES); only their labels are written here. */
export const STAGE_OPTIONS = [
  { value: '', label: 'Choose a stage' },
  { value: 'idea', label: 'An idea that is not yet tested with customers' },
  { value: 'validating', label: 'Validating the problem with customers' },
  { value: 'building', label: 'Building the first version' },
  { value: 'launched', label: 'Operating, with customers or revenue' },
] as const;

export const APPLY_FIELDS = {
  name: { label: 'Your name' },
  email: { label: 'Email address', hint: 'WE replies to this address.' },
  company: { label: 'Company or working name', hint: 'Optional. Leave it blank if the company has no name yet.' },
  situation: { label: 'Which sounds most like you? (optional)' },
  stage: { label: 'Where is the company today?' },
  startedMonth: { label: 'When did the company start, or when will it?', hint: 'Optional. It places the company on the business clock.' },
  industryYears: { label: 'Years in this industry before starting', hint: 'Optional.' },
  message: {
    label: 'What are you building, and for whom?',
    hint: 'Optional. A few plain sentences are enough: the problem, the customer and what you have learned so far.',
  },
  teamFunding: { label: 'How would the company pay for a team?', hint: 'Optional. This helps WE size a team you can sustain.' },
  horizon: { label: 'How long do you expect to build before the company runs without you in its daily work?', hint: 'Optional.' },
  seats: {
    label: 'Roles you have in mind',
    hint: 'Optional. Sketch the roles in the Team Composer and they appear here, or describe them yourself.',
  },
  source: { label: 'How did you hear about WE?', hint: 'Optional.' },
} as const satisfies Record<string, FieldCopy>;

/** The empty first option of every context select. */
export const CONTEXT_EMPTY_LABEL = 'Choose an answer';

/** The options of one context select: the empty choice, then the answers in the order of SALES.md 6.4. */
export function contextOptions(key: Exclude<ApplyContextKey, 'startedMonth'>): readonly ContextChoice[] {
  return [{ value: '', label: CONTEXT_EMPTY_LABEL }, ...(APPLY_CONTEXT[key].choices ?? [])];
}

/** The context selects, in the order the form asks them. Read by ApplyForm.astro, the review step and the sources test. */
export const CONTEXT_SELECTS = ['situation', 'industryYears', 'teamFunding', 'horizon', 'source'] as const;

/**
 * The form heading a situation page's link shows (SITE-COPY.md 8.1, SALES.md 6.3). Early in my career has none, and neither has
 * None of these, so the form keeps its plain heading for them.
 */
export const SITUATION_HEADINGS: Readonly<Partial<Record<SituationId, string>>> = {
  'industry-insider': 'Map the company your industry years can build.',
  encore: 'Plan a company that fits the next chapter.',
  'repeat-builder': 'Start the second one at the phase it is in.',
  global: 'Build here, with a team that knows the ground.',
  'under-backed': 'Capacity now, credibility over time.',
  restart: 'Is this a company yet? A year-one planning session.',
};

/** Every situation id, for the markup that renders one hidden heading per situation. */
export const SITUATION_IDS: readonly SituationId[] = SITUATIONS.map((situation) => situation.value);

/** Words of the review step and of the stepper controls (WP-43). */
export const REVIEW_COPY = {
  title: 'Review',
  intro: 'Check your answers. Nothing has been sent yet. Use Change to go back to a step.',
  empty: 'Not given',
  back: 'Back',
  next: 'Next',
} as const;
