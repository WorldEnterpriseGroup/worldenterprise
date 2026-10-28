/**
 * The one place that turns the form endpoint environment variables into URLs. astro.config.mjs reads it to build the
 * Content Security Policy and src/data/forms.ts reads it to render the forms, so the policy allows exactly the origins the
 * forms post to (code-security P1-4). Both sides use the same parser and the same rule: unset or blank means "not
 * configured", an absolute https URL is an endpoint, and anything else fails the build with a message that names the variable.
 * A silent downgrade is worse than a failed build: an http:// value would widen connect-src to cleartext while the form
 * stayed switched off, and a typo would leave a form that looks configured but is not.
 */

export const INTAKE_ENDPOINT_VAR = 'PUBLIC_WE_INTAKE_API_URL';
export const NEWSLETTER_ENDPOINT_VAR = 'PUBLIC_WE_NEWSLETTER_API_URL';

/** Validates a configured endpoint. Only absolute https URLs are accepted; anything else is treated as unset. */
export function parseEndpoint(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The endpoint for one variable. Returns null when the variable is unset or blank and throws when it is set to anything
 * that is not an absolute https URL.
 */
export function resolveEndpoint(name: string, raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (value === '') return null;
  const endpoint = parseEndpoint(value);
  if (endpoint === null) throw new Error(`${name} must be an absolute https URL, for example https://intake.example.org/v1. Got "${value}".`);
  return endpoint;
}

export interface Endpoints {
  readonly intake: string | null;
  readonly newsletter: string | null;
}

/** Both endpoints from one lookup, so the policy and the forms cannot read different sources. */
export function resolveEndpoints(read: (name: string) => string | undefined): Endpoints {
  return {
    intake: resolveEndpoint(INTAKE_ENDPOINT_VAR, read(INTAKE_ENDPOINT_VAR)),
    newsletter: resolveEndpoint(NEWSLETTER_ENDPOINT_VAR, read(NEWSLETTER_ENDPOINT_VAR)),
  };
}

/**
 * FormSubmit (https://formsubmit.co) is the hosted form relay WE uses instead of an intake service of its own (decision of 2026-10-28,
 * RELEASE.md section 5). It forwards each submission to a mailbox and has two doors on one origin: the plain address
 * `https://formsubmit.co/<mailbox>` takes a native form post and answers with a redirect, and `https://formsubmit.co/ajax/<mailbox>`
 * takes a fetch and answers with JSON. A browser fetch to the plain address cannot read the redirect, so the script always uses the
 * AJAX door and a no-JavaScript post always uses the plain one. Both are on the origin the Content Security Policy already allows.
 */
export const FORMSUBMIT_HOST = 'formsubmit.co';

const FORMSUBMIT_AJAX_SEGMENT = 'ajax';

/** True for an https endpoint on the FormSubmit origin, with or without its `/ajax/` prefix. */
export function isFormSubmit(endpoint: string | null | undefined): boolean {
  if (endpoint === null || endpoint === undefined) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.hostname === FORMSUBMIT_HOST;
  } catch {
    return false;
  }
}

/** The mailbox (or form token) of a FormSubmit endpoint: its path without a leading `/ajax/`. Empty when the path names none. */
function formSubmitRecipient(endpoint: string): string {
  const segments = new URL(endpoint).pathname.split('/').filter((segment) => segment !== '');
  if (segments[0] === FORMSUBMIT_AJAX_SEGMENT) segments.shift();
  return segments.join('/');
}

export interface FormSubmitTargets {
  /** Where a no-JavaScript form posts: `https://formsubmit.co/<mailbox>`. */
  readonly native: string;
  /** Where the script posts JSON: `https://formsubmit.co/ajax/<mailbox>`. */
  readonly ajax: string;
}

/** Both doors of one FormSubmit endpoint. Throws for an endpoint that is not on FormSubmit or that names no mailbox. */
export function formSubmitTargets(endpoint: string): FormSubmitTargets {
  if (!isFormSubmit(endpoint)) throw new Error(`"${endpoint}" is not a https://${FORMSUBMIT_HOST} endpoint.`);
  const recipient = formSubmitRecipient(endpoint);
  if (recipient === '') throw new Error(`The FormSubmit endpoint names no mailbox: expected https://${FORMSUBMIT_HOST}/<mailbox>.`);
  return { native: `https://${FORMSUBMIT_HOST}/${recipient}`, ajax: `https://${FORMSUBMIT_HOST}/${FORMSUBMIT_AJAX_SEGMENT}/${recipient}` };
}
