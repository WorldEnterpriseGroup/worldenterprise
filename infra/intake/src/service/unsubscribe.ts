/**
 * GET|POST /api/unsubscribe, and GET /api/health.
 *
 * The unsubscribe link in an email is fetched by mail scanners and link previewers, so a GET must change nothing: it
 * renders a confirmation page whose form posts to this same route. Only the POST unsubscribes. The POST also serves the
 * RFC 8058 one-click request a mail client sends to the List-Unsubscribe URL. The token is opaque (192 random bits) and
 * is looked up by hash; it is never logged.
 */

import { keyHash } from '../logic/crypto.ts';
import { confirmationPage, contentKind, emptyResult, htmlResult, jsonResult, MAX_BODY_BYTES, PAGE_CSS, parseBody, type HttpRequestLike, type HttpResult } from '../logic/http.ts';
import { errorCode } from '../logic/log.ts';
import { escapeHtml } from '../logic/text.ts';
import type { Deps } from './deps.ts';
import { emailHashOf } from './deliver.ts';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function confirmPage(token: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Stop WE emails</title><style>${PAGE_CSS}</style></head><body><main><h1>Stop WE emails</h1><p>Select the button to stop the follow-up emails WE sends about briefs and articles.</p><form method="post" action="/api/unsubscribe"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Stop these emails</button></form></main></body></html>`;
}

async function tokenFrom(req: HttpRequestLike): Promise<string> {
  const fromQuery = req.query('token') ?? '';
  const kind = contentKind(req.header('content-type'));
  if (kind === 'unsupported') return fromQuery;
  const text = await req.readBody(MAX_BODY_BYTES);
  if (text === null) return '';
  const parsed = parseBody(kind, text);
  const fromBody = parsed.ok && typeof parsed.body['token'] === 'string' ? parsed.body['token'].trim() : '';
  return fromBody !== '' ? fromBody : fromQuery;
}

export async function handleUnsubscribe(deps: Deps, req: HttpRequestLike): Promise<HttpResult> {
  if (req.method === 'GET') {
    const token = (req.query('token') ?? '').trim();
    if (!TOKEN_PATTERN.test(token)) return htmlResult(400, confirmationPage('This link is not valid', 'Open the link from the most recent email WE sent you.'));
    return htmlResult(200, confirmPage(token));
  }
  if (req.method !== 'POST') return emptyResult(405, { Allow: 'GET, POST' });

  let token: string;
  try {
    token = await tokenFrom(req);
  } catch (error) {
    deps.log.warn('body_unreadable', { route: 'unsubscribe', code: errorCode(error) });
    return htmlResult(400, confirmationPage('This request could not be read', 'Open the link from the most recent email WE sent you.'));
  }
  if (!TOKEN_PATTERN.test(token)) return htmlResult(400, confirmationPage('This link is not valid', 'Open the link from the most recent email WE sent you.'));

  try {
    const record = await deps.engagements.getByTokenHash(keyHash('unsub', token));
    if (record === null) return htmlResult(404, confirmationPage('This link is no longer available', 'There is nothing to stop for this link.'));

    const emailHash = emailHashOf(record.email);
    // Suppression is written first and on its own: it is what stops mail, so it must not depend on Dataverse being reachable.
    await deps.suppression.put(emailHash, { at: new Date(deps.clock.now()).toISOString(), crmSynced: false, engagementId: record.id });
    let synced = false;
    try {
      await syncCrm(deps, record.id);
      synced = true;
    } catch (error) {
      deps.log.error('unsubscribe_crm_sync_failed', { code: errorCode(error) });
    }
    if (synced) await deps.suppression.put(emailHash, { at: new Date(deps.clock.now()).toISOString(), crmSynced: true, engagementId: record.id });
    deps.log.info('unsubscribed', { outcome: synced ? 'synced' : 'pending_sync' });
    return htmlResult(200, confirmationPage('You are unsubscribed', 'WE will not send you further follow-up emails.'));
  } catch (error) {
    deps.log.error('unsubscribe_failed', { code: errorCode(error) });
    return htmlResult(503, confirmationPage('This could not be completed', 'Please try the link again in a few minutes.'), { 'Retry-After': '30' });
  }
}

/** Marks the row `unsubscribed` and the linked contact as opted out of bulk email. Safe to repeat. */
export async function syncCrm(deps: Deps, engagementId: string): Promise<void> {
  await deps.engagements.update(engagementId, { status: 'unsubscribed' });
  const contactId = await deps.crm.contactOfEngagement(engagementId);
  if (contactId !== null) await deps.crm.markContactOptedOut(contactId);
}

export interface HealthInfo {
  readonly configured: boolean;
  readonly contractVersion: number;
  readonly nurture: boolean;
}

/** Public and unauthenticated: it reports configuration only, and calls nothing downstream, so it cannot be used to load Dataverse. */
export function handleHealth(info: HealthInfo, req: HttpRequestLike): HttpResult {
  if (req.method !== 'GET' && req.method !== 'HEAD') return emptyResult(405, { Allow: 'GET, HEAD' });
  const body = { status: info.configured ? 'ok' : 'unconfigured', configured: info.configured, contract: info.contractVersion, nurture: info.nurture };
  return jsonResult(info.configured ? 200 : 503, body);
}
