import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createLogger, errorCode, formatLine } from '../src/logic/log.ts';
import { handleIntake } from '../src/service/intake.ts';
import { nurtureSweep, retrySweep } from '../src/service/sweeps.ts';
import { handleUnsubscribe } from '../src/service/unsubscribe.ts';
import { CLIENT_IP, harness, jsonPost, leakyError, request, validPayload, type Harness } from './fakes.ts';

const BODY_MARKER = 'BODYMARKER-7f3a91c2';
const EMAIL = 'leaky.person@marker-example.org';

/** Anything in this list appearing in a log line is a leak. */
function forbidden(extra: readonly string[] = []): readonly string[] {
  return [EMAIL, 'leaky.person', 'marker-example.org', BODY_MARKER, 'SECRETTOKEN', 'SASSIGNATURE', 'sig=', 'sv=', 'blob.core.windows.net', 'https://', CLIENT_IP, 'Leaky Person', ...extra];
}

function assertClean(h: Harness, extra: readonly string[] = []): void {
  for (const { line } of h.logs) {
    for (const needle of forbidden(extra)) assert.ok(!line.includes(needle), `log line leaks ${needle}: ${line}`);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    assert.equal(typeof parsed['event'], 'string');
    for (const value of Object.values(parsed)) assert.ok(['string', 'number', 'boolean'].includes(typeof value), line);
  }
}

/** A legal payload for the kind whose every free-text field the kind allows carries the marker. */
function payload(kind: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const withText = ['apply', 'contact', 'investor-interest', 'partner-enquiry'].includes(kind) ? { message: BODY_MARKER } : {};
  const withCompany = kind === 'newsletter' ? {} : { company: BODY_MARKER, name: 'Leaky Person' };
  return validPayload(kind, { email: EMAIL, ...withCompany, ...withText, ...overrides });
}

function tokenOf(h: Harness): string {
  const token = /token=([A-Za-z0-9_-]+)/.exec(h.mailer.sent.at(-1)?.text ?? '')?.[1];
  assert.ok(token !== undefined);
  return token;
}

