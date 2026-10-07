#!/usr/bin/env node
// Offline link audit over dist (no network, no server). For every page it resolves hrefs, srcs, srcsets and form actions:
//   internal targets must exist in dist (directory routes through index.html); #fragments must exist in the target page;
//   a link to a launched ledger route that is not built yet is "pending" (warning; error with --strict);
//   external links must be https, and target=_blank links need rel noopener. External URLs are listed, never fetched.
// It also reports orphan routes: built ledger routes that no other page links to (warning; error with --strict).
// Usage: node scripts/audit-links.mjs [--dist dist] [--ledger reports/ledger.json] [--strict] [--json reports/links.json]
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectIds, isDevRoute, ORIGIN, parseArgs, readPages, report, srcsetUrls, startTags, stripNonMarkup } from './lib/html.mjs';
import { loadLedger } from './lib/ledger.mjs';

const SKIP_SCHEME = /^(?:mailto:|tel:|sms:|data:|blob:|about:)/i;

/** Pulls every reference out of one page. Each ref: { kind, url, tag, attrs }. */
export function extractRefs(html) {
  const doc = stripNonMarkup(html);
  const refs = [];
  const add = (tag, attr, kinds) => {
    for (const t of startTags(doc, tag)) {
      const raw = t.attrs[attr];
      if (raw === undefined) continue;
      if (attr === 'srcset') for (const u of srcsetUrls(raw)) refs.push({ kind: kinds, url: u, tag, attrs: t.attrs });
      else refs.push({ kind: kinds, url: raw, tag, attrs: t.attrs });
    }
  };
  add('a', 'href', 'link');
  add('area', 'href', 'link');
  add('link', 'href', 'resource');
  add('script', 'src', 'resource');
  add('img', 'src', 'image');
  add('img', 'srcset', 'image');
  add('source', 'src', 'image');
  add('source', 'srcset', 'image');
  add('form', 'action', 'link');
  add('iframe', 'src', 'resource');
  add('video', 'src', 'resource');
  add('audio', 'src', 'resource');
  return refs;
}

function resolveInternal(url, route) {
  let u;
  try {
    u = new URL(url, `${ORIGIN}${route}`);
  } catch {
    return null;
  }
  if (u.origin !== ORIGIN) return null;
  return { path: decodeURI(u.pathname), hash: u.hash === '' ? '' : decodeURIComponent(u.hash.slice(1)) };
}

/** Finds the dist file for an internal path: exact file, then directory index. Returns { file, kind } or null. */
export function lookup(distDir, path) {
  const rel = path.replace(/^\/+/, '');
  const exact = join(distDir, rel);
  if (rel !== '' && !path.endsWith('/') && existsSync(exact) && statSync(exact).isFile()) return { file: rel, kind: 'file' };
  const index = join(distDir, rel, 'index.html');
  if (existsSync(index)) return { file: join(rel, 'index.html'), kind: path.endsWith('/') || rel === '' ? 'dir' : 'dir-no-slash' };
  return null;
}

