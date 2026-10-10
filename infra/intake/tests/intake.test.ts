import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { KINDS } from '../src/logic/contract.ts';
import { engagementFromRow } from '../src/logic/mapping.ts';
import { handleIntake } from '../src/service/intake.ts';
import { formPost, harness, jsonPost, leakyError, request, uuid, validPayload, ORIGIN } from './fakes.ts';

const REQUIRED_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function lowerHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function assertSecurityHeaders(headers: Readonly<Record<string, string>>, label: string): void {
  const lower = lowerHeaders(headers);
  for (const [name, value] of Object.entries(REQUIRED_HEADERS)) assert.equal(lower[name], value, `${label}: ${name}`);
  assert.ok(lower['content-security-policy']?.startsWith("default-src 'none'"), `${label}: CSP`);
  assert.equal(lower['set-cookie'], undefined, `${label}: a response never sets a cookie`);
}

describe('accepted submissions', () => {
  for (const kind of KINDS) {
    test(`${kind}: a valid post is stored first and answered 202`, async () => {
      const h = harness();
      const payload = validPayload(kind);
      const result = await handleIntake(h.deps, jsonPost(payload));
      assert.equal(result.status, 202);
      assert.deepEqual(JSON.parse(result.body), { ok: true });
      assert.equal(h.engagements.rows.size, 1);
      const [row] = [...h.engagements.rows.values()];
      assert.equal(row?.['we_kind'], kind);
      assert.equal(row?.['we_email'], 'ada@example.org');
      assert.equal(row?.['we_consent_at'], '2026-10-12T12:00:00.000Z');
      assert.equal(h.notifier.events.length, 1);
      assertSecurityHeaders(result.headers, kind);
      assert.equal(lowerHeaders(result.headers)['access-control-allow-origin'], ORIGIN);
    });
  }

  test('a brief request stores the row, mints a link, sends one email and marks it delivered', async () => {
    const h = harness();
    const payload = validPayload('brief-request', { consentUpdates: true });
    const result = await handleIntake(h.deps, jsonPost(payload));
    assert.equal(result.status, 202);
    assert.equal(h.mailer.sent.length, 1);
    const message = h.mailer.sent[0];
    assert.ok(message !== undefined);
    assert.equal(message.to, 'ada@example.org');
    assert.ok(message.text.includes('https://fake.blob.test/briefs/'), 'the signed link is in the email');
    assert.ok(message.text.includes('https://intake.worldenterprise.org/api/unsubscribe?token='), 'the unsubscribe link is in the email');
    assert.equal(message.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    const record = engagementFromRow(h.engagements.row(String(payload['requestId'])));
    assert.equal(record.status, 'delivered');
    assert.equal(record.briefVersion, '1.0');
    assert.equal(record.deliveryAttempts, 1);
    assert.equal(record.nurtureStage, 0);
    assert.equal(record.nurtureNextAt, '2026-10-15T12:00:00.000Z');
  });

  test('the unsubscribe token is stored encrypted and its hash is stored, never the token', async () => {
    const h = harness();
    const payload = validPayload('brief-request');
    await handleIntake(h.deps, jsonPost(payload));
    const row = h.engagements.row(String(payload['requestId']));
    const token = /token=([A-Za-z0-9_-]+)/.exec(h.mailer.sent[0]?.text ?? '')?.[1] ?? '';
    assert.ok(token.length >= 16);
    assert.ok(!JSON.stringify(row).includes(token), 'the clear token is not in the row');
    assert.match(String(row['we_unsubscribetoken']), /^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  test('an unknown brief id is 422 on briefId and writes nothing', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, jsonPost(validPayload('brief-request', { briefId: 'no-such-brief' })));
    assert.equal(result.status, 422);
    assert.ok('briefId' in (JSON.parse(result.body) as { errors: Record<string, string> }).errors);
    assert.equal(h.engagements.rows.size, 0);
  });
});

describe('field errors', () => {
  test('a wrong audience for the kind is 422 on audience and nothing is stored', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, jsonPost(validPayload('investor-interest', { audience: 'startup' })));
    assert.equal(result.status, 422);
    const body = JSON.parse(result.body) as { ok: boolean; errors: Record<string, string> };
    assert.equal(body.ok, false);
    assert.ok('audience' in body.errors);
    assert.equal(h.engagements.rows.size, 0);
    assert.equal(h.crm.accountCalls, 0);
  });

  test('malformed JSON is 400, an unknown form is 422, an unsupported content type is 415, a wrong method is 405', async () => {
    const h = harness();
    const malformed = await handleIntake(h.deps, request({ method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{not json' }));
    assert.equal(malformed.status, 400);
    const unknown = await handleIntake(h.deps, jsonPost({ form: 'webinar' }));
    assert.equal(unknown.status, 422);
    const plain = await handleIntake(h.deps, request({ method: 'POST', headers: { origin: ORIGIN, 'content-type': 'text/plain' }, body: 'x' }));
    assert.equal(plain.status, 415);
    const get = await handleIntake(h.deps, request({ method: 'GET', headers: { origin: ORIGIN } }));
    assert.equal(get.status, 405);
    for (const result of [malformed, unknown, plain, get]) assertSecurityHeaders(result.headers, String(result.status));
    assert.equal(h.engagements.rows.size, 0);
  });
});

describe('honeypot', () => {
  test('a non-empty website field returns 200, writes nothing and consumes no rate quota', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, jsonPost(validPayload('brief-request', { website: 'https://spam.example' })));
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), { ok: true });
    assert.equal(h.engagements.rows.size, 0);
    assert.equal(h.rate.consumeCalls, 0, 'the counter is a write, so the honeypot is checked first');
    assert.equal(h.rate.records.size, 0);
    assert.equal(h.crm.accountCalls, 0);
    assert.equal(h.crm.contacts.length, 0);
    assert.equal(h.mailer.sent.length, 0);
    assert.equal(h.notifier.events.length, 0);
    assertSecurityHeaders(result.headers, 'honeypot');
  });

  test('a form-encoded honeypot looks like a success too', async () => {
    const h = harness();
    const fields = Object.fromEntries(Object.entries(validPayload('apply', { website: 'x' })).map(([key, value]) => [key, String(value)]));
    const result = await handleIntake(h.deps, formPost(fields));
    assert.equal(result.status, 303);
    assert.equal(h.engagements.rows.size, 0);
  });
});

