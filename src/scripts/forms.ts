/**
 * Intake form client (docs/forms-contract.md). The first half is pure logic that runs under `node --test`: validation,
 * payload building, bot checks, the fetch client and the mailto fallback. The second half mounts the logic onto the
 * server-rendered form markup and touches the DOM only when mountIntakeForms() is called.
 */
import { PACKAGE_NOT_SURE, PACKAGE_PARAM, getPackage, isPackageId, parsePackageParam } from '../data/packages.ts';
import { ApplyStepper } from '../components/apply/stepper.ts';
import type { ApplyStep } from '../components/apply/steps.ts';
import { parseTeamFromLocation, describeTeam } from './team-composer.ts';

export type FormKind = 'apply' | 'contact' | 'newsletter';

export const STAGES = ['idea', 'validating', 'building', 'launched'] as const;
export type Stage = (typeof STAGES)[number];

export const TOPICS = ['general', 'seat-rate', 'press', 'correction', 'information'] as const;
export type Topic = (typeof TOPICS)[number];

export const LIMITS = {
  name: 120,
  email: 254,
  company: 120,
  seats: 500,
  message: 4000,
} as const;

/** Fields that can carry an error message. */
export type FieldName = 'name' | 'email' | 'company' | 'stage' | 'seats' | 'package' | 'topic' | 'message' | 'consent';

const FIELD_NAMES: readonly FieldName[] = ['name', 'email', 'company', 'stage', 'seats', 'package', 'topic', 'message', 'consent'];

/** Raw values as read from the form controls. */
export interface FormValues {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly stage: string;
  readonly seats: string;
  readonly topic: string;
  readonly message: string;
  readonly consent: boolean;
  /** Honeypot. Must stay empty. */
  readonly website: string;
  /**
   * Apply only. A package id, `not-sure` or empty. It is never a key of the payload: the intake schema is closed
   * (docs/forms-contract.md section 3), so buildPayload carries it as one line of `message`.
   */
  readonly package?: string;
}

export interface FieldError {
  readonly field: FieldName;
  readonly message: string;
}

export interface IntakePayload {
  readonly form: FormKind;
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly stage: string;
  readonly seats: string;
  readonly topic: string;
  readonly message: string;
  readonly consent: boolean;
  readonly website: string;
  readonly startedAt: string;
  readonly submittedAt: string;
  readonly page: string;
}

export const REQUEST_TIMEOUT_MS = 15_000;
/** Below this fill time the first submit is paused once and the visitor is asked to check their answers. */
export const MIN_FILL_MS = 3_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The line of `message` that carries the package choice, or '' when none was made (docs/forms-contract.md section 3). */
export function packageNote(value: string | undefined): string {
  if (value === undefined || value === '') return '';
  if (value === PACKAGE_NOT_SURE) return 'Package interest: not sure yet';
  return isPackageId(value) ? `Package interest: ${getPackage(value).name}` : '';
}

/** The message as sent: the visitor's text, then the package line after a blank line. */
export function composeMessage(message: string, packageValue: string | undefined): string {
  const text = normaliseText(message);
  const note = packageNote(packageValue);
  if (note === '') return text;
  return text === '' ? note : `${text}\n\n${note}`;
}

/**
 * Reads the package from a query string. Unknown, empty and repeated values are ignored, never an error, because a stale link must
 * still open the page (docs/wave7-contracts.md section 1). `not-sure` is accepted here too, so a link can say so.
 */
export function packageFromSearch(search: string): string | null {
  const values = new URLSearchParams(search).getAll(PACKAGE_PARAM);
  if (values.length !== 1) return null;
  const raw = (values[0] ?? '').trim().toLowerCase();
  if (raw === PACKAGE_NOT_SURE) return PACKAGE_NOT_SURE;
  return parsePackageParam(raw);
}

function tooLong(label: string, limit: number): string {
  return `${label} is too long. Shorten it to ${limit} characters or fewer.`;
}

