import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { engagementFromRow } from '../src/logic/mapping.ts';
import { emailHashOf } from '../src/service/deliver.ts';
import { handleIntake } from '../src/service/intake.ts';
import { handleHealth, handleUnsubscribe } from '../src/service/unsubscribe.ts';
import { nurtureSweep, retrySweep } from '../src/service/sweeps.ts';
import { harness, jsonPost, leakyError, request, validPayload, type Harness } from './fakes.ts';

/** Requests a brief with the updates box ticked and returns the token from the emailed unsubscribe link. */
async function subscribed(h: Harness, overrides: Record<string, unknown> = {}): Promise<{ token: string; requestId: string }> {
  const payload = validPayload('brief-request', { consentUpdates: true, ...overrides });
  const result = await handleIntake(h.deps, jsonPost(payload));
  assert.equal(result.status, 202);
  const text = h.mailer.sent.at(-1)?.text ?? '';
  const token = /token=([A-Za-z0-9_-]+)/.exec(text)?.[1];
  assert.ok(token !== undefined, 'the email carries an unsubscribe token');
  return { token, requestId: String(payload['requestId']) };
}

function formRequest(method: string, token: string, extra: { query?: Record<string, string> } = {}): ReturnType<typeof request> {
  return request({
    method,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? new URLSearchParams({ token }).toString() : '',
    ...(extra.query === undefined ? {} : { query: extra.query }),
  });
}