describe('idempotency', () => {
  test('a repeated request id returns the original outcome and sends no second email or row', async () => {
    const h = harness();
    const payload = validPayload('brief-request');
    const first = await handleIntake(h.deps, jsonPost(payload));
    const second = await handleIntake(h.deps, jsonPost(payload));
    assert.equal(first.status, 202);
    assert.equal(second.status, 200);
    assert.deepEqual(JSON.parse(second.body), { ok: true });
    assert.equal(h.engagements.rows.size, 1);
    assert.equal(h.mailer.sent.length, 1);
    assert.equal(h.links.minted.length, 1);
    assert.equal(h.notifier.events.length, 1);
  });

  test('a replay counts against the hour allowance (pinned decision: the rate limit comes before the Dataverse read)', async () => {
    const h = harness();
    const payload = validPayload('contact');
    await handleIntake(h.deps, jsonPost(payload));
    await handleIntake(h.deps, jsonPost(payload));
    assert.equal(h.rate.records.get(`ip:contact:${[...h.rate.records.keys()][0]?.split(':')[2]}`)?.count, 2);
  });

  test('two concurrent posts with one request id create one row', async () => {
    const h = harness();
    const payload = validPayload('contact');
    const [a, b] = await Promise.all([handleIntake(h.deps, jsonPost(payload)), handleIntake(h.deps, jsonPost(payload))]);
    assert.deepEqual([a.status, b.status].sort(), [200, 202]);
    assert.equal(h.engagements.rows.size, 1);
  });
});

