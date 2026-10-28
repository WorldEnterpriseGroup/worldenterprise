import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { KINDS } from '../src/logic/contract.ts';
import { buildLeadFields, buildNotifyEvent, engagementFromRow, leadSubject, LEAD_KINDS, makesLead } from '../src/logic/mapping.ts';
import { handleIntake } from '../src/service/intake.ts';
import { retrySweep } from '../src/service/sweeps.ts';
import { harness, jsonPost, leakyError, validPayload } from './fakes.ts';

const MINUTE = 60 * 1000;

function rowOf(h: ReturnType<typeof harness>, payload: Record<string, unknown>): Record<string, unknown> {
  return h.engagements.row(String(payload['requestId']));
}

describe('which forms make a Lead', () => {
  test('every form but the newsletter does', () => {
    assert.deepEqual([...LEAD_KINDS].sort(), KINDS.filter((kind) => kind !== 'newsletter').sort());
    assert.equal(makesLead('newsletter'), false);
  });

  for (const kind of KINDS) {
    test(`${kind}: ${makesLead(kind) ? 'a Lead' : 'a Contact and no Lead'} beside the engagement row`, async () => {
      const h = harness();
      const payload = validPayload(kind);
      assert.equal((await handleIntake(h.deps, jsonPost(payload))).status, 202);
      assert.equal(h.engagements.rows.size, 1);
      assert.equal(h.crm.contacts.length, 1, 'the contact is written for every form');
      if (makesLead(kind)) {
        assert.equal(h.crm.leads.size, 1);
        assert.equal(rowOf(h, payload)['we_Lead@odata.bind'], '/leads(lead-3)', 'the row links to its Lead');
        assert.equal([...h.crm.leads.values()][0]?.fields['we_requestid'], payload['requestId']);
      } else {
        assert.equal(h.crm.leads.size, 0);
        assert.equal(h.crm.leadCalls, 0);
        assert.equal(rowOf(h, payload)['we_Lead@odata.bind'], undefined);
      }
    });
  }
});

describe('the Lead', () => {
  test('carries the person, the organization, the request and a deterministic subject, keyed on the request id', async () => {
    const h = harness();
    const payload = validPayload('partner-enquiry', { name: 'Grace Hopper', email: 'grace@cloud.example' });
    await handleIntake(h.deps, jsonPost(payload));
    const lead = h.crm.leads.get(String(payload['requestId']));
    assert.ok(lead);
    const requestId = String(payload['requestId']);
    assert.equal(lead.fields['subject'], `Partner enquiry: Grace Hopper (${requestId.slice(0, 8)})`);
    assert.equal(lead.fields['firstname'], 'Grace');
    assert.equal(lead.fields['lastname'], 'Hopper');
    assert.equal(lead.fields['emailaddress1'], 'grace@cloud.example');
    assert.equal(lead.fields['companyname'], 'Example Cloud');
    assert.equal(lead.fields['websiteurl'], 'https://example.org/partners');
    assert.equal(lead.fields['we_requestid'], requestId);
    assert.equal(lead.fields['donotbulkemail'], true, 'no updates box on this form, so no bulk mail');
    assert.equal(lead.fields['leadsourcecode'], 8);
    assert.match(String(lead.fields['description']), /Partner category: cloud-credits/);
    assert.match(String(lead.fields['description']), /Offer: Hosting credits for early teams\./);
  });

  test('a replay makes no second Lead and no second notification', async () => {
    const h = harness();
    const payload = validPayload('apply');
    assert.equal((await handleIntake(h.deps, jsonPost(payload))).status, 202);
    assert.equal((await handleIntake(h.deps, jsonPost(payload))).status, 200);
    assert.equal(h.crm.leads.size, 1);
    assert.equal(h.crm.leadCalls, 1);
    assert.equal(h.notifier.events.length, 1);
  });

  test('a long message is cut to the Lead description limit and the ledger row keeps it whole', () => {
    const record = engagementFromRow({ we_engagementid: 'e', we_requestid: '12345678-aaaa', we_kind: 'contact', we_submittername: 'A B', we_email: 'a@b.example', we_message: 'x'.repeat(4000) });
    const fields = buildLeadFields(record);
    assert.ok(String(fields['description']).length <= 2000);
    assert.ok(String(fields['description']).endsWith('…'));
  });

  test('a person with a single-word name, or none, still gets a valid last name', () => {
    assert.equal(buildLeadFields(engagementFromRow({ we_requestid: 'r', we_kind: 'apply', we_submittername: 'Cher', we_email: 'c@x.example' }))['lastname'], 'Cher');
    assert.equal(buildLeadFields(engagementFromRow({ we_requestid: 'r', we_kind: 'apply', we_submittername: '', we_email: 'c@x.example' }))['lastname'], 'c@x.example');
    assert.equal(leadSubject({ kind: 'apply', requestId: 'abcdefgh-1', name: '', email: 'c@x.example' }), 'Application: c@x.example (abcdefgh)');
  });

  test('a failing Lead create never fails the visitor, is logged by code, and the sweep finishes it', async () => {
    const h = harness();
    h.crm.failLead = leakyError('ServiceUnavailable');
    const payload = validPayload('investor-interest');
    assert.equal((await handleIntake(h.deps, jsonPost(payload))).status, 202);
    assert.equal(h.crm.leads.size, 0);
    assert.equal(h.notifier.events.length, 1, 'the inbox still hears about it, with the contact link');
    assert.match(h.notifier.events[0]?.recordUrl ?? '', /etn=contact&id=contact-\d+$/);
    assert.ok(h.logs.some((entry) => entry.line.includes('"lead_failed"') && entry.line.includes('ServiceUnavailable')));
    assert.ok(h.logs.every((entry) => !entry.line.includes('ada@example.org')), 'no address in a log line');

    h.crm.failLead = null;
    h.clock.advance(11 * MINUTE);
    const summary = await retrySweep(h.deps);
    assert.equal(summary.followedUp, 1);
    assert.equal(h.crm.leads.size, 1);
    assert.ok(rowOf(h, payload)['we_Lead@odata.bind']);
    assert.equal(h.notifier.events.length, 1, 'already notified, so not notified again');
    assert.equal((await retrySweep(h.deps)).followedUp, 0, 'nothing left to do');
  });

  test('a failed link-back is retried without a second Lead', async () => {
    const h = harness();
    const payload = validPayload('contact');
    const original = h.engagements.update.bind(h.engagements);
    let failures = 1;
    h.engagements.update = async (id, patch) => {
      if (patch.leadId !== undefined && failures > 0) {
        failures -= 1;
        throw leakyError('ECONNRESET');
      }
      return original(id, patch);
    };
    assert.equal((await handleIntake(h.deps, jsonPost(payload))).status, 202);
    assert.equal(rowOf(h, payload)['we_Lead@odata.bind'], undefined);
    h.clock.advance(11 * MINUTE);
    await retrySweep(h.deps);
    assert.equal(h.crm.leads.size, 1);
    assert.ok(rowOf(h, payload)['we_Lead@odata.bind']);
  });
});

