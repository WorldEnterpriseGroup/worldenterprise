import { readEnv, readFlag } from '../lib/env.ts';
import { INTAKE_ENDPOINT_VAR, NEWSLETTER_ENDPOINT_VAR, parseEndpoint, resolveEndpoint } from '../lib/endpoints.ts';
import { AUDIENCES, BRIEFS } from './families.ts';
import type { Audience } from './families.ts';
import { PACKAGE_NOT_SURE, getPackage, isPackageId } from './packages.ts';
import { site } from './site.ts';

/** Kept here for the callers that import it from the forms module. The parser itself lives in src/lib/endpoints.ts. */
export { parseEndpoint };

/**
 * Forms contract (docs/forms-contract.md, authored by WP-03). A form posts JSON to an endpoint, falls back to a
 * mailto link only when the mailbox is confirmed, and is otherwise disabled. Production builds (PUBLIC_RELEASE=1)
 * fail if a launched form route is disabled.
 */
export type FormMode = 'endpoint' | 'mailto' | 'disabled';

interface Mailbox {
  readonly address: string;
  readonly confirmed: boolean;
}

export interface FormConfig {
  readonly id: 'intake' | 'newsletter';
  readonly mode: FormMode;
  readonly endpoint: string | null;
  readonly mailto: string | null;
}

function resolveForm(id: FormConfig['id'], endpointVar: string, mailbox: Mailbox | null): FormConfig {
  // Throws on a set value that is not an absolute https URL, exactly as astro.config.mjs does for the Content Security Policy.
  const endpoint = resolveEndpoint(endpointVar, readEnv(endpointVar));
  if (endpoint !== null) return { id, mode: 'endpoint', endpoint, mailto: null };
  if (mailbox !== null && mailbox.confirmed) return { id, mode: 'mailto', endpoint: null, mailto: mailbox.address };
  return { id, mode: 'disabled', endpoint: null, mailto: null };
}

export const forms = {
  intake: resolveForm('intake', INTAKE_ENDPOINT_VAR, site.mailboxes.apply),
  /** Newsletter has no mailto fallback: it is hidden unless an endpoint is configured. */
  newsletter: resolveForm('newsletter', NEWSLETTER_ENDPOINT_VAR, null),
} as const;

/**
 * True when the intake endpoint cannot take a native form-encoded post (docs/forms-contract.md section 8). The form
 * then states that JavaScript is required instead of offering a no-JavaScript submit.
 */
export const intakeRequiresJs: boolean = readFlag('PUBLIC_WE_INTAKE_REQUIRES_JS');

/** The six kinds the intake endpoint and the newsletter endpoint accept (docs/forms-contract.md section 3). */
export const FORM_KINDS = ['apply', 'contact', 'newsletter', 'brief-request', 'investor-interest', 'partner-enquiry'] as const;
export type FormKind = (typeof FORM_KINDS)[number];
export type FormPage = FormKind;

/** The only kinds that may fall back to a mail client. A brief request, an investor interest and a partner enquiry have no mailbox. */
export const MAILTO_KINDS: readonly FormKind[] = ['apply', 'contact'];

/** What a form shows and permits before any JavaScript has run (docs/forms-contract.md section 8). */
export interface FormPlan {
  /** Effective mode: a mailto form without a confirmed mailbox is disabled. */
  readonly mode: FormMode;
  readonly mailbox: string | null;
  /** Endpoint a no-JavaScript submit posts to, or null when a no-JavaScript submit must not be possible. */
  readonly nativePost: string | null;
  /** The submit button ships `disabled` and only the client script removes it. True whenever `nativePost` is null. */
  readonly submitDisabledInMarkup: boolean;
  /** The client script removes `disabled` when it mounts. False only for a form that is not connected at all. */
  readonly scriptEnablesSubmit: boolean;
  /** Note shown to visitors who run without JavaScript. */
  readonly noscript: 'none' | 'needs-js' | 'mailto-no-prefill';
}

