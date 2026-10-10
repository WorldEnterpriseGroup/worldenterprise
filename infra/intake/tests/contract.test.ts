import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { compileContract, ContractError, KINDS, thanksAllowlist } from '../src/logic/contract.ts';
import { handleIntake } from '../src/service/intake.ts';
import { COMMITTED, loadContractUnderTest } from './contract-source.ts';
import { harness, jsonPost, validPayload } from './fakes.ts';

type Json = Record<string, unknown>;

function committedJson(): Json {
  return JSON.parse(readFileSync(COMMITTED, 'utf8')) as Json;
}

function matrixOf(json: Json): Record<string, Json> {
  return (json['presence'] as Json)['matrix'] as Record<string, Json>;
}

describe('the committed contract compiles to the rule table', () => {
  const { contract } = loadContractUnderTest();

  test('every kind has its fields, with types from the field names and limits from the contract', () => {
    for (const kind of KINDS) assert.ok(Object.keys(contract.kinds[kind].fields).length > 10, kind);
    const apply = contract.kinds.apply.fields;
    assert.equal(apply['email']?.type, 'email');
    assert.equal(apply['requestId']?.type, 'uuid');
    assert.equal(apply['consent']?.type, 'boolean');
    assert.equal(apply['message']?.max, 4000);
    assert.equal(apply['stage']?.type, 'enum');
    assert.ok(apply['stage']?.enum.includes('validating'));
    assert.equal(contract.kinds['partner-enquiry'].fields['companyUrl']?.type, 'url');
    assert.equal(contract.kinds['brief-request'].fields['briefId']?.type, 'slug');
  });

  test('the newsletter carries no audience, and a brief request accepts any audience a brief is offered to', () => {
    assert.deepEqual(contract.kinds.newsletter.audience, ['']);
    assert.ok(['startup', 'investor', 'partner', 'corporate'].every((audience) => contract.kinds['brief-request'].audience.includes(audience)));
    assert.deepEqual(contract.briefAudiences['early-stage-diligence'], ['investor']);
  });

  test('the redirect allowlist is the thanks paths the contract names', () => {
    const allowlist = thanksAllowlist(contract);
    assert.ok(allowlist.includes('/apply/thanks/'));
    assert.ok(allowlist.every((path) => path.startsWith('/') && !path.startsWith('//')));
    assert.equal(contract.kinds.contact.thanks, null);
  });
});

describe('a contract the server cannot read is a deployment error that names the path', () => {
  const bad: { readonly name: string; readonly mutate: (json: Json) => void; readonly path: string }[] = [
    { name: 'an unknown form', mutate: (json) => { (json['forms'] as string[]).push('webinar'); }, path: '$.forms' },
    { name: 'a missing form', mutate: (json) => { json['forms'] = (json['forms'] as string[]).filter((form) => form !== 'contact'); }, path: '$.forms' },
    { name: 'an unknown matrix field', mutate: (json) => { (matrixOf(json)['apply'] as Json)['isAdmin'] = 'O'; }, path: '$.presence.matrix.apply.isAdmin' },
    { name: 'a bad presence rule', mutate: (json) => { (matrixOf(json)['apply'] as Json)['email'] = 'X'; }, path: '$.presence.matrix.apply.email' },
    { name: 'a missing matrix column', mutate: (json) => { delete (matrixOf(json)['apply'] as Json)['company']; }, path: '$.presence.matrix.apply.company' },
    { name: 'a missing length limit', mutate: (json) => { delete (json['limits'] as Json)['offer']; }, path: '$.limits.offer' },
    { name: 'an empty enum', mutate: (json) => { (json['enums'] as Json)['stage'] = []; }, path: '$.enums.stage' },
    { name: 'an off-site thanks path', mutate: (json) => { (json['thanks'] as Json)['apply'] = '//evil.example/'; }, path: '$.thanks.apply' },
    { name: 'thanks for an unknown form', mutate: (json) => { (json['thanks'] as Json)['webinar'] = '/x/'; }, path: '$.thanks.webinar' },
    { name: 'a kind with no audiences', mutate: (json) => { (json['audience'] as Json)['apply'] = []; }, path: '$.audience.apply' },
  ];
  for (const { name, mutate, path } of bad) {
    test(name, () => {
      const json = committedJson();
      mutate(json);
      assert.throws(() => compileContract(json), (error: unknown) => error instanceof ContractError && error.path === path, path);
    });
  }
});

describe('briefs are offered by the contract, not by the registry alone', () => {
  test('a brief the contract does not name is 422 on briefId even if a registry holds it', async () => {
    const h = harness();
    h.registry.entries = [...h.registry.entries, { id: 'not-in-contract', title: 'Not in the contract', version: '1.0', pdfPath: 'briefs/not-in-contract/v1.0/x.pdf', htmlPath: 'briefs/not-in-contract/v1.0/x.html' }];
    const result = await handleIntake(h.deps, jsonPost(validPayload('brief-request', { briefId: 'not-in-contract' })));
    assert.equal(result.status, 422);
    assert.ok('briefId' in (JSON.parse(result.body) as { errors: Json })['errors']);
    assert.equal(h.engagements.rows.size, 0);
  });

  test('a brief offered to another audience is 422 on audience', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, jsonPost(validPayload('brief-request', { briefId: 'early-stage-diligence', audience: 'startup' })));
    assert.equal(result.status, 422);
    assert.ok('audience' in (JSON.parse(result.body) as { errors: Json })['errors']);
    assert.equal(h.engagements.rows.size, 0);
  });

  test('a path-like brief id is 422 on briefId', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, jsonPost(validPayload('brief-request', { briefId: '../../secrets' })));
    assert.equal(result.status, 422);
    assert.ok('briefId' in (JSON.parse(result.body) as { errors: Json })['errors']);
  });
});

describe('unknown input is rejected, not passed through', () => {
  test('a field the form does not define is 422 and nothing is stored', async () => {
    const h = harness();
    const result = await handleIntake(h.deps, jsonPost(validPayload('contact', { isAdmin: 'true' })));
    assert.equal(result.status, 422);
    assert.ok('isAdmin' in (JSON.parse(result.body) as { errors: Json })['errors']);
    assert.equal(h.engagements.rows.size, 0);
  });
});
