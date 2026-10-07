import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMailto,
  buildPayload,
  checkBot,
  failureMessage,
  MIN_FILL_MS,
  parseFieldErrors,
  submitIntake,
  SubmitError,
  topicFromSearch,
  validate,
} from '../../../src/scripts/forms.ts';
import type { FormValues, IntakePayload } from '../../../src/scripts/forms.ts';

const good: FormValues = {
  name: ' Ada Example ',
  email: 'ada@example.org',
  company: '',
  stage: 'validating',
  seats: 'Back end (1)',
  topic: '',
  message: 'Line one\r\nLine two',
  consent: true,
  website: '',
};

const timing = { startedAt: Date.UTC(2026, 9, 6, 14, 0, 0), submittedAt: Date.UTC(2026, 9, 6, 14, 2, 41) };

function payload(overrides: Partial<FormValues> = {}, kind: 'apply' | 'contact' = 'apply'): IntakePayload {
  return buildPayload(kind, { ...good, ...overrides }, timing, '/apply/');
}

function reply(status: number, body: string): typeof fetch {
  return (async () => new Response(status === 204 ? null : body, { status })) as typeof fetch;
}

test('a complete apply form has no errors', () => {
  assert.deepEqual(validate('apply', good), []);
});

test('apply requires name, email, stage and consent, with messages that say what to do', () => {
  const errors = validate('apply', { ...good, name: ' ', email: '', stage: '', consent: false });
  assert.deepEqual(
    errors.map((e) => e.field),
    ['name', 'email', 'stage', 'consent'],
  );
  assert.match(errors[1]?.message ?? '', /Enter your email address/);
});

test('email must look like an address', () => {
  const errors = validate('apply', { ...good, email: 'ada@example' });
  assert.equal(errors[0]?.field, 'email');
  assert.match(errors[0]?.message ?? '', /name@example\.org/);
});

test('contact requires a topic and a message but not a stage', () => {
  const errors = validate('contact', { ...good, stage: '', topic: '', message: '' });
  assert.deepEqual(
    errors.map((e) => e.field),
    ['topic', 'message'],
  );
});

test('newsletter needs only an email and consent', () => {
  assert.deepEqual(validate('newsletter', { ...good, name: '', stage: '', message: '', topic: '' }), []);
  assert.deepEqual(
    validate('newsletter', { ...good, name: '', email: '', consent: false }).map((e) => e.field),
    ['email', 'consent'],
  );
});

test('over-long answers are rejected with the limit in the message', () => {
  const errors = validate('apply', { ...good, message: 'x'.repeat(4001), seats: 'y'.repeat(501) });
  assert.deepEqual(
    errors.map((e) => e.field).sort(),
    ['message', 'seats'],
  );
  assert.match(errors.find((e) => e.field === 'message')?.message ?? '', /4000/);
});

test('payload trims, normalises line endings, stamps ISO times and blanks the other form fields', () => {
  const p = payload();
  assert.equal(p.name, 'Ada Example');
  assert.equal(p.message, 'Line one\nLine two');
  assert.equal(p.topic, '');
  assert.equal(p.form, 'apply');
  assert.equal(p.startedAt, '2026-10-06T14:00:00.000Z');
  assert.equal(p.submittedAt, '2026-10-06T14:02:41.000Z');
  const c = payload({ topic: 'press', stage: 'idea', seats: 'ignored' }, 'contact');
  assert.equal(c.stage, '');
  assert.equal(c.seats, '');
  assert.equal(c.topic, 'press');
});

test('the payload never carries a field outside the contract', () => {
  assert.deepEqual(Object.keys(payload()).sort(), [
    'company', 'consent', 'email', 'form', 'message', 'name', 'page', 'seats', 'stage', 'startedAt', 'submittedAt', 'topic', 'website',
  ]);
});

test('bot check: filled honeypot is dropped, a fast first submit is paused once, then allowed', () => {
  assert.equal(checkBot({ website: 'http://spam.invalid' }, 60_000, false), 'honeypot');
  assert.equal(checkBot({ website: '' }, MIN_FILL_MS - 1, false), 'too-fast');
  assert.equal(checkBot({ website: '' }, MIN_FILL_MS - 1, true), 'ok');
  assert.equal(checkBot({ website: '' }, MIN_FILL_MS, false), 'ok');
});

test('submit resolves on a 204 with an empty body', async () => {
  await submitIntake('https://intake.example.org/v1', payload(), { fetchImpl: reply(204, '') });
});

