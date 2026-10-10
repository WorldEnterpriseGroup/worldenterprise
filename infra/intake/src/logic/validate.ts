/**
 * Server-side validation of one submission against the compiled forms contract. The browser validates too, but only this
 * result is trusted. Error messages never echo the submitted value: a message can end up in a response body, and the
 * submitted value may be personal data.
 */

import type { Contract, FieldRule, Kind, KindRule } from './contract.ts';
import { clean, isEmail, normalizeEmail } from './text.ts';

export interface Submission {
  readonly kind: Kind;
  readonly requestId: string;
  readonly audience: string;
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly stage: string;
  readonly seats: string;
  readonly topic: string;
  readonly message: string;
  readonly briefId: string;
  readonly companyUrl: string;
  readonly partnerCategory: string;
  readonly investorKind: string;
  readonly focus: string;
  readonly offer: string;
  readonly consentUpdates: boolean;
  readonly startedAt: string;
  readonly submittedAt: string;
  /** Path only: any query string or fragment the browser sent is dropped. */
  readonly page: string;
  /** The hidden form-post `redirect` value, unvalidated. The caller resolves it against the thanks allowlist. */
  readonly redirect: string;
}

export type FieldErrors = Readonly<Record<string, string>>;

export type ValidationResult =
  | { readonly ok: true; readonly submission: Submission }
  | { readonly ok: false; readonly status: 400 | 422; readonly errors: FieldErrors };

export type BodySource = 'json' | 'form';

/** Fields every request may carry whatever the contract file lists, with the rule used when the file is silent. */
const BUILT_IN: Readonly<Record<string, (kind: Kind) => FieldRule>> = {
  requestId: (kind) => ({ rule: kind === 'newsletter' ? 'O' : 'R', type: 'uuid', max: 36, enum: [] }),
  consent: () => ({ rule: 'R', type: 'boolean', max: 5, enum: [] }),
  consentUpdates: (kind) => ({ rule: kind === 'brief-request' ? 'O' : '-', type: 'boolean', max: 5, enum: [] }),
  startedAt: () => ({ rule: 'O', type: 'iso', max: 40, enum: [] }),
  submittedAt: () => ({ rule: 'O', type: 'iso', max: 40, enum: [] }),
  page: () => ({ rule: 'O', type: 'string', max: 300, enum: [] }),
};

/** Transport fields that are not part of the contract table: `form` and `audience` are checked separately, the rest are consumed earlier. */
const TRANSPORT_FIELDS: readonly string[] = ['form', 'audience', 'redirect', 'website'];

/** Every field the Submission carries, so a field the contract file does not list is treated as must-be-empty rather than ignored. */
const SUBMISSION_FIELDS: readonly string[] = [
  'requestId', 'name', 'email', 'company', 'stage', 'seats', 'topic', 'message', 'briefId', 'companyUrl', 'partnerCategory',
  'investorKind', 'focus', 'offer', 'consent', 'consentUpdates', 'startedAt', 'submittedAt', 'page',
];

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const LABELS: Readonly<Record<string, string>> = {
  requestId: 'request id', name: 'name', email: 'email address', company: 'company', stage: 'stage', seats: 'seats', topic: 'topic',
  message: 'message', briefId: 'brief', companyUrl: 'company website', partnerCategory: 'partner category', investorKind: 'investor type',
  focus: 'focus', offer: 'offer', consent: 'consent', consentUpdates: 'updates choice', startedAt: 'start time', submittedAt: 'submit time', page: 'page',
};