describe('rate limits', () => {
  test('the sixth request in an hour from one address is 429 with Retry-After, and the window resets', async () => {
    const h = harness();
    for (let index = 0; index < 5; index += 1) {
      const result = await handleIntake(h.deps, jsonPost(validPayload('contact', { email: `person${index}@example.org` })));
      assert.equal(result.status, 202, `request ${index + 1}`);
      h.clock.advance(60 * 1000);
    }
    const sixth = await handleIntake(h.deps, jsonPost(validPayload('contact', { email: 'person5@example.org' })));
    assert.equal(sixth.status, 429);
    const retryAfter = Number(lowerHeaders(sixth.headers)['retry-after']);
    assert.equal(retryAfter, 55 * 60, 'five minutes of the hour have passed');
    assertSecurityHeaders(sixth.headers, '429');
    assert.equal(h.engagements.rows.size, 5);

    h.clock.advance(retryAfter * 1000);
    const later = await handleIntake(h.deps, jsonPost(validPayload('contact', { email: 'person6@example.org' })));
    assert.equal(later.status, 202);
  });

  test('a 429 exposes Retry-After to the browser', async () => {
    const h = harness();
    for (let index = 0; index < 5; index += 1) await handleIntake(h.deps, jsonPost(validPayload('contact', { email: `x${index}@example.org` })));
    const sixth = await handleIntake(h.deps, jsonPost(validPayload('contact', { email: 'x5@example.org' })));
    assert.equal(sixth.status, 429);
    const headers = lowerHeaders(sixth.headers);
    assert.equal(headers['access-control-expose-headers'], 'Retry-After');
    assert.equal(headers['access-control-allow-origin'], ORIGIN);
    assert.ok(Number(headers['retry-after']) >= 1);
  });

  test('the sixth request for one email address is 429 even from different addresses', async () => {
    const h = harness();
    for (let index = 0; index < 5; index += 1) {
      const result = await handleIntake(h.deps, jsonPost(validPayload('contact'), { 'x-azure-clientip': `198.51.100.${index + 1}` }));
      assert.equal(result.status, 202);
    }
    const sixth = await handleIntake(h.deps, jsonPost(validPayload('contact'), { 'x-azure-clientip': '198.51.100.99' }));
    assert.equal(sixth.status, 429);
    assert.ok(Number(lowerHeaders(sixth.headers)['retry-after']) >= 1);
  });

  test('limits are kept per kind', async () => {
    const h = harness();
    for (let index = 0; index < 5; index += 1) await handleIntake(h.deps, jsonPost(validPayload('contact', { email: `p${index}@example.org` })));
    const other = await handleIntake(h.deps, jsonPost(validPayload('apply', { email: 'q@example.org' })));
    assert.equal(other.status, 202);
  });

  test('a failing rate store answers 503 and stores nothing', async () => {
    const h = harness();
    h.rate.failWith = leakyError('ECONNRESET');
    const result = await handleIntake(h.deps, jsonPost(validPayload('contact')));
    assert.equal(result.status, 503);
    assert.equal(h.engagements.rows.size, 0);
  });
});

