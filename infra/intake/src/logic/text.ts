/**
 * Small text helpers shared by validation, mapping, templates and logging. Pure: node built-ins only, so the root
 * `npm run test:unit` can import this directory without installing the Azure SDK.
 */

/** Trims, strips control characters other than newline and tab, and caps the length. Non-strings become "". */
export function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const withoutControls = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return withoutControls.trim().slice(0, max);
}

/** One mailbox, no display name, no list. Deliberately stricter than RFC 5322: the form is for people with ordinary addresses. */
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export const EMAIL_MAX = 254;

export function isEmail(value: string): boolean {
  return value.length <= EMAIL_MAX && !value.includes('..') && !value.startsWith('.') && EMAIL_PATTERN.test(value) && (value.split('@')[0] ?? '').length <= 64;
}

/** Lower-cased, trimmed address used as the identity key everywhere (rate limits, suppression, contact match). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

const CONSUMER_ROOTS: readonly string[] = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'aol.com', 'icloud.com',
  'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'zoho.com', 'fastmail.com', 'hey.com', 'mail.com',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net', 'charter.net',
];

/** True for a mailbox provider that serves individuals. Those domains never identify an organization, so no shared Account is made. */
export function isConsumerDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (normalized === '') return true;
  return CONSUMER_ROOTS.some((root) => normalized === root || normalized.endsWith(`.${root}`)) || /^yahoo\.[a-z.]+$/.test(normalized) || /^(hotmail|outlook|live)\.[a-z.]+$/.test(normalized);
}

const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** OData string literal: single quotes doubled. Used in $filter values, which are never logged. */
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** First line only, for use in a one-line field such as an email subject or a log value. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