test('submit sends JSON without credentials or referrer', async () => {
  let seen: RequestInit | undefined;
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    seen = init;
    return new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;
  await submitIntake('https://intake.example.org/v1', payload(), { fetchImpl });
  assert.equal(seen?.method, 'POST');
  assert.equal(seen?.credentials, 'omit');
  assert.equal(seen?.referrerPolicy, 'no-referrer');
  assert.equal((seen?.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.equal((JSON.parse(String(seen?.body)) as IntakePayload).email, 'ada@example.org');
});

test('a 422 with field errors surfaces them; a non-JSON 422 does not break the client', async () => {
  await assert.rejects(
    submitIntake('https://intake.example.org/v1', payload(), { fetchImpl: reply(422, '{"ok":false,"errors":{"email":"Use a work address.","bogus":"x"}}') }),
    (error: unknown) => {
      assert.ok(error instanceof SubmitError);
      assert.equal(error.failure, 'rejected');
      assert.deepEqual(error.fieldErrors, [{ field: 'email', message: 'Use a work address.' }]);
      return true;
    },
  );
  await assert.rejects(
    submitIntake('https://intake.example.org/v1', payload(), { fetchImpl: reply(400, '<html>bad</html>') }),
    (error: unknown) => error instanceof SubmitError && error.failure === 'rejected' && error.fieldErrors.length === 0,
  );
});

test('429 and 5xx map to specific failures', async () => {
  await assert.rejects(submitIntake('https://intake.example.org/v1', payload(), { fetchImpl: reply(429, '') }), (e: unknown) => e instanceof SubmitError && e.failure === 'rate-limited');
  await assert.rejects(submitIntake('https://intake.example.org/v1', payload(), { fetchImpl: reply(503, '') }), (e: unknown) => e instanceof SubmitError && e.failure === 'server' && e.status === 503);
});

test('a network error becomes a network failure', async () => {
  const fetchImpl = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;
  await assert.rejects(submitIntake('https://intake.example.org/v1', payload(), { fetchImpl }), (e: unknown) => e instanceof SubmitError && e.failure === 'network');
});

test('the timeout path aborts the request and reports a timeout', async () => {
  const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch;
  await assert.rejects(submitIntake('https://intake.example.org/v1', payload(), { fetchImpl, timeoutMs: 20 }), (e: unknown) => e instanceof SubmitError && e.failure === 'timeout');
});

test('an external abort is reported as aborted, not as a timeout', async () => {
  const controller = new AbortController();
  const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch;
  const pending = submitIntake('https://intake.example.org/v1', payload(), { fetchImpl, signal: controller.signal, timeoutMs: 5_000 });
  controller.abort();
  await assert.rejects(pending, (e: unknown) => e instanceof SubmitError && e.failure === 'aborted');
});

test('a non-https or invalid endpoint is refused before any request', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response('', { status: 200 });
  }) as typeof fetch;
  await assert.rejects(submitIntake('http://intake.example.org/v1', payload(), { fetchImpl }), (e: unknown) => e instanceof SubmitError && e.failure === 'invalid-config');
  await assert.rejects(submitIntake('not a url', payload(), { fetchImpl }), (e: unknown) => e instanceof SubmitError && e.failure === 'invalid-config');
  assert.equal(called, false);
});

test('parseFieldErrors ignores malformed bodies', () => {
  assert.deepEqual(parseFieldErrors(null), []);
  assert.deepEqual(parseFieldErrors({ errors: [] }), []);
  assert.deepEqual(parseFieldErrors({ errors: { name: 5, email: ' ' } }), []);
});

test('failure messages offer the email fallback only when one exists', () => {
  const timeout = new SubmitError('timeout', 'slow');
  assert.match(failureMessage(timeout, true), /by email instead/);
  assert.doesNotMatch(failureMessage(timeout, false), /by email/);
});

test('mailto link carries the answers and encodes them', () => {
  const link = buildMailto('apply@worldenterprise.org', payload({ company: 'Acme & Co' }));
  assert.ok(link.startsWith('mailto:apply@worldenterprise.org?subject='));
  const body = decodeURIComponent(link.split('&body=')[1] ?? '');
  assert.match(body, /Company: Acme & Co/);
  assert.match(body, /Stage: validating/);
  assert.match(body, /Team: Back end \(1\)/);
  assert.throws(() => buildMailto('x@example.org', { ...payload(), form: 'newsletter' }), RangeError);
});

test('topic prefill accepts only known topics', () => {
  assert.equal(topicFromSearch('?topic=seat-rate'), 'seat-rate');
  assert.equal(topicFromSearch('?topic=<script>'), null);
  assert.equal(topicFromSearch(''), null);
});
