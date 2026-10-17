import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CONTEXT_EMPTY_LABEL, CONTEXT_SELECTS, SITUATION_HEADINGS, SITUATION_IDS, contextOptions } from '../../../src/components/apply/fields.ts';
import { APPLY_CONTEXT, APPLY_CONTEXT_KEYS, FIELD_KEYS, SITUATIONS, STARTED_MONTH_LIMIT } from '../../../src/data/forms.ts';
import { buildPayload, composeMessage, contextLines, situationFromSearch, validate } from '../../../src/scripts/forms.ts';
import type { FormValues } from '../../../src/scripts/forms.ts';

// WP-54 (W9-13): the readiness review's context questions (SALES.md 6.4, the interim with no contract change). The intake schema stays
// closed (docs/forms-contract.md section 3), so each answer rides inside `message` as one labelled line, the controls have no name, and
// `?situation=` preselects the situation leniently. The retired package field leaves no trace.

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
  audience: 'startup',
  requestId: '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b',
};
const timing = { startedAt: Date.UTC(2026, 9, 9, 10, 0, 0), submittedAt: Date.UTC(2026, 9, 9, 10, 3, 0) };
const keys = (value: object): string[] => Object.keys(value).sort();
const full = { situation: 'industry-insider', startedMonth: '2025-03', industryYears: 'three-to-nine', teamFunding: 'revenue', horizon: 'one-to-three', source: 'professional-referral' };

test('the context questions are the six of SALES.md 6.4, and none is a key of the request body', () => {
  assert.deepEqual([...APPLY_CONTEXT_KEYS], ['situation', 'startedMonth', 'industryYears', 'teamFunding', 'horizon', 'source']);
  for (const key of APPLY_CONTEXT_KEYS) assert.ok(!(FIELD_KEYS as readonly string[]).includes(key), key);
  assert.ok(!(FIELD_KEYS as readonly string[]).includes('package'));
});

test('the situations are the seven situation pages plus None of these, and never ask age, race, sex or national origin', () => {
  assert.deepEqual(
    SITUATIONS.map((s) => s.value),
    ['industry-insider', 'encore', 'repeat-builder', 'global', 'under-backed', 'next-gen', 'restart', 'none'],
  );
  for (const situation of SITUATIONS) assert.doesNotMatch(situation.label, /\b(age|old|young|race|ethnic|sex|gender|citizen|nationality|born)\b/i, situation.label);
  assert.deepEqual(SITUATION_IDS, SITUATIONS.map((s) => s.value));
  for (const id of Object.keys(SITUATION_HEADINGS)) assert.ok((SITUATION_IDS as readonly string[]).includes(id), id);
  assert.equal(SITUATION_HEADINGS['next-gen'], undefined, 'Early in my career has no form heading (SALES.md 6.3)');
});

test('every context select opens on an empty choice followed by the answers in order', () => {
  for (const key of CONTEXT_SELECTS) {
    const options = contextOptions(key);
    assert.deepEqual(options[0], { value: '', label: CONTEXT_EMPTY_LABEL }, key);
    assert.deepEqual(options.slice(1), APPLY_CONTEXT[key].choices, key);
  }
});

test('the message carries one labelled line per answer, after the visitor text, in question order', () => {
  assert.deepEqual(contextLines(full), [
    'Situation: Leaving an industry to build in it',
    'Company started: 2025-03',
    'Years in the industry before starting: Three to nine years',
    'How the company would pay for a team: Revenue',
    'Expected build horizon: One to three years',
    'Heard about WE through: Referral from an accountant or attorney',
  ]);
  assert.equal(composeMessage('Hello', { teamFunding: 'savings' }), 'Hello\n\nHow the company would pay for a team: Savings');
  assert.equal(composeMessage('', { horizon: 'longer' }), 'Expected build horizon: Longer');
  assert.equal(composeMessage('  Hello\r\nthere  ', {}), 'Hello\nthere');
  assert.equal(composeMessage('Hello', undefined), 'Hello');
});

test('an empty or unknown answer adds no line, and a typed start date is folded onto one line', () => {
  assert.deepEqual(contextLines({ situation: '', industryYears: 'gold', source: '__proto__', horizon: 'SPARK' }), []);
  assert.deepEqual(contextLines({ startedMonth: '  spring\n2025 ' }), ['Company started: spring 2025']);
});

test('the payload keeps exactly the closed key set whether or not context answers are given', () => {
  const without = buildPayload('apply', base, timing, '/apply/');
  const withContext = buildPayload('apply', { ...base, ...full }, timing, '/apply/');
  assert.deepEqual(keys(withContext), keys(without));
  for (const key of [...APPLY_CONTEXT_KEYS, 'package']) assert.ok(!(key in withContext), key);
  assert.equal(withContext.message, `A scheduling tool for clinics.\n\n${contextLines(full).join('\n')}`);
});

test('a contact message never gains a context line', () => {
  const contact = buildPayload('contact', { ...base, topic: 'general', ...full }, timing, '/contact/');
  assert.equal(contact.message, 'A scheduling tool for clinics.');
});

test('the answers are optional, checked against their lists, and counted in the message limit', () => {
  assert.deepEqual(validate('apply', base), []);
  assert.deepEqual(validate('apply', { ...base, ...full }), []);
  const bad = validate('apply', { ...base, situation: 'gold', horizon: 'forever' });
  assert.deepEqual(bad.map((e) => e.field), ['situation', 'horizon']);
  assert.match(bad[0]?.message ?? '', /Choose one of the answers in the list/);
  const long = validate('apply', { ...base, startedMonth: 'x'.repeat(STARTED_MONTH_LIMIT + 1) });
  assert.deepEqual(long.map((e) => e.field), ['startedMonth']);
  const nearLimit = 'x'.repeat(3990);
  assert.deepEqual(validate('apply', { ...base, message: nearLimit, situation: 'encore' }).map((e) => e.field), ['message']);
  // Another kind ignores the answers: they are never part of its body.
  assert.deepEqual(validate('contact', { ...base, stage: '', topic: 'general', situation: 'gold' }), []);
});

test('?situation= is read leniently: one known situation, otherwise nothing', () => {
  assert.equal(situationFromSearch('?situation=encore'), 'encore');
  assert.equal(situationFromSearch('?situation=Industry-Insider'), 'industry-insider');
  assert.equal(situationFromSearch('?situation=%20restart%20'), 'restart');
  assert.equal(situationFromSearch('?utm_source=x&situation=global'), 'global');
  for (const none of ['', '?', '?situation=', '?situation=none', '?situation=gold', '?situation=encore&situation=global', '?package=spark', '?situation=%E0%A4%A']) {
    assert.equal(situationFromSearch(none), null, none);
  }
});

test('the form has no package control left, and the context controls are script-only', () => {
  const form = readFileSync(new URL('../../../src/components/forms/ApplyForm.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(form, /package|PACKAGE/);
  assert.match(form, /submitLabel="Start my readiness review"/);
  assert.match(form, /data-situation-heading=\{id\} hidden/);
  const script = readFileSync(new URL('../../../src/scripts/forms.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /packages\.ts|packageFromSearch|PACKAGE_/);
});
