import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  evaluateGate,
  isSoftwareRenderer,
  MIN_CORES,
  probeWebgl2,
  rendererName,
  SCENE_MEDIA,
  WEBGL_CONTEXT_ATTRIBUTES,
} from '../../../src/scripts/visuals/gate.ts';
import type { CanvasFactory, ProbeContext, SceneCapabilities } from '../../../src/scripts/visuals/gate.ts';
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

/** A document whose canvas answers getContext with `result`, recording the arguments. */
function fakeDocument(result: () => unknown): { doc: CanvasFactory; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const doc = {
    createElement: () => ({
      getContext: (id: 'webgl2', attributes: WebGLContextAttributes) => {
        calls.push([id, attributes]);
        return result() as ProbeContext | null;
      },
    }),
  } satisfies CanvasFactory;
  return { doc, calls };
}

/** A context reporting `renderer` (unmasked when `debugInfo`, else through RENDERER), counting releases. */
function fakeContext(renderer: string, debugInfo = true): { gl: ProbeContext; lost: { count: number } } {
  const lost = { count: 0 };
  const gl: ProbeContext = {
    getExtension: (name: string) => {
      if (name === 'WEBGL_lose_context') return { loseContext: () => (lost.count += 1) };
      if (name === 'WEBGL_debug_renderer_info') return debugInfo ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null;
      return null;
    },
    getParameter: (pname: number) => {
      if (pname === 0x9246) return debugInfo ? renderer : null;
      if (pname === 0x1f01) return debugInfo ? 'WebKit WebGL' : renderer;
      return null;
    },
  };
  return { gl, lost };
}

const HARDWARE = [
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206) Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (AMD, AMD Radeon RX 6800 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
  'Mesa Intel(R) Xe Graphics (TGL GT2)',
  'Apple GPU',
];
const SOFTWARE = [
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
  'Google SwiftShader',
  'llvmpipe (LLVM 15.0.7, 256 bits)',
  'ANGLE (Mesa, llvmpipe (LLVM 17.0.6, 256 bits), OpenGL 4.5)',
  'softpipe',
  'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'Mesa OffScreen',
];

test('the renderer matcher refuses software rasterisers and allows hardware GPUs', () => {
  for (const name of SOFTWARE) assert.equal(isSoftwareRenderer(name), true, name);
  for (const name of HARDWARE) assert.equal(isSoftwareRenderer(name), false, name);
});

test('the WebGL2 probe asks with the caveat flag and allows a hardware renderer', () => {
  assert.equal(WEBGL_CONTEXT_ATTRIBUTES.failIfMajorPerformanceCaveat, true);
  const { gl, lost } = fakeContext(HARDWARE[0] ?? '');
  const ok = fakeDocument(() => gl);
  assert.equal(probeWebgl2(ok.doc), true);
  assert.deepEqual(ok.calls, [['webgl2', { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' }]]);
  assert.equal(lost.count, 1, 'the probe context is released at once');
});

test('a software renderer handed out without a caveat keeps the poster, and the context is still released', () => {
  for (const name of SOFTWARE) {
    const { gl, lost } = fakeContext(name);
    assert.equal(probeWebgl2(fakeDocument(() => gl).doc), false, name);
    assert.equal(lost.count, 1, `${name}: released`);
  }
  const swift = fakeContext(SOFTWARE[0] ?? '');
  assert.deepEqual(evaluateGate({ ...CAPABLE, webgl2: () => probeWebgl2(fakeDocument(() => swift.gl).doc) }), {
    ok: false,
    reason: 'webgl2',
  });
});

test('without WEBGL_debug_renderer_info the probe reads RENDERER', () => {
  assert.equal(rendererName(fakeContext('Google SwiftShader', false).gl), 'Google SwiftShader');
  assert.equal(rendererName(fakeContext('Apple GPU').gl), 'Apple GPU');
  assert.equal(probeWebgl2(fakeDocument(() => fakeContext('llvmpipe (LLVM 15.0.7, 256 bits)', false).gl).doc), false);
  assert.equal(probeWebgl2(fakeDocument(() => fakeContext('Apple GPU', false).gl).doc), true);
});

test('no context or a throwing probe keeps the poster', () => {
  // With failIfMajorPerformanceCaveat, a blocklisted GPU returns null rather than a software context.
  assert.equal(probeWebgl2(fakeDocument(() => null).doc), false);
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    assert.equal(
      probeWebgl2(
        fakeDocument(() => {
          throw new Error('context lost');
        }).doc,
      ),
      false,
    );
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(evaluateGate({ ...CAPABLE, webgl2: () => probeWebgl2(fakeDocument(() => null).doc) }), { ok: false, reason: 'webgl2' });
});

test('the renderer is created with the same context attributes as the probe', () => {
  const runtime = readFileSync(new URL('../../../src/scripts/visuals/runtime.ts', import.meta.url), 'utf8');
  // WP-36: the WebGL2 backend of WebGPURenderer draws on a context the runtime creates with the probe's attributes.
  assert.match(runtime, /getContext\('webgl2', \{[^}]*\.\.\.WEBGL_CONTEXT_ATTRIBUTES[^}]*\}\)/);
  assert.match(runtime, /new WebGPURenderer\(\{[^\n]*context: gl/);
});

test('the media query requires a wide screen, a fine pointer and motion allowed', () => {
  assert.match(SCENE_MEDIA, /min-width: 64rem/);
  assert.match(SCENE_MEDIA, /pointer: fine/);
  assert.match(SCENE_MEDIA, /prefers-reduced-motion: no-preference/);
});

test('scene names are a closed set', () => {
  assert.deepEqual([...SCENE_NAMES], ['galaxy', 'launch', 'orbit', 'worldforge', 'starfield', 'accretion']);
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
  assert.ok(
    constellationLinks(6).some(([a, b]) => a === 5 && b === 0),
    'ring closes at six',
  );
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
