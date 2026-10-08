import { readEnv, readFlag } from '../lib/env.ts';
import { INTAKE_ENDPOINT_VAR, NEWSLETTER_ENDPOINT_VAR, parseEndpoint, resolveEndpoint } from '../lib/endpoints.ts';
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

export type FormPage = 'apply' | 'contact' | 'newsletter';

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
  const mode: FormMode = config.mode === 'mailto' && mailbox === null ? 'disabled' : config.mode;
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

/** Routes that render a form, and which form each uses. */
export const FORM_ROUTES: Readonly<Record<string, FormConfig['id']>> = {
  '/apply/': 'intake',
  '/contact/': 'intake',
  '/newsletter/': 'newsletter',
};