describe('origin, size and content type', () => {
  test('a disallowed or missing Origin is refused with 403 and nothing runs', async () => {
    const h = harness();
    for (const headers of [{ origin: 'https://evil.example' }, { origin: 'https://worldenterprise.org.evil.example' }, { origin: 'http://worldenterprise.org' }, {}]) {
      const result = await handleIntake(h.deps, request({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(validPayload('contact')) }));
      assert.equal(result.status, 403, JSON.stringify(headers));
      assert.equal(lowerHeaders(result.headers)['access-control-allow-origin'], undefined);
      assertSecurityHeaders(result.headers, 'origin');
    }
    assert.equal(h.rate.consumeCalls, 0);
    assert.equal(h.engagements.rows.size, 0);
  });

  test('the preview origin is allowed and is echoed, never a wildcard', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, jsonPost(validPayload('contact'), { origin: 'https://preview.example.test' }));
    assert.equal(result.status, 202);
    assert.equal(lowerHeaders(result.headers)['access-control-allow-origin'], 'https://preview.example.test');
    assert.equal(lowerHeaders(result.headers)['access-control-allow-credentials'], undefined);
  });

  test('Origin: null is accepted for a native form post only', async () => {
    const h = harness();
    const asJson = await handleIntake(h.deps, jsonPost(validPayload('contact'), { origin: 'null' }));
    assert.equal(asJson.status, 403);
    const fields = Object.fromEntries(Object.entries(validPayload('apply')).map(([key, value]) => [key, String(value)]));
    const asForm = await handleIntake(h.deps, formPost(fields, { origin: 'null' }));
    assert.equal(asForm.status, 303);
    assert.equal(lowerHeaders(asForm.headers)['access-control-allow-origin'], undefined);
  });

  test('the preflight answers an allowed origin and refuses another', async () => {
    const h = harness();
    const ok = await handleIntake(h.deps, request({ method: 'OPTIONS', headers: { origin: ORIGIN } }));
    assert.equal(ok.status, 204);
    const headers = lowerHeaders(ok.headers);
    assert.equal(headers['access-control-allow-origin'], ORIGIN);
    assert.equal(headers['access-control-allow-headers'], 'Content-Type');
    assert.ok(headers['access-control-allow-methods']?.includes('POST'));
    assertSecurityHeaders(ok.headers, 'preflight');
    const refused = await handleIntake(h.deps, request({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
    assert.equal(refused.status, 403);
  });

  test('a body over the cap is refused, by its declared length and by its actual length', async () => {
    const h = harness();
    const declared = await handleIntake(h.deps, jsonPost(validPayload('contact'), { 'content-length': String(64 * 1024) }));
    assert.equal(declared.status, 413);
    const big = validPayload('contact', { message: 'x'.repeat(40 * 1024) });
    const actual = await handleIntake(h.deps, jsonPost(big));
    assert.equal(actual.status, 413);
    assert.equal(h.engagements.rows.size, 0);
    assert.equal(h.rate.consumeCalls, 0);
  });
});

describe('form-encoded posts', () => {
  function fieldsFor(kind: string, overrides: Record<string, unknown> = {}): Record<string, string> {
    return Object.fromEntries(Object.entries(validPayload(kind, overrides)).map(([key, value]) => [key, value === true ? 'on' : value === false ? '' : String(value)]));
  }

  test('each kind with a thanks page answers 303 to it', async () => {
    const expected: Record<string, string> = {
      apply: '/apply/thanks/', 'brief-request': '/briefs/thanks/', 'investor-interest': '/investors/interest/thanks/', 'partner-enquiry': '/network/partners/enquire/thanks/',
    };
    for (const [kind, path] of Object.entries(expected)) {
      const h = harness();
      const result = await handleIntake(h.deps, formPost(fieldsFor(kind)));
      assert.equal(result.status, 303, kind);
      assert.equal(lowerHeaders(result.headers)['location'], `https://worldenterprise.org${path}`);
      assertSecurityHeaders(result.headers, kind);
      assert.equal(h.engagements.rows.size, 1);
    }
  });

  test('an allowlisted redirect is honored, anything else is ignored', async () => {
    const attempts = ['https://evil.example/apply/thanks/', 'https://worldenterprise.org.evil.example/apply/thanks/', '//evil.example/apply/thanks/', '/admin/', 'javascript:alert(1)', 'https://worldenterprise.org/briefs/thanks/?x=1'];
    for (const redirect of attempts) {
      const h = harness();
      const result = await handleIntake(h.deps, formPost(fieldsFor('apply', { redirect })));
      assert.equal(result.status, 303, redirect);
      const location = lowerHeaders(result.headers)['location'];
      assert.ok(location === 'https://worldenterprise.org/apply/thanks/' || location === 'https://worldenterprise.org/briefs/thanks/', `${redirect} -> ${location}`);
      assert.ok(!location?.includes('evil'), redirect);
      assert.ok(!location?.includes('?'), redirect);
    }
    const h = harness();
    const honored = await handleIntake(h.deps, formPost(fieldsFor('apply', { redirect: 'https://worldenterprise.org/apply/thanks/' })));
    assert.equal(lowerHeaders(honored.headers)['location'], 'https://worldenterprise.org/apply/thanks/');
  });

  test('a kind with no thanks page gets a small confirmation page, not a redirect', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, formPost(fieldsFor('contact')));
    assert.equal(result.status, 200);
    assert.ok(lowerHeaders(result.headers)['content-type']?.startsWith('text/html'));
    assert.equal(lowerHeaders(result.headers)['location'], undefined);
  });

  test('a native post with the build-time-empty request id gets one from the server', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, formPost(fieldsFor('apply', { requestId: '' })));
    assert.equal(result.status, 303);
    const [row] = [...h.engagements.rows.values()];
    assert.match(String(row?.['we_requestid']), /^[0-9a-f-]{36}$/);
  });
});

