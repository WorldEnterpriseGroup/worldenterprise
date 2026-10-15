import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const scene = read('src/components/visuals/Scene.astro');
const band = read('src/components/visuals/Band.astro');
const starfield = read('src/components/visuals/StarfieldBand.astro');
const motion = read('src/styles/motion.css');
const readme = read('src/components/visuals/README.md');

/** The rules of a style sheet whose selector contains `needle`, as text. */
function rule(css: string, needle: string): string {
  const at = css.indexOf(needle);
  assert.ok(at >= 0, `no rule for ${needle}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated rule ${needle}`);
}

test('a framed scene is masked into the page: intersecting edge gradients, behind @supports, with a resting fallback', () => {
  assert.match(scene, /@supports \(mask-composite: intersect\)/);
  assert.match(scene, /mask-composite: intersect/);
  assert.match(scene, /-webkit-mask-composite: source-in/);
  const frame = rule(scene, '.scene--feather .scene__frame {');
  assert.match(frame, /mask-image: var\(--_ease-x\), var\(--_ease-y\)/);
  assert.match(frame, /border-radius: 0/);
  assert.match(scene, /feather = 'edges'/, 'feathering is the default');
});

test('the frame never draws a box: no border, outline or shadow on frame, stage or figure', () => {
  for (const sel of ['.scene__frame {', '.scene__stage {', '.scene__figure {']) {
    assert.doesNotMatch(rule(scene, sel), /border(?!-radius)|outline|box-shadow/, sel);
  }
});

test('a custom property the mask reads always has a fallback, so a browser without @property still masks', () => {
  assert.match(scene, /var\(--depth, 0\)/);
  assert.doesNotMatch(scene, /var\(--depth\)/);
});

test('poster to canvas is a crossfade: opacity transitions and @starting-style, only with motion allowed, canvas out of flow', () => {
  assert.match(scene, /@starting-style \{\s*\.scene__frame :global\(\.scene__canvas\) \{\s*opacity: 0/);
  const motionBlock = scene.slice(scene.indexOf('@media (prefers-reduced-motion: no-preference) {'));
  assert.match(motionBlock, /transition-property: opacity/);
  assert.match(rule(scene, '.scene__frame :global(.scene__poster),\n  .scene__overlay,\n  .scene__frame :global(.scene__canvas) {'), /position: absolute/);
});

test('scroll-driven depth uses longhands, a typed property and respects reduced motion', () => {
  assert.match(scene, /@property --depth \{\s*syntax: '<number>'/);
  assert.match(scene, /animation-timeline: view\(\)/);
  assert.doesNotMatch(scene, /animation: scene-materialize/, 'longhands only (WP-60)');
  assert.match(scene, /@supports \(animation-timeline: view\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\)/);
});

test('view transitions: the document opt-in, the named header and title, and the named hero media', () => {
  assert.match(motion, /@view-transition \{\s*navigation: auto;/);
  assert.match(motion, /view-transition-name: site-top/);
  assert.match(motion, /view-transition-name: page-title/);
  assert.match(scene, /\.scene--hero \.scene__frame \{\s*view-transition-name: hero-media/);
  assert.match(scene, /hero && 'scene--hero'/);
  const guarded = scene.slice(scene.indexOf('@supports (view-transition-name: none)'));
  assert.match(guarded.slice(0, 200), /prefers-reduced-motion: no-preference/);
});

test('popover legend with anchor positioning, and a dialog with closedby and an invoker command', () => {
  assert.match(scene, /popovertarget=\{legendId\}/);
  assert.match(scene, /popover="auto"/);
  assert.match(scene, /@supports \(position-anchor: auto\) and \(position-area: top\)/);
  assert.match(scene, /position-try-fallbacks/);
  assert.match(scene, /<dialog[^>]*closedby="any"/);
  assert.match(scene, /commandfor=\{detailId\}[^>]*command="show-modal"|command="show-modal"[^>]*commandfor/);
  assert.match(scene, /<form method="dialog">/);
  assert.match(scene, /hidden data-detail-for/, 'the open button stays hidden until the stub confirms a dialog');
});

test('the poster-state sheen is typed, desktop and motion-gated, and :has() keeps it off a live canvas', () => {
  assert.match(scene, /@property --sheen \{\s*syntax: '<percentage>'/);
  assert.match(scene, /\(prefers-reduced-motion: no-preference\) and \(min-width: 64rem\) and \(pointer: fine\)/);
  assert.match(scene, /:not\(:has\(:global\(\.scene__canvas\)\)\)/);
});

test('bands bleed into their neighbours with decorative skirts, and a deferred band does not (containment would clip them)', () => {
  assert.match(band, /band--bleed::before/);
  assert.match(band, /pointer-events: none/);
  assert.match(band, /bleed && !defer/);
  assert.match(starfield, /\.starfield-band::before/);
  assert.match(starfield, /overflow-x: clip/);
  assert.doesNotMatch(starfield, /overflow: hidden/);
});

test('no style attribute, inline script or third-party request in the visuals markup (CSP)', () => {
  for (const src of [scene, band, starfield]) {
    assert.doesNotMatch(src, /\sstyle=/);
    assert.doesNotMatch(src, /<script[^>]*is:inline|https?:\/\//);
  }
});

test('speculation rules stay registered with the CSP generator by hash', () => {
  const rules = read('src/components/seo/SpeculationRules.astro');
  assert.match(rules, /insertScriptHash/);
  assert.match(rules, /type="speculationrules"/);
});

test('the README documents every shipped feature and its fallback', () => {
  for (const term of ['WebGPURenderer', 'webgl2', 'feather', 'view transitions', 'Scroll-driven', '@starting-style', 'Popover', 'closedby', '@property', 'Container queries', ':has()', 'content-visibility', 'Speculation rules', 'fetchpriority', 'OffscreenCanvas', 'AccretionScene', '3840']) {
    assert.ok(readme.toLowerCase().includes(term.toLowerCase()), `README mentions ${term}`);
  }
});
