#!/usr/bin/env node
// Minimal static server for the built site, behaving like GitHub Pages for the cases the tests rely on:
// directory routes serve index.html, a missing trailing slash redirects (301), unknown paths answer 404 with /404.html.
// Media files answer byte-range requests (206, or 416 for a range outside the file), as browsers need to seek a <video>.
// Used by Playwright (webServer) and Lighthouse so that no Astro tooling is needed once dist exists.
// Usage: node scripts/lib/serve.mjs [dist] [port]
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt; charset=utf-8',
};

/** Files served with byte ranges (never compressed or rewritten). */
const RANGED = new Set(['.mp4', '.webm']);

/**
 * Parses a `Range` header against a file of `size` bytes (RFC 9110 14.1.2). Only a single `bytes=` range is honored.
 * Returns `null` when there is no usable header (serve the whole file), `{ start, end }` (inclusive) for a satisfiable range, or
 * `'unsatisfiable'` when the range is malformed or lies outside the file (answer 416).
 */
export function parseRange(header, size) {
  if (header === undefined || header === null || header === '') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (match === null) return 'unsatisfiable';
  const [, first, last] = match;
  if (first === '' && last === '') return 'unsatisfiable';
  if (!Number.isSafeInteger(size) || size <= 0) return 'unsatisfiable';
  let start;
  let end;
  if (first === '') {
    // Suffix range: the last N bytes.
    const length = Number(last);
    if (!Number.isSafeInteger(length) || length === 0) return 'unsatisfiable';
    start = Math.max(0, size - length);
    end = size - 1;
  } else {
    start = Number(first);
    end = last === '' ? size - 1 : Math.min(Number(last), size - 1);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return 'unsatisfiable';
  }
  return { start, end };
}

/**
 * Validates a raw request target (`req.url`) and splits it into `{ pathname, search }`, or returns null when it must be rejected (400).
 * Only origin-form targets with a single leading slash are accepted: `//` and `//host/x` (scheme-relative, which `new URL` either
 * throws on or reads as a host), absolute-form targets, backslashes (WHATWG URL treats `\` as `/`, so `/\evil.example` would turn a
 * redirect into an open redirect), control characters and NUL bytes are all refused. Dot segments are left to `resolveFile`.
 */
export function parseRequestTarget(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw[0] !== '/' || raw[1] === '/') return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  const hash = raw.indexOf('#');
  const target = hash === -1 ? raw : raw.slice(0, hash);
  const query = target.indexOf('?');
  const pathname = query === -1 ? target : target.slice(0, query);
  const search = query === -1 ? '' : target.slice(query);
  if (pathname.includes('//')) return null;
  return { pathname, search };
}

/** Resolves a request path to a file under root, or null. Rejects traversal outside root. */
export function resolveFile(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) return null;
  if (existsSync(target) && statSync(target).isFile()) return { file: target, redirect: null };
  const index = join(target, 'index.html');
  if (existsSync(index) && statSync(target).isDirectory()) {
    return decoded.endsWith('/') ? { file: index, redirect: null } : { file: index, redirect: `${pathname}/` };
  }
  return null;
}

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.md', '.svg']);

/**
 * `options.rewriteOrigin` replaces the production origin inside HTML and XML responses, so that Lighthouse can judge a page
 * whose canonical URL points at its own origin. It is read per request, so it may be set after the server is listening.
 */
export function createStaticServer(distDir, options = {}) {
  const root = resolve(distDir);
  if (!existsSync(root)) throw new Error(`dist directory not found: ${root}`);
  return createServer((req, res) => {
    try {
      handle(req, res);
    } catch (error) {
      console.error(`serve: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  });

  function handle(req, res) {
    const url = parseRequestTarget(req.url);
    if (url === null) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Bad request');
      return;
    }
    const hit = resolveFile(root, url.pathname);
    if (hit?.redirect) {
      res.writeHead(301, { Location: hit.redirect + url.search });
      res.end();
      return;
    }
    const notFound = join(root, '404.html');
    const file = hit?.file ?? (existsSync(notFound) ? notFound : null);
    if (file === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = extname(file).toLowerCase();
    const headers = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' };
    const status = hit === null ? 404 : 200;
    const rewrite = options.rewriteOrigin !== undefined && (ext === '.html' || ext === '.xml');
    const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    if (status === 200 && RANGED.has(ext)) {
      const size = statSync(file).size;
      const range = parseRange(req.headers.range, size);
      headers['Accept-Ranges'] = 'bytes';
      if (range === 'unsatisfiable') {
        res.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      if (range !== null) {
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': range.end - range.start + 1 });
        if (req.method === 'HEAD') res.end();
        else createReadStream(file, { start: range.start, end: range.end }).on('error', () => res.destroy()).pipe(res);
        return;
      }
      res.writeHead(200, { ...headers, 'Content-Length': size });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).on('error', () => res.destroy()).pipe(res);
      return;
    }
    if (!rewrite && !gzip) {
      res.writeHead(status, headers);
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).on('error', () => res.destroy()).pipe(res);
      return;
    }
    let body = readFileSync(file);
    if (rewrite) body = Buffer.from(body.toString('utf8').replaceAll('https://worldenterprise.org', options.rewriteOrigin), 'utf8');
    if (gzip) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
    res.writeHead(status, { ...headers, 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  }
}

export function listen(server, port, host = '127.0.0.1') {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolvePromise(server.address().port));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = process.argv[2] ?? 'dist';
  const port = Number(process.argv[3] ?? 4321);
  try {
    const server = createStaticServer(dist);
    const bound = await listen(server, port);
    console.log(`serving ${resolve(dist)} on http://127.0.0.1:${bound}`);
  } catch (error) {
    console.error(`serve: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