function label(field: string): string {
  return LABELS[field] ?? field;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isTrueish(value: unknown, source: BodySource): boolean {
  if (source === 'json') return value === true;
  return typeof value === 'string' && ['on', 'true', '1', 'yes'].includes(value.trim().toLowerCase());
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return true;
  return typeof value === 'string' && value.trim() === '';
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** The value after cleaning, or an error message. `''` is a valid cleaned value; the caller applies the required rule. */
function checkValue(field: string, spec: FieldRule, raw: unknown, source: BodySource): { value: string } | { error: string } {
  if (spec.type === 'boolean') {
    if (source === 'json' && raw !== undefined && typeof raw !== 'boolean') return { error: `${capitalize(label(field))} must be true or false.` };
    return { value: isTrueish(raw, source) ? 'true' : '' };
  }
  if (raw === undefined || raw === null) return { value: '' };
  if (typeof raw !== 'string') return { error: `${capitalize(label(field))} must be text.` };
  if (raw.length > spec.max * 2 + 16) return { error: `${capitalize(label(field))} is too long.` };
  const value = clean(raw, spec.max + 1);
  if (value.length > spec.max) return { error: `${capitalize(label(field))} must be at most ${spec.max} characters.` };
  if (value === '') return { value };
  switch (spec.type) {
    case 'email':
      return isEmail(value) ? { value: normalizeEmail(value) } : { error: 'Enter one valid email address.' };
    case 'url':
      return isHttpsUrl(value) ? { value } : { error: 'Enter a website address that starts with https://.' };
    case 'uuid':
      return UUID_V4.test(value) ? { value: value.toLowerCase() } : { error: 'The request id is not valid. Reload the page and try again.' };
    case 'slug':
      return SLUG.test(value) ? { value } : { error: `Choose a valid ${label(field)}.` };
    case 'iso':
      return ISO_8601.test(value) && !Number.isNaN(Date.parse(value)) ? { value } : { error: `${capitalize(label(field))} must be an ISO 8601 time.` };
    case 'enum':
      return spec.enum.includes(value) ? { value } : { error: `Choose one of the listed options for ${label(field)}.` };
    default:
      return { value };
  }
}

function ruleFor(kindRule: KindRule, kind: Kind, field: string): FieldRule | null {
  const listed = kindRule.fields[field];
  if (listed !== undefined) return listed;
  const builtIn = BUILT_IN[field];
  if (builtIn !== undefined) return builtIn(kind);
  // A field the contract does not list for this kind: it must be empty.
  return { rule: '-', type: 'string', max: 4000, enum: [] };
}

function pagePath(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

export function validate(contract: Contract, kind: Kind, body: Readonly<Record<string, unknown>>, source: BodySource): ValidationResult {
  const kindRule = contract.kinds[kind];
  const errors: Record<string, string> = {};

  const known = new Set<string>([...SUBMISSION_FIELDS, ...TRANSPORT_FIELDS, ...Object.keys(kindRule.fields)]);
  for (const key of Object.keys(body)) {
    if (!known.has(key)) errors[key] = 'This field is not part of the form.';
  }

  const values: Record<string, string> = {};
  const names = new Set<string>([...SUBMISSION_FIELDS, ...Object.keys(kindRule.fields)]);
  for (const field of names) {
    const spec = ruleFor(kindRule, kind, field);
    if (spec === null) continue;
    const checked = checkValue(field, spec, body[field], source);
    if ('error' in checked) {
      errors[field] = checked.error;
      continue;
    }
    values[field] = checked.value;
    const empty = isEmptyValue(spec.type === 'boolean' ? (checked.value === 'true' ? true : undefined) : checked.value);
    if (spec.rule === 'R' && empty) {
      errors[field] = spec.type === 'boolean' ? 'Please confirm to continue.' : `${capitalize(label(field))} is required.`;
    } else if (spec.rule === '-' && !empty) {
      errors[field] = `${capitalize(label(field))} is not used on this form.`;
    }
  }

  const audience = typeof body['audience'] === 'string' ? body['audience'].trim() : body['audience'] === undefined ? '' : null;
  if (audience === null || !kindRule.audience.includes(audience)) {
    errors['audience'] = kindRule.audience.length === 1 && kindRule.audience[0] === ''
      ? 'This form does not take an audience.'
      : 'Choose who you are. That choice is not available on this form.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, status: 422, errors };

  const redirect = typeof body['redirect'] === 'string' ? clean(body['redirect'], 300) : '';
  return {
    ok: true,
    submission: {
      kind,
      requestId: values['requestId'] ?? '',
      audience: audience ?? '',
      name: values['name'] ?? '',
      email: values['email'] ?? '',
      company: values['company'] ?? '',
      stage: values['stage'] ?? '',
      seats: values['seats'] ?? '',
      topic: values['topic'] ?? '',
      message: values['message'] ?? '',
      briefId: values['briefId'] ?? '',
      companyUrl: values['companyUrl'] ?? '',
      partnerCategory: values['partnerCategory'] ?? '',
      investorKind: values['investorKind'] ?? '',
      focus: values['focus'] ?? '',
      offer: values['offer'] ?? '',
      consentUpdates: values['consentUpdates'] === 'true',
      startedAt: values['startedAt'] ?? '',
      submittedAt: values['submittedAt'] ?? '',
      page: pagePath(values['page'] ?? ''),
      redirect,
    },
  };
}

/** The honeypot: a non-empty `website` means automation. Checked before validation so a bot learns nothing from the errors. */
export function isHoneypotTripped(body: Readonly<Record<string, unknown>>): boolean {
  const value = body['website'];
  return typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null && value !== false;
}

/** Reads `form` from a parsed body. Anything that is not a string is "no kind". */
export function readFormKind(body: Readonly<Record<string, unknown>>): string {
  const value = body['form'];
  return typeof value === 'string' ? value.trim() : '';
}
