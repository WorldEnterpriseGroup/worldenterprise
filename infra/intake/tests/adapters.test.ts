import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { UserDelegationKey } from '@azure/storage-blob';

import { BlobBriefRegistry, BlobLock, BlobRateStore, BlobSuppression, parseRegistry, StateError } from '../src/azure/blob.ts';
import { readConfig } from '../src/azure/config.ts';
import { DataverseClient, DataverseCrm, DataverseEngagements, DataverseError } from '../src/azure/dataverse.ts';
import { toRequestLike, toResponse, type RuntimeRequest } from '../src/azure/http-adapter.ts';
import { SasLinks } from '../src/azure/links.ts';
import { AcsMailer, MailError, type EmailSender } from '../src/azure/mailer.ts';
import { LOGIC_APP_AUDIENCE, LogicAppNotifier, NotifyError } from '../src/azure/notify.ts';
import { buildNotifyEvent, engagementFromRow } from '../src/logic/mapping.ts';
import { RATE_LIMIT } from '../src/logic/rate.ts';
import { MemoryBlobPort } from './blob-fake.ts';
import { FakeClock, leakyError } from './fakes.ts';

const EMAIL = 'ada@example.org';

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

type Scripted = Response | Error | ((seen: Seen) => Response | Error);

function jsonResponse(status: number, payload?: unknown, headers: Record<string, string> = {}): Response {
  if (status === 204 || payload === undefined) return new Response(null, { status, headers });
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function scriptedFetch(script: Scripted[]): { fetch: typeof fetch; seen: Seen[] } {
  const seen: Seen[] = [];
  const fake = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const record: Seen = {
      method: init?.method ?? 'GET',
      url: String(input),
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    seen.push(record);
    const next = script.shift();
    if (next === undefined) return Promise.reject(new Error('unscripted request'));
    const value = typeof next === 'function' ? next(record) : next;
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  };
  return { fetch: fake as typeof fetch, seen };
}

function client(script: Scripted[], sleeps: number[] = []): { client: DataverseClient; seen: Seen[] } {
  const scripted = scriptedFetch(script);
  return {
    seen: scripted.seen,
    client: new DataverseClient({ baseUrl: 'https://org.crm.example', fetch: scripted.fetch, getToken: () => Promise.resolve('TOKEN-VALUE'), sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); } }),
  };
}

