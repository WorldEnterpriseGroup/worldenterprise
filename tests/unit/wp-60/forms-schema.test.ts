import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { BRIEFS } from '../../../src/data/families.ts';
import {
  FIELD_KEYS,
  FORM_KINDS,
  FORM_MATRIX,
  FORM_ROUTES,
  MAILTO_KINDS,
  THANKS_PATHS,
  audiencesFor,
  formsSchema,
  validate,
} from '../../../src/data/forms.ts';
import type { FormKind, FormValues } from '../../../src/data/forms.ts';
import { getRoute } from '../../../src/data/routes.ts';

// Forms contract v2 (docs/forms-contract.md, docs/wave8-contracts.md section 3). The required matrix, the enums and the limits live in
// src/data/forms.ts; docs/forms-contract.schema.json is generated from them so the intake Function's tests can read the same table.

const SCHEMA_PATH = new URL('../../../docs/forms-contract.schema.json', import.meta.url);
const render = (): string => `${JSON.stringify(formsSchema(), null, 2)}\n`;

test('docs/forms-contract.schema.json is the generated form of src/data/forms.ts (UPDATE_SCHEMA=1 regenerates it)', () => {
  if (process.env.UPDATE_SCHEMA === '1') writeFileSync(SCHEMA_PATH, render());
  assert.equal(readFileSync(SCHEMA_PATH, 'utf8'), render(), 'run: UPDATE_SCHEMA=1 node --test tests/unit/wp-60/forms-schema.test.ts');
});

const UUID = '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b';
const empty: FormValues = {
  name: '', email: '', company: '', stage: '', seats: '', topic: '', message: '', consent: false, website: '',
  requestId: '', audience: '', briefId: '', companyUrl: '', partnerCategory: '', offer: '', investorKind: '', focus: '',
};

/** Values that satisfy every `R` of the matrix for one kind. */
function complete(kind: FormKind): FormValues {
  const brief = BRIEFS.entries[0];
  return {
    ...empty,
    name: 'Ada Example',
    email: 'ada@example.org',
    company: FORM_MATRIX[kind].company === 'R' ? 'Acme Ltd' : '',
    stage: FORM_MATRIX[kind].stage === 'R' ? 'validating' : '',
    topic: FORM_MATRIX[kind].topic === 'R' ? 'general' : '',
    message: FORM_MATRIX[kind].message === 'R' ? 'Hello.' : '',
    briefId: kind === 'brief-request' ? (brief?.slug ?? '') : '',
    companyUrl: FORM_MATRIX[kind].companyUrl === 'R' ? 'https://acme.example' : '',
    partnerCategory: kind === 'partner-enquiry' ? 'legal' : '',
    offer: kind === 'partner-enquiry' ? 'Fixed-fee incorporation for founders.' : '',
    audience: kind === 'brief-request' ? (brief?.audience[0] ?? 'startup') : (audiencesFor(kind)[0] ?? ''),
    requestId: kind === 'newsletter' ? '' : UUID,
    consent: true,
  };
}

test('every kind validates clean when its required fields are filled', () => {
  for (const kind of FORM_KINDS) assert.deepEqual(validate(kind, complete(kind)), [], kind);
});

test('each required field is reported when it is the only thing missing', () => {
  for (const kind of FORM_KINDS) {
    for (const key of FIELD_KEYS) {
      if (FORM_MATRIX[kind][key] !== 'R') continue;
      const values = key === 'consent' ? { ...complete(kind), consent: false } : { ...complete(kind), [key]: '' };
      assert.deepEqual(
        validate(kind, values).map((e) => e.field),
        [key],
        `${kind} without ${key}`,
      );
    }
  }
});

test('a field the matrix marks empty is refused when it carries a value (newsletter excepted)', () => {
  for (const kind of FORM_KINDS) {
    if (kind === 'newsletter') continue;
    for (const key of FIELD_KEYS) {
      if (FORM_MATRIX[kind][key] !== '-' || key === 'consent') continue;
      const errors = validate(kind, { ...complete(kind), [key]: 'x' }).map((e) => e.field);
      assert.ok(errors.includes(key), `${kind} refuses ${key}`);
    }
  }
});

test('the request id must be a UUID v4 for every kind but the newsletter', () => {
  for (const kind of FORM_KINDS) {
    if (kind === 'newsletter') continue;
    for (const bad of ['', 'not-a-uuid', '3f2b8c1e-5d4a-1e6b-9a7c-1b2d3e4f5a6b']) {
      assert.deepEqual(validate(kind, { ...complete(kind), requestId: bad }).map((e) => e.field), ['requestId'], `${kind} ${bad}`);
    }
  }
});

test('audience: apply is startup, investor interest is investor, partner enquiry is partner, contact accepts every audience', () => {
  assert.deepEqual(audiencesFor('apply'), ['startup']);
  assert.deepEqual(audiencesFor('investor-interest'), ['investor']);
  assert.deepEqual(audiencesFor('partner-enquiry'), ['partner']);
  assert.ok(audiencesFor('contact').length >= 3);
  assert.deepEqual(validate('apply', { ...complete('apply'), audience: 'investor' }).map((e) => e.field), ['audience']);
  assert.deepEqual(validate('partner-enquiry', { ...complete('partner-enquiry'), audience: 'startup' }).map((e) => e.field), ['audience']);
});

test('a brief request takes the audience list of its own registry entry', () => {
  for (const entry of BRIEFS.entries) {
    for (const audience of entry.audience) {
      assert.deepEqual(validate('brief-request', { ...complete('brief-request'), briefId: entry.slug, audience }), [], `${entry.slug} ${audience}`);
    }
  }
  assert.deepEqual(validate('brief-request', { ...complete('brief-request'), briefId: 'not-a-brief' }).map((e) => e.field), ['briefId']);
});

test('the company website must be https, and the partner enquiry needs one', () => {
  assert.deepEqual(validate('partner-enquiry', { ...complete('partner-enquiry'), companyUrl: 'http://acme.example' }).map((e) => e.field), ['companyUrl']);
  assert.deepEqual(validate('investor-interest', { ...complete('investor-interest'), companyUrl: '' }), []);
  assert.deepEqual(validate('investor-interest', { ...complete('investor-interest'), companyUrl: 'javascript:alert(1)' }).map((e) => e.field), ['companyUrl']);
});

test('mailto is for apply and contact only; every form route has a ledger row and every thanks path is a launched one', () => {
  assert.deepEqual([...MAILTO_KINDS], ['apply', 'contact']);
  for (const path of Object.keys(FORM_ROUTES)) assert.ok(getRoute(path) !== undefined, `${path} has a ledger row`);
  for (const path of Object.values(THANKS_PATHS)) assert.equal(getRoute(path)?.launch, true, `${path} is a launched row`);
});

test('the schema JSON names the same kinds, endpoint-free, and carries the request id pattern', () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as { version: number; forms: string[]; requestId: { pattern: string } };
  assert.equal(schema.version, 2);
  assert.deepEqual(schema.forms, [...FORM_KINDS]);
  assert.ok(new RegExp(schema.requestId.pattern, 'i').test(UUID));
  assert.doesNotMatch(readFileSync(SCHEMA_PATH, 'utf8'), /https?:\/\//, 'the schema names no endpoint');
});
