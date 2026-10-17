import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { schemas } from '../../../src/lib/content-schemas.ts';

/**
 * The consent gate of the people collection (WP-108, #108), mirroring tests/unit/wp-64/portfolio.test.ts. The fixtures below are test data
 * in this file only. They are never written to src/content/people, which stays empty until the operator supplies a real, consented record.
 */
const root = new URL('../../../', import.meta.url).pathname;

const entry = { name: 'Fixture Person', role: 'Fixture role', source: 'register-0001', consent: true };

test('the schema accepts an entry with consent and a source', () => {
  assert.equal(schemas.people.safeParse(entry).success, true);
});

test('the schema rejects an entry without consent, so no draft can parse', () => {
  assert.equal(schemas.people.safeParse({ ...entry, consent: false }).success, false);
  assert.equal(schemas.people.safeParse({ ...entry, consent: undefined }).success, false);
  assert.equal(schemas.people.safeParse({ ...entry, consent: 'yes' }).success, false);
});

test('the schema rejects an entry without a source or without a name and role', () => {
  assert.equal(schemas.people.safeParse({ ...entry, source: undefined }).success, false);
  assert.equal(schemas.people.safeParse({ ...entry, source: '' }).success, false);
  assert.equal(schemas.people.safeParse({ ...entry, name: '' }).success, false);
  assert.equal(schemas.people.safeParse({ ...entry, role: '' }).success, false);
});

test('the schema has no field for contact or profile data, so none can be added without a counsel-reviewed schema change', () => {
  for (const field of ['email', 'phone', 'linkedin', 'twitter', 'website', 'photo', 'location', 'bio']) {
    assert.equal(schemas.people.safeParse({ ...entry, [field]: 'sentinel-client@leak.invalid' }).success, false, `${field} is not a field`);
  }
});

test('src/content/people holds no invented person: every entry present carries consent, a source and no contact data', () => {
  const dir = join(root, 'src/content/people');
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));
  for (const file of entries) {
    const text = readFileSync(join(dir, file), 'utf8');
    assert.match(text, /^consent:\s*true\s*$/m, `${file} has no consent: true`);
    assert.match(text, /^source:\s*\S/m, `${file} has no source`);
    assert.doesNotMatch(text, /\bfixture\b|\bexample\b|\bsample\b|lorem/i, `${file} looks like a sample`);
    assert.doesNotMatch(text, /@|\btel:|linkedin\.com|(?:twitter|x)\.com\/|\+\d[\d\s().-]{6,}/i, `${file} carries contact or profile data`);
  }
});