describe('Dataverse engagements', () => {
  test('create is a POST carrying the alternate key, so it can never overwrite: 204 is created and 412 is exists', async () => {
    const created = client([jsonResponse(204)]);
    assert.equal(await new DataverseEngagements(created.client).createIfAbsent('req-1', { we_kind: 'apply' }), 'created');
    const [request] = created.seen;
    assert.equal(request?.method, 'POST');
    assert.equal(request?.url, 'https://org.crm.example/api/data/v9.2/we_engagements');
    assert.deepEqual(request?.body, { we_kind: 'apply', we_requestid: 'req-1' });
    assert.equal(request?.headers['Authorization'], 'Bearer TOKEN-VALUE');
    const exists = client([jsonResponse(412)]);
    assert.equal(await new DataverseEngagements(exists.client).createIfAbsent('req-1', {}), 'exists');
  });

  // Gate for #119: Dataverse answers an alternate-key PATCH with `If-None-Match: *` for a NEW key with 404 (0x80060891), so that
  // pattern can never create. No create-only write may use it.
  test('no create-only write addresses a row by alternate key with If-None-Match', async () => {
    const seen: Seen[] = [];
    const dataverse = (record: Seen): Response => {
      seen.push(record);
      if (record.headers['If-None-Match'] !== undefined) return jsonResponse(404, { error: { code: '0x80060891' } });
      return record.method === 'POST' ? jsonResponse(201, { accountid: 'acct-1', leadid: 'lead-1' }) : jsonResponse(500);
    };
    const engagements = client([dataverse]);
    assert.equal(await new DataverseEngagements(engagements.client).createIfAbsent('req-1', {}), 'created');
    const crm = client([dataverse, dataverse]);
    assert.deepEqual(await new DataverseCrm(crm.client).ensureAccount({ key: 'domain:example.org', fields: {}, organization: true }), { id: 'acct-1' });
    assert.deepEqual(await new DataverseCrm(crm.client).ensureLead('req-1', {}), { id: 'lead-1' });
    assert.ok(seen.every((record) => record.method === 'POST' && !record.url.includes("='")), JSON.stringify(seen.map((r) => [r.method, r.url])));
  });

  test('any other status is an error carrying the status as its code, with no request data in the message', async () => {
    const failing = client([jsonResponse(500, { error: { message: `bad ${EMAIL}` } })]);
    await assert.rejects(new DataverseEngagements(failing.client).createIfAbsent('req-1', { we_email: EMAIL }), (error: unknown) => {
      assert.ok(error instanceof DataverseError);
      assert.equal(error.code, 'dataverse_http_500');
      assert.ok(!error.message.includes(EMAIL) && !error.message.includes('org.crm.example'));
      return true;
    });
  });

  test('reads filter on the request id and the token hash, and an empty page is null', async () => {
    const found = client([jsonResponse(200, { value: [{ we_engagementid: 'row-1', we_requestid: 'req-1', we_status: 100000000, we_email: EMAIL }] }), jsonResponse(200, { value: [] })]);
    const store = new DataverseEngagements(found.client);
    const record = await store.getByRequestId('req-1');
    assert.equal(record?.id, 'row-1');
    assert.equal(record?.email, EMAIL);
    assert.ok(decodeURIComponent(found.seen[0]?.url ?? '').includes("$filter=we_requestid eq 'req-1'"));
    assert.equal(await store.getByTokenHash('abc'), null);
    assert.ok(decodeURIComponent(found.seen[1]?.url ?? '').includes("we_tokenhash eq 'abc'"));
  });

  test('an update patches only the named columns and refuses to create', async () => {
    const updated = client([jsonResponse(204)]);
    await new DataverseEngagements(updated.client).update('row-1', { status: 'delivered', deliveryAttempts: 2, deliveredAt: new Date('2026-10-12T12:00:00Z'), nurtureNextAt: null });
    const [request] = updated.seen;
    assert.equal(request?.headers['If-Match'], '*');
    assert.deepEqual(request?.body, { we_status: 100000001, we_deliveryattempts: 2, we_deliveredat: '2026-10-12T12:00:00.000Z', we_nurturenextat: null });
  });

  test('linking a Lead binds the lookup, and the notification time is a plain column', async () => {
    const linked = client([jsonResponse(204), jsonResponse(204)]);
    const store = new DataverseEngagements(linked.client);
    await store.update('row-1', { leadId: 'lead-7' });
    await store.update('row-1', { notifiedAt: new Date('2026-10-12T12:00:00Z') });
    assert.deepEqual(linked.seen[0]?.body, { 'we_Lead@odata.bind': '/leads(lead-7)' });
    assert.deepEqual(linked.seen[1]?.body, { we_notifiedat: '2026-10-12T12:00:00.000Z' });
  });

  test('a row read back carries the lookups and the contents a Lead is built from', async () => {
    const read = client([jsonResponse(200, { value: [{
      we_engagementid: 'row-1', we_requestid: 'req-1', we_kind: 'contact', we_submittername: 'Ada Example', we_email: EMAIL, we_message: 'Hello',
      _we_lead_value: 'lead-1', _we_contact_value: 'c-1', _we_account_value: 'a-1', we_notifiedat: '2026-10-12T12:00:00Z',
    }] })]);
    const record = await new DataverseEngagements(read.client).getByRequestId('req-1');
    assert.deepEqual([record?.leadId, record?.contactId, record?.accountId, record?.message, record?.notifiedAt], ['lead-1', 'c-1', 'a-1', 'Hello', '2026-10-12T12:00:00Z']);
    const selected = decodeURIComponent(read.seen[0]?.url ?? '');
    for (const column of ['_we_lead_value', '_we_contact_value', '_we_account_value', 'we_notifiedat', 'we_message']) assert.ok(selected.includes(column), column);
  });

  test('the follow-up query covers the window, the unsent notifications and the missing Leads, and leaves newsletter signups without a Lead', async () => {
    const owed = client([jsonResponse(200, { value: [] })]);
    await new DataverseEngagements(owed.client).listFollowUpPending(new Date('2026-10-05T12:00:00Z'), new Date('2026-10-12T11:50:00Z'), 25);
    const url = decodeURIComponent(owed.seen[0]?.url ?? '');
    assert.ok(url.includes('createdon gt 2026-10-05T12:00:00.000Z and createdon lt 2026-10-12T11:50:00.000Z'));
    assert.ok(url.includes("(we_notifiedat eq null or (_we_lead_value eq null and we_kind ne 'newsletter'))"));
    assert.ok(url.includes('$top=25'));
  });

  test('the sweep queries select brief requests that failed or went stale, and nurture rows that are due', async () => {
    const queries = client([jsonResponse(200, { value: [] }), jsonResponse(200, { value: [] })]);
    const store = new DataverseEngagements(queries.client);
    await store.listDeliveryPending(new Date('2026-10-12T11:50:00Z'), 25);
    await store.listNurtureDue(new Date('2026-10-12T12:00:00Z'), 50);
    const delivery = decodeURIComponent(queries.seen[0]?.url ?? '');
    assert.ok(delivery.includes("we_kind eq 'brief-request'"));
    assert.ok(delivery.includes('we_status eq 100000002'));
    assert.ok(delivery.includes('we_deliveryattempts eq 0 and createdon lt 2026-10-12T11:50:00.000Z'));
    assert.ok(delivery.includes('$top=25'));
    const nurture = decodeURIComponent(queries.seen[1]?.url ?? '');
    assert.ok(nurture.includes('we_status eq 100000001 and we_consentupdates eq true and we_nurturestage lt 3 and we_nurturenextat le 2026-10-12T12:00:00.000Z'));
  });
});

