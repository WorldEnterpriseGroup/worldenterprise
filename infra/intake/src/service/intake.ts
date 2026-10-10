/**
 * POST /api/intake. The order of the steps is part of the contract and is pinned by tests:
 *
 *   method, content type, Origin, size cap, parse, honeypot, kind, validate, brief id, rate limit, idempotency,
 *   Dataverse write, side effects, response.
 *
 * The honeypot sits before the rate limit because a counter is a write, and a honeypot hit must write nothing. The rate
 * limit sits before the idempotency read so an unauthenticated caller cannot make the service query Dataverse without
 * limit; the cost is that a replay of a request id counts against the hour's allowance, which is stated in the contract
 * tests. Nothing is written to Dataverse until every check has passed, and the response is sent only after the write.
 */

import { encryptToken, keyHash, logHash } from '../logic/crypto.ts';
import { isKind, thanksAllowlist, type Kind } from '../logic/contract.ts';
import {
  checkOrigin, clientAddress, confirmationPage, contentKind, corsHeaders, emptyResult, htmlResult, jsonResult, MAX_BODY_BYTES, parseBody,
  redirectResult, resolveThanksUrl, type HttpRequestLike, type HttpResult,
} from '../logic/http.ts';
import { errorCode } from '../logic/log.ts';
import { buildContactFields, buildEngagementRow, planAccount, selectContact, type EngagementRecord, type ReviewName } from '../logic/mapping.ts';
import { rateKeys } from '../logic/rate.ts';
import { isHoneypotTripped, readFormKind, validate, type Submission } from '../logic/validate.ts';
import type { Deps } from './deps.ts';
import type { BriefEntry } from './ports.ts';
import { emailHashOf, findBrief, sendRequestedBrief } from './deliver.ts';

const ACK = { ok: true };

function fieldError(status: 400 | 422, field: string, message: string): HttpResult {
  return jsonResult(status, { ok: false, errors: { [field]: message } });
}

function withExtra(result: HttpResult, extra: Readonly<Record<string, string>>): HttpResult {
  return { ...result, headers: { ...result.headers, ...extra } };
}

interface Outcome {
  readonly status: 200 | 202;
}

/** How a success is shown: JSON for the script, a redirect or a small page for a native form post. */
function success(deps: Deps, kind: Kind, form: boolean, redirect: string, outcome: Outcome): HttpResult {
  if (!form) return jsonResult(outcome.status, ACK);
  const target = resolveThanksUrl(deps.contract.kinds[kind].thanks, redirect, thanksAllowlist(deps.contract), deps.settings.allowedOrigins, deps.settings.siteOrigin);
  if (target !== null) return redirectResult(target);
  return htmlResult(200, confirmationPage('Thank you', 'WE received your message.'));
}

async function resolveLinks(deps: Deps, submission: Submission): Promise<{ accountId: string | null; contactId: string | null; review: ReviewName }> {
  const plan = planAccount(submission);
  const account = await deps.crm.ensureAccount(plan);
  const accountId = plan.organization ? account.id : null;
  // A person-level Account still links to the engagement; only an organization Account becomes the contact's employer.
  return deps.lock.withLock(`contact:${emailHashOf(submission.email)}`, async () => {
    const selection = selectContact(await deps.crm.findContactsByEmail(submission.email));
    if (selection.outcome === 'ambiguous') return { accountId: account.id, contactId: null, review: 'contact-ambiguous' as const };
    if (selection.outcome === 'use') return { accountId: account.id, contactId: selection.contact.id, review: 'none' as const };
    const created = await deps.crm.createContact(buildContactFields(submission, accountId));
    return { accountId: account.id, contactId: created.id, review: 'none' as const };
  });
}

