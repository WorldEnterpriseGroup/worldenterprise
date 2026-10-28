import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as lhMod from '../../../scripts/run-lighthouse.mjs';

// #49 item 2: the brief pages carry the shared request-form script, as /apply/ and /contact/ do, so they are exempt from the JavaScript
// budget. The /briefs/ hub has no form and keeps the budget: exemptBelow exempts the pages under a prefix, never the prefix itself.

interface Summary {
  route: string;
  scores: Record<string, number | null>;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  scriptBytes: number;
  thirdParty: string[];
}
interface Budget {
  scores: Record<string, number>;
  metrics: { lcpMs: number; cls: number; tbtMs: number };
  javascript: { maxGzipBytes: number; exemptPrefixes: string[]; exemptBelow?: string[] };
}

const lh = lhMod as unknown as { evaluate(summary: Summary, config: Budget): string[] };

const config = JSON.parse(readFileSync(new URL('../../../lighthouserc.json', import.meta.url), 'utf8')) as Budget;
const summary = (route: string, scriptBytes: number): Summary => ({ route, scores: { performance: 0.98, accessibility: 1, seo: 1, 'best-practices': 1 }, lcpMs: 1900, cls: 0, tbtMs: 0, scriptBytes, thirdParty: [] });

test('a brief page over the JavaScript budget passes: it carries the request form', () => {
  assert.deepEqual(lh.evaluate(summary('/briefs/funding-paths/', 20895), config), []);
});

test('the /briefs/ hub over the JavaScript budget still fails (negative proof)', () => {
  assert.match(lh.evaluate(summary('/briefs/', 20895), config).join('\n'), /JavaScript transfer 20895 bytes exceeds 10240/);
});

test('a page outside every exemption over the JavaScript budget still fails', () => {
  assert.match(lh.evaluate(summary('/insights/', 20895), config).join('\n'), /JavaScript transfer/);
});

test('a config without exemptBelow keeps the old prefix-only behaviour', () => {
  const legacy: Budget = { ...config, javascript: { maxGzipBytes: 10240, exemptPrefixes: ['/tools/'] } };
  assert.deepEqual(lh.evaluate(summary('/tools/x/', 20895), legacy), []);
  assert.match(lh.evaluate(summary('/briefs/funding-paths/', 20895), legacy).join('\n'), /JavaScript transfer/);
});