describe('Dataverse accounts and contacts', () => {
  const plan = { key: "domain:o'brien.example", fields: { name: 'O Brien Co' }, organization: true };

  test('a new account is a POST carrying its alternate key in the body', async () => {
    const made = client([jsonResponse(201, { accountid: 'acct-9' })]);
    assert.deepEqual(await new DataverseCrm(made.client).ensureAccount(plan), { id: 'acct-9' });
    const [request] = made.seen;
    assert.equal(request?.method, 'POST');
    assert.ok(request?.url.endsWith('/accounts'), request?.url);
    assert.equal(request?.headers['If-None-Match'], undefined);
    assert.deepEqual(request?.body, { name: 'O Brien Co', we_accountkey: "domain:o'brien.example" });
  });

  test('an existing account is read back and not changed', async () => {
    const existing = client([jsonResponse(412), jsonResponse(200, { value: [{ accountid: 'acct-3' }] })]);
    assert.deepEqual(await new DataverseCrm(existing.client).ensureAccount(plan), { id: 'acct-3' });
    assert.equal(existing.seen.length, 2);
    assert.equal(existing.seen[1]?.method, 'GET');
  });

  test('contacts are found by an escaped filter, limited to three and to active records', async () => {
    const found = client([jsonResponse(200, { value: [{ contactid: 'c-1' }, { contactid: 'c-2' }] })]);
    const matches = await new DataverseCrm(found.client).findContactsByEmail("o'brien@example.org");
    assert.deepEqual(matches, [{ id: 'c-1' }, { id: 'c-2' }]);
    const url = decodeURIComponent(found.seen[0]?.url ?? '');
    assert.ok(url.includes("emailaddress1 eq 'o''brien@example.org' and statecode eq 0"));
    assert.ok(url.includes('$top=3'));
  });

  test('create returns the id from the entity header or the body, and opt-out patches donotbulkemail', async () => {
    const guid = '8c6f0d2e-1b7a-4e53-9a41-0f2d3c4b5a69';
    const made = client([jsonResponse(204, undefined, { 'OData-EntityId': `https://org.crm.example/api/data/v9.2/contacts(${guid})` }), jsonResponse(204)]);
    const crm = new DataverseCrm(made.client);
    assert.deepEqual(await crm.createContact({ lastname: 'Lovelace' }), { id: guid });
    await crm.markContactOptedOut(guid);
    assert.deepEqual(made.seen[1]?.body, { donotbulkemail: true });
    assert.equal(made.seen[1]?.headers['If-Match'], '*');
  });

  test('a new Lead is a POST carrying the request id as its alternate key, so it cannot overwrite', async () => {
    const guid = '8c6f0d2e-1b7a-4e53-9a41-0f2d3c4b5a69';
    const made = client([jsonResponse(204, undefined, { 'OData-EntityId': `https://org.crm.example/api/data/v9.2/leads(${guid})` })]);
    assert.deepEqual(await new DataverseCrm(made.client).ensureLead("req'1", { subject: 'S' }), { id: guid });
    const [request] = made.seen;
    assert.equal(request?.method, 'POST');
    assert.ok(request?.url.endsWith('/leads'), request?.url);
    assert.equal(request?.headers['If-None-Match'], undefined);
    assert.deepEqual(request?.body, { subject: 'S', we_requestid: "req'1" });
  });

  test('a Lead that already exists for the request is read back, not duplicated or changed', async () => {
    const existing = client([jsonResponse(412), jsonResponse(200, { value: [{ leadid: 'lead-3' }] })]);
    assert.deepEqual(await new DataverseCrm(existing.client).ensureLead('req-1', {}), { id: 'lead-3' });
    assert.equal(existing.seen.length, 2);
    assert.equal(existing.seen[1]?.method, 'GET');
    assert.ok(decodeURIComponent(existing.seen[1]?.url ?? '').includes("we_requestid eq 'req-1'"));
    const lost = client([jsonResponse(412), jsonResponse(200, { value: [] })]);
    await assert.rejects(new DataverseCrm(lost.client).ensureLead('req-1', {}), { code: 'dataverse_lead_missing' });
    const refused = client([jsonResponse(403, { error: { message: `no ${EMAIL}` } })]);
    await assert.rejects(new DataverseCrm(refused.client).ensureLead('req-1', {}), (error: unknown) => error instanceof DataverseError && error.code === 'dataverse_http_403' && !error.message.includes(EMAIL));
  });

  test('the contact linked to an engagement comes from the lookup value, or is null', async () => {
    const lookups = client([jsonResponse(200, { _we_contact_value: 'c-7' }), jsonResponse(200, {})]);
    const crm = new DataverseCrm(lookups.client);
    assert.equal(await crm.contactOfEngagement('row-1'), 'c-7');
    assert.equal(await crm.contactOfEngagement('row-2'), null);
  });
});

