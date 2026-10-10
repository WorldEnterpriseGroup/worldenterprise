import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { KINDS, thanksAllowlist, type Kind } from '../../../infra/intake/src/logic/contract.ts';
import { isHoneypotTripped, validate } from '../../../infra/intake/src/logic/validate.ts';
import { loadContractUnderTest } from '../../../infra/intake/tests/contract-source.ts';

/**
 * Contract 3.1 required matrix (R required, O optional, - must be empty), written out here on purpose. The schema JSON
 * that WP-60 commits is the source the server loads; this table is the independent statement of what it must say, so the
 * server cannot drift from the contract without a test failing. Newsletter is not a matrix column: v1 says it fills only
 * the address and the consent.
 */
type Rule = 'R' | 'O' | '-';
const MATRIX: Record<Kind, Record<string, Rule>> = {
  apply: { name: 'R', email: 'R', company: 'O', stage: 'R', seats: 'O', topic: '-', message: 'O', briefId: '-', companyUrl: '-', partnerCategory: '-', offer: '-', investorKind: '-', focus: '-', consent: 'R', requestId: 'R' },
  contact: { name: 'R', email: 'R', company: 'O', stage: '-', seats: '-', topic: 'R', message: 'R', briefId: '-', companyUrl: '-', partnerCategory: '-', offer: '-', investorKind: '-', focus: '-', consent: 'R', requestId: 'R' },
  newsletter: { name: '-', email: 'R', company: '-', stage: '-', seats: '-', topic: '-', message: '-', briefId: '-', companyUrl: '-', partnerCategory: '-', offer: '-', investorKind: '-', focus: '-', consent: 'R', requestId: 'O' },
  'brief-request': { name: 'R', email: 'R', company: 'O', stage: 'O', seats: '-', topic: '-', message: '-', briefId: 'R', companyUrl: '-', partnerCategory: '-', offer: '-', investorKind: '-', focus: '-', consent: 'R', requestId: 'R' },
  'investor-interest': { name: 'R', email: 'R', company: 'O', stage: '-', seats: '-', topic: '-', message: 'O', briefId: '-', companyUrl: 'O', partnerCategory: '-', offer: '-', investorKind: 'O', focus: 'O', consent: 'R', requestId: 'R' },
  'partner-enquiry': { name: 'R', email: 'R', company: 'R', stage: '-', seats: '-', topic: '-', message: 'O', briefId: '-', companyUrl: 'R', partnerCategory: 'R', offer: 'R', investorKind: '-', focus: '-', consent: 'R', requestId: 'R' },
};

const AUDIENCES: Record<Kind, readonly string[]> = {
  apply: ['startup'],
  contact: ['startup', 'investor', 'partner'],
  newsletter: [''],
  'brief-request': ['startup', 'investor', 'partner'],
  'investor-interest': ['investor'],
  'partner-enquiry': ['partner'],
};

const THANKS: Record<Kind, string | null> = {
  apply: '/apply/thanks/',
  contact: null,
  newsletter: null,
  'brief-request': '/briefs/thanks/',
  'investor-interest': '/investors/interest/thanks/',
  'partner-enquiry': '/network/partners/enquire/thanks/',
};

/** A value that is legal for the field, used to prove a must-be-empty field rejects a perfectly good value. */
const SAMPLE: Record<string, unknown> = {
  name: 'Ada Example', email: 'ada@example.org', company: 'Example Co', stage: 'validating', seats: 'Product design x1', topic: 'general',
  message: 'Hello.', briefId: 'funding-paths', companyUrl: 'https://example.org', partnerCategory: 'legal', offer: 'Credits.',
  investorKind: 'angel', focus: 'Seed.', consent: true, requestId: '6f1c2d3e-8a4b-4c5d-9e0f-1a2b3c4d5e6f',
};

const FIELDS = Object.keys(MATRIX.apply);

const { contract, source } = loadContractUnderTest();

