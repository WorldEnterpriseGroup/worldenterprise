import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FORM_KINDS,
  FORMSUBMIT_SUBJECTS,
  formSubmitBody,
  formSubmitHiddenFields,
  formSubmitSubject,
  planForm,
  type FormConfig,
} from '../../../src/data/forms.ts';
import { FORMSUBMIT_HOST, formSubmitTargets, isFormSubmit, resolveEndpoints } from '../../../src/lib/endpoints.ts';
import { buildCsp, endpointOrigins } from '../../../src/lib/csp.ts';
import { buildPayload, relaySucceeded, submitIntake, SubmitError } from '../../../src/scripts/forms.ts';
import type { FormValues } from '../../../src/data/forms.ts';

// Release decision of 2026-10-28 (RELEASE.md section 5): no intake service of its own. Both endpoint variables hold
// https://formsubmit.co/info@worldenterprise.org, the same relay the sister site globalenterprise uses. These tests pin how the
// forms behave against it: the two doors (native post and AJAX), the `_` controls, the honeypot name and the Content Security Policy.

const ENDPOINT = 'https://formsubmit.co/info@worldenterprise.org';
const AJAX = 'https://formsubmit.co/ajax/info@worldenterprise.org';

const relay: FormConfig = { id: 'intake', mode: 'endpoint', endpoint: ENDPOINT, mailto: null };
const json: FormConfig = { id: 'intake', mode: 'endpoint', endpoint: 'https://intake.example.test/api/intake', mailto: null };

test('isFormSubmit matches the https FormSubmit origin only', () => {
  assert.equal(FORMSUBMIT_HOST, 'formsubmit.co');
  assert.equal(isFormSubmit(ENDPOINT), true);
  assert.equal(isFormSubmit(AJAX), true);
  assert.equal(isFormSubmit('http://formsubmit.co/info@worldenterprise.org'), false);
  assert.equal(isFormSubmit('https://formsubmit.co.evil.example/info@worldenterprise.org'), false);
  assert.equal(isFormSubmit('https://evil.example/formsubmit.co'), false);
  assert.equal(isFormSubmit('https://intake.example.test/api/intake'), false);
  assert.equal(isFormSubmit(null), false);
  assert.equal(isFormSubmit('not a url'), false);
});

test('formSubmitTargets gives the plain door for a native post and the /ajax/ door for the script, from either spelling', () => {
  assert.deepEqual(formSubmitTargets(ENDPOINT), { native: ENDPOINT, ajax: AJAX });
  assert.deepEqual(formSubmitTargets(AJAX), { native: ENDPOINT, ajax: AJAX });
  assert.throws(() => formSubmitTargets('https://formsubmit.co/'), /names no mailbox/);
  assert.throws(() => formSubmitTargets('https://formsubmit.co/ajax/'), /names no mailbox/);
  assert.throws(() => formSubmitTargets('https://intake.example.test/x'), /not a https:\/\/formsubmit\.co endpoint/);
});

test('the endpoint variables accept the FormSubmit address, and the policy allows exactly its origin for fetch and for a form post', () => {
  const env: Record<string, string> = { PUBLIC_WE_INTAKE_API_URL: ENDPOINT, PUBLIC_WE_NEWSLETTER_API_URL: ENDPOINT };
  const endpoints = resolveEndpoints((name) => env[name]);
  assert.equal(endpoints.intake, ENDPOINT);
  assert.equal(endpoints.newsletter, ENDPOINT);
  assert.deepEqual(endpointOrigins([endpoints.intake ?? undefined, endpoints.newsletter ?? undefined]), ['https://formsubmit.co']);
  const directives: string[] = (buildCsp([endpoints.intake ?? undefined, endpoints.newsletter ?? undefined]).directives ?? []).map((directive) => String(directive));
  assert.ok(directives.includes("connect-src 'self' https://formsubmit.co"), 'the AJAX door needs connect-src');
  assert.ok(directives.includes("form-action 'self' https://formsubmit.co"), 'the native post needs form-action');
  // A redirect after the post goes to the site's own thanks page, which 'self' covers: no other origin may be added.
  assert.equal(directives.filter((d) => d.includes('formsubmit')).length, 2);
});

