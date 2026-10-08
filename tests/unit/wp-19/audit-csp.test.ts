import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as cspAudit from '../../../scripts/audit-csp.mjs';

interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
const api = cspAudit as unknown as {
  auditPage(where: string, html: string, options?: { dev?: boolean }): Finding[];
  parsePolicy(content: string): Record<string, string[]>;
  inlineBlocks(html: string): { kind: string; type: string; text: string }[];
};

const hash = (text: string): string => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

interface Options {
  readonly styles?: readonly string[];
  readonly scripts?: readonly string[];
  readonly connect?: string;
  readonly formAction?: string;
  readonly body?: string;
  readonly extraStyleHashes?: readonly string[];
}

function pageWith(options: Options = {}): string {
  const { styles = [], scripts = [], connect = "'self'", formAction = "'self'", body = '', extraStyleHashes = [] } = options;
  const policy = [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `connect-src ${connect}`,
    `form-action ${formAction}`,
    `script-src 'self' 'wasm-unsafe-eval' ${scripts.map(hash).join(' ')}`.trim(),
    `style-src-elem 'self' ${[...styles.map(hash), ...extraStyleHashes].join(' ')}`.trim(),
    "style-src-attr 'unsafe-inline'",
  ].join('; ');
  const styleTags = styles.map((css) => `<style>${css}</style>`).join('');
  const scriptTags = scripts.map((js) => `<script type="module">${js}</script>`).join('');
  return `<html><head><meta http-equiv="content-security-policy" content="${policy}">${styleTags}${scriptTags}<script type="application/ld+json">{"@type":"Organization"}</script></head><body>${body}</body></html>`;
}

const audit = (html: string, options?: { dev?: boolean }): string => api.auditPage('/x/', html, options).map((f) => `${f.level}: ${f.message}`).join('\n');

test('a page whose inline styles and scripts are all hashed passes, and JSON-LD blocks are not treated as scripts', () => {
  assert.equal(audit(pageWith({ styles: ['body{margin:0}', '.a{color:red}'], scripts: ['console.log(1)'] })), '');
});

test('an inline style whose hash is missing from the policy fails (the browser would drop it)', () => {
  const html = pageWith({ styles: ['body{margin:0}'] }).replace('</head>', '<style>.late{display:none}</style></head>');
  assert.match(audit(html), /error: inline style is not covered by the policy: 'sha256-.*' is missing from style-src-elem/);
});

test('an inline script whose hash is missing fails, and so does a speculation rules block', () => {
  const html = pageWith({ scripts: ['a()'] }).replace('</head>', '<script type="speculationrules">{"prerender":[]}</script><script>b()</script></head>');
  const text = audit(html);
  assert.match(text, /inline script \(speculationrules\) is not covered/);
  assert.match(text, /inline script is not covered/);
});

test('a hash is exact: one changed character in the block breaks it', () => {
  const html = pageWith({ styles: ['body{margin:0}'] }).replace('body{margin:0}</style>', 'body{margin:1}</style>');
  assert.match(audit(html), /inline style is not covered/);
});

test('inline event handlers and javascript: URLs fail, but only warn on a development route', () => {
  const html = pageWith({ body: '<form onsubmit="return false"></form><a href="javascript:void(0)">x</a>' });
  assert.match(audit(html), /error: inline event-handler attribute/);
  assert.match(audit(html), /error: javascript: URL/);
  assert.match(audit(html, { dev: true }), /warn: inline event-handler attribute/);
  assert.doesNotMatch(audit(html, { dev: true }), /error:/);
});

test('text that looks like a handler inside a script or style block is not an attribute', () => {
  assert.equal(audit(pageWith({ scripts: ['const html = \'<a onclick="x">\';'] })), '');
});

test('a form endpoint must be in connect-src and form-action, and an action in form-action', () => {
  const form = '<form data-intake-form data-endpoint="https://intake.example.org/v1" action="https://intake.example.org/v1" method="post"></form>';
  const missing = audit(pageWith({ body: form }));
  assert.match(missing, /form data-endpoint origin https:\/\/intake\.example\.org is not in connect-src/);
  assert.match(missing, /form data-endpoint origin https:\/\/intake\.example\.org is not in form-action/);
  assert.match(missing, /form action origin https:\/\/intake\.example\.org is not in form-action/);
  assert.equal(audit(pageWith({ body: form, connect: "'self' https://intake.example.org", formAction: "'self' https://intake.example.org" })), '');
});

test('a cleartext or foreign-scheme form target fails', () => {
  assert.match(audit(pageWith({ body: '<form data-endpoint="http://intake.example.org/v1"></form>' })), /data-endpoint "http:\/\/intake\.example\.org\/v1" is not an https URL/);
  assert.match(audit(pageWith({ body: '<form action="ftp://x.example.org/"></form>' })), /action "ftp:\/\/x\.example\.org\/" is not an https URL/);
});

test('a page with no policy, or two, fails', () => {
  assert.match(audit('<html><head></head><body></body></html>'), /expected one Content-Security-Policy meta tag, found 0/);
  const two = pageWith().replace('</head>', '<meta http-equiv="content-security-policy" content="default-src \'none\'"></head>');
  assert.match(audit(two), /found 2/);
});

test('the policy parser keeps the first occurrence of a directive', () => {
  const policy = api.parsePolicy("default-src 'self'; script-src 'self' 'sha256-aaa='; script-src 'unsafe-inline'");
  assert.deepEqual(policy['script-src'], ["'self'", "'sha256-aaa='"]);
});
