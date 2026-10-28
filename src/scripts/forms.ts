/**
 * Intake form client (docs/forms-contract.md). The first half is pure logic that runs under `node --test`: validation,
 * payload building, bot checks, the fetch client and the mailto fallback. The second half mounts the logic onto the
 * server-rendered form markup and touches the DOM only when mountIntakeForms() is called.
 */
import { ApplyStepper } from '../components/apply/stepper.ts';
import type { ApplyStep } from '../components/apply/steps.ts';
import { FIELD_NAMES, FORM_KINDS, LIMITS, MAILTO_KINDS, SITUATIONS, STAGES, TOPICS, composeMessage, contextLines, formSubmitBody, normaliseText, validate } from '../data/forms.ts';
import { isFormSubmit } from '../lib/endpoints.ts';
import type { FieldError, FieldName, FormKind, FormValues, SituationId, Stage, Topic } from '../data/forms.ts';
import { parseTeamFromLocation, describeTeam } from './team-composer.ts';

/**
 * The rules (the required matrix, the limits, the validators) live in src/data/forms.ts, so the intake Function's tests and this
 * client read one table (docs/forms-contract.md section 3.1). They are re-exported here for the callers that import them from the script.
 */
export { LIMITS, STAGES, TOPICS, composeMessage, contextLines, validate };
export type { FieldError, FieldName, FormKind, FormValues, SituationId, Stage, Topic };

/** The JSON body (docs/forms-contract.md section 3.1). The newsletter keeps its own, shorter body and carries none of the v2 keys. */
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
  readonly requestId?: string;
  readonly audience?: string;
  readonly briefId?: string;
  readonly companyUrl?: string;
  readonly partnerCategory?: string;
  readonly offer?: string;
  readonly investorKind?: string;
  readonly focus?: string;
  readonly consentUpdates?: boolean;
}

export const REQUEST_TIMEOUT_MS = 15_000;
/** Below this fill time the first submit is paused once and the visitor is asked to check their answers. */
export const MIN_FILL_MS = 3_000;

/** The query parameter the situation pages link to /apply/ with (SALES.md 6.3). */
export const SITUATION_PARAM = 'situation';

/**
 * Reads the situation from a query string. Unknown, empty and repeated values are ignored, never an error, because a stale or edited link
 * must still open the page. `none` is a choice of the list, not a situation, so a link cannot preselect it.
 */
export function situationFromSearch(search: string): SituationId | null {
  const values = new URLSearchParams(search).getAll(SITUATION_PARAM);
  if (values.length !== 1) return null;
  const raw = (values[0] ?? '').trim().toLowerCase();
  if (raw === 'none') return null;
  return SITUATIONS.find((situation) => situation.value === raw)?.value ?? null;
}

/**
 * A fresh idempotency key (docs/forms-contract.md section 3.1). `crypto.randomUUID()` where the browser has it; the same v4 shape from
 * `getRandomValues` otherwise. Never derived from the visitor's answers, so it reveals nothing.
 */
export function newRequestId(source: Pick<Crypto, 'randomUUID' | 'getRandomValues'> = globalThis.crypto): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Builds the JSON body defined in docs/forms-contract.md section 3.1. A field the kind does not use is an empty string. The newsletter
 * keeps its own contract: it carries none of the v2 keys.
 */
