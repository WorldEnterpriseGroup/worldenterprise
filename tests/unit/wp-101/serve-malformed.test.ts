import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { Server } from 'node:http';
import test from 'node:test';
import * as serve from '../../../scripts/lib/serve.mjs';
import { makeDist } from '../shared/fixture-dist.ts';

// #101: scripts/lib/serve.mjs (Playwright webServer, Lighthouse) must survive any request target. `new URL('//', base)` throws,
// `//evil.example/x` reads as a host, and a backslash is a slash to the WHATWG parser. None may crash the process, redirect off-site
// or leave dist: each answers 400 or 404 and the server keeps serving.

const api = serve as unknown as {
  parseRequestTarget(raw: unknown): { pathname: string; search: string } | null;
  resolveFile(root: string, pathname: string): { file: string; redirect: string | null } | null;
  createStaticServer(dist: string): Server;
  listen(server: Server, port: number): Promise<number>;
};

interface Reply {
  status: number;
  location: string | undefined;
  body: string;
}

function get(port: number, path: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function start(t: test.TestContext): Promise<number> {
  const dist = makeDist({
    'index.html': '<!doctype html><title>Home</title>',
    '404.html': '<!doctype html><title>Not found</title>',
    'program/index.html': '<!doctype html><title>Program</title>',
  });
  const server = api.createStaticServer(dist);
  const port = await api.listen(server, 0);
  t.after(() => server.close());
  return port;
}

test('parseRequestTarget accepts normal targets and keeps the query', () => {
  assert.deepEqual(api.parseRequestTarget('/'), { pathname: '/', search: '' });
  assert.deepEqual(api.parseRequestTarget('/program/?a=1&b=2'), { pathname: '/program/', search: '?a=1&b=2' });
  assert.deepEqual(api.parseRequestTarget('/a%20b#frag'), { pathname: '/a%20b', search: '' });
});

test('parseRequestTarget rejects //, scheme-relative, absolute-form, backslash and control targets', () => {
  for (const raw of ['//', '//evil.example/x', '///x', '/a//b', '/\\evil.example', '/a\\b', 'http://evil.example/', '*', '', 'x', '/a\u0000b', '/a\nb', undefined, null]) {
    assert.equal(api.parseRequestTarget(raw), null, String(raw));
  }
});

test('the server answers 400 for // and //evil.example/x and keeps serving', async (t) => {
  const port = await start(t);
  for (const path of ['//', '//evil.example/x', '///', '/\\evil.example']) {
    const reply = await get(port, path);
    assert.equal(reply.status, 400, path);
    assert.equal(reply.location, undefined, `${path} must not redirect`);
  }
  assert.equal((await get(port, '/')).status, 200, 'still serving after the malformed requests');
});

test('a missing trailing slash never redirects off-site', async (t) => {
  const port = await start(t);
  const ok = await get(port, '/program?x=1');
  assert.equal(ok.status, 301);
  assert.equal(ok.location, '/program/?x=1');
  const evil = await get(port, '/\\evil.example/program');
  assert.equal(evil.status, 400);
  assert.equal(evil.location, undefined);
});

test('malformed percent-encoding answers 404, not a throw', async (t) => {
  const port = await start(t);
  for (const path of ['/%E0%A4%A', '/%', '/%zz', '/program/%E0%A4%A']) {
    const reply = await get(port, path);
    assert.equal(reply.status, 404, path);
    assert.match(reply.body, /Not found/);
  }
  assert.equal((await get(port, '/program/')).status, 200);
});

test('traversal with .. (plain and encoded) and NUL bytes never leaves dist', async (t) => {
  const port = await start(t);
  for (const path of ['/..', '/../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/program/..%2f..%2f..%2fetc/passwd', '/%00', '/program%00/']) {
    const reply = await get(port, path);
    assert.equal(reply.status, 404, path);
    assert.doesNotMatch(reply.body, /root:/, path);
  }
  assert.equal(api.resolveFile('/srv/dist', '/%00'), null);
  assert.equal(api.resolveFile('/srv/dist', '/%E0%A4%A'), null);
  assert.equal(api.resolveFile('/srv/dist', '/../x'), null);
});
