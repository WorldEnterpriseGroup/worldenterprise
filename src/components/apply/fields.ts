/**
 * The words of the Apply form, in one place (WP-43). ApplyForm.astro renders them and /program/how-we-decide/ lists them under
 * "What you can send", so the page and the form cannot say different things. Pure data, free of Astro globals.
 */
import { PACKAGE_NOT_SURE, packages } from '../../data/packages.ts';

export interface FieldCopy {
  readonly label: string;
  readonly hint?: string;
}

export const STAGE_OPTIONS = [
  { value: '', label: 'Choose a stage' },
  { value: 'idea', label: 'An idea that is not yet tested with customers' },
  { value: 'validating', label: 'Validating the problem with customers' },
  { value: 'building', label: 'Building the first version' },
  { value: 'launched', label: 'Live, and looking for the first customers' },
] as const;

export const APPLY_FIELDS = {
  name: { label: 'Your name' },
  email: { label: 'Email address', hint: 'WE replies to this address.' },
  company: { label: 'Company or working name', hint: 'Optional. Leave it blank if the company has no name yet.' },
  stage: { label: 'Where is the idea today?' },
  message: {
    label: 'What are you building, and for whom?',
    hint: 'Optional. A few plain sentences are enough: the problem, the customer and what you have learned so far.',
  },
  seats: {
    label: 'Team you have in mind',
    hint: 'Optional. Sketch the roles in the Team Composer and they appear here, or describe them yourself.',
  },
  package: {
    label: 'Package you have in mind',
    hint: 'Optional. Choose one of the four packages, or say that you are not sure.',
  },
} as const satisfies Record<string, FieldCopy>;

/** The line under the package select that points to the pricing page. */
export const PACKAGE_PRICING_NOTE = {
  before: 'Seats and packages are explained on the ',
  link: { text: 'pricing page', href: '/pricing/' },
  after: '.',
} as const;

/** Words of the review step and of the stepper controls (WP-43). */
export const REVIEW_COPY = {
  title: 'Review',
  intro: 'Check your answers. Nothing has been sent yet. Use Change to go back to a step.',
  empty: 'Not given',
  back: 'Back',
  next: 'Next',
} as const;

/** Label of the "not sure" option. It is never listed with the four packages (docs/wave7-contracts.md, section 1). */
export const PACKAGE_NOT_SURE_LABEL = 'Not sure yet';
export const PACKAGE_EMPTY_LABEL = 'Choose a package';

/** The options of the package select: an empty choice, the four packages in published order, then "Not sure". */
export const PACKAGE_OPTIONS: readonly { readonly value: string; readonly label: string; readonly stageFit?: string }[] = [
  { value: '', label: PACKAGE_EMPTY_LABEL },
  ...packages.map((p) => ({ value: p.id, label: p.name, stageFit: p.stageFit })),
  { value: PACKAGE_NOT_SURE, label: PACKAGE_NOT_SURE_LABEL },
];