test('a FormSubmit intake form posts natively to the plain door and the script posts to the AJAX door', () => {
  for (const kind of ['apply', 'contact', 'brief-request', 'investor-interest', 'partner-enquiry'] as const) {
    const plan = planForm(kind, relay, null, false);
    assert.equal(plan.provider, 'formsubmit');
    assert.equal(plan.nativePost, ENDPOINT, kind);
    assert.equal(plan.scriptEndpoint, AJAX, kind);
    assert.equal(plan.submitDisabledInMarkup, false, kind);
  }
});

test('the newsletter on FormSubmit stays script-only and uses the AJAX door', () => {
  const plan = planForm('newsletter', { id: 'newsletter', mode: 'endpoint', endpoint: ENDPOINT, mailto: null }, null, false);
  assert.equal(plan.provider, 'formsubmit');
  assert.equal(plan.nativePost, null);
  assert.equal(plan.scriptEndpoint, AJAX);
  assert.equal(plan.submitDisabledInMarkup, true);
});

test('an endpoint that is not FormSubmit keeps the JSON contract unchanged (the e2e:forms test endpoint)', () => {
  const plan = planForm('apply', json, null, false);
  assert.equal(plan.provider, 'json');
  assert.equal(plan.nativePost, 'https://intake.example.test/api/intake');
  assert.equal(plan.scriptEndpoint, 'https://intake.example.test/api/intake');
});

test('forms with no endpoint have no script endpoint', () => {
  const plan = planForm('apply', { id: 'intake', mode: 'disabled', endpoint: null, mailto: null }, null, false);
  assert.equal(plan.scriptEndpoint, null);
  assert.equal(plan.nativePost, null);
});

test('the hidden controls of a native post: form, subject, no captcha, table template, and _next only where a thanks page exists', () => {
  const apply = new Map(formSubmitHiddenFields('apply', 'https://worldenterprise.org/apply/thanks/'));
  assert.equal(apply.get('form'), 'apply');
  assert.equal(apply.get('_subject'), 'WE application');
  assert.equal(apply.get('_captcha'), 'false');
  assert.equal(apply.get('_template'), 'table');
  assert.equal(apply.get('_next'), 'https://worldenterprise.org/apply/thanks/');
  const contact = new Map(formSubmitHiddenFields('contact', null));
  assert.equal(contact.has('_next'), false, 'contact has no thanks page, so FormSubmit shows its own confirmation');
  for (const [name] of [...apply, ...contact]) assert.ok(name === 'form' || name.startsWith('_'), `${name} is not a form or FormSubmit control`);
  assert.equal(apply.has('redirect'), false);
  assert.equal(apply.has('requestId'), false);
});

test('every kind has a subject line, with the sender appended when there is one', () => {
  for (const kind of FORM_KINDS) assert.ok(FORMSUBMIT_SUBJECTS[kind].startsWith('WE '), kind);
  assert.equal(formSubmitSubject('contact', ' Ada Example '), 'WE contact message from Ada Example');
  assert.equal(formSubmitSubject('contact', ''), 'WE contact message');
});

const VALUES: FormValues = {
  name: 'Ada Example',
  email: 'ada@example.org',
  company: '',
  stage: 'idea',
  seats: '',
  topic: '',
  message: 'Hello',
  consent: true,
  website: '',
  requestId: '6f1c2d3e-8a4b-4c5d-9e0f-1a2b3c4d5e6f',
  audience: 'startup',
};

