import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { SCENE_NAMES } from '../../../src/scripts/visuals/types.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
/** Source without comments, so a comment may explain what the code replaced. */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SCENES = readdirSync(join(ROOT, 'src/scripts/visuals/scenes')).filter((f) => f.endsWith('.ts'));

test('every scene module draws with node materials from three/webgpu, never GLSL ShaderMaterial', () => {
  for (const file of SCENES) {
    const src = code(`src/scripts/visuals/scenes/${file}`);
    assert.doesNotMatch(src, /from 'three'/, `${file} imports from 'three' (use 'three/webgpu')`);
    assert.doesNotMatch(src, /ShaderMaterial|glsl|gl_Position|gl_PointSize/, `${file} has GLSL; WebGPURenderer cannot run it`);
  }
  assert.match(read('src/scripts/visuals/scenes/common.ts'), /PointsNodeMaterial/);
  assert.match(read('src/scripts/visuals/scenes/common.ts'), /MeshBasicNodeMaterial/);
});

test('the scene files are the closed set of names plus the shared helpers', () => {
  const scenes = SCENES.filter((f) => f !== 'common.ts').map((f) => f.replace(/\.ts$/, '')).sort();
  assert.deepEqual(scenes, [...SCENE_NAMES].sort());
});

test('the loader stub has a lazy loader for every scene name', () => {
  const stub = read('src/scripts/visuals/scene-element.ts');
  for (const name of SCENE_NAMES) assert.match(stub, new RegExp(`${name}: \\(\\) => import\\('\\./scenes/${name}\\.ts'\\)`), name);
});

test('the runtime renders with WebGPURenderer, on WebGPU or its WebGL2 backend, and cleans up', () => {
  const runtime = read('src/scripts/visuals/runtime.ts');
  assert.match(runtime, /from 'three\/webgpu'/);
  assert.match(runtime, /forceWebGL: backend === 'webgl2'/);
  assert.match(runtime, /await renderer\.init\(\)/);
  assert.match(runtime, /compileAsync/, 'pipelines are compiled before the first frame is shown');
  assert.match(runtime, /onDeviceLost/, 'a lost WebGPU device falls back to the poster');
  assert.match(runtime, /webglcontextlost/, 'a lost WebGL context falls back to the poster');
  assert.match(runtime, /WebGPU failed to initialise, using WebGL2/, 'WebGPU init failure retries on WebGL2');
  assert.match(runtime, /MAX_DPR = 1\.75/);
  assert.match(runtime, /'pagehide'/);
  assert.match(runtime, /visibilitychange/);
  assert.match(runtime, /IntersectionObserver/);
  assert.match(runtime, /prefers-reduced-motion: reduce/);
  assert.match(runtime, /disposeTree\(this\.scene\)/);
});

test('no worker or blob: URL anywhere in the scene code (CSP: worker-src and img-src forbid them)', () => {
  const files = ['scene-element.ts', 'runtime.ts', 'gate.ts', 'backend.ts', ...SCENES.map((f) => `scenes/${f}`)];
  for (const f of files) {
    const src = read(`src/scripts/visuals/${f}`);
    assert.doesNotMatch(src, /new (Shared)?Worker\(|createObjectURL|blob:|transferControlToOffscreen/, f);
  }
});

test('the loader stub still imports nothing from three, the runtime or the scenes statically', () => {
  const stub = read('src/scripts/visuals/scene-element.ts');
  for (const m of stub.matchAll(/^import (?!type).*? from '(.+?)';/gm)) assert.doesNotMatch(m[1] ?? '', /^three|runtime|scenes\//, m[0]);
  assert.match(stub, /commandForElement/, 'the about dialog uses invoker commands where supported');
});

test('the accretion scene is a pure function of the scene clock and loops without a pop', () => {
  const src = read('src/scripts/visuals/scenes/accretion.ts');
  assert.match(src, /fract\(clock\.div\(LIFE\)/, 'grains follow a looping life');
  assert.match(src, /posterTime: POSTER_TIME/);
  assert.match(src, /align/);
  assert.equal(existsSync(join(ROOT, 'src/assets/visuals/posters/accretion.avif')), true);
  assert.equal(existsSync(join(ROOT, 'src/assets/visuals/posters/accretion-end.avif')), true);
});

test('the accretion component is additive: optional props only, Scene wrapper, own poster keys', () => {
  const src = read('src/components/visuals/AccretionScene.astro');
  assert.match(src, /scene="accretion"/);
  assert.match(src, /poster=\{accretionPosterKey\(align\)\}/);
  const props = /interface Props \{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
  for (const line of props.split('\n').filter((l) => /^\s+\w+\??:/.test(l))) assert.match(line, /\?:/, `${line.trim()} is optional`);
});
