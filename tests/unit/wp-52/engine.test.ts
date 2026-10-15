import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { evaluateGate, MIN_CORES, SCENE_MEDIA } from '../../../src/scripts/visuals/gate.ts';
import type { SceneCapabilities } from '../../../src/scripts/visuals/gate.ts';
import { SCENE_NAMES, isSceneName } from '../../../src/scripts/visuals/types.ts';
import {
  constellationLayout,
  constellationLinks,
  globeCellCount,
  goldbergCells,
  launchAnchors,
  MAX_SEATS,
  orbitLayout,
  positionClasses,
  project,
  ORBIT_CAMERA,
} from '../../../src/scripts/visuals/geometry.ts';
import { seeded, hashString } from '../../../src/scripts/visuals/rng.ts';

const CAPABLE: SceneCapabilities = { media: true, forcedColors: false, cores: 8, memory: 8, saveData: false, webgl2: () => true };

test('the gate passes a capable desktop and names the first failing condition otherwise', () => {
  assert.deepEqual(evaluateGate(CAPABLE), { ok: true });
  assert.deepEqual(evaluateGate({ ...CAPABLE, media: false }), { ok: false, reason: 'media' });
  assert.deepEqual(evaluateGate({ ...CAPABLE, forcedColors: true }), { ok: false, reason: 'forced-colors' });
  assert.deepEqual(evaluateGate({ ...CAPABLE, cores: MIN_CORES - 1 }), { ok: false, reason: 'cores' });
  assert.deepEqual(evaluateGate({ ...CAPABLE, memory: 2 }), { ok: false, reason: 'memory' });
  assert.deepEqual(evaluateGate({ ...CAPABLE, saveData: true }), { ok: false, reason: 'save-data' });
  assert.deepEqual(evaluateGate({ ...CAPABLE, webgl2: () => false }), { ok: false, reason: 'webgl2' });
  assert.deepEqual(evaluateGate({ ...CAPABLE, cores: undefined, memory: undefined }), { ok: true }, 'unreported hints do not block');
});

test('the gate never probes WebGL when an earlier condition fails', () => {
  let probed = false;
  evaluateGate({ ...CAPABLE, media: false, webgl2: () => ((probed = true), true) });
  assert.equal(probed, false);
});

test('the media query requires a wide screen, a fine pointer and motion allowed', () => {
  assert.match(SCENE_MEDIA, /min-width: 64rem/);
  assert.match(SCENE_MEDIA, /pointer: fine/);
  assert.match(SCENE_MEDIA, /prefers-reduced-motion: no-preference/);
});

test('scene names are a closed set', () => {
  assert.deepEqual([...SCENE_NAMES], ['galaxy', 'launch', 'orbit', 'worldforge', 'starfield']);
  assert.equal(isSceneName('galaxy'), true);
  assert.equal(isSceneName('blackhole'), false);
  assert.equal(isSceneName(undefined), false);
});

test('Goldberg globes have 10f^2 + 2 cells with exactly twelve pentagons', () => {
  for (const f of [1, 2, 4, 6]) {
    const cells = goldbergCells(f);
    assert.equal(cells.length, globeCellCount(f), `f=${f}`);
    assert.equal(cells.filter((c) => c.corners.length === 5).length, 12, `f=${f}`);
  }
});

test('projection puts the camera target at the frame center', () => {
  const p = project(ORBIT_CAMERA.target, ORBIT_CAMERA, 16 / 9);
  assert.ok(Math.abs(p.x - 0.5) < 1e-9 && Math.abs(p.y - 0.5) < 1e-9);
});

test('layouts: orbit bodies, launch anchors and constellation positions stay in frame and in bounds', () => {
  assert.equal(orbitLayout(7, 'single').length, 7);
  assert.equal(launchAnchors(6).length, 9, 'three stations then six waypoints');
  const team = constellationLayout(MAX_SEATS + 5);
  assert.equal(team.length, MAX_SEATS);
  for (const p of team) assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
  assert.ok(constellationLinks(6).some(([a, b]) => a === 5 && b === 0), 'ring closes at six');
  assert.equal(positionClasses(0.374, 1.2), 'vp-x-37 vp-y-100');
});

test('randomness is seeded and stable', () => {
  const a = seeded(42);
  const b = seeded(42);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
  assert.equal(hashString('Dream'), hashString('Dream'));
  assert.notEqual(hashString('Dream'), hashString('Build'));
});

test('the <we-scene> stub imports nothing from three statically (three loads only after the gate passes)', () => {
  const src = readFileSync(new URL('../../../src/scripts/visuals/scene-element.ts', import.meta.url), 'utf8');
  const staticImports = [...src.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.ok(staticImports.length > 0);
  for (const spec of staticImports) {
    assert.doesNotMatch(spec ?? '', /^three|runtime|scenes\//, `static import of ${spec}`);
  }
  assert.match(src, /import\('\.\/runtime\.ts'\)/);
});
