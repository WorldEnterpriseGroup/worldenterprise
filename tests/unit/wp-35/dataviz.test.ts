import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apportion, beeswarm, bandPath, cellsPath, linePath, niceTicks, scale, spreadLabels, stackLayers, wrapText } from '../../../src/components/visuals/charts/dataviz.ts';

/** WP-35, the pure geometry behind the chart components: it must be exact, because a chart cannot be eyeballed for arithmetic mistakes. */

test('apportion splits a total by the largest-remainder method and always adds up', () => {
  assert.deepEqual(apportion([50, 50], 100), [50, 50]);
  const counts = apportion([20.4, 29.4, 15.5, 34.7], 100);
  assert.equal(counts.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(counts, [20, 29, 16, 35]);
  const big = apportion([315318, 87754, 4987744], 1000);
  assert.equal(big.reduce((a, b) => a + b, 0), 1000);
  assert.deepEqual(big, [59, 16, 925]);
  assert.throws(() => apportion([0, 0], 10));
  assert.throws(() => apportion([1, 2], 2.5));
});

test('scale maps a domain to a range and tolerates a flat domain', () => {
  const s = scale([0, 100], [10, 110]);
  assert.equal(s(0), 10);
  assert.equal(s(50), 60);
  assert.equal(scale([5, 5], [0, 1])(5), 0);
});

test('niceTicks gives round values inside the range', () => {
  assert.deepEqual(niceTicks(0, 100, 4), [0, 25, 50, 75, 100]);
  assert.deepEqual(niceTicks(0, 0.5, 2), [0, 0.25, 0.5]);
  assert.deepEqual(niceTicks(3, 3), [3]);
});

test('stackLayers: stacked layers sit on each other, a percent stack ends at 100 and a stream is centred', () => {
  const series = [
    { label: 'a', values: [1, 2, 3] },
    { label: 'b', values: [3, 2, 1] },
  ];
  const stack = stackLayers(series, 'stack');
  assert.deepEqual(stack.layers[0]?.lower, [0, 0, 0]);
  assert.deepEqual(stack.layers[1]?.upper, [4, 4, 4]);
  assert.equal(stack.max, 4);
  const pct = stackLayers(series, 'percent');
  assert.deepEqual(pct.layers[1]?.upper.map((v) => Math.round(v * 1000) / 1000), [100, 100, 100]);
  const stream = stackLayers(series, 'stream');
  const mid = stream.layers.map((l) => l.lower.map((lo, i) => (lo + (l.upper[i] ?? 0)) / 2));
  assert.ok(Math.abs((stream.layers[0]?.lower[0] ?? 0) + (stream.layers[1]?.upper[0] ?? 0)) < 1e-9, 'symmetric about zero');
  assert.equal(mid.length, 2);
});

test('spreadLabels keeps every label at least the gap apart, in order, inside the bounds', () => {
  const out = spreadLabels([10, 12, 13, 14, 100], 20, 0, 200);
  for (let i = 1; i < out.length; i++) assert.ok((out[i] ?? 0) - (out[i - 1] ?? 0) >= 20 - 1e-9, `gap at ${i}`);
  assert.ok(out.every((v) => v >= 0 && v <= 200));
  assert.equal(out[4], 100);
});

test('beeswarm: no two dots of radius r overlap and each keeps its exact position', () => {
  const pos = [10, 11, 11, 12, 30, 31, 31.5, 60];
  const r = 6;
  const off = beeswarm(pos, r);
  assert.equal(off.length, pos.length);
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const d = Math.hypot((pos[i] ?? 0) - (pos[j] ?? 0), (off[i] ?? 0) - (off[j] ?? 0));
      assert.ok(d >= 2 * r - 1e-6, `dots ${i} and ${j} overlap (${d.toFixed(2)})`);
    }
  }
  assert.deepEqual(beeswarm([5], 6), [0]);
});

test('wrapText breaks at spaces and never splits a word', () => {
  assert.deepEqual(wrapText('Professional, scientific and technical', 24), ['Professional, scientific', 'and technical']);
  assert.deepEqual(wrapText('Extraordinarily', 5), ['Extraordinarily']);
});

test('cellsPath draws exactly `count` squares and nothing else', () => {
  assert.equal((cellsPath(0, 0, 10, 10, 24, 3).match(/M/g) ?? []).length, 0);
  assert.equal((cellsPath(0, 37, 10, 10, 24, 3).match(/M/g) ?? []).length, 37);
  assert.equal((cellsPath(37, 20, 10, 10, 24, 3).match(/M/g) ?? []).length, 20);
});

test('line and band paths are valid SVG path data', () => {
  assert.match(linePath([0, 10, 20], [5, 6, 7]), /^M[\d.]+ [\d.]+ ?L/);
  const band = bandPath([0, 10], [0, 0], [5, 6]);
  assert.match(band, /^M/);
  assert.match(band, /Z$/);
});