describe('Dataverse client failure handling', () => {
  test('a throttled call is retried once after the advertised wait, capped', async () => {
    const sleeps: number[] = [];
    const throttled = client([jsonResponse(429, undefined, { 'retry-after': '120' }), jsonResponse(204)], sleeps);
    await new DataverseEngagements(throttled.client).update('row-1', { status: 'delivered' });
    assert.deepEqual(sleeps, [5000]);
    assert.equal(throttled.seen.length, 2);
    const stillThrottled = client([jsonResponse(503), jsonResponse(503)]);
    await assert.rejects(new DataverseEngagements(stillThrottled.client).update('row-1', {}), { code: 'dataverse_http_503' });
  });

  test('network failures and token failures surface as stable codes without the underlying message', async () => {
    const network = client([leakyError('ECONNRESET')]);
    await assert.rejects(new DataverseEngagements(network.client).getByRequestId('req-1'), (error: unknown) => {
      assert.ok(error instanceof DataverseError);
      assert.equal(error.code, 'dataverse_network');
      assert.ok(!error.message.includes('SECRETTOKEN') && !error.message.includes('example.org'));
      return true;
    });
    const noToken = new DataverseClient({ baseUrl: 'https://org.crm.example', fetch: scriptedFetch([]).fetch, getToken: () => Promise.reject(leakyError('CredentialUnavailable')) });
    await assert.rejects(new DataverseEngagements(noToken).getByRequestId('req-1'), (error: unknown) => {
      assert.ok(error instanceof DataverseError);
      assert.equal(error.code, 'dataverse_token');
      assert.ok(!error.message.includes('SECRETTOKEN'));
      return true;
    });
  });
});

describe('rate counters in blobs', () => {
  test('five requests pass, the sixth is refused with a Retry-After, and the refusal writes nothing', async () => {
    const blobs = new MemoryBlobPort();
    const clock = new FakeClock();
    const store = new BlobRateStore(blobs);
    for (let index = 0; index < RATE_LIMIT; index += 1) assert.equal((await store.consume('ip:apply:h', clock.now())).allowed, true);
    const writes = blobs.puts.length;
    const refused = await store.consume('ip:apply:h', clock.now());
    assert.equal(refused.allowed, false);
    assert.ok(refused.retryAfterSeconds > 0);
    assert.equal(blobs.puts.length, writes);
    clock.advance(61 * 60 * 1000);
    assert.equal((await store.consume('ip:apply:h', clock.now())).allowed, true);
  });

  test('counters are independent per key, and a lost race is retried', async () => {
    const blobs = new MemoryBlobPort();
    const store = new BlobRateStore(blobs);
    assert.equal((await store.consume('ip:apply:a', 0)).record.count, 1);
    assert.equal((await store.consume('ip:apply:b', 0)).record.count, 1);
    blobs.forceConflicts = 2;
    assert.equal((await store.consume('ip:apply:a', 0)).record.count, 2);
  });

  test('persistent contention is an error, not a free pass', async () => {
    const blobs = new MemoryBlobPort();
    blobs.forceConflicts = 100;
    await assert.rejects(new BlobRateStore(blobs).consume('k', 0), { code: 'rate_contention' });
  });

  test('a corrupt counter is treated as empty rather than locking the visitor out', async () => {
    const blobs = new MemoryBlobPort();
    const store = new BlobRateStore(blobs);
    await store.consume('k', 0);
    for (const name of blobs.blobs.keys()) blobs.blobs.set(name, { text: '{"windowStart":"x"}', etag: 99 });
    assert.equal((await store.consume('k', 0)).allowed, true);
  });
});