test('the AJAX body drops empty values, the clocks, the request id and the honeypot, and keeps email as the reply address', () => {
  const payload = buildPayload('apply', VALUES, { startedAt: 0, submittedAt: 10_000 }, '/apply/');
  const body = formSubmitBody(payload, 'apply');
  assert.equal(body.email, 'ada@example.org');
  assert.equal(body.name, 'Ada Example');
  assert.equal(body.stage, 'idea');
  assert.equal(body.consent, true);
  assert.equal(body.page, '/apply/');
  for (const dropped of ['website', 'startedAt', 'submittedAt', 'requestId', 'company', 'seats', 'topic', 'consentUpdates']) assert.equal(dropped in body, false, dropped);
  assert.equal(body._subject, 'WE application from Ada Example');
  assert.equal(body._captcha, 'false');
  assert.equal(body._template, 'table');
  assert.equal(body._honey, '');
});

function stubFetch(status: number, text: string): { fetchImpl: typeof fetch; calls: { url: string; init: RequestInit | undefined }[] } {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(text, { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetchImpl, calls };
}

const PAYLOAD = buildPayload('contact', { ...VALUES, topic: 'general' }, { startedAt: 0, submittedAt: 10_000 }, '/contact/');

test('relaySucceeded reads the string flag FormSubmit answers with, and nothing else', () => {
  assert.equal(relaySucceeded({ success: 'true', message: 'ok' }), true);
  assert.equal(relaySucceeded({ success: true }), true);
  assert.equal(relaySucceeded({ success: 'false', message: 'needs activation' }), false);
  assert.equal(relaySucceeded({ success: false }), false);
  assert.equal(relaySucceeded({}), false);
  assert.equal(relaySucceeded(null), false);
  assert.equal(relaySucceeded('<html>captcha</html>'), false);
});

test('submitIntake sends FormSubmit its own body as JSON with no cookies and resolves on success: "true"', async () => {
  const { fetchImpl, calls } = stubFetch(200, '{"success":"true","message":"The form was submitted successfully."}');
  await submitIntake(AJAX, PAYLOAD, { fetchImpl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, AJAX);
  const init = calls[0]?.init;
  assert.equal(init?.method, 'POST');
  assert.equal(init?.credentials, 'omit');
  assert.deepEqual(init?.headers, { 'Content-Type': 'application/json', Accept: 'application/json' });
  const sent: unknown = JSON.parse(String(init?.body));
  assert.deepEqual(sent, formSubmitBody(PAYLOAD, 'contact'));
});

test('a 200 with success: "false" (a form not yet activated) is a failure, never a thank-you page', async () => {
  const { fetchImpl } = stubFetch(200, '{"success":"false","message":"This form needs to be activated."}');
  await assert.rejects(submitIntake(AJAX, PAYLOAD, { fetchImpl }), (error: unknown) => error instanceof SubmitError && error.failure === 'server');
});

test('a 200 that is not JSON (a captcha or an error page) is a failure on FormSubmit', async () => {
  const { fetchImpl } = stubFetch(200, '<html><body>Please confirm you are human</body></html>');
  await assert.rejects(submitIntake(AJAX, PAYLOAD, { fetchImpl }), (error: unknown) => error instanceof SubmitError && error.failure === 'server');
});

test('a non-2xx answer from FormSubmit keeps the existing failure mapping', async () => {
  const { fetchImpl } = stubFetch(500, '{"success":"false"}');
  await assert.rejects(submitIntake(AJAX, PAYLOAD, { fetchImpl }), (error: unknown) => error instanceof SubmitError && error.failure === 'server' && error.status === 500);
});

test('an endpoint that is not FormSubmit still receives the contract body, and an empty 200 is still success', async () => {
  const { fetchImpl, calls } = stubFetch(200, '');
  await submitIntake('https://intake.example.test/api/intake', PAYLOAD, { fetchImpl });
  const sent: unknown = JSON.parse(String(calls[0]?.init?.body));
  assert.deepEqual(sent, JSON.parse(JSON.stringify(PAYLOAD)));
});