/**
 * Decides, for one form, how it behaves without JavaScript. The rule: a form is only ever submittable before JavaScript
 * mounts when the browser can POST it form-encoded to a confirmed endpoint. In every other state the submit button is
 * disabled in the markup, so no visitor can send their name, email and message as a GET query string (PII in the URL,
 * browser history and server logs). The element is also always `method="post"`, so a submit that slips past the disabled
 * button still never builds a query string.
 */
export function planForm(kind: FormPage, config: FormConfig, mailbox: string | null, requiresJs: boolean): FormPlan {
  const mailtoAllowed = MAILTO_KINDS.includes(kind) && mailbox !== null;
  const mode: FormMode = config.mode === 'mailto' && !mailtoAllowed ? 'disabled' : config.mode;
  const nativePost = kind !== 'newsletter' && mode === 'endpoint' && !requiresJs ? config.endpoint : null;
  let noscript: FormPlan['noscript'] = 'none';
  if (mode === 'mailto') noscript = 'mailto-no-prefill';
  else if (mode === 'endpoint' && nativePost === null) noscript = 'needs-js';
  return { mode, mailbox, nativePost, submitDisabledInMarkup: nativePost === null, scriptEnablesSubmit: mode !== 'disabled', noscript };
}

/** Mailbox that a form may expose as a mailto fallback, or null until the operator confirms it exists (C-22, B-2). */
export function mailboxFor(kind: 'apply' | 'contact'): string | null {
  const preferred: Mailbox = kind === 'apply' ? site.mailboxes.apply : site.mailboxes.hello;
  const other: Mailbox = kind === 'apply' ? site.mailboxes.hello : site.mailboxes.apply;
  if (preferred.confirmed) return preferred.address;
  return other.confirmed ? other.address : null;
}

/** Address shown on the Contact page as a way to reach a human. Null until the mailbox is confirmed. */
export function publicContactAddress(): string | null {
  const hello: Mailbox = site.mailboxes.hello;
  return hello.confirmed ? hello.address : null;
}

/**
 * Routes that render a form, and which form each uses. The ten brief squeeze pages, the investor interest page and the partner
 * enquiry page are registered once here (docs/wave8-contracts.md section 3.4), so no content package edits this frozen file. An
 * entry whose ledger row is `launch: false` is ignored by the form-route checks, so a cut brief needs no edit.
 */
export const FORM_ROUTES: Readonly<Record<string, FormConfig['id']>> = {
  '/apply/': 'intake',
  '/contact/': 'intake',
  '/newsletter/': 'newsletter',
  ...Object.fromEntries(BRIEFS.entries.map((entry) => [entry.path, 'intake' as const])),
  '/investors/interest/': 'intake',
  '/network/partners/enquire/': 'intake',
};

/** Where a successful submit goes. `contact` confirms in the page and `newsletter` in place; neither has a thanks route. */
export const THANKS_PATHS = {
  apply: '/apply/thanks/',
  'brief-request': '/briefs/thanks/',
  'investor-interest': '/investors/interest/thanks/',
  'partner-enquiry': '/network/partners/enquire/thanks/',
} as const;

// ---------------------------------------------------------------------------------------------------------------------------------
// The field rules (docs/forms-contract.md section 3.1). One table, read by the client validators, the schema file the intake
// Function's tests read, and the drift test. Pure data and pure functions, so it loads under `node --test` and in the browser.
// ---------------------------------------------------------------------------------------------------------------------------------

export const STAGES = ['idea', 'validating', 'building', 'launched'] as const;
export type Stage = (typeof STAGES)[number];

export const TOPICS = ['general', 'seat-rate', 'press', 'correction', 'information'] as const;
export type Topic = (typeof TOPICS)[number];

export const PARTNER_CATEGORIES = ['tooling-saas', 'cloud-credits', 'legal', 'finance-accounting', 'delivery', 'ecosystem', 'other'] as const;
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export const INVESTOR_KINDS = ['angel', 'fund', 'corporate', 'family-office', 'other'] as const;
export type InvestorKind = (typeof INVESTOR_KINDS)[number];