describe('the contact lock', () => {
  test('a second holder waits for the first, and the lease is released after the work', async () => {
    const blobs = new MemoryBlobPort();
    const clock = new FakeClock();
    // The wait yields to the event loop, so the first holder can finish while the second one polls.
    const lock = new BlobLock(blobs, { clock, pollMs: 10, sleep: async (ms) => { await new Promise((resolve) => setImmediate(resolve)); clock.advance(ms); } });
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = lock.withLock('contact:x', async () => { order.push('first-start'); await gate; order.push('first-end'); });
    await Promise.resolve();
    const second = lock.withLock('contact:x', () => { order.push('second'); return Promise.resolve(); });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(order, ['first-start']);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, ['first-start', 'first-end', 'second']);
    assert.equal(blobs.leases.size, 0);
  });

  test('a lock that stays held produces lock_unavailable, and a failing job still releases it', async () => {
    const blobs = new MemoryBlobPort();
    const clock = new FakeClock();
    const lock = new BlobLock(blobs, { clock, waitMs: 100, pollMs: 40, sleep: (ms) => { clock.advance(ms); return Promise.resolve(); } });
    let inner: Promise<unknown> = Promise.resolve();
    await lock.withLock('k', () => {
      inner = assert.rejects(lock.withLock('k', () => Promise.resolve()), { code: 'lock_unavailable' });
      return inner;
    });
    await assert.rejects(lock.withLock('k2', () => Promise.reject(new Error('boom'))), { message: 'boom' });
    assert.equal(blobs.leases.size, 0);
  });
});

describe('suppression list in blobs', () => {
  test('an unsynced record is found by the sweep until it is marked synced', async () => {
    const store = new BlobSuppression(new MemoryBlobPort());
    await store.put('hash-1', { at: '2026-10-12T12:00:00Z', crmSynced: false, engagementId: 'row-1' });
    assert.deepEqual((await store.get('hash-1'))?.engagementId, 'row-1');
    assert.equal((await store.listUnsynced(10)).length, 1);
    await store.put('hash-1', { at: '2026-10-12T12:00:00Z', crmSynced: true, engagementId: 'row-1' });
    assert.equal((await store.listUnsynced(10)).length, 0);
    assert.equal((await store.get('hash-1'))?.crmSynced, true);
    assert.equal(await store.get('absent'), null);
  });

  test('a corrupt suppression record is an error, never read as "not suppressed"', async () => {
    const blobs = new MemoryBlobPort();
    blobs.blobs.set('suppression/h.json', { text: 'not json', etag: 1 });
    await assert.rejects(new BlobSuppression(blobs).get('h'), (error: unknown) => error instanceof StateError && error.code === 'state_corrupt');
  });
});

describe('brief registry', () => {
  const registry = (extra: object = {}): string => JSON.stringify({ version: 1, briefs: [{ id: 'funding-paths', title: 'Funding paths', version: '2', pdfPath: 'briefs/funding-paths/v2/funding-paths.pdf', htmlPath: 'briefs/funding-paths/v2/funding-paths.html', ...extra }] });

  test('reads the published entries and caches them for a minute', async () => {
    const blobs = new MemoryBlobPort();
    blobs.blobs.set('briefs.json', { text: registry(), etag: 1 });
    const clock = new FakeClock();
    const reader = new BlobBriefRegistry(blobs, clock);
    assert.equal((await reader.list())[0]?.id, 'funding-paths');
    blobs.blobs.delete('briefs.json');
    assert.equal((await reader.list()).length, 1);
    clock.advance(61_000);
    await assert.rejects(reader.list(), { code: 'registry_missing' });
  });

  test('a malformed registry, a path outside the entry folder or a traversal is refused', () => {
    assert.throws(() => parseRegistry('{'), { code: 'state_corrupt' });
    assert.throws(() => parseRegistry('{"version":2,"briefs":[]}'), { code: 'registry_invalid' });
    assert.throws(() => parseRegistry(registry({ pdfPath: 'briefs/other/v2/x.pdf' })), { code: 'registry_invalid' });
    assert.throws(() => parseRegistry(registry({ pdfPath: 'briefs/funding-paths/v2/../../secret.pdf' })), { code: 'registry_invalid' });
    assert.throws(() => parseRegistry(registry({ id: 'Bad Id' })), { code: 'registry_invalid' });
    assert.throws(() => parseRegistry(registry({ version: 'two' })), { code: 'registry_invalid' });
    assert.deepEqual(parseRegistry('{"version":1,"briefs":[]}'), []);
  });
});