describe('unsubscribe', () => {
  test('GET only shows a confirmation page: nothing is suppressed, stored or changed', async () => {
    const h = harness();
    const { token, requestId } = await subscribed(h);
    const before = JSON.stringify(h.engagements.row(requestId));
    const result = await handleUnsubscribe(h.deps, request({ method: 'GET', query: { token } }));
    assert.equal(result.status, 200);
    assert.ok(result.body.includes('<form method="post" action="/api/unsubscribe">'));
    assert.ok(result.body.includes('name="robots" content="noindex"'));
    assert.equal(h.suppression.records.size, 0);
    assert.equal(JSON.stringify(h.engagements.row(requestId)), before);
    assert.equal(h.crm.optedOut.size, 0);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.ok(result.headers['Content-Security-Policy']?.startsWith("default-src 'none'"));
  });

  test('GET repeated by a mail scanner, any number of times, still changes nothing', async () => {
    const h = harness();
    const { token } = await subscribed(h);
    for (let index = 0; index < 5; index += 1) await handleUnsubscribe(h.deps, request({ method: 'GET', query: { token } }));
    assert.equal(h.suppression.records.size, 0);
  });

  test('POST unsubscribes: suppression written, row unsubscribed, contact opted out', async () => {
    const h = harness();
    const { token, requestId } = await subscribed(h);
    const result = await handleUnsubscribe(h.deps, formRequest('POST', token));
    assert.equal(result.status, 200);
    assert.ok(result.body.includes('You are unsubscribed'));
    const record = h.suppression.records.get(emailHashOf('ada@example.org'));
    assert.equal(record?.crmSynced, true);
    assert.equal(engagementFromRow(h.engagements.row(requestId)).status, 'unsubscribed');
    assert.equal(h.crm.optedOut.size, 1);
  });

  test('POST is idempotent', async () => {
    const h = harness();
    const { token } = await subscribed(h);
    assert.equal((await handleUnsubscribe(h.deps, formRequest('POST', token))).status, 200);
    assert.equal((await handleUnsubscribe(h.deps, formRequest('POST', token))).status, 200);
    assert.equal(h.suppression.records.size, 1);
  });

  test('a mail client one-click POST to the List-Unsubscribe URL works', async () => {
    const h = harness();
    const { token } = await subscribed(h);
    const oneClick = request({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click', query: { token } });
    assert.equal((await handleUnsubscribe(h.deps, oneClick)).status, 200);
    assert.equal(h.suppression.records.size, 1);
  });

  test('a malformed or unknown token changes nothing', async () => {
    const h = harness();
    await subscribed(h);
    assert.equal((await handleUnsubscribe(h.deps, formRequest('POST', 'short'))).status, 400);
    assert.equal((await handleUnsubscribe(h.deps, formRequest('POST', 'A'.repeat(32)))).status, 404);
    assert.equal((await handleUnsubscribe(h.deps, request({ method: 'GET' }))).status, 400);
    assert.equal(h.suppression.records.size, 0);
  });

  test('when Dataverse is down the suppression is still recorded, the person is told yes, and the sweep finishes the update', async () => {
    const h = harness();
    const { token, requestId } = await subscribed(h);
    h.engagements.failUpdate = leakyError('ServiceUnavailable');
    const result = await handleUnsubscribe(h.deps, formRequest('POST', token));
    assert.equal(result.status, 200);
    assert.equal(h.suppression.records.get(emailHashOf('ada@example.org'))?.crmSynced, false);

    h.engagements.failUpdate = null;
    const summary = await retrySweep(h.deps);
    assert.equal(summary.reconciled, 1);
    assert.equal(h.suppression.records.get(emailHashOf('ada@example.org'))?.crmSynced, true);
    assert.equal(engagementFromRow(h.engagements.row(requestId)).status, 'unsubscribed');
    assert.equal(h.crm.optedOut.size, 1);
  });

  test('when the suppression store itself fails the answer is 503, not a false success', async () => {
    const h = harness();
    const { token } = await subscribed(h);
    h.suppression.failPut = leakyError('ServiceUnavailable');
    assert.equal((await handleUnsubscribe(h.deps, formRequest('POST', token))).status, 503);
  });

  test('suppression blocks a later follow-up send, and stops the schedule', async () => {
    const h = harness({ nurtureEnabled: true });
    const { token, requestId } = await subscribed(h);
    await handleUnsubscribe(h.deps, formRequest('POST', token));
    h.mailer.sent.length = 0;
    // Put the row back to delivered with a due follow-up, as if the unsubscribe had not reached the row.
    const row = h.engagements.row(requestId);
    row['we_status'] = 100000001;
    row['we_nurturenextat'] = '2026-10-15T12:00:00.000Z';
    h.clock.advance(4 * 24 * 60 * 60 * 1000);
    const summary = await nurtureSweep(h.deps);
    assert.equal(summary.sent, 0);
    assert.equal(summary.suppressed, 1);
    assert.equal(h.mailer.sent.length, 0);
    assert.equal(engagementFromRow(row).nurtureNextAt, '');
  });

  test('the requested brief itself is a reply to the request and is not held back, but a follow-up always is', async () => {
    const h = harness();
    const first = await subscribed(h);
    await handleUnsubscribe(h.deps, formRequest('POST', first.token));
    h.mailer.sent.length = 0;
    const again = await handleIntake(h.deps, jsonPost(validPayload('brief-request', { consentUpdates: false })));
    assert.equal(again.status, 202);
    assert.equal(h.mailer.sent.length, 1);
  });
});

describe('nurture sweep', () => {
  const DAY = 24 * 60 * 60 * 1000;

  test('NURTURE_ENABLED=false sends nothing and does not even read the store', async () => {
    const h = harness({ nurtureEnabled: false });
    await subscribed(h);
    h.mailer.sent.length = 0;
    let reads = 0;
    h.engagements.listNurtureDue = async () => {
      reads += 1;
      return [];
    };
    h.clock.advance(30 * DAY);
    const summary = await nurtureSweep(h.deps);
    assert.deepEqual(summary, { enabled: false, sent: 0, suppressed: 0 });
    assert.equal(h.mailer.sent.length, 0);
    assert.equal(reads, 0);
  });

  test('enabled: follow-ups go out on day 3, 10 and 21 and then stop', async () => {
    const h = harness({ nurtureEnabled: true });
    const { requestId } = await subscribed(h);
    h.mailer.sent.length = 0;

    h.clock.advance(2 * DAY);
    assert.equal((await nurtureSweep(h.deps)).sent, 0, 'not due on day 2');
    h.clock.advance(1 * DAY);
    assert.equal((await nurtureSweep(h.deps)).sent, 1, 'day 3');
    assert.equal(engagementFromRow(h.engagements.row(requestId)).nurtureStage, 1);
    h.clock.advance(6 * DAY);
    assert.equal((await nurtureSweep(h.deps)).sent, 0, 'not due on day 9');
    h.clock.advance(1 * DAY);
    assert.equal((await nurtureSweep(h.deps)).sent, 1, 'day 10');
    h.clock.advance(11 * DAY);
    assert.equal((await nurtureSweep(h.deps)).sent, 1, 'day 21');
    h.clock.advance(30 * DAY);
    assert.equal((await nurtureSweep(h.deps)).sent, 0, 'sequence over');
    assert.equal(h.mailer.sent.length, 3);
    for (const message of h.mailer.sent) {
      assert.ok(message.text.includes('/api/unsubscribe?token='), 'every follow-up carries the unsubscribe link');
      assert.equal(message.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    }
  });

  test('a person who did not tick the updates box is never sent a follow-up', async () => {
    const h = harness({ nurtureEnabled: true });
    await subscribed(h, { consentUpdates: false });
    h.mailer.sent.length = 0;
    h.clock.advance(40 * DAY);
    assert.equal((await nurtureSweep(h.deps)).sent, 0);
    assert.equal(h.mailer.sent.length, 0);
  });
});

describe('retry sweep', () => {
  const MINUTE = 60 * 1000;

  test('a failed brief email is retried after the backoff and then marked delivered', async () => {
    const h = harness();
    h.mailer.failWith = leakyError('ETIMEDOUT');
    const payload = validPayload('brief-request');
    await handleIntake(h.deps, jsonPost(payload));
    h.mailer.failWith = null;

    h.clock.advance(2 * MINUTE);
    assert.equal((await retrySweep(h.deps)).delivered, 0, 'too early');
    h.clock.advance(4 * MINUTE);
    assert.equal((await retrySweep(h.deps)).delivered, 1);
    assert.equal(engagementFromRow(h.engagements.row(String(payload['requestId']))).status, 'delivered');
    assert.equal(h.mailer.sent.length, 1);
    assert.equal((await retrySweep(h.deps)).delivered, 0, 'nothing left to do');
  });

  test('retries stop after the last attempt and the row stays delivery-failed', async () => {
    const h = harness();
    h.mailer.failWith = leakyError('ETIMEDOUT');
    const payload = validPayload('brief-request');
    await handleIntake(h.deps, jsonPost(payload));
    for (let index = 0; index < 12; index += 1) {
      h.clock.advance(13 * 60 * MINUTE);
      await retrySweep(h.deps);
    }
    const record = engagementFromRow(h.engagements.row(String(payload['requestId'])));
    assert.equal(record.status, 'delivery-failed');
    assert.equal(record.deliveryAttempts, 6);
    assert.ok(h.logs.some((entry) => entry.line.includes('delivery_exhausted')));
  });

  test('a brief request whose email step never ran is sent once it is stale', async () => {
    const h = harness();
    const original = h.engagements.getByRequestId.bind(h.engagements);
    let reads = 0;
    h.engagements.getByRequestId = async (id) => {
      reads += 1;
      if (reads === 2) throw leakyError('ECONNRESET');
      return original(id);
    };
    const payload = validPayload('brief-request');
    await handleIntake(h.deps, jsonPost(payload));
    assert.equal(h.mailer.sent.length, 0);
    h.clock.advance(5 * MINUTE);
    assert.equal((await retrySweep(h.deps)).delivered, 0, 'not stale yet: the first request may still be running');
    h.clock.advance(6 * MINUTE);
    assert.equal((await retrySweep(h.deps)).delivered, 1);
    assert.equal(h.mailer.sent.length, 1);
  });
});

describe('health', () => {
  test('reports configuration only and carries the security headers', () => {
    const ok = handleHealth({ configured: true, contractVersion: 2, nurture: false }, request({ method: 'GET' }));
    assert.equal(ok.status, 200);
    assert.deepEqual(JSON.parse(ok.body), { status: 'ok', configured: true, contract: 2, nurture: false });
    assert.equal(ok.headers['X-Content-Type-Options'], 'nosniff');
    const down = handleHealth({ configured: false, contractVersion: 2, nurture: false }, request({ method: 'GET' }));
    assert.equal(down.status, 503);
    assert.equal(handleHealth({ configured: true, contractVersion: 2, nurture: false }, request({ method: 'POST' })).status, 405);
  });
});
