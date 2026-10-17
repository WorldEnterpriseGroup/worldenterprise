import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';

import { decryptToken, encryptToken, hmacHex, keyHash, logHash, newToken, safeEqualHex } from '../../../infra/intake/src/logic/crypto.ts';
import {
  checkOrigin, clientAddress, CONTENT_SECURITY_POLICY, contentKind, PAGE_CSS, parseBody, parseOrigins, resolveThanksUrl, securityHeaders,
} from '../../../infra/intake/src/logic/http.ts';
import { buildContactFields, buildEngagementRow, engagementFromRow, NAV_ACCOUNT, NAV_CONTACT, planAccount, REVIEW, selectContact, splitName, STATUS } from '../../../infra/intake/src/logic/mapping.ts';
import { NURTURE_STAGES, renderBriefEmail, renderNurtureEmail, type MailContext } from '../../../infra/intake/src/logic/mail.ts';
import { consume, rateKeys, RATE_LIMIT, RATE_WINDOW_MS } from '../../../infra/intake/src/logic/rate.ts';
import { isRetryDue, MAX_DELIVERY_ATTEMPTS, nurtureDueAt, NURTURE_DAYS, RETRY_BACKOFF_MS } from '../../../infra/intake/src/logic/schedule.ts';
import { emailDomain, escapeHtml, isConsumerDomain, isEmail, odataString } from '../../../infra/intake/src/logic/text.ts';
import type { Submission } from '../../../infra/intake/src/logic/validate.ts';

const KEY = 'a-long-enough-unsubscribe-key-0001';

const SUBMISSION: Submission = {
  kind: 'apply', requestId: '6f1c2d3e-8a4b-4c5d-9e0f-1a2b3c4d5e6f', audience: 'startup', name: 'Ada Example Lovelace', email: 'ada@startup.example', company: 'Startup Co',
  stage: 'validating', seats: '', topic: '', message: 'Hello', briefId: '', companyUrl: '', partnerCategory: '', investorKind: '', focus: '', offer: '',
  consentUpdates: false, startedAt: '', submittedAt: '', page: '/apply/', redirect: '',
};

