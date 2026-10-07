#!/usr/bin/env node
// Minimal static server for the built site, behaving like GitHub Pages for the cases the tests rely on:
// directory routes serve index.html, a missing trailing slash redirects (301), unknown paths answer 404 with /404.html.
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
};

/** Resolves a request path to a file under root, or null. Rejects traversal outside root. */
export function resolveFile(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
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
    const url = new URL(req.url ?? '/', 'http://localhost');
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
  });
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