/** Validates the values for one form. Messages say what to do, not only what is wrong (WCAG 3.3.1, 3.3.3). */
export function validate(kind: FormKind, values: FormValues): FieldError[] {
  const errors: FieldError[] = [];
  const name = values.name.trim();
  const email = values.email.trim();

  if (name === '' && kind !== 'newsletter') errors.push({ field: 'name', message: 'Enter your name.' });
  else if (name.length > LIMITS.name) errors.push({ field: 'name', message: tooLong('Your name', LIMITS.name) });

  if (email === '') errors.push({ field: 'email', message: 'Enter your email address so WE can reply.' });
  else if (!EMAIL_PATTERN.test(email) || email.length > LIMITS.email) {
    errors.push({ field: 'email', message: 'Enter an email address in the form name@example.org.' });
  }

  if (values.company.trim().length > LIMITS.company) errors.push({ field: 'company', message: tooLong('The company name', LIMITS.company) });

  if (kind === 'apply') {
    if (!(STAGES as readonly string[]).includes(values.stage)) {
      errors.push({ field: 'stage', message: 'Choose the stage that is closest to where your idea is today.' });
    }
    if (values.seats.trim().length > LIMITS.seats) errors.push({ field: 'seats', message: tooLong('The team description', LIMITS.seats) });
    const choice = values.package ?? '';
    if (choice !== '' && choice !== PACKAGE_NOT_SURE && !isPackageId(choice)) {
      errors.push({ field: 'package', message: 'Choose one of the packages in the list, or choose Not sure yet.' });
    }
  } else if (kind === 'contact') {
    if (!(TOPICS as readonly string[]).includes(values.topic)) {
      errors.push({ field: 'topic', message: 'Choose what your message is about.' });
    }
    if (values.message.trim() === '') errors.push({ field: 'message', message: 'Write a short message so WE knows how to help.' });
  }
  const sent = kind === 'apply' ? composeMessage(values.message, values.package) : values.message.trim();
  if (sent.length > LIMITS.message) errors.push({ field: 'message', message: tooLong('Your message', LIMITS.message) });

  if (!values.consent) errors.push({ field: 'consent', message: 'Tick the box to confirm that WE may use these details to reply to you.' });
  return errors;
}

function normaliseText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

/** Builds the JSON body defined in docs/forms-contract.md section 3. Form-specific fields are blank on the other form. */
export function buildPayload(
  kind: FormKind,
  values: FormValues,
  timing: { readonly startedAt: number; readonly submittedAt: number },
  page: string,
): IntakePayload {
  return {
    form: kind,
    name: normaliseText(values.name),
    email: values.email.trim(),
    company: normaliseText(values.company),
    stage: kind === 'apply' ? values.stage : '',
    seats: kind === 'apply' ? normaliseText(values.seats) : '',
    topic: kind === 'contact' ? values.topic : '',
    message: kind === 'apply' ? composeMessage(values.message, values.package) : normaliseText(values.message),
    consent: values.consent,
    website: values.website,
    startedAt: new Date(timing.startedAt).toISOString(),
    submittedAt: new Date(timing.submittedAt).toISOString(),
    page,
  };
}

export type BotVerdict = 'ok' | 'honeypot' | 'too-fast';

/**
 * Honeypot filled: treat as automation and drop silently. Filled in under MIN_FILL_MS: ask once, because autofill
 * and password managers can legitimately complete a form quickly. `alreadyWarned` lets the second attempt through.
 */
export function checkBot(values: Pick<FormValues, 'website'>, elapsedMs: number, alreadyWarned: boolean): BotVerdict {
  if (values.website.trim() !== '') return 'honeypot';
  if (!alreadyWarned && elapsedMs < MIN_FILL_MS) return 'too-fast';
  return 'ok';
}

export type SubmitFailure = 'timeout' | 'network' | 'aborted' | 'rejected' | 'rate-limited' | 'server' | 'invalid-config';

/** Failure from the intake client. `fieldErrors` is set only for a 400 or 422 answer that names fields. */
export class SubmitError extends Error {
  readonly failure: SubmitFailure;
  readonly status: number | null;
  readonly fieldErrors: readonly FieldError[];