describe('token crypto', () => {
  test('a token round-trips, each encryption differs, and the ciphertext does not contain the token', () => {
    const token = newToken();
    const a = encryptToken(token, KEY);
    const b = encryptToken(token, KEY);
    assert.notEqual(a, b);
    assert.equal(decryptToken(a, KEY), token);
    assert.ok(!a.includes(token));
    assert.match(a, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  test('a tampered ciphertext, another key or a short key fails', () => {
    const sealed = encryptToken('abc', KEY);
    const [iv, tag, body] = sealed.split('.');
    assert.throws(() => decryptToken(`${iv}.${tag}.${Buffer.from('zzz').toString('base64url')}`, KEY));
    assert.throws(() => decryptToken(sealed, 'a-different-long-enough-key-0002'));
    assert.throws(() => encryptToken('abc', 'short'));
    assert.throws(() => decryptToken(`${iv}.${tag}`, KEY));
    assert.ok(body);
  });

  test('hashes are stable, separated by key space and not the input', () => {
    assert.equal(keyHash('email', 'a@b.org'), keyHash('email', 'a@b.org'));
    assert.notEqual(keyHash('email', 'a@b.org'), keyHash('client', 'a@b.org'));
    assert.equal(logHash('client', '1.2.3.4').length, 12);
    assert.ok(!keyHash('email', 'a@b.org').includes('b.org'));
    assert.equal(safeEqualHex(hmacHex('s', 'p'), hmacHex('s', 'p')), true);
    assert.equal(safeEqualHex(hmacHex('s', 'p'), hmacHex('s', 'q')), false);
    assert.equal(safeEqualHex('', ''), false);
  });
});

describe('rate decision (fake clock)', () => {
  test('five are allowed, the sixth is refused with the time left, and the window resets', () => {
    let record = null as ReturnType<typeof consume>['record'] | null;
    const start = 1_000_000;
    for (let index = 0; index < RATE_LIMIT; index += 1) {
      const decision = consume(record, start + index * 1000);
      assert.equal(decision.allowed, true);
      record = decision.record;
    }
    const refused = consume(record, start + 10_000);
    assert.equal(refused.allowed, false);
    assert.equal(refused.retryAfterSeconds, Math.ceil((RATE_WINDOW_MS - 10_000) / 1000));
    assert.equal(refused.record.count, RATE_LIMIT, 'a refusal does not extend the window');
    assert.equal(consume(refused.record, start + RATE_WINDOW_MS).allowed, true);
  });

  test('a clock that moves backwards starts a new window instead of locking out', () => {
    assert.equal(consume({ windowStart: 5_000_000, count: 5 }, 1_000).allowed, true);
  });

  test('keys are per kind and an absent email adds no email key', () => {
    assert.deepEqual(rateKeys('apply', 'h1', 'e1'), ['ip:apply:h1', 'email:apply:e1']);
    assert.deepEqual(rateKeys('newsletter', 'h1', null), ['ip:newsletter:h1']);
  });
});

describe('http logic', () => {
  test('every security header the contract names is present, and the CSP allows only the one stylesheet by hash', () => {
    const headers = securityHeaders();
    assert.equal(headers['Cache-Control'], 'no-store');
    assert.equal(headers['Referrer-Policy'], 'no-referrer');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.ok(CONTENT_SECURITY_POLICY.startsWith("default-src 'none'"));
    assert.ok(!CONTENT_SECURITY_POLICY.includes('unsafe'));
    assert.ok(CONTENT_SECURITY_POLICY.includes(`'sha256-${createHash('sha256').update(PAGE_CSS).digest('base64')}'`));
    assert.equal(Object.keys(headers).some((name) => name.toLowerCase() === 'set-cookie'), false);
  });

  test('origins are matched exactly', () => {
    const allowed = parseOrigins('https://worldenterprise.org/, https://preview.example.test,http://insecure.example,not-a-url');
    assert.deepEqual(allowed, ['https://worldenterprise.org', 'https://preview.example.test']);
    assert.deepEqual(checkOrigin('https://worldenterprise.org', allowed), { kind: 'allowed', origin: 'https://worldenterprise.org' });
    assert.deepEqual(checkOrigin('https://WORLDENTERPRISE.org', allowed), { kind: 'allowed', origin: 'https://worldenterprise.org' });
    assert.equal(checkOrigin('https://worldenterprise.org.evil.test', allowed).kind, 'refused');
    assert.equal(checkOrigin('https://sub.worldenterprise.org', allowed).kind, 'refused');
    assert.equal(checkOrigin(undefined, allowed).kind, 'refused');
    assert.equal(checkOrigin('null', allowed).kind, 'opaque');
  });

  test('content types and bodies', () => {
    assert.equal(contentKind('application/json; charset=utf-8'), 'json');
    assert.equal(contentKind('Application/X-WWW-Form-Urlencoded'), 'form');
    assert.equal(contentKind('multipart/form-data; boundary=x'), 'unsupported');
    assert.equal(contentKind(undefined), 'unsupported');
    assert.deepEqual(parseBody('json', '{"a":"b"}'), { ok: true, body: { a: 'b' } });
    assert.equal(parseBody('json', '[1]').ok, false);
    assert.equal(parseBody('json', 'null').ok, false);
    assert.equal(parseBody('json', '{').ok, false);
    assert.deepEqual(parseBody('form', 'a=b&a=c&d=%20e'), { ok: true, body: { a: 'c', d: ' e' } });
  });

  test('the thanks redirect honors only an allowlisted path on an allowed origin', () => {
    const allow = ['/apply/thanks/', '/briefs/thanks/'];
    const origins = ['https://worldenterprise.org', 'https://preview.example.test'];
    const site = 'https://worldenterprise.org';
    assert.equal(resolveThanksUrl('/apply/thanks/', '', allow, origins, site), 'https://worldenterprise.org/apply/thanks/');
    assert.equal(resolveThanksUrl('/apply/thanks/', '/briefs/thanks/', allow, origins, site), 'https://worldenterprise.org/briefs/thanks/');
    assert.equal(resolveThanksUrl('/apply/thanks/', 'https://preview.example.test/briefs/thanks/', allow, origins, site), 'https://preview.example.test/briefs/thanks/');
    for (const bad of ['https://evil.test/apply/thanks/', '//evil.test/apply/thanks/', '/admin/', 'javascript:alert(1)', 'https://worldenterprise.org/apply/thanks/../../x', 'data:text/html,x']) {
      assert.equal(resolveThanksUrl('/apply/thanks/', bad, allow, origins, site), 'https://worldenterprise.org/apply/thanks/', bad);
    }
    assert.equal(resolveThanksUrl(null, '', allow, origins, site), null);
    assert.equal(resolveThanksUrl('/apply/thanks/', 'https://worldenterprise.org/apply/thanks/?email=a@b.org', allow, origins, site), 'https://worldenterprise.org/apply/thanks/');
  });

  test('the client address comes from the Front Door header, with a port stripped', () => {
    const headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.9:4711, 10.0.0.1' };
    assert.equal(clientAddress((name) => headers[name]), '203.0.113.9');
    assert.equal(clientAddress((name) => ({ 'x-azure-clientip': '198.51.100.2' } as Record<string, string>)[name]), '198.51.100.2');
    assert.equal(clientAddress(() => undefined), 'unknown');
  });
});

describe('Dataverse mapping', () => {
  test('a corporate domain shares an Account; a consumer mailbox gets a person-level one', () => {
    const corporate = planAccount(SUBMISSION);
    assert.equal(corporate.key, 'domain:startup.example');
    assert.equal(corporate.organization, true);
    assert.equal(corporate.fields['name'], 'Startup Co');
    const consumer = planAccount({ ...SUBMISSION, email: 'ada@gmail.com', company: '' });
    assert.equal(consumer.key, 'person:ada@gmail.com');
    assert.equal(consumer.organization, false);
    assert.equal(consumer.fields['name'], 'Ada Example Lovelace');
    const newsletter = planAccount({ ...SUBMISSION, email: 'x@outlook.com', name: '', company: '' });
    assert.equal(newsletter.fields['name'], 'x@outlook.com');
  });

  test('consumer mailbox providers are recognized, including regional and subdomain variants', () => {
    for (const domain of ['gmail.com', 'GoogleMail.com', 'outlook.com', 'hotmail.co.uk', 'yahoo.co.uk', 'live.fr', 'icloud.com', 'proton.me', '']) assert.equal(isConsumerDomain(domain), true, domain);
    for (const domain of ['startup.example', 'gmail.example.org', 'notgmail.com']) assert.equal(isConsumerDomain(domain), false, domain);
  });

  test('the engagement row carries the contract columns, the lookups by navigation property, and no unsubscribe token in clear', () => {
    const row = buildEngagementRow(SUBMISSION, { accountId: 'acct-1', contactId: 'contact-1', review: 'none' }, { now: new Date('2026-10-12T12:00:00Z'), tokenCiphertext: 'iv.tag.body', tokenHash: 'abc', briefVersion: '' });
    for (const column of ['we_requestid', 'we_kind', 'we_audience', 'we_briefid', 'we_stage', 'we_partnercategory', 'we_investorkind', 'we_sourcepage', 'we_consent_at', 'we_consentupdates', 'we_status']) {
      assert.ok(column in row, column);
    }
    assert.equal(row['we_status'], STATUS.received);
    assert.equal(row['we_review'], REVIEW.none);
    assert.equal(row[`${NAV_CONTACT}@odata.bind`], '/contacts(contact-1)');
    assert.equal(row[`${NAV_ACCOUNT}@odata.bind`], '/accounts(acct-1)');
    const ambiguous = buildEngagementRow(SUBMISSION, { accountId: 'acct-1', contactId: null, review: 'contact-ambiguous' }, { now: new Date(), tokenCiphertext: 'x', tokenHash: 'y', briefVersion: '' });
    assert.equal(ambiguous[`${NAV_CONTACT}@odata.bind`], undefined);
    assert.equal(ambiguous['we_review'], REVIEW['contact-ambiguous']);
  });

  test('a row reads back through engagementFromRow', () => {
    const record = engagementFromRow({ we_engagementid: 'g', we_requestid: 'r', we_status: STATUS['delivery-failed'], we_review: REVIEW['contact-ambiguous'], we_consentupdates: true, we_deliveryattempts: 2, we_email: 'a@b.org' });
    assert.equal(record.status, 'delivery-failed');
    assert.equal(record.review, 'contact-ambiguous');
    assert.equal(record.consentUpdates, true);
    assert.equal(record.deliveryAttempts, 2);
    assert.equal(engagementFromRow({}).status, 'received');
  });

  test('contact selection never guesses between duplicates', () => {
    assert.deepEqual(selectContact([]), { outcome: 'create' });
    assert.deepEqual(selectContact([{ id: 'a' }]), { outcome: 'use', contact: { id: 'a' } });
    assert.deepEqual(selectContact([{ id: 'a' }, { id: 'b' }]), { outcome: 'ambiguous' });
  });

  test('names split on the last space; bulk email stays off unless the updates box was ticked', () => {
    assert.deepEqual(splitName('Ada Example Lovelace'), { first: 'Ada Example', last: 'Lovelace' });
    assert.deepEqual(splitName('Cher'), { first: '', last: 'Cher' });
    assert.equal(buildContactFields(SUBMISSION, 'acct-1')['donotbulkemail'], true);
    assert.equal(buildContactFields({ ...SUBMISSION, consentUpdates: true }, null)['donotbulkemail'], false);
    assert.equal(buildContactFields(SUBMISSION, 'acct-1')['parentcustomerid_account@odata.bind'], '/accounts(acct-1)');
  });
});

describe('text helpers', () => {
  test('email syntax', () => {
    for (const ok of ['a@b.org', 'first.last+tag@sub.example.co.uk', "o'brien@example.org"]) assert.equal(isEmail(ok), true, ok);
    for (const bad of ['', 'a', 'a@b', 'a@@b.org', 'a b@c.org', 'a@b.org,c@d.org', '.a@b.org', 'a..b@c.org', 'a@-b.org', `${'a'.repeat(65)}@b.org`]) assert.equal(isEmail(bad), false, bad);
    assert.equal(emailDomain('A@Example.ORG'), 'example.org');
  });

  test('escaping', () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    assert.equal(odataString("o'brien"), "'o''brien'");
  });
});

describe('schedules', () => {
  test('retry backoff', () => {
    const t0 = Date.parse('2026-10-12T12:00:00Z');
    const iso = new Date(t0).toISOString();
    assert.equal(isRetryDue(1, iso, t0 + RETRY_BACKOFF_MS[0]! - 1), false);
    assert.equal(isRetryDue(1, iso, t0 + RETRY_BACKOFF_MS[0]!), true);
    assert.equal(isRetryDue(MAX_DELIVERY_ATTEMPTS, iso, t0 + 10 ** 10), false);
    assert.equal(isRetryDue(2, '', t0), true);
  });

  test('nurture follow-ups are due on day 3, 10 and 21', () => {
    assert.deepEqual(NURTURE_DAYS, [3, 10, 21]);
    const t0 = Date.parse('2026-10-12T00:00:00Z');
    assert.equal(nurtureDueAt(t0, 1), t0 + 3 * 86_400_000);
    assert.equal(nurtureDueAt(t0, 3), t0 + 21 * 86_400_000);
    assert.equal(nurtureDueAt(t0, 4), null);
    assert.equal(NURTURE_STAGES, 3);
  });
});

describe('email copy follows the site truth policy', () => {
  const ctx: MailContext = {
    name: 'Ada Example', briefTitle: 'Funding paths', briefId: 'funding-paths', siteOrigin: 'https://worldenterprise.org',
    briefUrl: 'https://store.example/briefs/x.pdf?sig=abc', unsubscribeUrl: 'https://intake.worldenterprise.org/api/unsubscribe?token=TOKEN', footerAddress: '',
  };
  const messages = [renderBriefEmail('ada@example.org', ctx), ...[1, 2, 3].map((stage) => renderNurtureEmail('ada@example.org', stage, { ...ctx, briefUrl: null }))];
  const BANNED: readonly RegExp[] = [
    /\bfree\b/i, /\bno fees?\b/i, /\bno equity\b/i, /\bno stake\b/i, /free of charge/i, /success[- ]fee/i, /investor network/i, /\bguarantee/i, /\baccelerator/i,
    /\bcohort/i, /\bmentor/i, /\bperks?\b/i, /\$\s?\d/, /\bwithin \d+ (hours?|days?|minutes?)\b/i, /\bwe will (reply|respond)\b/i, /limited (time|spots|seats)/i, /!/,
  ];

  test('no denylisted phrase, amount, response-time promise, exclamation mark or urgency language', () => {
    for (const message of messages) {
      for (const pattern of BANNED) {
        assert.ok(!pattern.test(message.text), `${message.subject}: text matches ${pattern}`);
        assert.ok(!pattern.test(message.html.replace(/<!doctype[^>]*>/i, '')), `${message.subject}: html matches ${pattern}`);
        assert.ok(!pattern.test(message.subject), `${message.subject}: subject matches ${pattern}`);
      }
    }
  });

  test('every message carries the unsubscribe link, the one-click headers and the company name; WE is in capitals', () => {
    for (const message of messages) {
      assert.ok(message.text.includes(ctx.unsubscribeUrl));
      assert.ok(message.html.includes(escapeHtml(ctx.unsubscribeUrl)));
      assert.equal(message.headers['List-Unsubscribe'], `<${ctx.unsubscribeUrl}>`);
      assert.ok(message.text.includes('World Enterprise Group Incorporated'));
      assert.ok(!/(^|[^A-Za-z])we([^A-Za-z]|$)/.test(message.text), 'WE is always in capitals');
    }
  });

  test('the brief email states the 48-hour life of the link and nothing about when it arrives', () => {
    const brief = messages[0];
    assert.ok(brief?.text.includes('48 hours'));
    assert.ok(brief?.text.includes('https://store.example/briefs/x.pdf?sig=abc'));
  });

  test('user-supplied text is escaped in the HTML part', () => {
    const hostile = renderBriefEmail('ada@example.org', { ...ctx, name: '<script>alert(1)</script> Ada', briefTitle: '"><img src=x onerror=alert(1)>' });
    assert.ok(!hostile.html.includes('<script>'));
    assert.ok(!hostile.html.includes('<img'));
    assert.equal(hostile.subject.includes('\n'), false);
  });

  test('the postal address line appears only when the operator sets it', () => {
    assert.ok(!messages[0]?.text.includes('Example Street'));
    const withAddress = renderBriefEmail('a@b.org', { ...ctx, footerAddress: '1 Example Street' });
    assert.ok(withAddress.text.includes('1 Example Street'));
  });
});
