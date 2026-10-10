/**
 * The Apply stepper (WP-43). Progressive enhancement of the one server-rendered <form>: every fieldset is in the DOM and visible
 * without JavaScript, and docs/forms-contract.md section 8 is untouched. When src/scripts/forms.ts mounts, this groups the
 * fieldsets into four steps with a progress list, Back and Next, per-step validation, a review step and focus on the step heading.
 *
 * Step state lives in memory only. Nothing is written to localStorage, sessionStorage, a cookie or the URL (DP-13): the answers
 * are PII and the visitor has not sent them yet. The first half of this file is pure and runs under `node --test`; the DOM class
 * below it touches the document only when it is constructed.
 */
import type { FieldError, FormValues } from '../../scripts/forms.ts';
import { PACKAGE_NOT_SURE, isPackageId, getPackage } from '../../data/packages.ts';
import { PACKAGE_NOT_SURE_LABEL, REVIEW_COPY, STAGE_OPTIONS } from './fields.ts';
import { APPLY_STEPS, firstStepWithErrors, type ApplyStep, type ApplyStepId } from './steps.ts';

export interface ReviewRow {
  readonly label: string;
  readonly value: string;
}

export interface ReviewGroup {
  readonly step: ApplyStepId;
  readonly title: string;
  readonly rows: readonly ReviewRow[];
}

function stageLabel(value: string): string {
  const found = STAGE_OPTIONS.find((option) => option.value === value && option.value !== '');
  return found === undefined ? REVIEW_COPY.empty : found.label;
}

function packageLabel(value: string | undefined): string {
  if (value === undefined || value === '') return REVIEW_COPY.empty;
  if (value === PACKAGE_NOT_SURE) return PACKAGE_NOT_SURE_LABEL;
  return isPackageId(value) ? getPackage(value).name : REVIEW_COPY.empty;
}

/** What the review step shows, grouped by the step each answer belongs to. An unanswered optional field reads "Not given". */
export function buildReviewGroups(values: FormValues): readonly ReviewGroup[] {
  const given = (text: string): string => (text.trim() === '' ? REVIEW_COPY.empty : text.trim());
  return [
    {
      step: 'you',
      title: 'About you',
      rows: [
        { label: 'Your name', value: given(values.name) },
        { label: 'Email address', value: given(values.email) },
        { label: 'Company or working name', value: given(values.company) },
      ],
    },
    {
      step: 'idea',
      title: 'About the idea',
      rows: [
        { label: 'Where the idea is today', value: stageLabel(values.stage) },
        { label: 'What you are building, and for whom', value: given(values.message) },
      ],
    },
    {
      step: 'team',
      title: 'Team and package',
      rows: [
        { label: 'Team you have in mind', value: given(values.seats) },
        { label: 'Package you have in mind', value: packageLabel(values.package) },
      ],
    },
  ];
}

/** "Step 2 of 4: About the idea". The text of the live region and of the progress bar. */
export function stepStatus(index: number, steps: readonly ApplyStep[] = APPLY_STEPS): string {
  const step = steps[index];
  if (step === undefined) throw new RangeError(`There is no step ${index}.`);
  return `Step ${index + 1} of ${steps.length}: ${step.title}`;
}

/** Where a failed submit sends the visitor: the earliest step that holds one of the errors, or null when none of them is on a step. */
export function stepForErrors(errors: readonly FieldError[]): number | null {
  const index = firstStepWithErrors(errors.map((error) => error.field));
  return index < 0 ? null : index;
}

/** The pieces of IntakeFormController the stepper needs. Keeps this file free of a dependency cycle with forms.ts. */
export interface StepperHooks {
  /** Errors for the fields of one step only. */
  validateStep(step: ApplyStep): readonly FieldError[];
  showErrors(errors: readonly FieldError[], intro: string): void;
  clearErrors(): void;
  values(): FormValues;
}

const STATE_TEXT = { done: ', completed', current: ', current step', todo: '' } as const;

export class ApplyStepper {
  private readonly form: HTMLFormElement;
  private readonly hooks: StepperHooks;
  private readonly groups: ReadonlyMap<ApplyStepId, readonly HTMLElement[]>;
  private readonly bar: HTMLElement;
  private readonly status: HTMLElement;
  private readonly items: readonly HTMLElement[];
  private readonly back: HTMLButtonElement | null;
  private readonly next: HTMLButtonElement | null;
  private readonly submit: HTMLButtonElement | null;
  private readonly review: HTMLElement | null;
  private current = 0;

  private constructor(form: HTMLFormElement, hooks: StepperHooks, parts: { bar: HTMLElement; status: HTMLElement; items: readonly HTMLElement[]; groups: ReadonlyMap<ApplyStepId, readonly HTMLElement[]> }) {
    this.form = form;
    this.hooks = hooks;
    this.bar = parts.bar;
    this.status = parts.status;
    this.items = parts.items;
    this.groups = parts.groups;
    this.back = form.querySelector<HTMLButtonElement>('[data-step-back]');
    this.next = form.querySelector<HTMLButtonElement>('[data-step-next]');
    this.submit = form.querySelector<HTMLButtonElement>('[data-submit]');
    this.review = form.querySelector<HTMLElement>('[data-review]');
  }

