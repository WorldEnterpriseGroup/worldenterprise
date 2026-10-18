import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// WP-108 (#108): C-13 gains the social-proof shapes that name or imply a customer. The audit:claims self-test seeds the same cases through
// the real scanner (tests/unit/wp-18/audit-claims.test.ts runs it); this file pins the rule data so a loosened pattern fails here.

interface Rule {
  readonly id: string;
  readonly claim: string;
  readonly flags?: string;
  readonly pattern: string;
}
const denylist = JSON.parse(readFileSync(new URL('../../../claims-denylist.json', import.meta.url), 'utf8')) as { rules: Rule[] };
const rule = (id: string): RegExp => {
  const found = denylist.rules.find((r) => r.id === id);
  assert.ok(found, `${id} exists`);
  assert.equal(found.claim, 'C-13');
  return new RegExp(found.pattern, found.flags ?? '');
};

test('every shape the issue names is caught', () => {
  const named = rule('C-13-named-customers');
  for (const text of ['Our customers include Acme.', 'our clients such as Initech', 'Customers include Acme', 'Clients such as Acme', 'used by 500 teams', 'Used by leading companies', 'used by hundreds of founders', 'Case study: Acme', 'case study : Acme']) {
    assert.match(text, named, text);
  }
  assert.match('Used by Acme and Globex', rule('C-13-used-by-named'));
  assert.match('used by Acme, Globex', rule('C-13-used-by-named'));
});

test('ordinary wording that holds the same words is not caught', () => {
  const named = rule('C-13-named-customers');
  for (const text of ['Formulas used by the runway calculator', 'a product used by a child at home', 'built once and used by many', 'a mark previously used by another', 'Are any of our customers connected to us?', 'a case study of a method', 'customers are asked']) {
    assert.doesNotMatch(text, named, text);
  }
  assert.doesNotMatch('Formulas used by the cap table explainer', rule('C-13-used-by-named'));
  assert.doesNotMatch('used by many and Used by a person', rule('C-13-used-by-named'));
});