export function buildPayload(
  kind: FormKind,
  values: FormValues,
  timing: { readonly startedAt: number; readonly submittedAt: number },
  page: string,
): IntakePayload {
  const base = {
    form: kind,
    name: normaliseText(values.name),
    email: values.email.trim(),
    company: normaliseText(values.company),
    stage: kind === 'apply' || kind === 'brief-request' ? values.stage : '',
    seats: kind === 'apply' ? normaliseText(values.seats) : '',
    topic: kind === 'contact' ? values.topic : '',
    message: kind === 'apply' ? composeMessage(values.message, values) : kind === 'brief-request' ? '' : normaliseText(values.message),
    consent: values.consent,
    website: values.website,
    startedAt: new Date(timing.startedAt).toISOString(),
    submittedAt: new Date(timing.submittedAt).toISOString(),
    page,
  };
  if (kind === 'newsletter') return base;
  const text = (value: string | undefined): string => normaliseText(value ?? '');
  return {
    ...base,
    requestId: text(values.requestId),
    audience: text(values.audience),
    briefId: kind === 'brief-request' ? text(values.briefId) : '',
    companyUrl: kind === 'investor-interest' || kind === 'partner-enquiry' ? text(values.companyUrl) : '',
    partnerCategory: kind === 'partner-enquiry' ? text(values.partnerCategory) : '',
    offer: kind === 'partner-enquiry' ? text(values.offer) : '',
    investorKind: kind === 'investor-interest' ? text(values.investorKind) : '',
    focus: kind === 'investor-interest' ? text(values.focus) : '',
    consentUpdates: kind === 'brief-request' && values.consentUpdates === true,
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
  /** Whole seconds from a 429 answer's `Retry-After` header, or null when it sent none or one that is not a number of seconds. */
  readonly retryAfterSeconds: number | null;

  constructor(
    failure: SubmitFailure,
    message: string,
    options: { status?: number; fieldErrors?: readonly FieldError[]; retryAfterSeconds?: number | null; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SubmitError';
    this.failure = failure;
    this.status = options.status ?? null;
    this.fieldErrors = options.fieldErrors ?? [];
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

/** Reads `Retry-After` as delta-seconds. An HTTP date or any other value is ignored: the message then gives no figure. */
export function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\d{1,6}$/.test(value.trim())) return null;
  return Number.parseInt(value.trim(), 10);
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

/**
 * FormSubmit answers a fetch with `{ "success": "true", "message": "..." }`, the flag as a string, and a refusal (a form that is not
 * yet activated, a blocked sender) with `"success": "false"` and the same 200 status. Only an explicit true counts as sent: a page that
 * is not JSON (a captcha or an error page) must never read as success.
 */
export function relaySucceeded(body: unknown): boolean {
  return isRecord(body) && (body.success === true || body.success === 'true');
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
  // The FormSubmit relay (RELEASE.md section 5) takes its own body and answers { success: "true" | "false", message } with a 200 either way.
  const relay = isFormSubmit(target.href);

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
        body: JSON.stringify(relay ? formSubmitBody(payload, payload.form) : payload),
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
      if (relay && !relaySucceeded(body)) {
        throw new SubmitError('server', 'The relay did not accept the submission.', { status: response.status });
      }
      if (isRecord(body) && body.ok === false) {
        throw new SubmitError('rejected', 'The server did not accept the submission.', { status: response.status, fieldErrors: parseFieldErrors(body) });
      }
      return;
    }
    if (response.status === 429) {
      throw new SubmitError('rate-limited', 'Too many requests.', { status: 429, retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')) });
    }
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

/** "Wait N minutes and try again", rounded up to whole minutes from the server's `Retry-After`; a general instruction when it gave none. */
function waitAdvice(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null || retryAfterSeconds <= 0) return 'Wait a few minutes and try again.';
  if (retryAfterSeconds < 60) return 'Wait a minute and try again.';
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Wait ${minutes} minutes and try again.`;
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
      return `Too many messages were sent from this connection. ${waitAdvice(error.retryAfterSeconds)}${hasFallback ? ' You can also send your answers by email.' : ''}`;
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
  if (payload.form !== 'apply' && payload.form !== 'contact') {
    throw new RangeError(`The ${payload.form} form has no mailto fallback: only ${MAILTO_KINDS.join(' and ')} do (docs/forms-contract.md section 4).`);
  }
  const subject = payload.form === 'apply' ? `Application from ${payload.name}` : `Message from ${payload.name}`;
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

/** A control by its form field name, or by `data-field` for one that has no name (a context question, which the browser must not post). */
function control(form: HTMLFormElement, name: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const el = form.elements.namedItem(name) ?? form.querySelector(`[data-field="${CSS.escape(name)}"]`);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el : null;
}

function readValues(form: HTMLFormElement): FormValues {
  const text = (name: string): string => control(form, name)?.value ?? '';
  const consent = control(form, 'consent');
  const consentUpdates = control(form, 'consentUpdates');
  return {
    name: text('name'),
    email: text('email'),
    company: text('company'),
    stage: text('stage'),
    seats: text('seats'),
    topic: text('topic'),
    message: text('message'),
    consent: consent instanceof HTMLInputElement && consent.checked,
    // The honeypot is `website` on the JSON contract and `_honey` on a FormSubmit form, which only knows that name.
    website: text('website') || text('_honey'),
    situation: text('situation'),
    startedMonth: text('startedMonth'),
    industryYears: text('industryYears'),
    teamFunding: text('teamFunding'),
    horizon: text('horizon'),
    source: text('source'),
    requestId: text('requestId'),
    audience: text('audience'),
    briefId: text('briefId'),
    companyUrl: text('companyUrl'),
    partnerCategory: text('partnerCategory'),
    offer: text('offer'),
    investorKind: text('investorKind'),
    focus: text('focus'),
    consentUpdates: consentUpdates instanceof HTMLInputElement && consentUpdates.checked,
  };
}

/** The kind a form declares in `data-kind`. An unknown value is a markup error, so it falls back to the safest kind rather than posting anything. */
function kindOf(value: string | undefined): FormKind {
  return (FORM_KINDS as readonly string[]).includes(value ?? '') ? (value as FormKind) : 'contact';
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
  /** One idempotency key per submission attempt: kept across retries of a failed send, replaced after a success (contracts section 3.1). */
  private requestId = newRequestId();

  constructor(form: HTMLFormElement) {
    this.form = form;
    this.kind = kindOf(form.dataset.kind);
    this.mode = form.dataset.mode === 'mailto' && !(MAILTO_KINDS as readonly string[]).includes(this.kind) ? 'disabled' : (form.dataset.mode ?? 'disabled');
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

  /** The answers as the validators and the payload see them: the form's controls plus the script-held request id. */
  private values(): FormValues {
    return { ...readValues(this.form), requestId: this.requestId };
  }

  private mountStepper(): void {
    this.stepper = ApplyStepper.mount(this.form, {
      validateStep: (step) => this.errorsForStep(step),
      showErrors: (errors, intro) => this.showErrors(errors, intro),
      clearErrors: () => this.clearErrors(),
      values: () => this.values(),
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
    this.form.addEventListener('change', (event) => this.clearFieldError(event.target));
  }

  /** The validation errors of one step: validate() runs on every answer and the result is filtered to the step's own fields. */
  private errorsForStep(step: ApplyStep): FieldError[] {
    return validate(this.kind, this.values()).filter((error) => step.fields.includes(error.field));
  }

  private prefill(): void {
    if (this.kind === 'contact') {
      const topic = topicFromSearch(window.location.search);
      const select = control(this.form, 'topic');
      if (topic !== null && select instanceof HTMLSelectElement && select.value === '') select.value = topic;
      return;
    }
    if (this.kind !== 'apply') return;
    this.prefillSituation();
    const team = parseTeamFromLocation(window.location.hash, window.location.search);
    const text = describeTeam(team);
    const seats = control(this.form, 'seats');
    if (text !== '' && seats !== null && seats.value.trim() === '') seats.value = text;
  }

  /**
   * The context questions are script-only, so they are revealed here and a visitor without JavaScript never sees them. `?situation=`
   * preselects the situation and shows the heading written for it (SALES.md 6.3); every other heading stays hidden.
   */
  private prefillSituation(): void {
    for (const wrap of this.form.querySelectorAll<HTMLElement>('[data-context-field]')) wrap.hidden = false;
    const chosen = situationFromSearch(window.location.search);
    if (chosen === null) return;
    const select = control(this.form, 'situation');
    if (select instanceof HTMLSelectElement && select.value === '') select.value = chosen;
    const heading = this.form.querySelector<HTMLElement>(`[data-situation-heading="${CSS.escape(chosen)}"]`);
    if (heading !== null) heading.hidden = false;
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
    return buildPayload(this.kind, this.values(), { startedAt: this.startedAt, submittedAt: Date.now() }, window.location.pathname);
  }

  private async handleSubmit(): Promise<void> {
    if (this.submitting) return;
    const values = this.values();
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
    // The next submission is a new request, whether or not the page is left.
    this.requestId = newRequestId();
    if (this.thanks !== '') {
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
