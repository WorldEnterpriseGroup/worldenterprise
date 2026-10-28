import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { KINDS } from '../../../infra/intake/src/logic/contract.ts';
import { loadContractUnderTest } from '../../../infra/intake/tests/contract-source.ts';

/**
 * The privacy notice and docs/forms-privacy-facts.md must say what happens to a submission. Since 2026-10-28 that is FormSubmit
 * forwarding it to the shared info@ mailbox (RELEASE.md section 5), not the intake service in infra/intake. WP-10's pins check the notice
 * against the v1 field list; these pins check it against the field rules of that contract, so a new field cannot ship without the
 * notice naming it, and against the FormSubmit controls the forms add.
 */
const ROOT = new URL('../../../', import.meta.url);
const privacy = readFileSync(new URL('src/content/pages/legal/privacy.md', ROOT), 'utf8');
const facts = readFileSync(new URL('docs/forms-privacy-facts.md', ROOT), 'utf8');

/** Fields every form sends that are not columns of the required matrix, plus the FormSubmit controls a native post adds. */
const TRANSPORT_FIELDS = ['form', 'audience', 'consentUpdates', '_honey', '_next', '_subject', '_template', '_captcha', 'page'];

describe('the privacy notice names every field of every form', () => {
  const { contract } = loadContractUnderTest();

  for (const kind of KINDS) {
    test(`${kind}`, () => {
      const used = Object.entries(contract.kinds[kind].fields)
        .filter(([name, rule]) => rule.rule !== '-' && name !== 'requestId')  // the request id is JSON-contract only; FormSubmit gets none
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

describe('the privacy notice states what happens to the data', () => {
  test('it names FormSubmit as the forwarder and the shared mailbox as the destination, and no longer names the unused backend', () => {
    assert.match(privacy, /FormSubmit/);
    assert.match(privacy, /formsubmit\.co/);
    assert.match(privacy, /info@worldenterprise\.org/);
    assert.match(privacy, /hello@, apply@ and security@ worldenterprise\.org are aliases/);
    assert.match(privacy, /own terms and privacy policy/i);
    for (const gone of [/Dataverse/, /Azure Communication Services/, /intake\.worldenterprise\.org/, /48 hours/, /unsubscribe link/i]) {
      assert.doesNotMatch(privacy, gone, `the notice still describes ${String(gone)}, which the FormSubmit forms do not do`);
    }
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

  test('says the forms post to FormSubmit and that the intake service is unused', () => {
    assert.match(facts, /FormSubmit/);
    assert.match(facts, /info@worldenterprise\.org/);
    assert.match(facts, /not used/i);
  });
});
