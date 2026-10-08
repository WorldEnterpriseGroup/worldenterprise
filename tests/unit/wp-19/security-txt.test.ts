import assert from 'node:assert/strict';
import test from 'node:test';
import { securityContactUri, securityTxt, speculationRules } from '../../../src/lib/seo.ts';

// code-security P2-4 and P2-6.

const expires = new Date('2027-10-06T00:00:00Z');

test('an https URL, a mailto or tel URI and a bare mailbox are all valid contacts, and none is mangled', () => {
  assert.equal(securityContactUri('https://github.com/WorldEnterpriseGroup/worldenterprise/security/advisories/new'), 'https://github.com/WorldEnterpriseGroup/worldenterprise/security/advisories/new');
  assert.equal(securityContactUri('mailto:security@worldenterprise.org'), 'mailto:security@worldenterprise.org');
  assert.equal(securityContactUri('tel:+15555550100'), 'tel:+15555550100');
  assert.equal(securityContactUri('security@worldenterprise.org'), 'mailto:security@worldenterprise.org');
  assert.equal(securityContactUri('  security@worldenterprise.org  '), 'mailto:security@worldenterprise.org');
});

test('a cleartext, foreign or malformed contact is refused instead of published', () => {
  for (const bad of ['http://example.org/report', 'ftp://example.org', 'javascript:alert(1)', 'not a contact', '', 'https://', 'a@b', 'security @worldenterprise.org']) {
    assert.throws(() => securityContactUri(bad), /security\.txt contact must be/, JSON.stringify(bad));
  }
});

test('the file carries the URL contact as written, still has no file while the contact is null, and keeps the other RFC 9116 fields', () => {
  assert.equal(securityTxt({ contact: null, expires }), null);
  const body = securityTxt({ contact: 'https://example.org/security', expires }) ?? '';
  assert.match(body, /^Contact: https:\/\/example\.org\/security\n/);
  assert.doesNotMatch(body, /mailto:https/);
  assert.match(body, /Expires: 2027-10-06T00:00:00\.000Z/);
  assert.match(body, /Canonical: https:\/\/worldenterprise\.org\/\.well-known\/security\.txt/);
});

test('the speculation rules carry no rule that can never match', () => {
  const text = JSON.stringify(speculationRules('/'));
  assert.doesNotMatch(text, /selector_matches/);
  assert.match(text, /href_matches/);
});
