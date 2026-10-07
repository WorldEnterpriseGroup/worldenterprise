import { readEnv } from '../lib/env.ts';
import { site } from './site.ts';

/**
 * Forms contract (docs/forms-contract.md, authored by WP-03). A form posts JSON to an endpoint, falls back to a
 * mailto link only when the mailbox is confirmed, and is otherwise disabled. Production builds (PUBLIC_RELEASE=1)
 * fail if a launched form route is disabled.
 */
export type FormMode = 'endpoint' | 'mailto' | 'disabled';

export interface FormConfig {
  readonly id: 'intake' | 'newsletter';
  readonly mode: FormMode;
  readonly endpoint: string | null;
  readonly mailto: string | null;
}

function resolveForm(id: FormConfig['id'], endpointVar: string, mailbox: { address: string; confirmed: boolean } | null): FormConfig {
  const endpoint = readEnv(endpointVar) ?? null;
  if (endpoint !== null) return { id, mode: 'endpoint', endpoint, mailto: null };
  if (mailbox !== null && mailbox.confirmed) return { id, mode: 'mailto', endpoint: null, mailto: mailbox.address };
  return { id, mode: 'disabled', endpoint: null, mailto: null };
}

export const forms = {
  intake: resolveForm('intake', 'PUBLIC_WE_INTAKE_API_URL', site.mailboxes.apply),
  /** Newsletter has no mailto fallback: it is hidden unless an endpoint is configured. */
  newsletter: resolveForm('newsletter', 'PUBLIC_WE_NEWSLETTER_API_URL', null),
} as const;

/** Routes that render a form, and which form each uses. */
export const FORM_ROUTES: Readonly<Record<string, FormConfig['id']>> = {
  '/apply/': 'intake',
  '/contact/': 'intake',
  '/newsletter/': 'newsletter',
};