  constructor(failure: SubmitFailure, message: string, options: { status?: number; fieldErrors?: readonly FieldError[]; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SubmitError';
    this.failure = failure;
    this.status = options.status ?? null;
    this.fieldErrors = options.fieldErrors ?? [];
  }
}

export interface SubmitOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (text.trim() === '') return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Extracts `{ errors: { field: message } }` from a rejection body. Keys that are not form fields are ignored. */
export function parseFieldErrors(body: unknown): FieldError[] {
  if (!isRecord(body) || !isRecord(body.errors)) return [];
  const found: FieldError[] = [];
  for (const [key, value] of Object.entries(body.errors)) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const field = (FIELD_NAMES as readonly string[]).includes(key) ? (key as FieldName) : null;
    if (field !== null) found.push({ field, message: value.trim().slice(0, 300) });
  }
  return found;
}

/**
 * Posts the payload as JSON. Resolves on any 2xx. Rejects with a SubmitError whose `failure` says what happened, so the
 * caller can show a specific message. Never throws anything else.
 */
export async function submitIntake(endpoint: string, payload: IntakePayload, options: SubmitOptions = {}): Promise<void> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, signal, fetchImpl = fetch } = options;
  let target: URL;
  try {
    target = new URL(endpoint);
  } catch (cause) {
    throw new SubmitError('invalid-config', 'The form endpoint is not a valid URL.', { cause });
  }
  if (target.protocol !== 'https:') throw new SubmitError('invalid-config', 'The form endpoint must use https.');

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = (): void => controller.abort();
  if (signal !== undefined) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    let response: Response;
    try {
      response = await fetchImpl(target.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        mode: 'cors',
        signal: controller.signal,
      });
    } catch (cause) {
      if (timedOut) throw new SubmitError('timeout', `The request took longer than ${Math.round(timeoutMs / 1000)} seconds.`, { cause });
      if (controller.signal.aborted) throw new SubmitError('aborted', 'The request was cancelled.', { cause });
      throw new SubmitError('network', 'The request could not reach the server.', { cause });
    }

    if (response.ok) {
      const body = await readJson(response);
      if (isRecord(body) && body.ok === false) {
        throw new SubmitError('rejected', 'The server did not accept the submission.', { status: response.status, fieldErrors: parseFieldErrors(body) });
      }
      return;
    }
    if (response.status === 429) throw new SubmitError('rate-limited', 'Too many requests.', { status: 429 });
    if (response.status === 400 || response.status === 422) {
      const body = await readJson(response);
      throw new SubmitError('rejected', 'The server did not accept the submission.', { status: response.status, fieldErrors: parseFieldErrors(body) });
    }
    throw new SubmitError('server', `The server answered with status ${response.status}.`, { status: response.status });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Plain-language message for a failed submission. */
export function failureMessage(error: SubmitError, hasFallback: boolean): string {
  const retry = hasFallback ? ' Your answers are still here. You can try again or send them by email instead.' : ' Your answers are still here. Please try again in a few minutes.';
  switch (error.failure) {
    case 'timeout':
      return `The form took too long to send.${retry}`;
    case 'network':
      return `The form could not be sent. Check your connection.${retry}`;
    case 'rate-limited':
      return `Too many messages were sent from this connection. Wait a few minutes and try again.${hasFallback ? ' You can also send your answers by email.' : ''}`;
    case 'rejected':
      return 'The form could not be accepted. Check your answers and send it again.';
    case 'aborted':
      return `Sending was cancelled.${retry}`;
    case 'invalid-config':
    case 'server':
      return `Something went wrong on our side.${retry}`;
  }
}

