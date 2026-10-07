import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import * as serveMod from '../../../scripts/lib/serve.mjs';
import * as lhMod from '../../../scripts/run-lighthouse.mjs';
import * as gateMod from '../../../scripts/lib/release-gate.mjs';
import { cleanSite, makeDist } from './fixture-dist.ts';

interface Server {
  listen(port: number, host: string): unknown;
  close(): unknown;
  address(): AddressInfo | string | null;
}
const serve = serveMod as unknown as {
  resolveFile(root: string, pathname: string): { file: string; redirect: string | null } | null;
  createStaticServer(dist: string, options?: { rewriteOrigin?: string }): Server;
};
interface Budget {
  scores: Record<string, number>;
  metrics: { lcpMs: number; cls: number; tbtMs: number };
  javascript: { maxGzipBytes: number; exemptPrefixes: string[] };
}
interface Summary {
  route: string;
  scores: Record<string, number | null>;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  scriptBytes: number;
  thirdParty: string[];
}
const lh = lhMod as unknown as {
  pickRoutes(c: string[], built: Set<string>, max: number): string[];
  evaluate(s: Summary, c: Budget): string[];
  summarise(route: string, lhr: unknown, origin: string): Summary;
};
const gate = gateMod as unknown as { parseProblems(o: string): string[] | null; unallowed(p: string[], allow: string): string[] };

test('serve: resolves directories, redirects a missing slash, rejects traversal', () => {
  const root = makeDist(cleanSite());
  assert.match(serve.resolveFile(root, '/program/')?.file ?? '', /program\/index\.html$/);
  assert.equal(serve.resolveFile(root, '/program')?.redirect, '/program/');
  assert.equal(serve.resolveFile(root, '/missing/'), null);
  assert.equal(serve.resolveFile(root, '/../etc/passwd'), null);
  assert.equal(serve.resolveFile(root, '/%E0%A4%A'), null);
});

test('serve: answers 200, 301 and a 404 with the 404 page', async () => {
  const root = makeDist(cleanSite());
  const server = serve.createStaticServer(root);
  server.listen(0, '127.0.0.1');
  await once(server as unknown as NodeJS.EventEmitter, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    const ok = await fetch(`http://127.0.0.1:${port}/program/`);
    assert.equal(ok.status, 200);
    const moved = await fetch(`http://127.0.0.1:${port}/program`, { redirect: 'manual' });
    assert.equal(moved.status, 301);
    const gone = await fetch(`http://127.0.0.1:${port}/nope/`);
    assert.equal(gone.status, 404);
    assert.match(await gone.text(), /Not here/);
  } finally {
    server.close();
  }
});

const budget: Budget = {
  scores: { performance: 0.9, accessibility: 1 },
  metrics: { lcpMs: 2500, cls: 0.1, tbtMs: 200 },
  javascript: { maxGzipBytes: 10240, exemptPrefixes: ['/tools/'] },
};
const okSummary: Summary = { route: '/', scores: { performance: 0.95, accessibility: 1 }, lcpMs: 1800, cls: 0, tbtMs: 50, scriptBytes: 2000, thirdParty: [] };

test('lighthouse: pickRoutes keeps order and only built routes', () => {
  assert.deepEqual(lh.pickRoutes(['/', '/a/', '/b/', '/c/'], new Set(['/', '/b/', '/c/']), 2), ['/', '/b/']);
});

test('lighthouse: a summary inside budget passes, each breach fails (negative proof)', () => {
  assert.deepEqual(lh.evaluate(okSummary, budget), []);
  const breaches: [Partial<Summary>, RegExp][] = [
    [{ scores: { performance: 0.7, accessibility: 1 } }, /performance score 70/],
    [{ scores: { performance: 0.95, accessibility: null } }, /accessibility score missing/],
    [{ lcpMs: 3000 }, /LCP/],
    [{ cls: 0.3 }, /CLS/],
    [{ tbtMs: 400 }, /TBT/],
    [{ thirdParty: ['https://fonts.googleapis.com/x'] }, /third-party/],
    [{ scriptBytes: 20000 }, /JavaScript transfer/],
  ];
  for (const [patch, pattern] of breaches) {
    assert.match(lh.evaluate({ ...okSummary, ...patch }, budget).join('\n'), pattern);
  }
  assert.deepEqual(lh.evaluate({ ...okSummary, route: '/tools/x/', scriptBytes: 50000 }, budget), []);
});

test('lighthouse: summarise separates third-party and script bytes', () => {
  const lhr = {
    categories: { performance: { score: 0.9 }, accessibility: { score: 1 }, seo: { score: 1 }, 'best-practices': { score: 1 } },
    audits: {
      'largest-contentful-paint': { numericValue: 1200 },
      'cumulative-layout-shift': { numericValue: 0.01 },
      'total-blocking-time': { numericValue: 10 },
      'network-requests': {
        details: {
          items: [
            { url: 'http://127.0.0.1:1/a.js', resourceType: 'Script', transferSize: 300 },
            { url: 'https://cdn.example.org/b.js', resourceType: 'Script', transferSize: 700 },
          ],
        },
      },
    },
  };
  const s = lh.summarise('/', lhr, 'http://127.0.0.1:1');
  assert.deepEqual(s.thirdParty, ['https://cdn.example.org/b.js']);
  assert.equal(s.scriptBytes, 1000);
  assert.equal(s.lcpMs, 1200);
});

test('release gate: parses the problem list and applies the allow list', () => {
  const out = 'noise\n\u001b[31mError: Release assertions failed (3):\n- missing route /apply/\n- draft content in a\n- form disabled: contact\n\nstack';
  const problems = gate.parseProblems(out);
  assert.deepEqual(problems, ['missing route /apply/', 'draft content in a', 'form disabled: contact']);
  assert.deepEqual(gate.unallowed(problems ?? [], '^missing route, form disabled'), ['draft content in a']);
  assert.deepEqual(gate.unallowed(problems ?? [], ''), problems);
  assert.equal(gate.parseProblems('Build failed: syntax error'), null);
});
