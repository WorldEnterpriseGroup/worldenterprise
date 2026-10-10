import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { KINDS } from '../../../infra/intake/src/logic/contract.ts';
import { loadContractUnderTest } from '../../../infra/intake/tests/contract-source.ts';

/**
 * The privacy notice and docs/forms-privacy-facts.md must say what the intake service does. WP-10's pins check the notice
 * against the v1 field list; these pins check it against the contract the Function actually enforces, so a new field cannot
 * ship without the notice naming it.
 */
const ROOT = new URL('../../../', import.meta.url);
const privacy = readFileSync(new URL('src/content/pages/legal/privacy.md', ROOT), 'utf8');
const facts = readFileSync(new URL('docs/forms-privacy-facts.md', ROOT), 'utf8');

/** Fields every form sends that are not columns of the required matrix, plus the one a native post adds. */
const TRANSPORT_FIELDS = ['form', 'audience', 'consentUpdates', 'website', 'startedAt', 'submittedAt', 'page', 'redirect'];

describe('the privacy notice names every field of every form', () => {
  const { contract } = loadContractUnderTest();

  for (const kind of KINDS) {
    test(`${kind}`, () => {
      const used = Object.entries(contract.kinds[kind].fields)
        .filter(([, rule]) => rule.rule !== '-')
        .map(([name]) => name);
      for (const field of [...used, ...TRANSPORT_FIELDS]) {
        assert.ok(privacy.includes(`\`${field}\``), `the privacy notice does not name ${field}, which ${kind} uses`);
      }
    });
  }

  test('all six forms are named', () => {
    for (const form of ['Apply', 'Contact', 'Request a brief', 'Investor interest', 'Partner enquiry', 'newsletter']) {
      assert.ok(privacy.includes(form), `the privacy notice does not name the ${form} form`);
    }
  });
});

describe('the privacy notice states what the service does with the data', () => {
  test('it names the CRM use, the mail provider and the emailed link', () => {
    assert.match(privacy, /customer relationship management system/i);
    assert.match(privacy, /Dataverse/);
    assert.match(privacy, /Azure Communication Services/);
    assert.match(privacy, /link to it/i);
    assert.match(privacy, /unsubscribe/i);
  });

  test('it keeps the browsing promises', () => {
    assert.match(privacy, /sets no cookies/i);
    assert.match(privacy, /no analytics/i);
  });

  test('it states no retention period and says none is set', () => {
    assert.equal(/\b\d+\s+(?:days|weeks|months|years)\b/i.test(privacy), false);
    assert.match(privacy, /has not yet set a period/i);
  });

  test('it makes no promise about delivery time or nurture sequences', () => {
    assert.equal(/\bwithin\s+\d+/i.test(privacy), false);
    assert.equal(/\bday\s+(?:3|10|21)\b/i.test(privacy), false);
  });
});

describe('docs/forms-privacy-facts.md', () => {
  test('lists the facts a counsel review needs and leaves retention open', () => {
    for (const heading of ['What each form sends', 'What the service stores', 'Email', 'Logs', 'Retention', 'Open items']) {
      assert.ok(facts.includes(heading), `the facts document has no ${heading} section`);
    }
    assert.match(facts, /OP-RETAIN/);
    assert.match(facts, /OP-COUNSEL/);
    assert.equal(/\b\d+\s+(?:days|weeks|months|years)\b/i.test(facts), false);
  });

  test('names the secrets by name only', () => {
    assert.match(facts, /worldenterprise-intake-unsubscribe-key/);
  });
});