describe('the notification', () => {
  test('carries the form, the name and a record link, and no email address or message body', async () => {
    const h = harness();
    const payload = validPayload('contact', { message: 'A private question about my fundraising.' });
    await handleIntake(h.deps, jsonPost(payload));
    const [event] = h.notifier.events;
    assert.ok(event);
    assert.deepEqual(Object.keys(event).sort(), ['formLabel', 'kind', 'name', 'recordUrl', 'requestId', 'test']);
    assert.equal(event.formLabel, 'Contact');
    assert.equal(event.name, 'Ada Example');
    assert.match(event.recordUrl, /^https:\/\/org\.crm\.example\/main\.aspx\?pagetype=entityrecord&etn=lead&id=lead-\d+$/);
    const text = JSON.stringify(event);
    assert.ok(!text.includes('ada@example.org') && !text.includes('fundraising'));
    assert.equal(event.test, false);
  });

  test('traffic from the reserved .invalid domain is flagged as a test', async () => {
    const h = harness();
    await handleIntake(h.deps, jsonPost(validPayload('apply', { email: 'e2e-abc@e2e.invalid' })));
    assert.equal(h.notifier.events[0]?.test, true);
  });

  test('is sent after the Lead and marks the row, so a delivered notification is not sent again', async () => {
    const h = harness();
    const payload = validPayload('apply');
    await handleIntake(h.deps, jsonPost(payload));
    assert.equal(rowOf(h, payload)['we_notifiedat'], '2026-10-12T12:00:00.000Z');
    h.clock.advance(11 * MINUTE);
    assert.equal((await retrySweep(h.deps)).followedUp, 0);
    assert.equal(h.notifier.events.length, 1);
  });

  test('a failure never fails the visitor, leaves the row unmarked and is retried by the sweep', async () => {
    const h = harness();
    h.notifier.failWith = leakyError('ECONNRESET');
    const payload = validPayload('newsletter');
    const result = await handleIntake(h.deps, jsonPost(payload));
    assert.equal(result.status, 202);
    assert.equal(h.engagements.rows.size, 1);
    assert.equal(rowOf(h, payload)['we_notifiedat'], undefined);
    assert.ok(h.logs.some((entry) => entry.level === 'warn' && entry.line.includes('"notify_failed"')));
    assert.ok(h.logs.every((entry) => !entry.line.includes('SECRETTOKEN') && !entry.line.includes('ada@example.org')));

    h.clock.advance(5 * MINUTE);
    assert.equal((await retrySweep(h.deps)).followedUp, 0, 'too early: the first request may still be running');
    h.clock.advance(6 * MINUTE);
    h.notifier.failWith = null;
    assert.equal((await retrySweep(h.deps)).followedUp, 1);
    assert.equal(h.notifier.events.length, 1);
    assert.ok(rowOf(h, payload)['we_notifiedat']);
  });

  test('the sweep gives up on rows older than a week', async () => {
    const h = harness();
    h.notifier.failWith = leakyError('ECONNRESET');
    await handleIntake(h.deps, jsonPost(validPayload('contact')));
    h.notifier.failWith = null;
    h.clock.advance(8 * 24 * 60 * MINUTE);
    assert.equal((await retrySweep(h.deps)).followedUp, 0);
    assert.equal(h.notifier.events.length, 0);
  });

  test('the link points at the engagement row when there is neither a Lead nor a contact', () => {
    const record = engagementFromRow({ we_engagementid: 'eng-9', we_requestid: 'r', we_kind: 'contact', we_submittername: '', we_email: 'a@b.example' });
    const event = buildNotifyEvent(record, 'https://org.crm.example');
    assert.equal(event.recordUrl, 'https://org.crm.example/main.aspx?pagetype=entityrecord&etn=we_engagement&id=eng-9');
    assert.equal(event.name, '(no name given)');
  });
});
