import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bars, donut, hexagon, lanes, linear, polyline, survivalPaths, ticks, timelineX, timelineYears } from '../../../src/components/visuals/chart-math.ts';
import { hexField, radarPoint, radarPolygon, weightBand } from '../../../src/components/visuals/illustrations/shapes.ts';
import { JOURNEY_MILESTONES, JOURNEY_PHASES, READINESS_AREAS, milestonesOf } from '../../../src/components/visuals/illustrations/journey.ts';
import { findDenied } from '../../../src/components/visuals/contracts.ts';

test('linear maps a domain onto a range', () => {
  const f = linear([0, 10], [100, 0]);
  assert.equal(f(0), 100);
  assert.equal(f(5), 50);
  assert.equal(f(10), 0);
});

test('ticks are round and cover the maximum', () => {
  assert.deepEqual(ticks(100, 4), [0, 25, 50, 75, 100]);
  assert.deepEqual(ticks(10, 5), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(ticks(0), [0]);
});

test('polyline formats points with one decimal', () => {
  assert.equal(polyline([[0, 0], [1.25, 2.04]]), 'M0 0 L1.3 2');
});

test('survival paths step at each year and close the area to the baseline', () => {
  const box = { x: 0, y: 0, width: 100, height: 100 };
  const p = survivalPaths([{ year: 0, percent: 100 }, { year: 1, percent: 50 }], box, 1);
  assert.equal(p.line, 'M0 0 L100 0 L100 50');
  assert.ok(p.area.endsWith('L100 100 L0 100 Z'));
  assert.deepEqual(p.dots, [[0, 0], [100, 50]]);
});

test('bars scale to the largest value or a given maximum', () => {
  const box = { x: 0, y: 0, width: 200, height: 100 };
  assert.deepEqual(bars([50, 100], box).map((b) => b.width), [100, 200]);
  assert.deepEqual(bars([50, 100], box, 200).map((b) => b.width), [50, 100]);
});

test('donut segments cover the circle in order, with a full ring for a single value', () => {
  const arcs = donut([1, 1, 2], 50, 50, 40, 20);
  assert.equal(arcs.length, 3);
  assert.equal(arcs[0]?.start, 0);
  assert.ok(Math.abs((arcs[2]?.end ?? 0) - Math.PI * 2) < 1e-9);
  const ring = donut([0, 5], 50, 50, 40, 20);
  assert.equal(ring[0]?.d, '');
  assert.match(ring[1]?.d ?? '', /A40 40 0 1 1/);
  assert.deepEqual(donut([0, 0], 50, 50, 40, 20), []);
});

test('the timeline scale is monotonic, starts at 0, ends at the width, and gives year one about a third', () => {
  assert.equal(timelineX(0, 10, 1), 0);
  assert.ok(Math.abs(timelineX(10, 10, 1) - 1) < 1e-9);
  const one = timelineX(1, 10, 1);
  assert.ok(one > 0.28 && one < 0.4, String(one));
  let last = -1;
  for (let y = 0; y <= 10; y += 0.25) {
    const x = timelineX(y, 10, 1);
    assert.ok(x > last);
    last = x;
  }
  assert.equal(timelineX(30, 10, 1), timelineX(10, 10, 1));
  assert.deepEqual(timelineYears(10), [0, 1, 2, 3, 5, 10]);
});

test('lanes alternate labels that would collide', () => {
  assert.deepEqual(lanes([0, 0.05, 0.1, 0.5], 0.15, 3), [0, 1, 2, 0]);
  assert.deepEqual(lanes([0, 0.5, 1], 0.15, 2), [0, 0, 0]);
});

test('hexagons and radar polygons have six points', () => {
  assert.equal(hexagon(0, 0, 10).split(' ').length, 6);
  assert.equal(radarPolygon(0, 0, 10, [1, 1, 1, 1, 1, 1]).split(' ').length, 6);
  const [x, y] = radarPoint(0, 0, 10, 0, 6, 1);
  assert.ok(Math.abs(x) < 1e-9 && Math.abs(y + 10) < 1e-9, 'axis 0 points straight up');
});

test('the hex field is deterministic, denser at its edge, and has exactly one amber cell', () => {
  const a = hexField(800, 400, 22, 'right', 0.6, 7);
  const b = hexField(800, 400, 22, 'right', 0.6, 7);
  assert.deepEqual(a, b);
  assert.equal(a.filter((c) => c.amber).length, 1);
  const right = a.filter((c) => c.x > 600).length;
  const left = a.filter((c) => c.x < 200).length;
  assert.ok(right > left * 2, `${right} vs ${left}`);
  assert.equal(hexField(800, 400, 22, 'left', 0.6, 7, false).filter((c) => c.amber).length, 0);
  assert.equal(weightBand(0.9), 4);
  assert.equal(weightBand(0.1), 1);
});

test('the journey follows BRIEF 3.2: three phases, deliverables, no numbers, days or banned words', () => {
  assert.deepEqual(JOURNEY_PHASES.map((p) => [p.name, p.altitude]), [['Dream', 'Survey'], ['Build', 'Blueprint'], ['Grow', 'Territory']]);
  for (const p of JOURNEY_PHASES) assert.ok(milestonesOf(p.id).length >= 2, p.id);
  for (const m of JOURNEY_MILESTONES) {
    const text = `${m.title} ${m.keeps}`;
    assert.doesNotMatch(text, /\d|\bdays?\b|\bM\d|certif|fee|guarantee/i, text);
    assert.equal(findDenied(text), null, text);
  }
  assert.equal(READINESS_AREAS.length, 6);
});
