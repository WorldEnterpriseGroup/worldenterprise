/**
 * HTTP-shaped pure logic: response headers, the single-origin CORS check, body parsing and the thanks redirect. Nothing here
 * touches the Functions runtime; the Azure adapter maps its request and response types onto these.
 */

import { createHash } from 'node:crypto';

import { clean } from './text.ts';

export interface HttpRequestLike {
  readonly method: string;
  /** Case-insensitive header lookup. */
  header(name: string): string | undefined;
  /** The body as text, or `null` when it is larger than `maxBytes` (the stream is abandoned, not buffered). */
  readBody(maxBytes: number): Promise<string | null>;
  /** One query-string value. Used only by the unsubscribe confirmation, which carries an opaque token and no personal data. */
  query(name: string): string | undefined;
}

export interface HttpResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/** 32 KiB: well above the largest legal body (the contract's field limits sum to about 10,000 characters of mostly ASCII). */
export const MAX_BODY_BYTES = 32 * 1024;

/** The only stylesheet any response uses (the unsubscribe and confirmation pages). It is allowed by hash, so the policy has no `unsafe-inline`. */
export const PAGE_CSS = 'body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#1a1a1a}h1{font-size:1.5rem}button{font:inherit;padding:.6rem 1.2rem;cursor:pointer}';

const CSS_HASH = createHash('sha256').update(PAGE_CSS).digest('base64');

export const CONTENT_SECURITY_POLICY = `default-src 'none'; style-src 'sha256-${CSS_HASH}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`;

/** Headers every response carries, including errors and redirects. */
export function securityHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

export function parseOrigins(raw: string | undefined): readonly string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter((value) => /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value));
}

export type OriginVerdict =
  | { readonly kind: 'allowed'; readonly origin: string }
  /** `Origin: null` is what a browser sends for a native cross-origin form post under `Referrer-Policy: no-referrer`. Allowed for form posts only. */
  | { readonly kind: 'opaque' }
  | { readonly kind: 'refused' };

export function checkOrigin(origin: string | undefined, allowed: readonly string[]): OriginVerdict {
  if (origin === undefined || origin === '') return { kind: 'refused' };
  if (origin === 'null') return { kind: 'opaque' };
  const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();
  const match = allowed.find((candidate) => candidate.toLowerCase() === normalized);
  return match === undefined ? { kind: 'refused' } : { kind: 'allowed', origin: match };
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Lets the browser read the wait time on a 429 (docs/forms-contract.md section 5).
    'Access-Control-Expose-Headers': 'Retry-After',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function jsonResult(status: number, payload: unknown, extra: Readonly<Record<string, string>> = {}): HttpResult {
  return { status, headers: { ...securityHeaders(), 'Content-Type': 'application/json; charset=utf-8', ...extra }, body: JSON.stringify(payload) };
}

export function htmlResult(status: number, html: string, extra: Readonly<Record<string, string>> = {}): HttpResult {
  return { status, headers: { ...securityHeaders(), 'Content-Type': 'text/html; charset=utf-8', ...extra }, body: html };
}

export function emptyResult(status: number, extra: Readonly<Record<string, string>> = {}): HttpResult {
  return { status, headers: { ...securityHeaders(), ...extra }, body: '' };
}

export function redirectResult(location: string, extra: Readonly<Record<string, string>> = {}): HttpResult {
  return { status: 303, headers: { ...securityHeaders(), Location: location, ...extra }, body: '' };
}

export type ContentKind = 'json' | 'form' | 'unsupported';

export function contentKind(contentType: string | undefined): ContentKind {
  const base = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'application/json') return 'json';
  if (base === 'application/x-www-form-urlencoded') return 'form';
  return 'unsupported';
}

export type ParsedBody =
  | { readonly ok: true; readonly body: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly reason: 'malformed' };

/** Parses a JSON object or a form-encoded body. A repeated form key keeps its last value. */
export function parseBody(kind: 'json' | 'form', text: string): ParsedBody {
  if (kind === 'json') {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, reason: 'malformed' };
      return { ok: true, body: parsed as Record<string, unknown> };
    } catch {
      return { ok: false, reason: 'malformed' };
    }
  }
  const body: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(text)) body[key] = value;
  return { ok: true, body };
}

/**
 * The redirect target for a form-encoded post. The hidden `redirect` field is honoured only when its path is one of the
 * thanks paths the contract names; its origin must be an allowed origin or absent. Anything else is ignored and the kind's
 * own thanks path is used. Query strings and fragments never survive.
 */
export function resolveThanksUrl(
  kindThanks: string | null,
  requested: string,
  allowlist: readonly string[],
  allowedOrigins: readonly string[],
  siteOrigin: string,
): string | null {
  const candidate = clean(requested, 300);
  if (candidate !== '') {
    try {
      const parsed = new URL(candidate, siteOrigin);
      const originOk = parsed.origin === new URL(siteOrigin).origin || allowedOrigins.includes(parsed.origin);
      if (originOk && allowlist.includes(parsed.pathname)) return `${parsed.origin}${parsed.pathname}`;
    } catch {
      // A malformed redirect is ignored like any other value off the allowlist.
    }
  }
  return kindThanks === null ? null : `${siteOrigin}${kindThanks}`;
}

/** The client address as Front Door reports it. The origin only accepts Front Door traffic, so these headers are not attacker-chosen. */
export function clientAddress(header: (name: string) => string | undefined): string {
  const direct = header('x-azure-clientip');
  const forwarded = header('x-forwarded-for')?.split(',')[0];
  const raw = (direct ?? forwarded ?? '').trim();
  if (raw === '') return 'unknown';
  // Strip an IPv4 port (203.0.113.9:4711); leave IPv6 alone.
  return /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(raw) ? raw.slice(0, raw.lastIndexOf(':')) : raw;
}

/** Minimal confirmation page for a native form post to a kind that has no thanks page. */
export function confirmationPage(title: string, lead: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>${PAGE_CSS}</style></head><body><main><h1>${title}</h1><p>${lead}</p></main></body></html>`;
}