describe('failure handling', () => {
  test('a failing mail sender still answers 202 and leaves the row delivery-failed', async () => {
    const h = harness();
    h.mailer.failWith = leakyError('ETIMEDOUT');
    const payload = validPayload('brief-request');
    const result = await handleIntake(h.deps, jsonPost(payload));
    assert.equal(result.status, 202);
    const record = engagementFromRow(h.engagements.row(String(payload['requestId'])));
    assert.equal(record.status, 'delivery-failed');
    assert.equal(record.deliveryAttempts, 1);
    assert.ok(h.logs.some((entry) => entry.level === 'error' && entry.line.includes('delivery_failed')), 'an alertable event is logged');
  });

  test('a link that cannot be minted is a delivery failure, not a request failure', async () => {
    const h = harness();
    h.links.failWith = leakyError('AuthorizationFailure');
    const payload = validPayload('brief-request');
    const result = await handleIntake(h.deps, jsonPost(payload));
    assert.equal(result.status, 202);
    assert.equal(engagementFromRow(h.engagements.row(String(payload['requestId']))).status, 'delivery-failed');
  });

  test('a failing Dataverse write answers 503 and keeps nothing: no row, no email, no notification', async () => {
    const h = harness();
    h.engagements.failCreate = leakyError('ServiceUnavailable');
    const result = await handleIntake(h.deps, jsonPost(validPayload('brief-request')));
    assert.equal(result.status, 503);
    assert.ok(Number(lowerHeaders(result.headers)['retry-after']) > 0);
    assert.equal(h.engagements.rows.size, 0);
    assert.equal(h.mailer.sent.length, 0);
    assert.equal(h.links.minted.length, 0);
    assert.equal(h.notifier.events.length, 0);
    assertSecurityHeaders(result.headers, '503');
  });

  test('a failing Account or Contact step answers 503 and stores no row', async () => {
    const h = harness();
    h.crm.failWith = leakyError('ServiceUnavailable');
    const result = await handleIntake(h.deps, jsonPost(validPayload('apply')));
    assert.equal(result.status, 503);
    assert.equal(h.engagements.rows.size, 0);
  });

  test('after a 503 the same request id can be retried and succeeds', async () => {
    const h = harness();
    const payload = validPayload('contact');
    h.engagements.failCreate = leakyError('ServiceUnavailable');
    assert.equal((await handleIntake(h.deps, jsonPost(payload))).status, 503);
    h.engagements.failCreate = null;
    assert.equal((await handleIntake(h.deps, jsonPost(payload))).status, 202);
    assert.equal(h.engagements.rows.size, 1);
  });

  test('a failed read-back after the write does not turn the stored request into an error', async () => {
    const h = harness();
    const original = h.engagements.getByRequestId.bind(h.engagements);
    let reads = 0;
    h.engagements.getByRequestId = async (id) => {
      reads += 1;
      if (reads === 2) throw leakyError('ECONNRESET');
      return original(id);
    };
    const result = await handleIntake(h.deps, jsonPost(validPayload('brief-request')));
    assert.equal(result.status, 202);
    assert.equal(h.engagements.rows.size, 1);
    assert.equal(h.mailer.sent.length, 0, 'the retry sweep sends it later');
  });

  test('a failing webhook never affects the response', async () => {
    const h = harness();
    h.notifier.failWith = leakyError('ECONNRESET');
    assert.equal((await handleIntake(h.deps, jsonPost(validPayload('contact')))).status, 202);
  });
});