async function afterWrite(deps: Deps, submission: Submission, record: EngagementRecord | null, client: string): Promise<void> {
  if (record === null) return;
  const now = deps.clock.now();
  if (submission.kind === 'brief-request') {
    try {
      await sendRequestedBrief(deps, record);
      const delivered = new Date(now);
      await deps.engagements.update(record.id, {
        status: 'delivered',
        deliveryAttempts: 1,
        lastAttemptAt: delivered,
        deliveredAt: delivered,
        ...(submission.consentUpdates ? { nurtureStage: 0, nurtureNextAt: new Date(now + 3 * 24 * 60 * 60 * 1000) } : {}),
      });
      deps.log.info('brief_delivered', { requestId: submission.requestId, kind: submission.kind, client });
    } catch (error) {
      deps.log.error('delivery_failed', { requestId: submission.requestId, kind: submission.kind, code: errorCode(error), client });
      try {
        await deps.engagements.update(record.id, { status: 'delivery-failed', deliveryAttempts: 1, lastAttemptAt: new Date(now) });
      } catch (updateError) {
        deps.log.error('status_update_failed', { requestId: submission.requestId, code: errorCode(updateError) });
      }
    }
  }
  try {
    await deps.notifier.notify({ requestId: submission.requestId, kind: submission.kind, audience: submission.audience });
  } catch (error) {
    deps.log.warn('notify_failed', { requestId: submission.requestId, code: errorCode(error) });
  }
}

/**
 * `impliedKind` is set by a route that serves one form only (`/api/newsletter`): a post to it that omits the `form` field
 * is read as that form. A post that names another form is still validated as the form it names.
 */