/** Builds a mailto: link carrying the answers, for the fallback mode and the offered fallback. */
export function buildMailto(address: string, payload: IntakePayload): string {
  const subject = payload.form === 'apply' ? `Application from ${payload.name}` : `Message from ${payload.name}`;
  if (payload.form === 'newsletter') throw new RangeError('The newsletter form has no mailto fallback.');
  const lines: string[] = [`Name: ${payload.name}`, `Email: ${payload.email}`];
  if (payload.company !== '') lines.push(`Company: ${payload.company}`);
  if (payload.form === 'apply') {
    lines.push(`Stage: ${payload.stage}`);
    if (payload.seats !== '') lines.push(`Team: ${payload.seats}`);
  } else {
    lines.push(`Topic: ${payload.topic}`);
  }
  if (payload.message !== '') lines.push('', payload.message);
  const body = lines.join('\n');
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Selects a contact topic from `?topic=`. Unknown values are ignored. */
export function topicFromSearch(search: string): Topic | null {
  const value = new URLSearchParams(search).get('topic');
  return value !== null && (TOPICS as readonly string[]).includes(value) ? (value as Topic) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// DOM mount. Nothing below runs at import time.
// ---------------------------------------------------------------------------------------------------------------

/** A control by its form field name, or by `data-field` for one that has no name (the package choice, which the browser must not post). */
function control(form: HTMLFormElement, name: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const el = form.elements.namedItem(name) ?? form.querySelector(`[data-field="${CSS.escape(name)}"]`);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el : null;
}

function readValues(form: HTMLFormElement): FormValues {
  const text = (name: string): string => control(form, name)?.value ?? '';
  const consent = control(form, 'consent');
  return {
    name: text('name'),
    email: text('email'),
    company: text('company'),
    stage: text('stage'),
    seats: text('seats'),
    topic: text('topic'),
    message: text('message'),
    consent: consent instanceof HTMLInputElement && consent.checked,
    website: text('website'),
    package: text('package'),
  };
}

class IntakeFormController {
  private readonly form: HTMLFormElement;
  private readonly kind: FormKind;
  private readonly mode: string;
  private readonly endpoint: string;
  private readonly mailto: string;
  private readonly thanks: string;
  private readonly summary: HTMLElement | null;
  private readonly status: HTMLElement | null;
  private readonly fallback: HTMLAnchorElement | null;
  private readonly submit: HTMLButtonElement | null;
  private startedAt = Date.now();
  private warnedFast = false;
  private submitting = false;
  private stepper: ApplyStepper | null = null;

  constructor(form: HTMLFormElement) {
    this.form = form;
    this.kind = form.dataset.kind === 'contact' || form.dataset.kind === 'newsletter' ? form.dataset.kind : 'apply';
    this.mode = form.dataset.mode ?? 'disabled';
    this.endpoint = form.dataset.endpoint ?? '';
    this.mailto = form.dataset.mailto ?? '';
    this.thanks = form.dataset.thanks ?? '';
    this.summary = form.querySelector<HTMLElement>('[data-error-summary]');
    this.status = form.querySelector<HTMLElement>('[data-status]');
    this.fallback = form.querySelector<HTMLAnchorElement>('[data-fallback]');
    this.submit = form.querySelector<HTMLButtonElement>('[data-submit]');
  }

  init(): void {
    if (this.kind === 'apply') {
      this.mountStepper();
      if (this.stepper !== null) this.attachEnterAsNext();
    }
    if (this.mode === 'disabled') {
      // Nothing can be sent. The stepper still works, so a visitor can walk the whole form; the button stays off (planForm).
      if (this.stepper !== null) this.attachStepperBehaviour();
      return;
    }
    this.form.noValidate = true;
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      // Enter in a field of an earlier step means Next, never a send.
      if (this.stepper !== null && !this.stepper.isFinal) {
        this.stepper.goNext();
        return;
      }
      void this.handleSubmit();
    });
    this.attachInputBehaviour();
    this.prefill();
    // The server renders the button disabled unless the browser could post the form natively (planForm in src/data/forms.ts),
    // so a visitor without JavaScript can never submit it as a GET query string. The handlers above are now attached.
    this.submit?.removeAttribute('disabled');
  }

  private mountStepper(): void {
    this.stepper = ApplyStepper.mount(this.form, {
      validateStep: (step) => this.errorsForStep(step),
      showErrors: (errors, intro) => this.showErrors(errors, intro),
      clearErrors: () => this.clearErrors(),
      values: () => readValues(this.form),
    });
  }

  /**
   * Enter in a text field of an earlier step means Next. The browser's own implicit submission cannot be relied on for this: it does
   * nothing while the submit button is disabled (mode `disabled`), and it would send the form from a step the visitor has not finished.
   */
  private attachEnterAsNext(): void {
    this.form.addEventListener('keydown', (event) => {
      const stepper = this.stepper;
      const target = event.target;
      if (stepper === null || stepper.isFinal || event.key !== 'Enter' || event.isComposing || event.defaultPrevented) return;
      if (!(target instanceof HTMLInputElement) || (target.type !== 'text' && target.type !== 'email')) return;
      event.preventDefault();
      stepper.goNext();
    });
  }

  private attachStepperBehaviour(): void {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.stepper !== null && !this.stepper.isFinal) this.stepper.goNext();
    });
    this.attachInputBehaviour();
    this.prefill();
  }

  private attachInputBehaviour(): void {
    this.form.addEventListener('input', (event) => this.clearFieldError(event.target));
    this.form.addEventListener('change', (event) => {
      this.clearFieldError(event.target);
      if (event.target instanceof HTMLSelectElement && event.target.dataset.field === 'package') this.showPackageFit(event.target);
    });
  }

  /** The validation errors of one step: validate() runs on every answer and the result is filtered to the step's own fields. */
  private errorsForStep(step: ApplyStep): FieldError[] {
    return validate(this.kind, readValues(this.form)).filter((error) => step.fields.includes(error.field));
  }

  /** Under the package select: the stage each package is sized for, from src/data/packages.ts through the option's data attribute. */
  private showPackageFit(select: HTMLSelectElement): void {
    const note = this.form.querySelector<HTMLElement>('[data-package-fit]');
    if (note === null) return;
    const option = select.selectedOptions[0];
    const fit = option?.dataset.stageFit ?? '';
    note.textContent = fit === '' ? '' : `${option?.textContent ?? ''} is sized for: ${fit}`;
  }

  private prefill(): void {
    if (this.kind === 'contact') {
      const topic = topicFromSearch(window.location.search);
      const select = control(this.form, 'topic');
      if (topic !== null && select instanceof HTMLSelectElement && select.value === '') select.value = topic;
      return;
    }
    if (this.kind === 'newsletter') return;
    this.prefillPackage();
    const team = parseTeamFromLocation(window.location.hash, window.location.search);
    const text = describeTeam(team);
    const seats = control(this.form, 'seats');
    if (text !== '' && seats !== null && seats.value.trim() === '') seats.value = text;
  }

  /** `?package=` selects a package. The field is script-only, so it is revealed here and a no-JavaScript visitor never sees it. */
  private prefillPackage(): void {
    const field = this.form.querySelector<HTMLElement>('[data-package-field]');
    const select = control(this.form, 'package');
    if (field === null || !(select instanceof HTMLSelectElement)) return;
    field.hidden = false;
    const chosen = packageFromSearch(window.location.search);
    if (chosen !== null && select.value === '') {
      select.value = chosen;
      this.showPackageFit(select);
    }
  }

  private setStatus(message: string): void {
    if (this.status !== null) this.status.textContent = message;
  }

  private setBusy(busy: boolean): void {
    this.submitting = busy;
    this.form.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (this.submit !== null) this.submit.setAttribute('aria-disabled', busy ? 'true' : 'false');
  }

  private clearFieldError(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement) || target.id === '') return;
    const message = this.form.querySelector<HTMLElement>(`#${CSS.escape(target.id)}-error`);
    if (message !== null && !message.hidden) {
      message.hidden = true;
      message.textContent = '';
      target.removeAttribute('aria-invalid');
    }
  }

  private clearErrors(): void {
    this.form.querySelectorAll<HTMLElement>('.field__error').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
    this.form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    if (this.summary !== null) {
      this.summary.hidden = true;
      this.summary.querySelector('ul')?.replaceChildren();
    }
    if (this.fallback !== null) this.fallback.hidden = true;
  }

  private showErrors(errors: readonly FieldError[], intro: string): void {
    this.clearErrors();
    this.stepper?.showStepForErrors(errors);
    const list = this.summary?.querySelector('ul');
    for (const error of errors) {
      const el = control(this.form, error.field);
      if (el !== null && el.id !== '') {
        const message = this.form.querySelector<HTMLElement>(`#${CSS.escape(el.id)}-error`);
        if (message !== null) {
          message.textContent = error.message;
          message.hidden = false;
        }
        el.setAttribute('aria-invalid', 'true');
      }
      if (list) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = el !== null && el.id !== '' ? `#${el.id}` : '#';
        link.textContent = error.message;
        link.addEventListener('click', (event) => {
          if (el === null) return;
          event.preventDefault();
          // The field may sit on a step that is out of sight; a hidden control cannot take focus.
          this.stepper?.revealField(el);
          el.focus();
        });
        item.append(link);
        list.append(item);
      }
    }
    const lead = this.summary?.querySelector<HTMLElement>('[data-error-intro]');
    if (lead) lead.textContent = intro;
    if (this.summary !== null) {
      this.summary.hidden = false;
      this.summary.focus();
    }
  }

  private showFailure(error: SubmitError): void {
    const hasFallback = this.mailto !== '';
    const message = failureMessage(error, hasFallback);
    if (error.failure === 'rejected' && error.fieldErrors.length > 0) {
      this.setStatus('');
      this.showErrors(error.fieldErrors, 'The form could not be accepted. Fix the items listed below and send it again.');
      return;
    }
    this.clearErrors();
    const list = this.summary?.querySelector('ul');
    list?.replaceChildren();
    const lead = this.summary?.querySelector<HTMLElement>('[data-error-intro]');
    if (lead) lead.textContent = message;
    if (this.summary !== null) {
      this.summary.hidden = false;
      this.summary.focus();
    }
    if (hasFallback && this.fallback !== null) {
      const payload = this.currentPayload();
      this.fallback.href = buildMailto(this.mailto, payload);
      this.fallback.hidden = false;
    }
    this.setStatus('');
  }

  private currentPayload(): IntakePayload {
    return buildPayload(this.kind, readValues(this.form), { startedAt: this.startedAt, submittedAt: Date.now() }, window.location.pathname);
  }

  private async handleSubmit(): Promise<void> {
    if (this.submitting) return;
    const values = readValues(this.form);
    const errors = validate(this.kind, values);
    if (errors.length > 0) {
      this.setStatus('');
      this.showErrors(errors, errors.length === 1 ? 'There is 1 item to fix before WE can send this.' : `There are ${errors.length} items to fix before WE can send this.`);
      return;
    }
    const verdict = checkBot(values, Date.now() - this.startedAt, this.warnedFast);
    if (verdict === 'honeypot') {
      this.finishSuccess();
      return;
    }
    if (verdict === 'too-fast') {
      this.warnedFast = true;
      this.clearErrors();
      this.setStatus('That was quick. Read your answers once more, then press send again.');
      return;
    }
    this.clearErrors();
    const payload = this.currentPayload();

    if (this.mode === 'mailto') {
      this.setStatus('Opening your email program with your answers.');
      window.location.href = buildMailto(this.mailto, payload);
      return;
    }

    this.setBusy(true);
    this.setStatus('Sending.');
    try {
      await submitIntake(this.endpoint, payload);
      this.finishSuccess();
    } catch (error) {
      const failure = error instanceof SubmitError ? error : new SubmitError('network', 'Unexpected failure.', { cause: error });
      this.showFailure(failure);
    } finally {
      this.setBusy(false);
    }
  }

  private finishSuccess(): void {
    if (this.kind === 'apply' && this.thanks !== '') {
      window.location.assign(this.thanks);
      return;
    }
    this.form.reset();
    this.startedAt = Date.now();
    this.warnedFast = false;
    this.setStatus(this.kind === 'newsletter' ? 'Thank you. WE has received your request to subscribe.' : 'Thank you. Your message has been sent to WE.');
    this.status?.focus();
  }
}

/** Mounts every server-rendered intake form on the page. Safe to call more than once. */
export function mountIntakeForms(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>('form[data-intake-form]').forEach((form) => {
    if (form.dataset.mounted === 'true') return;
    form.dataset.mounted = 'true';
    new IntakeFormController(form).init();
  });
}