  /** Returns a stepper when the form carries the step markup, or null (the form then stays the plain single page). */
  static mount(form: HTMLFormElement, hooks: StepperHooks): ApplyStepper | null {
    const bar = form.querySelector<HTMLElement>('[data-stepper]');
    const status = form.querySelector<HTMLElement>('[data-stepper-status]');
    if (bar === null || status === null) return null;
    const items = [...form.querySelectorAll<HTMLElement>('[data-stepper-item]')];
    const groups = new Map<ApplyStepId, HTMLElement[]>();
    for (const step of APPLY_STEPS) {
      const elements = [...form.querySelectorAll<HTMLElement>(`[data-step="${step.id}"]`)];
      if (elements.length === 0) return null;
      groups.set(step.id, elements);
    }
    if (items.length !== APPLY_STEPS.length) return null;
    const stepper = new ApplyStepper(form, hooks, { bar, status, items, groups });
    stepper.enable();
    return stepper;
  }

  get index(): number {
    return this.current;
  }

  get isFinal(): boolean {
    return this.current === APPLY_STEPS.length - 1;
  }

  private enable(): void {
    // Every control is validated by the script, so native validation cannot block a step that is out of sight.
    this.form.noValidate = true;
    this.form.dataset.stepper = 'on';
    this.bar.hidden = false;
    this.back?.addEventListener('click', () => this.goBack());
    this.next?.addEventListener('click', () => this.goNext());
    this.review?.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const change = target.closest<HTMLElement>('[data-review-change]');
      const id = change?.dataset.reviewChange;
      const index = APPLY_STEPS.findIndex((step) => step.id === id);
      if (index >= 0) {
        this.hooks.clearErrors();
        this.goTo(index, true);
      }
    });
    this.render(false);
  }

  /** Advances after validating the current step. Returns false, with the errors shown, when the step has problems. */
  goNext(): boolean {
    const step = APPLY_STEPS[this.current];
    if (step === undefined || this.isFinal) return false;
    const errors = this.hooks.validateStep(step);
    if (errors.length > 0) {
      this.hooks.showErrors(errors, errors.length === 1 ? 'There is 1 item to fix before you continue.' : `There are ${errors.length} items to fix before you continue.`);
      return false;
    }
    this.hooks.clearErrors();
    this.goTo(this.current + 1, true);
    return true;
  }

  goBack(): void {
    if (this.current === 0) return;
    this.hooks.clearErrors();
    this.goTo(this.current - 1, true);
  }

  /** Shows one step. `moveFocus` sends focus to its heading, which is what a keyboard or screen reader visitor needs after Next or Back. */
  goTo(index: number, moveFocus: boolean): void {
    if (index < 0 || index >= APPLY_STEPS.length) throw new RangeError(`There is no step ${index}.`);
    this.current = index;
    this.render(moveFocus);
  }

  /** Switches to the step that holds an element, so that focusing it does not target something hidden. */
  revealField(element: HTMLElement): void {
    const index = APPLY_STEPS.findIndex((step) => (this.groups.get(step.id) ?? []).some((group) => group.contains(element)));
    if (index >= 0 && index !== this.current) this.goTo(index, false);
  }

  /** After a failed submit: the earliest step with an error becomes the visible one, without moving focus (the error summary takes it). */
  showStepForErrors(errors: readonly FieldError[]): void {
    const index = stepForErrors(errors);
    if (index !== null) this.goTo(index, false);
  }

  private render(moveFocus: boolean): void {
    const visibleId = APPLY_STEPS[this.current]?.id;
    for (const step of APPLY_STEPS) {
      for (const element of this.groups.get(step.id) ?? []) element.hidden = step.id !== visibleId;
    }
    if (visibleId === 'review') this.renderReview();
    this.items.forEach((item, index) => {
      const state = index < this.current ? 'done' : index === this.current ? 'current' : 'todo';
      item.dataset.state = state;
      if (state === 'current') item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      const note = item.querySelector<HTMLElement>('[data-stepper-state]');
      if (note !== null) note.textContent = STATE_TEXT[state];
    });
    this.status.textContent = stepStatus(this.current);
    if (this.back !== null) this.back.hidden = this.current === 0;
    if (this.next !== null) this.next.hidden = this.isFinal;
    if (this.submit !== null) this.submit.hidden = !this.isFinal;
    if (moveFocus) {
      const heading = (this.groups.get(visibleId ?? 'you') ?? [])[0]?.querySelector<HTMLElement>('[data-step-heading]');
      heading?.focus();
    }
  }

  private renderReview(): void {
    if (this.review === null) return;
    const list = this.review.querySelector<HTMLElement>('[data-review-list]');
    if (list === null) return;
    const sections: HTMLElement[] = [];
    for (const group of buildReviewGroups(this.hooks.values())) {
      const section = document.createElement('div');
      section.className = 'review__group';
      const title = document.createElement('h3');
      title.className = 'review__title';
      title.textContent = group.title;
      const change = document.createElement('button');
      change.type = 'button';
      change.className = 'btn btn--quiet review__change';
      change.dataset.reviewChange = group.step;
      change.textContent = `Change ${group.title.toLowerCase()}`;
      const head = document.createElement('div');
      head.className = 'review__head';
      head.append(title, change);
      const dl = document.createElement('dl');
      dl.className = 'review__rows';
      for (const row of group.rows) {
        const wrap = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = row.label;
        const dd = document.createElement('dd');
        dd.textContent = row.value;
        wrap.append(dt, dd);
        dl.append(wrap);
      }
      section.append(head, dl);
      sections.push(section);
    }
    list.replaceChildren(...sections);
  }
}