export function auditLinks({ distDir, pages, ledger = null, strict = false }) {
  const findings = [];
  const external = new Map();
  const inbound = new Map();
  const idCache = new Map();
  const byRoute = new Map(pages.map((p) => [p.route, p]));
  const pendingHits = new Map();
  const pendingRoutes = new Set([
    ...(ledger?.routes ?? []).filter((r) => r.launch && !byRoute.has(r.path)).map((r) => r.path),
    ...(ledger?.machine ?? []).filter((m) => m.launch).map((m) => m.path),
  ]);
  const ids = (route) => {
    if (!idCache.has(route)) idCache.set(route, new Set(collectIds(byRoute.get(route)?.html ?? '')));
    return idCache.get(route);
  };

  for (const page of pages) {
    const here = isDevRoute(page.route) ? `${page.route} (dev)` : page.route;
    for (const ref of extractRefs(page.html)) {
      const url = ref.url.trim();
      if (url === '') {
        if (ref.tag === 'a') findings.push({ level: 'warn', where: here, message: 'anchor with an empty href' });
        continue;
      }
      if (/^javascript:/i.test(url)) {
        findings.push({ level: 'error', where: here, message: `javascript: URL in <${ref.tag}>` });
        continue;
      }
      if (SKIP_SCHEME.test(url)) continue;
      if (url === '#') {
        findings.push({ level: 'warn', where: here, message: 'link to "#" goes nowhere' });
        continue;
      }
      if (url.startsWith('#')) {
        const frag = decodeURIComponent(url.slice(1));
        if (frag !== 'main' && frag !== 'top' && !ids(page.route).has(frag)) {
          findings.push({ level: 'error', where: here, message: `fragment ${url} has no matching id on the page` });
        }
        continue;
      }
      const absolute = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
      const internal = resolveInternal(url, page.route);
      if (absolute && internal === null) {
        let parsed = null;
        try {
          parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
        } catch {
          findings.push({ level: 'error', where: here, message: `malformed URL ${url}` });
          continue;
        }
        if (parsed.protocol === 'http:') findings.push({ level: 'error', where: here, message: `external link is not https: ${url}` });
        if (ref.tag === 'a' && ref.attrs.target === '_blank' && !/\b(noopener|noreferrer)\b/.test(ref.attrs.rel ?? '')) {
          findings.push({ level: 'error', where: here, message: `target=_blank without rel=noopener: ${url}` });
        }
        external.set(url, [...(external.get(url) ?? []), page.route]);
        continue;
      }
      if (internal === null) {
        findings.push({ level: 'error', where: here, message: `cannot resolve ${url}` });
        continue;
      }
      const hit = lookup(distDir, internal.path);
      if (hit === null) {
        if (pendingRoutes.has(internal.path)) {
          if (strict) findings.push({ level: 'error', where: here, message: `${url} points at a launched route that is not built yet (pending)` });
          else {
            const seen = pendingHits.get(internal.path) ?? { count: 0, first: here };
            seen.count += 1;
            pendingHits.set(internal.path, seen);
          }
          continue;
        }
        findings.push({ level: 'error', where: here, message: `broken ${ref.kind}: ${url} (no ${internal.path} in dist)` });
        continue;
      }
      if (hit.kind === 'dir-no-slash') {
        findings.push({ level: 'warn', where: here, message: `${url} lacks the trailing slash (a redirect hop on GitHub Pages)` });
      }
      const targetRoute = hit.file.endsWith('index.html') ? `/${hit.file.slice(0, -'index.html'.length)}` : `/${hit.file}`;
      if (ref.kind === 'link' && ref.tag === 'a' && targetRoute !== page.route) {
        inbound.set(targetRoute, (inbound.get(targetRoute) ?? 0) + 1);
      }
      if (internal.hash !== '' && hit.file.endsWith('.html')) {
        if (byRoute.has(targetRoute) && !ids(targetRoute).has(internal.hash)) {
          findings.push({ level: 'error', where: here, message: `${url}: target page has no id "${internal.hash}"` });
        }
      }
    }
  }

  const orphans = [];
  for (const row of ledger?.routes ?? []) {
    if (!row.launch || !byRoute.has(row.path) || row.path === '/' || row.path === '/404.html') continue;
    if ((inbound.get(row.path) ?? 0) === 0) orphans.push(row.path);
  }
  for (const [path, hit] of pendingHits) {
    findings.push({ level: 'warn', where: path, message: `${hit.count} link(s) point at this launched route, which is not built yet (pending); first on ${hit.first}` });
  }
  for (const path of orphans) {
    findings.push({ level: strict ? 'error' : 'warn', where: path, message: 'orphan route: no other page links to it' });
  }
  return { findings, external, orphans };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', ledger: 'reports/ledger.json', json: 'reports/links.json' });
  try {
    const ledger = existsSync(args.ledger) ? loadLedger(args.ledger) : null;
    if (ledger === null) console.warn(`audit-links: no ledger at ${args.ledger}; pending and orphan checks are skipped`);
    const pages = readPages(args.dist);
    const result = auditLinks({ distDir: args.dist, pages, ledger, strict: args.strict === true });
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, `${JSON.stringify({ external: Object.fromEntries(result.external), orphans: result.orphans }, null, 2)}\n`);
    process.exit(report('audit-links', result.findings, `${pages.length} pages, ${result.external.size} external URLs listed`));
  } catch (error) {
    console.error(`audit-links: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
