import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { compileContract, ContractError, thanksAllowlist, type Contract } from '../src/logic/contract.ts';
import { handleIntake } from '../src/service/intake.ts';
import { FIXTURE } from './contract-source.ts';
import { harness, jsonPost, validPayload } from './fakes.ts';

type Json = Record<string, unknown>;

function fixtureJson(): Json {
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as Json;
}

function kindsOf(json: Json): Record<string, Json> {
  return json['kinds'] as Record<string, Json>;
}

describe('the contract shape WP-60 emits', () => {
  test('rateLimit.perHour is read per kind and defaults to the service-wide limit', () => {
    const json = fixtureJson();
    kindsOf(json)['contact'] = { ...kindsOf(json)['contact'], rateLimit: { perHour: 2 } };
    const contract = compileContract(json);
    assert.equal(contract.kinds.contact.rateLimit.perHour, 2);
    assert.equal(contract.kinds.apply.rateLimit.perHour, 5);
  });

  test('redirectAllowlist joins the thanks paths and is optional', () => {
    const json = fixtureJson();
    assert.deepEqual(compileContract(json).redirectAllowlist, []);
    json['redirectAllowlist'] = ['/briefs/thanks/', '/newsletter/thanks/'];
    const allowlist = thanksAllowlist(compileContract(json));
    assert.ok(allowlist.includes('/newsletter/thanks/'));
    assert.ok(allowlist.includes('/apply/thanks/'));
  });

  test('values that do not fit are a deployment error that names the path', () => {
    const bad: { readonly mutate: (json: Json) => void; readonly path: string }[] = [
      { mutate: (json) => { json['redirectAllowlist'] = ['//evil.example/']; }, path: '$.redirectAllowlist[0]' },
      { mutate: (json) => { json['redirectAllowlist'] = 'nope'; }, path: '$.redirectAllowlist' },
      { mutate: (json) => { kindsOf(json)['apply'] = { ...kindsOf(json)['apply'], rateLimit: { perHour: 0 } }; }, path: '$.kinds.apply.rateLimit.perHour' },
      { mutate: (json) => { kindsOf(json)['apply'] = { ...kindsOf(json)['apply'], rateLimit: 5 }; }, path: '$.kinds.apply.rateLimit' },
      { mutate: (json) => { kindsOf(json)['webinar'] = kindsOf(json)['apply'] as Json; }, path: '$.kinds.webinar' },
    ];
    for (const { mutate, path } of bad) {
      const json = fixtureJson();
      mutate(json);
      assert.throws(() => compileContract(json), (error: unknown) => error instanceof ContractError && error.path === path, path);
    }
  });
});

describe('the per-kind rate limit reaches the store', () => {
  function withLimit(perHour: number): Contract {
    const json = fixtureJson();
    kindsOf(json)['contact'] = { ...kindsOf(json)['contact'], rateLimit: { perHour } };
    return compileContract(json);
  }

  test('a kind limited to two an hour answers 429 on the third', async () => {
    const h = harness();
    const deps = { ...h.deps, contract: withLimit(2) };
    for (let index = 0; index < 2; index += 1) {
      const result = await handleIntake(deps, jsonPost(validPayload('contact', { email: `p${index}@example.org` })));
      assert.equal(result.status, 202, `request ${index + 1}`);
    }
    const third = await handleIntake(deps, jsonPost(validPayload('contact', { email: 'p2@example.org' })));
    assert.equal(third.status, 429);
    assert.ok(h.rate.limits.every((limit) => limit === 2));
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
