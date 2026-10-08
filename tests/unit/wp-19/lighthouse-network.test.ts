import assert from 'node:assert/strict';
import test from 'node:test';
import * as lhMod from '../../../scripts/run-lighthouse.mjs';

interface Profile {
  fcpMs: number | null;
  requests: number;
  totalBytes: number;
  htmlBytes: number;
  cssRequests: number;
  cssBytes: number;
  fontRequests: number;
  fontBytes: number;
  imageBytes: number;
  renderBlocking: number;
  renderBlockingSavingsMs: number;
}
interface Row {
  route: string;
  lcpMs: number | null;
  network?: Profile;
}
const lh = lhMod as unknown as { networkProfile(lhr: unknown): Profile; networkReport(rows: readonly Row[]): string };

const request = (resourceType: string, transferSize: number): { resourceType: string; transferSize: number } => ({ resourceType, transferSize });

const lhr = {
  audits: {
    'first-contentful-paint': { numericValue: 1352.4 },
    'network-requests': {
      details: {
        items: [request('Document', 9000), request('Stylesheet', 8300), request('Stylesheet', 900), request('Font', 20000), request('Font', 16000), request('Image', 5000), request('Script', 1100)],
      },
    },
    'render-blocking-insight': { metricSavings: { FCP: 300, LCP: 300 }, details: { items: [{ url: 'a.css' }, { url: 'b.css' }] } },
  },
};

test('networkProfile counts requests and bytes by type and reads the render-blocking insight', () => {
  const profile = lh.networkProfile(lhr);
  assert.equal(profile.fcpMs, 1352.4);
  assert.equal(profile.requests, 7);
  assert.equal(profile.totalBytes, 60300);
  assert.equal(profile.htmlBytes, 9000);
  assert.equal(profile.cssRequests, 2);
  assert.equal(profile.cssBytes, 9200);
  assert.equal(profile.fontRequests, 2);
  assert.equal(profile.fontBytes, 36000);
  assert.equal(profile.imageBytes, 5000);
  assert.equal(profile.renderBlocking, 2);
  assert.equal(profile.renderBlockingSavingsMs, 300);
});

test('networkProfile tolerates a report without the audits: zero counts, null FCP', () => {
  const profile = lh.networkProfile({ audits: {} });
  assert.equal(profile.fcpMs, null);
  assert.equal(profile.requests, 0);
  assert.equal(profile.renderBlocking, 0);
});

test('networkReport lists one row per route and a mean row', () => {
  const a = lh.networkProfile(lhr);
  const b = { ...a, cssRequests: 4, fontRequests: 4 };
  const table = lh.networkReport([
    { route: '/', lcpMs: 1900, network: a },
    { route: '/program/', lcpMs: 1700, network: b },
  ]);
  const lines = table.trim().split('\n');
  assert.equal(lines.length, 5);
  assert.match(lines[2] ?? '', /^\| `\/` \| 1352 \| 1900 \| 2 \| 2 \|/);
  assert.match(lines[4] ?? '', /^\| \*\*mean\*\* \| 1352 \| 1800 \| 3\.00 \| 2\.00 \|/);
});