describe('log capture: no body, email, token or signed URL in any line', () => {
  test('the success paths for every kind', async () => {
    const h = harness();
    for (const kind of ['apply', 'contact', 'newsletter', 'brief-request', 'investor-interest', 'partner-enquiry']) {
      await handleIntake(h.deps, jsonPost(payload(kind, { email: `${kind}.${EMAIL}` })));
    }
    assert.ok(h.logs.length > 0, 'the paths log something, so the check is not vacuous');
    assertClean(h, [`${'brief-request'}.${EMAIL}`]);
    const token = tokenOf(h);
    for (const { line } of h.logs) assert.ok(!line.includes(token));
  });

  test('rejection paths: honeypot, origin, rate limit, validation, size, malformed', async () => {
    const h = harness();
    await handleIntake(h.deps, jsonPost(payload('contact', { website: BODY_MARKER })));
    await handleIntake(h.deps, jsonPost(payload('contact'), { origin: 'https://evil.example' }));
    await handleIntake(h.deps, jsonPost(payload('contact', { audience: 'nobody' })));
    await handleIntake(h.deps, jsonPost(payload('contact', { message: BODY_MARKER.repeat(5000) })));
    await handleIntake(h.deps, request({ method: 'POST', headers: { origin: 'https://worldenterprise.org', 'content-type': 'application/json' }, body: `{${BODY_MARKER}` }));
    for (let index = 0; index < 7; index += 1) await handleIntake(h.deps, jsonPost(payload('contact', { email: EMAIL })));
    assert.ok(h.logs.some((entry) => entry.line.includes('rate_limited')));
    assertClean(h);
  });

  test('failure paths: every adapter throws an error whose message holds an email, a token and a signed URL', async () => {
    const failures: readonly (readonly [string, (h: Harness) => void])[] = [
      ['dataverse write', (h) => { h.engagements.failCreate = leakyError('ServiceUnavailable'); }],
      ['dataverse read', (h) => { h.engagements.failRead = leakyError('ECONNRESET'); }],
      ['crm', (h) => { h.crm.failWith = leakyError('ServiceUnavailable'); }],
      ['rate store', (h) => { h.rate.failWith = leakyError('ECONNRESET'); }],
      ['mail', (h) => { h.mailer.failWith = leakyError('ETIMEDOUT'); }],
      ['link minting', (h) => { h.links.failWith = leakyError('AuthorizationFailure'); }],
      ['registry', (h) => { h.registry.failWith = leakyError('BlobNotFound'); }],
      ['webhook', (h) => { h.notifier.failWith = leakyError('ECONNRESET'); }],
      ['status update', (h) => { h.engagements.failUpdate = leakyError('ECONNRESET'); }],
    ];
    for (const [name, arm] of failures) {
      const h = harness();
      arm(h);
      const result = await handleIntake(h.deps, jsonPost(payload('brief-request')));
      assert.ok([202, 503].includes(result.status), `${name}: the handler answers instead of throwing (got ${result.status})`);
      assert.ok(h.logs.length > 0, `${name}: something was logged`);
      assertClean(h);
    }
  });

  test('the retry sweep, the nurture sweep and the unsubscribe routes', async () => {
    const h = harness({ nurtureEnabled: true });
    h.mailer.failWith = leakyError('ETIMEDOUT');
    await handleIntake(h.deps, jsonPost(payload('brief-request', { consentUpdates: true })));
    h.mailer.failWith = leakyError('ETIMEDOUT');
    h.clock.advance(10 * 60 * 1000);
    await retrySweep(h.deps);
    h.mailer.failWith = null;
    h.clock.advance(30 * 60 * 1000);
    await retrySweep(h.deps);
    const token = tokenOf(h);

    h.mailer.failWith = leakyError('ETIMEDOUT');
    h.clock.advance(4 * 24 * 60 * 60 * 1000);
    await nurtureSweep(h.deps);
    h.engagements.failRead = leakyError('ECONNRESET');
    await nurtureSweep(h.deps);
    h.engagements.failRead = null;
    h.mailer.failWith = null;

    await handleUnsubscribe(h.deps, request({ method: 'GET', query: { token } }));
    h.engagements.failUpdate = leakyError('ECONNRESET');
    await handleUnsubscribe(h.deps, request({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString() }));
    h.suppression.failPut = leakyError('ECONNRESET');
    await handleUnsubscribe(h.deps, request({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString() }));
    await retrySweep(h.deps);

    assert.ok(h.logs.length > 5);
    assertClean(h);
    for (const { line } of h.logs) assert.ok(!line.includes(token), 'the unsubscribe token is never logged');
  });
});

describe('the logger itself', () => {
  test('only allowlisted fields are written, and personal-looking values are redacted', () => {
    const line = formatLine('probe', { requestId: 'r-1', kind: 'apply', email: 'a@b.org', body: 'secret', client: 'a1b2c3', code: 'https://x.example/?sig=abc', stage: 2 });
    const parsed = JSON.parse(line) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed).sort(), ['client', 'code', 'event', 'kind', 'requestId', 'stage']);
    assert.equal(parsed['code'], '[redacted]');
  });

  test('an event name that is not a plain identifier is replaced', () => {
    assert.equal((JSON.parse(formatLine('a@b.org did a thing')) as { event: string }).event, 'invalid_event');
  });

  test('errorCode never returns the message', () => {
    assert.equal(errorCode(leakyError('ECONNRESET')), 'ECONNRESET');
    assert.equal(errorCode(new Error('contains ada@example.org')), 'Error');
    assert.equal(errorCode({ statusCode: 503, message: 'x@y.org' }), 'http_503');
    assert.equal(errorCode('ada@example.org'), 'unknown');
  });

  test('createLogger passes the level to the sink', () => {
    const seen: string[] = [];
    const log = createLogger({ write: (level, line) => seen.push(`${level}:${line}`) });
    log.warn('probe');
    assert.deepEqual(seen, ['warn:{"event":"probe"}']);
  });
});