describe('Account and Contact', () => {
  test('two people at one organization domain share one Account and each get a Contact', async () => {
    const h = harness();
    await handleIntake(h.deps, jsonPost(validPayload('apply', { email: 'a@startup.example', name: 'A One' })));
    await handleIntake(h.deps, jsonPost(validPayload('apply', { email: 'b@startup.example', name: 'B Two' })));
    assert.equal(h.crm.accounts.size, 1);
    assert.ok(h.crm.accounts.has('domain:startup.example'));
    assert.equal(h.crm.contacts.length, 2);
    assert.equal(h.crm.contacts[0]?.fields['parentcustomerid_account@odata.bind'], '/accounts(acct-1)');
  });

  test('a consumer mailbox gets a person-level Account and is never merged with another person at that provider', async () => {
    const h = harness();
    await handleIntake(h.deps, jsonPost(validPayload('apply', { email: 'ada@gmail.com' })));
    await handleIntake(h.deps, jsonPost(validPayload('apply', { email: 'bob@gmail.com', name: 'Bob Builder' })));
    assert.equal(h.crm.accounts.size, 2);
    assert.ok(h.crm.accounts.has('person:ada@gmail.com'));
    assert.ok(!h.crm.accounts.has('domain:gmail.com'));
    assert.equal(h.crm.contacts[0]?.fields['parentcustomerid_account@odata.bind'], undefined);
  });

  test('a returning person reuses the Contact; the contact create runs under a lease lock', async () => {
    const h = harness();
    await handleIntake(h.deps, jsonPost(validPayload('apply')));
    await handleIntake(h.deps, jsonPost(validPayload('contact')));
    assert.equal(h.crm.contacts.length, 1);
    assert.deepEqual(h.lock.keys.length, 2);
    assert.ok(h.lock.keys.every((key) => key.startsWith('contact:')));
  });

  test('an ambiguous contact match keeps the engagement row, unlinked, and flags it for review', async () => {
    const h = harness();
    h.crm.contacts.push({ id: 'dup-1', fields: { emailaddress1: 'ada@example.org' } }, { id: 'dup-2', fields: { emailaddress1: 'ada@example.org' } });
    const payload = validPayload('contact');
    const result = await handleIntake(h.deps, jsonPost(payload));
    assert.equal(result.status, 202);
    const row = h.engagements.row(String(payload['requestId']));
    assert.equal(engagementFromRow(row).review, 'contact-ambiguous');
    assert.equal(row['we_Contact@odata.bind'], undefined);
    assert.equal(h.crm.contacts.length, 2, 'no third contact is created');
  });

  test('a contact is opted out of bulk email unless the person ticked the updates box', async () => {
    const h = harness();
    await handleIntake(h.deps, jsonPost(validPayload('brief-request', { email: 'a@one.example', consentUpdates: false })));
    await handleIntake(h.deps, jsonPost(validPayload('brief-request', { email: 'b@two.example', consentUpdates: true })));
    assert.equal(h.crm.contacts[0]?.fields['donotbulkemail'], true);
    assert.equal(h.crm.contacts[1]?.fields['donotbulkemail'], false);
  });
});

describe('uuid helper sanity', () => {
  test('test payloads use distinct request ids', () => {
    assert.notEqual(uuid(), uuid());
  });
});
