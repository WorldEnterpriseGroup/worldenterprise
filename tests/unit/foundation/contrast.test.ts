import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { contrastRatio, readPairs } from '../../../src/lib/contrast.ts';

test('black on white is 21:1', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
});

test('every annotated token pair in tokens.css meets its required ratio', () => {
  const pairs = readPairs(readFileSync(new URL('../../../src/styles/tokens.css', import.meta.url), 'utf8'));
  assert.ok(pairs.length >= 10, `found ${pairs.length} pairs`);
  const failing = pairs.filter((p) => !p.pass).map((p) => `${p.foreground}/${p.background} ${p.ratio.toFixed(2)} < ${p.required}`);
  assert.deepEqual(failing, []);
});