export async function handleIntake(deps: Deps, req: HttpRequestLike, impliedKind?: Kind): Promise<HttpResult> {
  const verdict = checkOrigin(req.header('origin'), deps.settings.allowedOrigins);
  const cors = verdict.kind === 'allowed' ? corsHeaders(verdict.origin) : {};
  const done = (result: HttpResult): HttpResult => withExtra(result, cors);
  const client = logHash('client', clientAddress((name) => req.header(name)));

  if (req.method === 'OPTIONS') {
    if (verdict.kind !== 'allowed') return emptyResult(403);
    return done(emptyResult(204));
  }
  if (req.method !== 'POST') return emptyResult(405, { Allow: 'POST, OPTIONS' });

  const kindOfBody = contentKind(req.header('content-type'));
  if (kindOfBody === 'unsupported') return done(jsonResult(415, { ok: false, errors: { form: 'Send JSON or a standard form post.' } }));
  const isForm = kindOfBody === 'form';
  if (verdict.kind === 'refused' || (verdict.kind === 'opaque' && !isForm)) {
    deps.log.warn('origin_refused', { route: 'intake', client });
    return emptyResult(403);
  }

  const declared = Number(req.header('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    deps.log.warn('body_too_large', { route: 'intake', client });
    return done(jsonResult(413, { ok: false, errors: { form: 'The request is too large.' } }));
  }
  let text: string | null;
  try {
    text = await req.readBody(MAX_BODY_BYTES);
  } catch (error) {
    deps.log.warn('body_unreadable', { route: 'intake', code: errorCode(error), client });
    return done(fieldError(400, 'form', 'The request could not be read.'));
  }
  if (text === null) {
    deps.log.warn('body_too_large', { route: 'intake', client });
    return done(jsonResult(413, { ok: false, errors: { form: 'The request is too large.' } }));
  }

  const parsed = parseBody(kindOfBody, text);
  if (!parsed.ok) return done(fieldError(400, 'form', 'The request body is not valid.'));
  const body = impliedKind !== undefined && readFormKind(parsed.body) === '' ? { ...parsed.body, form: impliedKind } : parsed.body;

  if (isHoneypotTripped(body)) {
    deps.log.info('honeypot', { route: 'intake', client });
    const claimed = readFormKind(body);
    return done(isForm && isKind(claimed) ? success(deps, claimed, true, typeof body['redirect'] === 'string' ? body['redirect'] : '', { status: 200 }) : jsonResult(200, ACK));
  }

  const claimedKind = readFormKind(body);
  if (!isKind(claimedKind)) return done(fieldError(422, 'form', 'Unknown form.'));
  const kind: Kind = claimedKind;

  // A native form post carries a build-time-empty request id; the server supplies one.
  const candidate = isForm && (typeof body['requestId'] !== 'string' || body['requestId'].trim() === '') && kind !== 'newsletter'
    ? { ...body, requestId: deps.ids.requestId() }
    : body;
  const validated = validate(deps.contract, kind, candidate, kindOfBody);
  if (!validated.ok) {
    deps.log.info('validation_failed', { kind, status: validated.status, client });
    return done(jsonResult(validated.status, { ok: false, errors: validated.errors }));
  }
  const submission = validated.submission;

  let entry: BriefEntry | null = null;
  if (kind === 'brief-request') {
    try {
      entry = await findBrief(deps, submission.briefId);
    } catch (error) {
      deps.log.error('registry_read_failed', { requestId: submission.requestId, code: errorCode(error), client });
      return done(jsonResult(503, { ok: false, error: 'unavailable' }, { 'Retry-After': '30' }));
    }
    if (entry === null) return done(fieldError(422, 'briefId', 'Choose a brief that WE offers.'));
  }

  const now = deps.clock.now();
  let retryAfter = 0;
  try {
    for (const key of rateKeys(kind, keyHash('client', clientAddress((name) => req.header(name))), submission.email === '' ? null : emailHashOf(submission.email))) {
      const decision = await deps.rate.consume(key, now, deps.contract.kinds[kind].rateLimit.perHour);
      if (!decision.allowed) retryAfter = Math.max(retryAfter, decision.retryAfterSeconds);
    }
  } catch (error) {
    deps.log.error('rate_store_failed', { code: errorCode(error), kind, client });
    return done(jsonResult(503, { ok: false, error: 'unavailable' }, { 'Retry-After': '30' }));
  }
  if (retryAfter > 0) {
    deps.log.warn('rate_limited', { kind, client });
    return done(jsonResult(429, { ok: false, error: 'rate_limited' }, { 'Retry-After': String(retryAfter) }));
  }

  try {
    const existing = await deps.engagements.getByRequestId(submission.requestId);
    if (existing !== null) {
      deps.log.info('replay', { requestId: submission.requestId, kind, client });
      return done(success(deps, kind, isForm, submission.redirect, { status: 200 }));
    }

    const links = await resolveLinks(deps, submission);
    const token = deps.ids.token();
    const row = buildEngagementRow(submission, links, {
      now: new Date(now),
      tokenCiphertext: encryptToken(token, deps.settings.unsubscribeKey),
      tokenHash: keyHash('unsub', token),
      briefVersion: entry?.version ?? '',
    });
    const created = await deps.engagements.createIfAbsent(submission.requestId, row);
    if (created === 'exists') {
      deps.log.info('replay', { requestId: submission.requestId, kind, client });
      return done(success(deps, kind, isForm, submission.redirect, { status: 200 }));
    }
  } catch (error) {
    deps.log.error('dataverse_write_failed', { requestId: submission.requestId, kind, code: errorCode(error), client });
    return done(jsonResult(503, { ok: false, error: 'unavailable' }, { 'Retry-After': '30' }));
  }

  // The row is durable from here on. A failed read-back must not turn a stored request into an error response: the retry
  // sweep finds a brief request that never got its email.
  let record: EngagementRecord | null = null;
  try {
    record = await deps.engagements.getByRequestId(submission.requestId);
  } catch (error) {
    deps.log.error('dataverse_readback_failed', { requestId: submission.requestId, kind, code: errorCode(error), client });
  }

  deps.log.info('intake_accepted', { requestId: submission.requestId, kind, status: 202, client });
  await afterWrite(deps, submission, record, client);
  return done(success(deps, kind, isForm, submission.redirect, { status: 202 }));
}