export const LIMITS = {
  name: 120,
  email: 254,
  company: 120,
  seats: 500,
  message: 4000,
  companyUrl: 300,
  offer: 1500,
  focus: 1000,
} as const;

/** Every key of the request body that a visitor can fill, plus the two the page fills for them. */
export const FIELD_KEYS = [
  'name',
  'email',
  'company',
  'stage',
  'seats',
  'topic',
  'message',
  'briefId',
  'companyUrl',
  'partnerCategory',
  'offer',
  'investorKind',
  'focus',
  'audience',
  'consent',
  'requestId',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** Fields that can carry an error message: the request fields and the apply page's package choice (which is never posted). */
export type FieldName = FieldKey | 'package';
export const FIELD_NAMES: readonly FieldName[] = [...FIELD_KEYS, 'package'];

/** R required, O optional, - must be empty. */
export type Presence = 'R' | 'O' | '-';

/** The required matrix of the contract, one row per field, columns in the order of `MATRIX_KINDS`. */
const MATRIX_KINDS = ['apply', 'contact', 'brief-request', 'investor-interest', 'partner-enquiry'] as const;
const MATRIX_ROWS: Readonly<Record<FieldKey, readonly [Presence, Presence, Presence, Presence, Presence]>> = {
  name: ['R', 'R', 'R', 'R', 'R'],
  email: ['R', 'R', 'R', 'R', 'R'],
  company: ['O', 'O', 'O', 'O', 'R'],
  stage: ['R', '-', 'O', '-', '-'],
  seats: ['O', '-', '-', '-', '-'],
  topic: ['-', 'R', '-', '-', '-'],
  message: ['O', 'R', '-', 'O', 'O'],
  briefId: ['-', '-', 'R', '-', '-'],
  companyUrl: ['-', '-', '-', 'O', 'R'],
  partnerCategory: ['-', '-', '-', '-', 'R'],
  offer: ['-', '-', '-', '-', 'R'],
  investorKind: ['-', '-', '-', 'O', '-'],
  focus: ['-', '-', '-', 'O', '-'],
  audience: ['R', 'R', 'R', 'R', 'R'],
  consent: ['R', 'R', 'R', 'R', 'R'],
  requestId: ['R', 'R', 'R', 'R', 'R'],
};

/** The newsletter has its own contract: an address and consent, nothing else. */
const NEWSLETTER_REQUIRED: readonly FieldKey[] = ['email', 'consent'];

function buildMatrix(): Readonly<Record<FormKind, Readonly<Record<FieldKey, Presence>>>> {
  const matrix = {} as Record<FormKind, Record<FieldKey, Presence>>;
  for (const [index, kind] of MATRIX_KINDS.entries()) {
    matrix[kind] = Object.fromEntries(FIELD_KEYS.map((key) => [key, MATRIX_ROWS[key][index] ?? '-'])) as Record<FieldKey, Presence>;
  }
  matrix.newsletter = Object.fromEntries(FIELD_KEYS.map((key) => [key, NEWSLETTER_REQUIRED.includes(key) ? 'R' : '-'])) as Record<FieldKey, Presence>;
  return matrix;
}

export const FORM_MATRIX: Readonly<Record<FormKind, Readonly<Record<FieldKey, Presence>>>> = buildMatrix();

/** The audiences a form of this kind accepts. A brief takes the audience list of its registry entry; an unknown brief takes none. */
export function audiencesFor(kind: FormKind, briefId = ''): readonly Audience[] {
  switch (kind) {
    case 'apply':
      return ['startup'];
    case 'investor-interest':
      return ['investor'];
    case 'partner-enquiry':
      return ['partner'];
    case 'contact':
      return AUDIENCES;
    case 'brief-request':
      return BRIEFS.entries.find((entry) => entry.slug === briefId)?.audience ?? [];
    case 'newsletter':
      return [];
  }
}

/** The machine-readable form of everything above: `docs/forms-contract.schema.json` is this object, kept in step by a unit test. */
export function formsSchema(): Record<string, unknown> {
  return {
    $comment: 'Generated from src/data/forms.ts by tests/unit/wp-60/forms-schema.test.ts (UPDATE_SCHEMA=1 regenerates). Do not edit by hand.',
    version: 2,
    forms: [...FORM_KINDS],
    presence: { legend: { R: 'required', O: 'optional', '-': 'must be empty' }, matrix: FORM_MATRIX },
    enums: {
      stage: [...STAGES],
      topic: [...TOPICS],
      partnerCategory: [...PARTNER_CATEGORIES],
      investorKind: [...INVESTOR_KINDS],
      audience: [...AUDIENCES],
    },
    limits: LIMITS,
    audience: {
      apply: audiencesFor('apply'),
      contact: audiencesFor('contact'),
      'investor-interest': audiencesFor('investor-interest'),
      'partner-enquiry': audiencesFor('partner-enquiry'),
      briefs: Object.fromEntries(BRIEFS.entries.map((entry) => [entry.slug, [...entry.audience]])),
    },
    thanks: THANKS_PATHS,
    mailto: [...MAILTO_KINDS],
    requestId: { pattern: UUID_V4_SOURCE, requiredExcept: ['newsletter'] },
  };
}

/** Raw values as read from the form controls. The v2 fields are optional so a v1 caller keeps working. */
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
  readonly requestId?: string;
  readonly audience?: string;
  readonly briefId?: string;
  readonly companyUrl?: string;
  readonly partnerCategory?: string;
  readonly offer?: string;
  readonly investorKind?: string;
  readonly focus?: string;
  /** Brief request only, and only while `flags.briefUpdates` shows the checkbox. */
  readonly consentUpdates?: boolean;
}