describe('signed brief links', () => {
  const NOW = Date.parse('2026-10-12T12:00:00.000Z');
  const entry = { id: 'funding-paths', title: 'Funding paths', version: '2', pdfPath: 'briefs/funding-paths/v2/funding-paths.pdf', htmlPath: 'briefs/funding-paths/v2/funding-paths.html' };
  function delegationKey(startsOn: Date, expiresOn: Date): UserDelegationKey {
    return {
      signedObjectId: '00000000-0000-4000-8000-000000000001',
      signedTenantId: '00000000-0000-4000-8000-000000000002',
      signedStartsOn: startsOn,
      signedExpiresOn: expiresOn,
      signedService: 'b',
      signedVersion: '2024-11-04',
      value: Buffer.alloc(32, 7).toString('base64'),
    };
  }

  test('the link is read-only, https-only, backdated five minutes and good for 48 hours', async () => {
    const links = new SasLinks({ accountName: 'weintakeexample', container: 'briefs', keys: { get: (start, expiry) => Promise.resolve(delegationKey(start, expiry)) } });
    const url = new URL(await links.mintLink(entry, NOW));
    assert.equal(url.origin, 'https://weintakeexample.blob.core.windows.net');
    assert.equal(url.pathname, '/briefs/briefs/funding-paths/v2/funding-paths.pdf');
    assert.equal(url.searchParams.get('sp'), 'r');
    assert.equal(url.searchParams.get('spr'), 'https');
    assert.equal(url.searchParams.get('st'), new Date(NOW - 5 * 60 * 1000).toISOString().replace('.000Z', 'Z'));
    assert.equal(url.searchParams.get('se'), new Date(NOW + 48 * 60 * 60 * 1000).toISOString().replace('.000Z', 'Z'));
    assert.ok((url.searchParams.get('sig') ?? '').length > 20);
    assert.ok(url.searchParams.get('skoid') !== null, 'signed with a user delegation key, not an account key');
    assert.match(url.searchParams.get('rscd') ?? '', /^attachment; filename="funding-paths-v2\.pdf"$/);
  });

  test('the delegation key is reused, then renewed before it could expire under a fresh link', async () => {
    let fetched = 0;
    const links = new SasLinks({ accountName: 'weintakeexample', container: 'briefs', keys: { get: (start, expiry) => { fetched += 1; return Promise.resolve(delegationKey(start, expiry)); } } });
    await links.mintLink(entry, NOW);
    await links.mintLink(entry, NOW + 60 * 60 * 1000);
    assert.equal(fetched, 1);
    await links.mintLink(entry, NOW + 23 * 60 * 60 * 1000);
    assert.equal(fetched, 2);
  });
});