function payload(kind: Kind, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { form: kind, audience: AUDIENCES[kind][0] ?? '', consentUpdates: false, website: '', startedAt: '2026-10-12T14:00:00.000Z', submittedAt: '2026-10-12T14:00:41.000Z', page: '/x/' };
  for (const field of FIELDS) {
    const rule = MATRIX[kind][field];
    body[field] = rule === 'R' ? SAMPLE[field] : field === 'consent' ? true : '';
  }
  if (kind === 'newsletter') body['requestId'] = '';
  return { ...body, ...overrides };
}

describe(`forms contract (${source})`, () => {
  test('the contract file states the matrix, the audiences and the thanks paths', () => {
    for (const kind of KINDS) {
      const rule = contract.kinds[kind];
      for (const field of FIELDS) {
        const listed = rule.fields[field];
        const expected = MATRIX[kind][field];
        assert.ok(listed !== undefined, `${kind}.${field} is missing from the contract file`);
        assert.equal(listed.rule, expected, `${kind}.${field}`);
      }
      assert.deepEqual([...rule.audience].sort(), [...AUDIENCES[kind]].sort(), `${kind} audiences`);
      assert.equal(rule.thanks, THANKS[kind], `${kind} thanks path`);
    }
    assert.deepEqual([...thanksAllowlist(contract)].sort(), Object.values(THANKS).filter((path): path is string => path !== null).sort());
  });

  for (const kind of KINDS) {
    describe(kind, () => {
      test('a valid submission passes', () => {
        const result = validate(contract, kind, payload(kind), 'json');
        assert.equal(result.ok, true, JSON.stringify(result));
      });

      for (const field of FIELDS) {
        const rule = MATRIX[kind][field];
        if (rule === 'R') {
          test(`${field} is required: missing and blank are 422 on that field`, () => {
            for (const value of [undefined, '', '   ']) {
              if (field === 'consent' && value !== undefined) continue;
              const body = payload(kind);
              if (value === undefined) delete body[field];
              else body[field] = value;
              const result = validate(contract, kind, body, 'json');
              assert.equal(result.ok, false, `${field}=${JSON.stringify(value)}`);
              if (!result.ok) {
                assert.equal(result.status, 422);
                assert.ok(field in result.errors, `error on ${field}: ${JSON.stringify(result.errors)}`);
              }
            }
          });
        } else if (rule === 'O') {
          test(`${field} is optional: blank passes, a legal value passes`, () => {
            assert.equal(validate(contract, kind, payload(kind, { [field]: '' }), 'json').ok, true);
            assert.equal(validate(contract, kind, payload(kind, { [field]: SAMPLE[field] }), 'json').ok, true);
          });
        } else {
          test(`${field} must be empty: a legal value is 422 on that field`, () => {
            const result = validate(contract, kind, payload(kind, { [field]: SAMPLE[field] }), 'json');
            assert.equal(result.ok, false);
            if (!result.ok) assert.ok(field in result.errors, JSON.stringify(result.errors));
          });
        }
      }

      test('a wrong audience is 422 on audience, and every allowed audience passes', () => {
        for (const audience of ['startup', 'investor', 'partner', '', 'everyone']) {
          const result = validate(contract, kind, payload(kind, { audience }), 'json');
          if (AUDIENCES[kind].includes(audience)) {
            assert.equal(result.ok, true, `${kind}/${audience}`);
          } else {
            assert.equal(result.ok, false, `${kind}/${audience}`);
            if (!result.ok) {
              assert.equal(result.status, 422);
              assert.ok('audience' in result.errors);
            }
          }
        }
      });

      test('consent must be true', () => {
        const result = validate(contract, kind, payload(kind, { consent: false }), 'json');
        assert.equal(result.ok, false);
        if (!result.ok) assert.ok('consent' in result.errors);
      });

      test('an unknown field is rejected, not ignored', () => {
        const result = validate(contract, kind, payload(kind, { isAdmin: 'yes' }), 'json');
        assert.equal(result.ok, false);
        if (!result.ok) assert.ok('isAdmin' in result.errors);
      });
    });
  }

  test('only a brief request may carry the updates choice', () => {
    for (const kind of KINDS) {
      const result = validate(contract, kind, payload(kind, { consentUpdates: true }), 'json');
      assert.equal(result.ok, kind === 'brief-request', kind);
    }
  });

  test('limits and formats', () => {
    const cases: readonly [Kind, string, unknown][] = [
      ['apply', 'name', 'x'.repeat(121)],
      ['apply', 'email', `${'a'.repeat(250)}@example.org`],
      ['apply', 'email', 'not-an-email'],
      ['apply', 'email', 'a@b.org, c@d.org'],
      ['apply', 'email', 'a b@example.org'],
      ['apply', 'stage', 'unicorn'],
      ['apply', 'seats', 'x'.repeat(501)],
      ['apply', 'message', 'x'.repeat(4001)],
      ['apply', 'requestId', 'not-a-uuid'],
      ['apply', 'name', 42],
      ['apply', 'consent', 'true'],
      ['contact', 'topic', 'billing'],
      ['brief-request', 'briefId', 'Not A Slug'],
      ['investor-interest', 'companyUrl', 'http://example.org'],
      ['investor-interest', 'companyUrl', 'https://user:pw@example.org'],
      ['investor-interest', 'companyUrl', `https://example.org/${'a'.repeat(300)}`],
      ['investor-interest', 'investorKind', 'whale'],
      ['investor-interest', 'focus', 'x'.repeat(1001)],
      ['partner-enquiry', 'partnerCategory', 'accelerators'],
      ['partner-enquiry', 'offer', 'x'.repeat(1501)],
      ['apply', 'startedAt', 'yesterday'],
    ];
    for (const [kind, field, value] of cases) {
      const result = validate(contract, kind, payload(kind, { [field]: value }), 'json');
      assert.equal(result.ok, false, `${kind}.${field}=${String(value).slice(0, 30)}`);
      if (!result.ok) assert.ok(field in result.errors);
    }
  });

  test('error messages never echo the submitted value', () => {
    const secret = 'zz-secret-value-9f3a';
    const result = validate(contract, 'apply', payload('apply', { stage: secret, email: `${secret}`, name: 'x'.repeat(200) }), 'json');
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(!JSON.stringify(result.errors).includes(secret));
  });

  test('values are normalized: address lower-cased, request id lower-cased, page query dropped, control characters removed', () => {
    const result = validate(contract, 'apply', payload('apply', {
      email: 'Ada.Example@Example.ORG', requestId: '6F1C2D3E-8A4B-4C5D-9E0F-1A2B3C4D5E6F', page: '/apply/?name=Ada#team=qa:1', name: 'Ada\u0000 Example',
    }), 'json');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.submission.email, 'ada.example@example.org');
      assert.equal(result.submission.requestId, '6f1c2d3e-8a4b-4c5d-9e0f-1a2b3c4d5e6f');
      assert.equal(result.submission.page, '/apply/');
      assert.equal(result.submission.name, 'Ada Example');
    }
  });

  test('a form-encoded body treats a present consent box as true and an absent one as false', () => {
    const body = { ...payload('apply'), consent: 'on' };
    assert.equal(validate(contract, 'apply', body, 'form').ok, true);
    const { consent: _omitted, ...without } = body;
    assert.equal(validate(contract, 'apply', without, 'form').ok, false);
  });

  test('the honeypot is any non-empty website value', () => {
    assert.equal(isHoneypotTripped({ website: 'https://spam.example' }), true);
    assert.equal(isHoneypotTripped({ website: ' ' }), false);
    assert.equal(isHoneypotTripped({ website: '' }), false);
    assert.equal(isHoneypotTripped({}), false);
  });
});
