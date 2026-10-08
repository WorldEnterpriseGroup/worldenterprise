import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildCsp, endpointOrigins } from '../../../src/lib/csp.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

test('endpointOrigins keeps the origin of each endpoint once, sorted, and skips blanks', () => {
  assert.deepEqual(endpointOrigins([undefined, '', '  ']), []);
  assert.deepEqual(
    endpointOrigins(['https://intake.example.test/api/intake', 'https://intake.example.test/api/newsletter', 'https://a.example.org:8443/x?y=1']),
    ['https://a.example.org:8443', 'https://intake.example.test'],
  );
});

test('endpointOrigins rejects a value that is not an https URL, so cleartext never widens connect-src or form-action', () => {
  assert.throws(() => endpointOrigins(['intake.example.test/api']), /not an absolute URL/);
  assert.throws(() => endpointOrigins(['ftp://intake.example.test/api']), /must use https/);
  assert.throws(() => endpointOrigins(['http://intake.example.test/api']), /must use https/);
});

test('without endpoints the policy allows only the site itself as a form target and fetch destination', () => {
  const csp = buildCsp([undefined, undefined]);
  assert.ok((csp.directives as readonly string[] | undefined)?.includes("connect-src 'self'"));
  assert.ok((csp.directives as readonly string[] | undefined)?.includes("form-action 'self'"));
});

test('endpoint origins reach connect-src and form-action and nothing else', () => {
  const csp = buildCsp(['https://intake.example.test/api/intake', 'https://news.example.test/api/newsletter']);
  const directives: readonly string[] = csp.directives ?? [];
  assert.ok(directives.includes("connect-src 'self' https://intake.example.test https://news.example.test"));
  assert.ok(directives.includes("form-action 'self' https://intake.example.test https://news.example.test"));
  const others = directives.filter((d) => !d.startsWith('connect-src') && !d.startsWith('form-action'));
  assert.ok(others.every((d) => !d.includes('example.test')), 'no other directive names an endpoint');
});

test('the policy locks down objects, base URIs, images and fonts, and never allows unsafe-eval or inline script', () => {
  const csp = buildCsp([]);
  const directives: readonly string[] = csp.directives ?? [];
  for (const required of ["default-src 'self'", "img-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'self'"]) {
    assert.ok(directives.includes(required), `${required} is present`);
  }
  assert.equal(csp.algorithm, 'SHA-256');
  const scripts = csp.scriptDirective?.resources ?? [];
  assert.deepEqual(scripts, ["'self'", "'wasm-unsafe-eval'"]);
  assert.ok(!JSON.stringify(csp).includes("'unsafe-eval'"));
  assert.ok(!JSON.stringify(csp.scriptDirective).includes('unsafe-inline'));
});

test('there is no unsafe-inline anywhere: style attributes are blocked as well as inline scripts', () => {
  const csp = buildCsp([]);
  assert.deepEqual(csp.styleDirective?.resources ?? [], [{ resource: "'self'", kind: 'element' }]);
  assert.ok(!JSON.stringify(csp).includes('unsafe-inline'));
});

test('frame-ancestors, report-uri and sandbox are not listed: a meta policy ignores them', () => {
  const directives: readonly string[] = buildCsp([]).directives ?? [];
  assert.ok(directives.every((d) => !/^(frame-ancestors|report-uri|sandbox)/.test(d)));
});

test('astro.config.mjs enables the policy from the endpoint environment, and BaseLayout hashes its inline layer style', () => {
  const config = readFileSync(`${ROOT}astro.config.mjs`, 'utf8');
  assert.match(config, /resolveEndpoints\(/);
  assert.match(config, /buildCsp\(\[endpoints\.intake \?\? undefined, endpoints\.newsletter \?\? undefined\]\)/);
  assert.doesNotMatch(config, /buildCsp\(\[process\.env/);
  assert.match(config, /^\s*security,$/m);
  const layout = readFileSync(`${ROOT}src/layouts/BaseLayout.astro`, 'utf8');
  assert.match(layout, /Astro\.csp\?\.insertStyleHash/);
  assert.match(layout, /<style is:inline set:html=\{LAYER_ORDER\}>/);
});
