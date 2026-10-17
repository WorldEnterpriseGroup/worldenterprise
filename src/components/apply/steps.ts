/**
 * The four steps of the readiness review form (WP-43, revised by WP-54). ApplyForm.astro renders one fieldset per step, in the DOM for everyone, and
 * src/scripts/forms.ts groups them into a stepper when JavaScript runs. Without JavaScript every fieldset stays visible and the
 * form is the single native POST that docs/forms-contract.md section 8 describes.
 *
 * `fields` lists the validation field names that live on a step, so a step validates only its own answers and an error found at
 * submit time can send the visitor back to the right step. Pure data, free of Astro globals.
 */
import type { FieldName } from '../../scripts/forms.ts';

export type ApplyStepId = 'you' | 'idea' | 'team' | 'review';

export interface ApplyStep {
  readonly id: ApplyStepId;
  readonly title: string;
  readonly fields: readonly FieldName[];
}

export const APPLY_STEPS: readonly ApplyStep[] = [
  { id: 'you', title: 'About you', fields: ['name', 'email', 'company', 'situation'] },
  { id: 'idea', title: 'About the company', fields: ['stage', 'startedMonth', 'industryYears', 'message'] },
  { id: 'team', title: 'Team and horizon', fields: ['teamFunding', 'horizon', 'seats', 'source'] },
  { id: 'review', title: 'Review', fields: ['consent'] },
];

/** Index of the step that holds a field, or -1. */
export function stepIndexForField(field: FieldName): number {
  return APPLY_STEPS.findIndex((step) => step.fields.includes(field));
}

/** Index of the first step that holds any of the fields, or -1 when none of them belongs to a step. */
export function firstStepWithErrors(fields: readonly FieldName[]): number {
  const indexes = fields.map(stepIndexForField).filter((index) => index >= 0);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}
