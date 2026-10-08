import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { INTAKE_ENDPOINT_VAR, NEWSLETTER_ENDPOINT_VAR, parseEndpoint, resolveEndpoint, resolveEndpoints } from '../../../src/lib/endpoints.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

test('parseEndpoint accepts an absolute https URL and nothing else', () => {
  assert.equal(parseEndpoint('https://intake.example.org/v1'), 'https://intake.example.org/v1');
  assert.equal(parseEndpoint('http://intake.example.org/v1'), null);
  assert.equal(parseEndpoint('//intake.example.org/v1'), null);
  assert.equal(parseEndpoint('/relative'), null);
  assert.equal(parseEndpoint('ftp://intake.example.org'), null);
  assert.equal(parseEndpoint(undefined), null);
});

test('resolveEndpoint treats unset and blank as not configured', () => {
  assert.equal(resolveEndpoint(INTAKE_ENDPOINT_VAR, undefined), null);
  assert.equal(resolveEndpoint(INTAKE_ENDPOINT_VAR, ''), null);
  assert.equal(resolveEndpoint(INTAKE_ENDPOINT_VAR, '   '), null);
});

test('resolveEndpoint fails, naming the variable, for a value that is set but is not https', () => {
  for (const bad of ['http://intake.example.org/v1', 'intake.example.org', '/api/intake', 'javascript:alert(1)', 'https://']) {
    assert.throws(() => resolveEndpoint(NEWSLETTER_ENDPOINT_VAR, bad), new RegExp(`${NEWSLETTER_ENDPOINT_VAR} must be an absolute https URL`), bad);
  }
});

test('resolveEndpoints reads both variables through one lookup', () => {
  const env: Record<string, string> = { [INTAKE_ENDPOINT_VAR]: ' https://a.example.org/in ', [NEWSLETTER_ENDPOINT_VAR]: 'https://b.example.org/news' };
  assert.deepEqual(resolveEndpoints((name) => env[name]), { intake: 'https://a.example.org/in', newsletter: 'https://b.example.org/news' });
  assert.deepEqual(resolveEndpoints(() => undefined), { intake: null, newsletter: null });
});

interface Resolved {
  readonly forms: { readonly intake: string | null; readonly newsletter: string | null };
  readonly origins: readonly string[];
  readonly connectSrc: string | undefined;
  readonly formAction: string | undefined;
}

const PROBE = `
import { forms } from './src/data/forms.ts';
import { buildCsp } from './src/lib/csp.ts';
import { resolveEndpoints } from './src/lib/endpoints.ts';
const read = (name) => (process.env[name] === undefined || process.env[name] === '' ? undefined : process.env[name]);
const endpoints = resolveEndpoints(read);
const csp = buildCsp([endpoints.intake ?? undefined, endpoints.newsletter ?? undefined]);
const directives = csp.directives ?? [];
process.stdout.write(JSON.stringify({
  forms: { intake: forms.intake.endpoint, newsletter: forms.newsletter.endpoint },
  origins: [endpoints.intake, endpoints.newsletter].filter(Boolean).map((u) => new URL(u).origin),
  connectSrc: directives.find((d) => d.startsWith('connect-src')),
  formAction: directives.find((d) => d.startsWith('form-action')),
}));
`;

function probe(env: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', PROBE], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('the forms module and the CSP resolve the same endpoints from the same environment (code-security P1-4)', () => {
  const run = probe({ [INTAKE_ENDPOINT_VAR]: 'https://intake.example.test/api/intake', [NEWSLETTER_ENDPOINT_VAR]: 'https://news.example.test/api/newsletter' });
  assert.equal(run.status, 0, run.stderr);
  const seen = JSON.parse(run.stdout) as Resolved;
  assert.equal(seen.forms.intake, 'https://intake.example.test/api/intake');
  assert.equal(seen.forms.newsletter, 'https://news.example.test/api/newsletter');
  for (const url of [seen.forms.intake, seen.forms.newsletter]) {
    assert.ok(url !== null);
    const origin = new URL(url).origin;
    assert.ok(seen.connectSrc?.split(' ').includes(origin), `connect-src names ${origin}`);
    assert.ok(seen.formAction?.split(' ').includes(origin), `form-action names ${origin}`);
  }
});

test('with no endpoint set both stay off and the policy names only the site', () => {
  const run = probe({});
  assert.equal(run.status, 0, run.stderr);
  const seen = JSON.parse(run.stdout) as Resolved;
  assert.deepEqual(seen.forms, { intake: null, newsletter: null });
  assert.equal(seen.connectSrc, "connect-src 'self'");
  assert.equal(seen.formAction, "form-action 'self'");
});

test('a set but invalid endpoint fails the build for both the forms and the policy', () => {
  const run = probe({ [INTAKE_ENDPOINT_VAR]: 'http://intake.example.test/api/intake' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, new RegExp(`${INTAKE_ENDPOINT_VAR} must be an absolute https URL`));
});
