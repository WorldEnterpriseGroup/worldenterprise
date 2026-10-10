import assert from 'node:assert/strict';
import test from 'node:test';
import { PACKAGE_OPTIONS } from '../../../src/components/apply/fields.ts';
import { PACKAGE_IDS, packages } from '../../../src/data/packages.ts';
import { buildPayload, composeMessage, packageFromSearch, packageNote, validate } from '../../../src/scripts/forms.ts';
import type { FormValues } from '../../../src/scripts/forms.ts';

// WP-43: the optional package field. The intake payload schema is closed (docs/forms-contract.md section 3), so the choice rides inside
// `message`, and the field is read leniently from ?package= (docs/wave7-contracts.md section 1).

const base: FormValues = {
  name: 'Ada Example',
  email: 'ada@example.org',
  company: '',
  stage: 'validating',
  seats: '',
  topic: '',
  message: 'A scheduling tool for clinics.',
  consent: true,
  website: '',
};
const timing = { startedAt: Date.UTC(2026, 9, 9, 10, 0, 0), submittedAt: Date.UTC(2026, 9, 9, 10, 3, 0) };
const keys = (value: object): string[] => Object.keys(value).sort();

test('the package line names the package, says not sure, and is empty for no choice or an unknown id', () => {
  assert.equal(packageNote('spark'), 'Package interest: Spark');
  assert.equal(packageNote('studio'), 'Package interest: Studio');
  assert.equal(packageNote('not-sure'), 'Package interest: not sure yet');
  for (const none of [undefined, '', 'gold', 'SPARK', '__proto__']) assert.equal(packageNote(none), '', String(none));
});

test('the message carries the package line after the visitor text, and stands alone when the text is empty', () => {
  assert.equal(composeMessage('Hello', 'launch'), 'Hello\n\nPackage interest: Launch');
  assert.equal(composeMessage('', 'launch'), 'Package interest: Launch');
  assert.equal(composeMessage('  Hello\r\nthere  ', ''), 'Hello\nthere');
  assert.equal(composeMessage('', undefined), '');
});

test('the payload keeps exactly the closed key set whether or not a package is chosen', () => {
  const without = buildPayload('apply', base, timing, '/apply/');
  const withPackage = buildPayload('apply', { ...base, package: 'accelerate' }, timing, '/apply/');
  assert.deepEqual(keys(withPackage), keys(without));
  assert.ok(!('package' in withPackage));
  assert.equal(withPackage.message, 'A scheduling tool for clinics.\n\nPackage interest: Accelerate');
  assert.equal(without.message, base.message);
  assert.equal(buildPayload('apply', { ...base, package: 'not-sure' }, timing, '/apply/').message, 'A scheduling tool for clinics.\n\nPackage interest: not sure yet');
});

test('a contact message never gains a package line', () => {
  const contact = buildPayload('contact', { ...base, topic: 'general', package: 'spark' }, timing, '/contact/');
  assert.equal(contact.message, base.message);
  assert.deepEqual(keys(contact), keys(buildPayload('apply', base, timing, '/apply/')));
});

test('the package is optional, validated against the list, and counted in the message limit', () => {
  assert.deepEqual(validate('apply', base), []);
  assert.deepEqual(validate('apply', { ...base, package: '' }), []);
  assert.deepEqual(validate('apply', { ...base, package: 'not-sure' }), []);
  for (const id of PACKAGE_IDS) assert.deepEqual(validate('apply', { ...base, package: id }), [], id);
  const bad = validate('apply', { ...base, package: 'gold' });
  assert.deepEqual(bad.map((e) => e.field), ['package']);
  assert.match(bad[0]?.message ?? '', /Choose one of the packages/);
  const nearLimit = 'x'.repeat(4000 - 10);
  assert.deepEqual(validate('apply', { ...base, message: nearLimit }), []);
  assert.deepEqual(validate('apply', { ...base, message: nearLimit, package: 'spark' }).map((e) => e.field), ['message']);
});

test('?package= is read leniently: one valid value, otherwise nothing', () => {
  assert.equal(packageFromSearch('?package=spark'), 'spark');
  assert.equal(packageFromSearch('?package=Launch'), 'launch');
  assert.equal(packageFromSearch('?package=%20studio%20'), 'studio');
  assert.equal(packageFromSearch('?package=not-sure'), 'not-sure');
  assert.equal(packageFromSearch('?utm_source=x&package=accelerate'), 'accelerate');
  for (const none of ['', '?', '?package=', '?package=gold', '?package=spark&package=launch', '?other=spark', '?package=%E0%A4%A']) {
    assert.equal(packageFromSearch(none), null, none);
  }
});

test('the select lists an empty choice, the four packages in published order, then Not sure, and nothing else', () => {
  assert.deepEqual(
    PACKAGE_OPTIONS.map((o) => o.value),
    ['', ...packages.map((p) => p.id), 'not-sure'],
  );
  assert.deepEqual(PACKAGE_OPTIONS.slice(1, -1).map((o) => o.label), packages.map((p) => p.name));
  for (const option of PACKAGE_OPTIONS) assert.doesNotMatch(option.label, /[0-9$€£]/, option.label);
});
