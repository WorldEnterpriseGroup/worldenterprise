import { readEnv, readFlag } from '../lib/env.ts';
import { site } from './site.ts';

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

function resolveForm(id: FormConfig['id'], endpointVar: string, mailbox: Mailbox | null): FormConfig {
  const endpoint = parseEndpoint(readEnv(endpointVar));
  if (endpoint !== null) return { id, mode: 'endpoint', endpoint, mailto: null };
  if (mailbox !== null && mailbox.confirmed) return { id, mode: 'mailto', endpoint: null, mailto: mailbox.address };
  return { id, mode: 'disabled', endpoint: null, mailto: null };
}

export const forms = {
  intake: resolveForm('intake', 'PUBLIC_WE_INTAKE_API_URL', site.mailboxes.apply),
  /** Newsletter has no mailto fallback: it is hidden unless an endpoint is configured. */
  newsletter: resolveForm('newsletter', 'PUBLIC_WE_NEWSLETTER_API_URL', null),
} as const;

/**
 * True when the intake endpoint cannot take a native form-encoded post (docs/forms-contract.md section 8). The form
 * then states that JavaScript is required instead of offering a no-JavaScript submit.
 */
export const intakeRequiresJs: boolean = readFlag('PUBLIC_WE_INTAKE_REQUIRES_JS');

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
