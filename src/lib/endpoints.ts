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
