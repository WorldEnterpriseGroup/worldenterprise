import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import test from 'node:test';
import * as serve from '../../../scripts/lib/serve.mjs';
import { makeDist } from '../shared/fixture-dist.ts';

// WP-22 (#88): the test server (Playwright, Lighthouse) serves the self-hosted video like GitHub Pages does: the right MIME types and
// byte ranges, so a <video> can seek. Ranges are validated (416 outside the file) and still resolve through the traversal-safe lookup.

type RangeResult = { start: number; end: number } | 'unsatisfiable' | null;
const api = serve as unknown as {
  parseRange(header: string | undefined, size: number): RangeResult;
  createStaticServer(dist: string): Server;
  listen(server: Server, port: number): Promise<number>;
};

test('parseRange accepts single byte ranges and clamps the end to the file', () => {
  assert.equal(api.parseRange(undefined, 100), null);
  assert.equal(api.parseRange('', 100), null);
  assert.deepEqual(api.parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(api.parseRange('bytes=10-', 100), { start: 10, end: 99 });
  assert.deepEqual(api.parseRange('bytes=90-500', 100), { start: 90, end: 99 });
  assert.deepEqual(api.parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(api.parseRange('bytes=-500', 100), { start: 0, end: 99 });
});

test('parseRange rejects malformed and out-of-file ranges', () => {
  for (const header of ['bytes=100-', 'bytes=100-200', 'bytes=50-10', 'bytes=-0', 'bytes=-', 'bytes=a-b', 'items=0-1', 'bytes=0-1,5-6', 'bytes=-1-2']) {
    assert.equal(api.parseRange(header, 100), 'unsatisfiable', header);
  }
  assert.equal(api.parseRange('bytes=0-1', 0), 'unsatisfiable', 'an empty file has no satisfiable range');
});

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

function get(port: number, path: string, headers: Record<string, string> = {}, method = 'GET'): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('the server answers video with MIME types, 200, 206 and 416, and never leaves dist', async (t) => {
  const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => String(i % 10)).join(''), 'ascii');
  const dist = makeDist({
    'index.html': '<!doctype html><title>Home</title>',
    '404.html': '<!doctype html><title>Not found</title>',
    '_astro/film.abc123.mp4': bytes.toString('ascii'),
    '_astro/film.abc123.webm': 'webm',
    '_astro/film.abc123.vtt': 'WEBVTT\n',
  });
  const server = api.createStaticServer(dist);
  const port = await api.listen(server, 0);
  t.after(() => server.close());
  assert.ok((server.address() as AddressInfo).port === port);

  const whole = await get(port, '/_astro/film.abc123.mp4');
  assert.equal(whole.status, 200);
  assert.equal(whole.headers['content-type'], 'video/mp4');
  assert.equal(whole.headers['accept-ranges'], 'bytes');
  assert.equal(whole.headers['content-length'], '1000');
  assert.equal(whole.body.length, 1000);

  const part = await get(port, '/_astro/film.abc123.mp4', { Range: 'bytes=100-199' });
  assert.equal(part.status, 206);
  assert.equal(part.headers['content-range'], 'bytes 100-199/1000');
  assert.equal(part.headers['content-length'], '100');
  assert.deepEqual([...part.body], [...bytes.subarray(100, 200)]);

  const tail = await get(port, '/_astro/film.abc123.mp4', { Range: 'bytes=-10' });
  assert.equal(tail.status, 206);
  assert.equal(tail.headers['content-range'], 'bytes 990-999/1000');

  const head = await get(port, '/_astro/film.abc123.mp4', { Range: 'bytes=0-9' }, 'HEAD');
  assert.equal(head.status, 206);
  assert.equal(head.body.length, 0);

  const outside = await get(port, '/_astro/film.abc123.mp4', { Range: 'bytes=5000-6000' });
  assert.equal(outside.status, 416);
  assert.equal(outside.headers['content-range'], 'bytes */1000');
  assert.equal(outside.body.length, 0);

  const garbage = await get(port, '/_astro/film.abc123.mp4', { Range: 'bytes=9-1' });
  assert.equal(garbage.status, 416);

  assert.equal((await get(port, '/_astro/film.abc123.webm')).headers['content-type'], 'video/webm');
  assert.equal((await get(port, '/_astro/film.abc123.vtt')).headers['content-type'], 'text/vtt; charset=utf-8');

  // A range request on a traversal path is still a 404 page, never a file outside dist.
  const escape = await get(port, '/_astro/..%2f..%2f..%2fetc%2fpasswd', { Range: 'bytes=0-10' });
  assert.equal(escape.status, 404);
  assert.match(escape.headers['content-type'] as string, /^text\/html/);
  const missing = await get(port, '/_astro/missing.mp4', { Range: 'bytes=0-10' });
  assert.equal(missing.status, 404);
});
