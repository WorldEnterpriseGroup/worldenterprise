import assert from 'node:assert/strict';
import { test } from 'node:test';
import { armCenters, cluster, field, hash, lerp, r1, rng, smoothPath, stackOffsets } from '../../../src/components/hubs/geometry.ts';

// WP-24 (#90): the build-time geometry behind the hub drawings. Every drawing is computed from seeds, so the same content always draws
// the same picture (stable screenshots, no layout shift between builds) and every mark stays inside its frame.

test('hash and rng are deterministic, seeded and in range', () => {
  assert.equal(hash('desk-ai'), hash('desk-ai'));
  assert.notEqual(hash('desk-ai'), hash('desk-build'));
  assert.ok(Number.isInteger(hash('')) && hash('') >= 0);
  const a = rng('seed');
  const b = rng('seed');
  for (let i = 0; i < 200; i += 1) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1, `rng value ${x} out of [0, 1)`);
  }
  assert.notEqual(rng('one')(), rng('two')());
});

test('r1 rounds to one decimal', () => {
  assert.equal(r1(1.26), 1.3);
  assert.equal(r1(-0.04), -0);
  assert.equal(r1(10), 10);
});

test('cluster places one star per item around its center, the anchor first and brightest', () => {
  const center = { x: 400, y: 200 };
  for (const n of [0, 1, 5, 23]) {
    const stars = cluster(`c-${n}`, n, center, 13);
    assert.equal(stars.length, n);
    if (n === 0) continue;
    const anchor = stars[0];
    assert.ok(anchor !== undefined && Math.hypot(anchor.x - 400, anchor.y - 200) <= 13 * 0.25, 'the anchor sits on the center, within its jitter');
    for (const s of stars) {
      assert.ok(s.r > 0 && s.r <= 6, `radius ${s.r}`);
      assert.ok(Math.hypot(s.x - center.x, s.y - center.y) <= 13 * Math.sqrt(n + 1) + 13, 'star stays near its cluster');
    }
    assert.ok(stars.every((s, i) => i === 0 || s.r < (stars[0]?.r ?? 0)), 'the anchor is the largest star');
  }
  assert.deepEqual(cluster('same', 9, center, 13), cluster('same', 9, center, 13));
  assert.throws(() => cluster('x', -1, center, 13), RangeError);
  assert.throws(() => cluster('x', 1.5, center, 13), RangeError);
});

test('armCenters spreads clusters left to right inside the margins', () => {
  assert.deepEqual(armCenters(0, 1600, 520, 90), []);
  assert.deepEqual(armCenters(1, 1600, 520, 90), [{ x: 800, y: 260 }]);
  const pts = armCenters(14, 1600, 520, 90);
  assert.equal(pts.length, 14);
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    assert.ok(p !== undefined);
    assert.ok(p.x >= 90 && p.x <= 1510 && p.y >= 90 && p.y <= 430, `center ${p.x},${p.y} outside the margins`);
    if (i > 0) assert.ok(p.x > (pts[i - 1]?.x ?? 0), 'centers run left to right');
  }
});

test('smoothPath starts at the first point and ends at the last', () => {
  assert.equal(smoothPath([]), '');
  assert.equal(smoothPath([{ x: 1, y: 2 }]), 'M1 2');
  const d = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }]);
  assert.match(d, /^M0 0 C/);
  assert.match(d, / 20 0$/);
  assert.equal((d.match(/C/g) ?? []).length, 2);
});

test('field keeps every background star inside the frame', () => {
  const stars = field('sky', 120, 1600, 520);
  assert.equal(stars.length, 120);
  for (const s of stars) assert.ok(s.x >= 0 && s.x <= 1600 && s.y >= 0 && s.y <= 520 && s.r > 0);
});

test('lerp maps linearly and clamps to the range', () => {
  assert.equal(lerp(5, 0, 10, 0, 100), 50);
  assert.equal(lerp(-5, 0, 10, 0, 100), 0);
  assert.equal(lerp(50, 0, 10, 0, 100), 100);
  assert.equal(lerp(3, 3, 3, 10, 20), 10, 'a zero span does not divide by zero');
});

test('stackOffsets lifts repeats alternately above and below the line', () => {
  assert.deepEqual(stackOffsets([4, 4, 4, 4, 4, 7]), [0, -1, 1, -2, 2, 0]);
  assert.deepEqual(stackOffsets([]), []);
});
