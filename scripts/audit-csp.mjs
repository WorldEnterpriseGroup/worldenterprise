#!/usr/bin/env node
// Content Security Policy coverage audit over the built site. Node built-ins only. Run after `astro build`:
//
//   node scripts/audit-csp.mjs [--dist dist]
//
// The policy ships as a per-page <meta http-equiv> tag with a hash for every inline script and style (src/lib/csp.ts). A browser
// drops any inline block whose hash is not in the tag, silently, so the page looks unstyled or loses a behaviour with no build error.
// This audit recomputes the hashes from the built HTML and fails when any of these is not true, for every page:
//   - the page has exactly one CSP meta tag with default-src, script-src and style-src (or their -elem forms);
//   - every inline <style> block and every inline <script> block (module, classic and speculation rules) has its sha256 in the tag;
//   - no inline event-handler attribute and no javascript: URL, which the policy would block;
//   - every form's data-endpoint and action origin is in connect-src (data-endpoint) and form-action (both), so a configured form
//     can actually send (code-security P1-4).
// Exit code 1 on any error.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isDevRoute, parseArgs, parseAttrs, readPages, report, startTags } from './lib/html.mjs';

const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript', 'speculationrules']);

/** Splits a policy into { directive: [sources] }. The first occurrence of a directive wins, as in a browser. */
export function parsePolicy(content) {
  const policy = {};
  for (const part of content.split(';')) {
    const tokens = part.trim().split(/\s+/).filter((t) => t !== '');
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    if (!(name in policy)) policy[name] = tokens.slice(1);
  }
  return policy;
}

/** Sources that govern a kind of resource: the most specific directive present, falling back to default-src. */
export function sourcesFor(policy, directives) {
  for (const name of directives) if (name in policy) return policy[name];
  return policy['default-src'] ?? [];
}

export function sha256Source(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

/** The policy in the page's CSP meta tags: { count, content }. */
export function policyOf(html) {
  const tags = startTags(html, 'meta').filter((t) => (t.attrs['http-equiv'] ?? '').toLowerCase() === 'content-security-policy');
  return { count: tags.length, content: tags[0]?.attrs.content ?? '' };
}

/** Inline <style> and <script> blocks with their raw text, which is what the browser hashes. */
export function inlineBlocks(html) {
  const blocks = [];
  const re = /<(style|script)\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/\1\s*>/gi;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    const kind = m[1].toLowerCase();
    const attrs = parseAttrs(m[2].replace(/\/$/, ''));
    if (kind === 'script' && attrs.src !== undefined) continue;
    const type = (attrs.type ?? '').toLowerCase();
    if (kind === 'script' && !EXECUTABLE_TYPES.has(type)) continue; // JSON-LD and other data blocks are not executed
    blocks.push({ kind, type, text: m[3] });
  }
  return blocks;
}

function originOf(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** First inline event-handler attribute (onclick, onsubmit ...) in the markup, as "<tag> onxxx", or null. */
function eventHandler(markup) {
  const tags = /<([a-z][a-z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  for (let m = tags.exec(markup); m !== null; m = tags.exec(markup)) {
    const name = Object.keys(parseAttrs(m[2].replace(/\/$/, ''))).find((attr) => /^on[a-z]+$/.test(attr));
    if (name !== undefined) return `<${m[1]}> ${name}`;
  }
  return null;
}

/**
 * Audits one page. `where` is only used in messages. `dev` marks the development routes (styleguide, fixtures): a blocked inline
 * handler there is reported as a warning, because those routes never ship to visitors.
 */
export function auditPage(where, html, { dev = false } = {}) {
  const findings = [];
  const fail = (message) => findings.push({ level: 'error', where, message });
  const failOrWarn = (message) => findings.push({ level: dev ? 'warn' : 'error', where, message });
  const { count, content } = policyOf(html);
  if (count !== 1) {
    fail(`expected one Content-Security-Policy meta tag, found ${count}`);
    return findings;
  }
  const policy = parsePolicy(content);
  for (const required of ['default-src', 'object-src', 'base-uri']) if (!(required in policy)) fail(`policy has no ${required}`);

  const scriptSources = sourcesFor(policy, ['script-src-elem', 'script-src']);
  const styleSources = sourcesFor(policy, ['style-src-elem', 'style-src']);
  for (const block of inlineBlocks(html)) {
    const sources = block.kind === 'style' ? styleSources : scriptSources;
    const hash = sha256Source(block.text);
    if (sources.includes("'unsafe-inline'") && !sources.some((s) => s.startsWith("'sha256-"))) continue;
    if (!sources.includes(hash)) {
      const label = block.kind === 'script' ? `inline script${block.type === '' ? '' : ` (${block.type})`}` : 'inline style';
      fail(`${label} is not covered by the policy: ${hash} is missing from ${block.kind === 'style' ? 'style-src-elem' : 'script-src'} (${block.text.trim().slice(0, 50).replace(/\s+/g, ' ')}...)`);
    }
  }

  const stripped = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '<script></script>').replace(/<style\b[\s\S]*?<\/style\s*>/gi, '<style></style>');
  const handler = eventHandler(stripped);
  if (handler !== null) failOrWarn(`inline event-handler attribute, which the policy blocks: ${handler}`);
  if (/\s(?:href|src|action)\s*=\s*["']?\s*javascript:/i.test(stripped)) failOrWarn('javascript: URL, which the policy blocks');

  const connect = sourcesFor(policy, ['connect-src']);
  const formAction = sourcesFor(policy, ['form-action']);
  for (const form of startTags(html, 'form')) {
    const endpoint = form.attrs['data-endpoint'];
    const action = form.attrs.action;
    for (const [name, value, lists] of [
      ['data-endpoint', endpoint, [['connect-src', connect], ['form-action', formAction]]],
      ['action', action, [['form-action', formAction]]],
    ]) {
      if (value === undefined || value === '') continue;
      const origin = originOf(value);
      if (origin === null) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) fail(`form ${name} "${value}" is not an https URL`);
        continue;
      }
      for (const [directive, list] of lists) {
        if (!list.includes(origin)) fail(`form ${name} origin ${origin} is not in ${directive}`);
      }
    }
  }
  return findings;
}

export function auditCsp({ pages }) {
  const findings = [];
  let blocks = 0;
  for (const page of pages) {
    findings.push(...auditPage(page.route, page.html, { dev: isDevRoute(page.route) }));
    blocks += inlineBlocks(page.html).length;
  }
  return { findings, summary: `${pages.length} pages, ${blocks} inline blocks` };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist' });
  const { findings, summary } = auditCsp({ pages: readPages(args.dist) });
  process.exit(report('audit-csp', findings, summary));
}