export interface FieldError {
  readonly field: FieldName;
  readonly message: string;
}

export const UUID_V4_SOURCE = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
const UUID_V4 = new RegExp(UUID_V4_SOURCE, 'i');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The line of `message` that carries the package choice, or '' when none was made (docs/forms-contract.md section 3). */
export function packageNote(value: string | undefined): string {
  if (value === undefined || value === '') return '';
  if (value === PACKAGE_NOT_SURE) return 'Package interest: not sure yet';
  return isPackageId(value) ? `Package interest: ${getPackage(value).name}` : '';
}

export function normaliseText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

/** The message as sent: the visitor's text, then the package line after a blank line. */
export function composeMessage(message: string, packageValue: string | undefined): string {
  const text = normaliseText(message);
  const note = packageNote(packageValue);
  if (note === '') return text;
  return text === '' ? note : `${text}\n\n${note}`;
}

function tooLong(label: string, limit: number): string {
  return `${label} is too long. Shorten it to ${limit} characters or fewer.`;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates the values for one form against the required matrix. Messages say what to do, not only what is wrong (WCAG 3.3.1, 3.3.3).
 * A field the matrix marks `-` is never rendered, so a value there means the page was altered; it is reported rather than sent.
 */
export function validate(kind: FormKind, values: FormValues): FieldError[] {
  const errors: FieldError[] = [];
  const rule = FORM_MATRIX[kind];
  const push = (field: FieldName, message: string): void => {
    errors.push({ field, message });
  };
  const text = (key: keyof FormValues): string => {
    const value = values[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const present = (key: FieldKey): boolean => rule[key] !== '-';

  // Fields the form does not use must be empty. The newsletter keeps its v1 contract, which never looked at them.
  for (const key of FIELD_KEYS) {
    if (kind === 'newsletter' || key === 'consent' || rule[key] !== '-') continue;
    if (text(key) !== '') push(key, 'This form does not use this field. Reload the page and try again.');
  }

  const name = text('name');
  if (present('name')) {
    if (name === '') push('name', 'Enter your name.');
    else if (name.length > LIMITS.name) push('name', tooLong('Your name', LIMITS.name));
  }

  const email = text('email');
  if (email === '') push('email', 'Enter your email address so WE can reply.');
  else if (!EMAIL_PATTERN.test(email) || email.length > LIMITS.email) push('email', 'Enter an email address in the form name@example.org.');

  const company = text('company');
  if (rule.company === 'R' && company === '') push('company', 'Enter the name of your organization.');
  else if (company.length > LIMITS.company) push('company', tooLong('The company name', LIMITS.company));

  const stage = text('stage');
  if (rule.stage === 'R' && !(STAGES as readonly string[]).includes(stage)) {
    push('stage', 'Choose the stage that is closest to where your idea is today.');
  } else if (rule.stage === 'O' && stage !== '' && !(STAGES as readonly string[]).includes(stage)) {
    push('stage', 'Choose one of the stages in the list, or leave it empty.');
  }

  if (present('seats') && text('seats').length > LIMITS.seats) push('seats', tooLong('The team description', LIMITS.seats));

  if (kind === 'apply') {
    const choice = values.package ?? '';
    if (choice !== '' && choice !== PACKAGE_NOT_SURE && !isPackageId(choice)) {
      push('package', 'Choose one of the packages in the list, or choose Not sure yet.');
    }
  }

  if (rule.topic === 'R' && !(TOPICS as readonly string[]).includes(text('topic'))) push('topic', 'Choose what your message is about.');

  if (present('message')) {
    if (rule.message === 'R' && text('message') === '') push('message', 'Write a short message so WE knows how to help.');
    const sent = kind === 'apply' ? composeMessage(values.message, values.package) : normaliseText(values.message);
    if (sent.length > LIMITS.message) push('message', tooLong('Your message', LIMITS.message));
  }

  const briefId = text('briefId');
  if (rule.briefId === 'R' && !BRIEFS.entries.some((entry) => entry.slug === briefId)) push('briefId', 'Choose a brief from the list.');

  const url = text('companyUrl');
  if (rule.companyUrl === 'R' && url === '') push('companyUrl', 'Enter your organization’s website, starting with https://');
  else if (url !== '' && present('companyUrl')) {
    if (url.length > LIMITS.companyUrl) push('companyUrl', tooLong('The website address', LIMITS.companyUrl));
    else if (!isHttpsUrl(url)) push('companyUrl', 'Enter a website address that starts with https://');
  }

  const category = text('partnerCategory');
  if (rule.partnerCategory === 'R' && !(PARTNER_CATEGORIES as readonly string[]).includes(category)) {
    push('partnerCategory', 'Choose the category that fits what you offer.');
  }

  const offer = text('offer');
  if (rule.offer === 'R' && offer === '') push('offer', 'Describe what you provide to founders and on what terms.');
  else if (offer.length > LIMITS.offer) push('offer', tooLong('The description', LIMITS.offer));

  const investorKind = text('investorKind');
  if (rule.investorKind === 'O' && investorKind !== '' && !(INVESTOR_KINDS as readonly string[]).includes(investorKind)) {
    push('investorKind', 'Choose one of the descriptions in the list, or leave it empty.');
  }
  if (rule.focus === 'O' && text('focus').length > LIMITS.focus) push('focus', tooLong('The focus', LIMITS.focus));

  const audience = text('audience');
  if (rule.audience === 'R') {
    const allowed = audiencesFor(kind, briefId);
    const known = kind === 'brief-request' && allowed.length === 0 ? AUDIENCES : allowed;
    if (!(known as readonly string[]).includes(audience)) push('audience', 'Choose who you are writing as.');
  }

  if (rule.requestId === 'R' && !UUID_V4.test(text('requestId'))) {
    push('requestId', 'The form could not prepare this request. Reload the page and try again.');
  }

  if (!values.consent) push('consent', 'Tick the box to confirm that WE may use these details to answer this request.');
  return errors;
}