describe('ACS mailer', () => {
  const message = { to: EMAIL, subject: 'Your WE brief', text: 'text', html: '<p>html</p>', headers: { 'List-Unsubscribe': '<https://x.example/u>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };

  function sender(status: string | Error): { sender: EmailSender; sent: Parameters<EmailSender['beginSend']>[0][] } {
    const sent: Parameters<EmailSender['beginSend']>[0][] = [];
    return {
      sent,
      sender: {
        beginSend: (outgoing) => {
          sent.push(outgoing);
          return Promise.resolve({ pollUntilDone: () => (status instanceof Error ? Promise.reject(status) : Promise.resolve({ status })) });
        },
      },
    };
  }

  test('the message goes to one recipient with the one-click headers and engagement tracking off', async () => {
    const fake = sender('Succeeded');
    await new AcsMailer({ client: fake.sender, senderAddress: 'DoNotReply@mail.example' }).send(message);
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0]?.senderAddress, 'DoNotReply@mail.example');
    assert.deepEqual(fake.sent[0]?.recipients, { to: [{ address: EMAIL }] });
    assert.equal(fake.sent[0]?.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.equal(fake.sent[0]?.disableUserEngagementTracking, true);
  });

  test('a failed or canceled send is an error; a status check that times out is not, because a retry could send twice', async () => {
    await assert.rejects(new AcsMailer({ client: sender('Failed').sender, senderAddress: 'a@b.example' }).send(message), (error: unknown) => error instanceof MailError && error.code === 'mail_failed');
    await assert.rejects(new AcsMailer({ client: sender('Canceled').sender, senderAddress: 'a@b.example' }).send(message), { code: 'mail_canceled' });
    const slow = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await new AcsMailer({ client: sender(slow).sender, senderAddress: 'a@b.example' }).send(message);
  });

  test('errors from the service reach the caller as codes only', async () => {
    const broken: EmailSender = { beginSend: () => Promise.reject(leakyError('ETIMEDOUT')) };
    await assert.rejects(new AcsMailer({ client: broken, senderAddress: 'a@b.example' }).send(message), (error: unknown) => {
      assert.ok(error instanceof MailError);
      assert.equal(error.code, 'ETIMEDOUT');
      assert.ok(!error.message.includes('SECRETTOKEN') && !error.message.includes(EMAIL));
      return true;
    });
  });
});

describe('notification Logic App', () => {
  const record = engagementFromRow({ we_engagementid: 'row-1', we_requestid: 'req-1', we_kind: 'apply', we_submittername: 'Ada Example', we_email: EMAIL, _we_lead_value: 'lead-1' });
  const event = buildNotifyEvent(record, 'https://org.crm.example');
  const URL_WITHOUT_SIG = 'https://prod-00.centralus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?api-version=2016-10-01';

  test('posts the event with the identity token and the request id as the run tracking id', async () => {
    const hook = scriptedFetch([jsonResponse(202)]);
    const tokens: string[] = [];
    await new LogicAppNotifier({ url: URL_WITHOUT_SIG, fetch: hook.fetch, getToken: () => { tokens.push('asked'); return Promise.resolve('LOGIC-TOKEN'); } }).notify(event);
    const [posted] = hook.seen;
    assert.equal(posted?.method, 'POST');
    assert.equal(posted?.url, URL_WITHOUT_SIG);
    assert.equal(posted?.headers['Authorization'], 'Bearer LOGIC-TOKEN');
    assert.equal(posted?.headers['x-ms-client-tracking-id'], 'req-1');
    assert.deepEqual(posted?.body, event);
    assert.ok(!JSON.stringify(posted?.body).includes(EMAIL), 'no address in the body');
    assert.deepEqual(tokens, ['asked']);
    assert.equal(LOGIC_APP_AUDIENCE, 'https://management.core.windows.net/');
  });

  test('a refusal, an unreachable host, a timeout and a token failure are stable codes with no request data', async () => {
    const options = { url: URL_WITHOUT_SIG, getToken: () => Promise.resolve('T') };
    await assert.rejects(new LogicAppNotifier({ ...options, fetch: scriptedFetch([jsonResponse(401)]).fetch }).notify(event), { code: 'notify_http_401' });
    await assert.rejects(new LogicAppNotifier({ ...options, fetch: scriptedFetch([leakyError('ECONNRESET')]).fetch }).notify(event), (error: unknown) => {
      assert.ok(error instanceof NotifyError);
      assert.equal(error.code, 'notify_unreachable');
      assert.ok(!error.message.includes(EMAIL) && !error.message.includes('SECRETTOKEN'));
      return true;
    });
    const timeout = Object.assign(new Error('slow'), { name: 'TimeoutError' });
    await assert.rejects(new LogicAppNotifier({ ...options, fetch: scriptedFetch([timeout]).fetch }).notify(event), { code: 'notify_timeout' });
    const noToken = scriptedFetch([]);
    await assert.rejects(new LogicAppNotifier({ url: URL_WITHOUT_SIG, fetch: noToken.fetch, getToken: () => Promise.reject(leakyError('CredentialUnavailable')) }).notify(event), { code: 'notify_token' });
    assert.equal(noToken.seen.length, 0, 'nothing is sent without a token');
  });
});

describe('configuration', () => {
  const GOOD: Record<string, string> = {
    DATAVERSE_URL: 'https://org.crm.example',
    STORAGE_ACCOUNT: 'weintakeexample',
    ACS_ENDPOINT: 'https://acs-example.communication.azure.com',
    ACS_SENDER_ADDRESS: 'DoNotReply@mail.example',
    ALLOWED_ORIGINS: 'https://worldenterprise.org',
    SITE_ORIGIN: 'https://worldenterprise.org',
    API_ORIGIN: 'https://intake.worldenterprise.org',
    UNSUBSCRIBE_KEY: 'k'.repeat(40),
    NOTIFY_LOGICAPP_URL: 'https://prod-00.centralus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?api-version=2016-10-01',
  };

  test('a complete environment yields a configuration with the nurture sequence off', () => {
    const result = readConfig(GOOD);
    assert.ok(result.ok);
    assert.equal(result.config.nurtureEnabled, false);
    assert.equal(result.config.stateContainer, 'intake-state');
    assert.equal(result.config.notifyUrl, GOOD['NOTIFY_LOGICAPP_URL']);
  });

  test('nurture is on only for the exact value true', () => {
    for (const [value, expected] of [['true', true], ['TRUE', true], ['1', false], ['yes', false], ['', false]] as const) {
      const result = readConfig({ ...GOOD, NURTURE_ENABLED: value });
      assert.ok(result.ok);
      assert.equal(result.config.nurtureEnabled, expected, value);
    }
  });

  test('problems name the settings and never contain a value', () => {
    const result = readConfig({ ...GOOD, DATAVERSE_URL: 'http://insecure.example', UNSUBSCRIBE_KEY: 'short-secret-value', ACS_ENDPOINT: '', ALLOWED_ORIGINS: '', NOTIFY_LOGICAPP_URL: '' });
    assert.ok(!result.ok);
    assert.deepEqual([...result.problems].sort(), ['ACS_ENDPOINT', 'ALLOWED_ORIGINS', 'DATAVERSE_URL', 'NOTIFY_LOGICAPP_URL', 'UNSUBSCRIBE_KEY']);
    assert.ok(!JSON.stringify(result).includes('short-secret-value'));
    assert.deepEqual(readConfig({}).ok, false);
  });

  test('the notification URL must be https and must not carry a signature, because the Function authenticates with its identity', () => {
    for (const bad of ['http://logic.example/run', 'not a url', `${GOOD['NOTIFY_LOGICAPP_URL']}&sig=AbCdEf0123456789`]) {
      const result = readConfig({ ...GOOD, NOTIFY_LOGICAPP_URL: bad });
      assert.ok(!result.ok);
      assert.deepEqual(result.problems, ['NOTIFY_LOGICAPP_URL']);
      assert.ok(!JSON.stringify(result).includes('AbCdEf0123456789'));
    }
  });
});

describe('runtime request mapping', () => {
  function runtimeRequest(chunks: string[] | null, over: Partial<RuntimeRequest> = {}): { request: RuntimeRequest; state: { finished: boolean } } {
    const state = { finished: false };
    async function* body(): AsyncGenerator<Uint8Array> {
      try {
        for (const chunk of chunks ?? []) yield Buffer.from(chunk);
        state.finished = true;
      } finally {
        state.finished = true;
      }
    }
    return {
      state,
      request: { method: 'post', headers: new Headers({ Origin: 'https://worldenterprise.org' }), query: new URLSearchParams('token=abc'), body: chunks === null ? null : body(), ...over },
    };
  }

  test('method, headers and query are read case-insensitively', async () => {
    const mapped = toRequestLike(runtimeRequest(['{}']).request);
    assert.equal(mapped.method, 'POST');
    assert.equal(mapped.header('origin'), 'https://worldenterprise.org');
    assert.equal(mapped.header('x-missing'), undefined);
    assert.equal(mapped.query('token'), 'abc');
    assert.equal(await mapped.readBody(100), '{}');
  });

  test('a body over the cap is abandoned partway, and an absent body is empty text', async () => {
    const oversized = runtimeRequest(['aaaa', 'bbbb', 'cccc']);
    assert.equal(await toRequestLike(oversized.request).readBody(6), null);
    assert.equal(oversized.state.finished, true, 'the stream was closed');
    assert.equal(await toRequestLike(runtimeRequest(null).request).readBody(6), '');
  });

  test('a response keeps its headers, and an empty body is left out', () => {
    assert.deepEqual(toResponse({ status: 303, headers: { Location: 'https://worldenterprise.org/apply/thanks/' }, body: '' }), { status: 303, headers: { Location: 'https://worldenterprise.org/apply/thanks/' } });
    assert.equal(toResponse({ status: 200, headers: {}, body: '{"ok":true}' }).body, '{"ok":true}');
  });
});
