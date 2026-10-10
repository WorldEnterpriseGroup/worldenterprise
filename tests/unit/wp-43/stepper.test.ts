import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { buildReviewGroups, stepForErrors, stepStatus } from '../../../src/components/apply/stepper.ts';
import { APPLY_STEPS, firstStepWithErrors, stepIndexForField } from '../../../src/components/apply/steps.ts';
import { REVIEW_COPY } from '../../../src/components/apply/fields.ts';
import type { FieldName, FormValues } from '../../../src/scripts/forms.ts';

// WP-43: the pure half of the Apply stepper, and the consistency of the markup it enhances. The DOM half is covered by the e2e specs in
// tests/e2e/wave7/wp-43/.

const empty: FormValues = { name: '', email: '', company: '', stage: '', seats: '', topic: '', message: '', consent: false, website: '' };
const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
/** Code without comments, so a comment that says "never use localStorage" is not mistaken for a use of it. */
const code = (path: string): string => source(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

test('there are four steps in the order the plan names them, ending with the review', () => {
  assert.deepEqual(APPLY_STEPS.map((s) => s.title), ['About you', 'About the idea', 'Team and package', 'Review']);
  assert.deepEqual(APPLY_STEPS.map((s) => s.id), ['you', 'idea', 'team', 'review']);
});

test('every validated field of the apply form sits on exactly one step', () => {
  const fields: FieldName[] = ['name', 'email', 'company', 'stage', 'message', 'seats', 'package', 'consent'];
  for (const field of fields) {
    const owners = APPLY_STEPS.filter((s) => s.fields.includes(field));
    assert.equal(owners.length, 1, `${field} is on ${owners.length} steps`);
  }
  assert.equal(stepIndexForField('topic'), -1);
  assert.equal(stepIndexForField('consent'), 3);
});

test('a failed submit goes to the earliest step that holds an error, and to none when no error is on a step', () => {
  assert.equal(stepForErrors([{ field: 'stage', message: 'x' }, { field: 'name', message: 'x' }]), 0);
  assert.equal(stepForErrors([{ field: 'consent', message: 'x' }, { field: 'package', message: 'x' }]), 2);
  assert.equal(stepForErrors([{ field: 'topic', message: 'x' }]), null);
  assert.equal(stepForErrors([]), null);
  assert.equal(firstStepWithErrors(['message']), 1);
});

test('the status line counts steps from one and rejects a step that does not exist', () => {
  assert.equal(stepStatus(0), 'Step 1 of 4: About you');
  assert.equal(stepStatus(3), 'Step 4 of 4: Review');
  assert.throws(() => stepStatus(4), RangeError);
  assert.throws(() => stepStatus(-1), RangeError);
});

test('the review shows what was entered, says "Not given" for the rest, and names the package or Not sure', () => {
  const blank = buildReviewGroups(empty);
  assert.deepEqual(blank.map((g) => g.step), ['you', 'idea', 'team']);
  for (const row of blank.flatMap((g) => g.rows)) assert.equal(row.value, REVIEW_COPY.empty, row.label);

  const filled = buildReviewGroups({ ...empty, name: ' Ada ', email: 'ada@example.org', stage: 'validating', message: 'A tool.', package: 'launch' });
  const value = (label: string): string | undefined => filled.flatMap((g) => g.rows).find((r) => r.label === label)?.value;
  assert.equal(value('Your name'), 'Ada');
  assert.equal(value('Email address'), 'ada@example.org');
  assert.equal(value('Where the idea is today'), 'Validating the problem with customers');
  assert.equal(value('Package you have in mind'), 'Launch');
  assert.equal(buildReviewGroups({ ...empty, package: 'not-sure' })[2]?.rows[1]?.value, 'Not sure yet');
  assert.equal(buildReviewGroups({ ...empty, package: 'gold' })[2]?.rows[1]?.value, REVIEW_COPY.empty);
  assert.equal(buildReviewGroups({ ...empty, stage: 'nonsense' })[1]?.rows[0]?.value, REVIEW_COPY.empty);
});

test('the review never lists the consent box or the honeypot', () => {
  const labels = buildReviewGroups({ ...empty, website: 'spam' }).flatMap((g) => g.rows.map((r) => r.label));
  assert.ok(!labels.some((l) => /consent|agree|website/i.test(l)));
  assert.ok(!buildReviewGroups({ ...empty, website: 'spam' }).flatMap((g) => g.rows).some((r) => r.value === 'spam'));
});

test('ApplyForm renders one fieldset per step with the ids steps.ts declares, and a hidden stepper bar', () => {
  const form = source('src/components/forms/ApplyForm.astro');
  for (const step of APPLY_STEPS.filter((s) => s.id !== 'review')) {
    assert.ok(form.includes(`step="${step.id}"`), `ApplyForm.astro has no fieldset for step ${step.id}`);
    assert.ok(form.includes(`legend="${step.title}"`), `ApplyForm.astro has no legend ${step.title}`);
  }
  assert.ok(form.includes('data-step="review"'));
  assert.ok(form.includes('<ApplyProgress slot="top" />'));
  assert.ok(form.includes('stepped'));
  const progress = source('src/components/apply/ApplyProgress.astro');
  assert.ok(progress.includes('data-stepper hidden'), 'the bar must ship hidden so a visitor without JavaScript sees no dead control');
  assert.ok(progress.includes('APPLY_STEPS.map'));
});

test('the package select ships hidden and nameless, so the native no-JS post cannot carry it', () => {
  const form = source('src/components/forms/ApplyForm.astro');
  assert.match(form, /data-package-field hidden/);
  assert.match(form, /dataField="package"/);
  assert.ok(!/name="package"/.test(form), 'the package select must have no name attribute');
  const field = source('src/components/forms/Field.astro');
  assert.match(field, /name\?: string/);
});

test('Back and Next ship hidden and only on the stepped form', () => {
  const frame = source('src/components/forms/FormFrame.astro');
  assert.match(frame, /stepped && <button class="btn btn--secondary" type="button" data-step-back hidden>/);
  assert.match(frame, /stepped && <button class="btn btn--primary" type="button" data-step-next hidden>/);
});

test('no step state or answer is persisted: no storage, cookie or history API in the stepper or the form script', () => {
  const files = ['src/components/apply/stepper.ts', 'src/components/apply/steps.ts', 'src/components/apply/fields.ts', 'src/scripts/forms.ts'];
  for (const file of files) {
    assert.doesNotMatch(code(file), /localStorage|sessionStorage|indexedDB|document\.cookie|history\.(push|replace)State|caches\./, file);
  }
  for (const entry of readdirSync(new URL('../../../src/components/apply/', import.meta.url))) {
    assert.doesNotMatch(code(`src/components/apply/${entry}`), /localStorage|sessionStorage|document\.cookie/, entry);
  }
});

test('the submit control still defers to the endpoint mode: the stepper never enables a disabled submit', () => {
  const stepper = source('src/components/apply/stepper.ts');
  assert.doesNotMatch(stepper, /\.disabled\s*=\s*false|removeAttribute\('disabled'\)/);
  assert.match(stepper, /this\.submit\.hidden = !this\.isFinal/);
});
