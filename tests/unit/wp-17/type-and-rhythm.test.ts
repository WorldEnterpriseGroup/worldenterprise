import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;
const tokens = readFileSync(`${ROOT}src/styles/tokens.css`, 'utf8');
const base = readFileSync(`${ROOT}src/styles/base.css`, 'utf8');

const VIEWPORT_MIN = 360;
const VIEWPORT_MAX = 1440;

/** Resolve `--name: clamp(min, a + b vw, max)` to pixels at a viewport width. */
function resolve(name: string, viewport: number): number {
  const declaration = new RegExp(`${name}:\\s*clamp\\(([^;]+?)\\);`).exec(tokens);
  assert.ok(declaration, `${name} is declared as a clamp() in tokens.css`);
  const body = declaration[1] ?? '';
  const match = /^([\d.]+)rem,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw,\s*([\d.]+)rem$/.exec(body.trim());
  assert.ok(match, `${name} has the shape clamp(Nrem, Nrem + Nvw, Nrem): ${body}`);
  const [min, intercept, slope, max] = match.slice(1).map(Number) as [number, number, number, number];
  const fluid = intercept * 16 + (slope / 100) * viewport;
  return Math.min(Math.max(fluid, min * 16), max * 16);
}

const STEPS = ['lg', 'xl', '2xl', '3xl', '4xl'] as const;

test('the type scale grows by one modular ratio per step at both ends of the fluid range', () => {
  const small = STEPS.map((s) => resolve(`--fs-${s}`, VIEWPORT_MIN));
  const large = STEPS.map((s) => resolve(`--fs-${s}`, VIEWPORT_MAX));
  for (let i = 1; i < STEPS.length; i += 1) {
    const ratioSmall = (small[i] ?? 0) / (small[i - 1] ?? 1);
    const ratioLarge = (large[i] ?? 0) / (large[i - 1] ?? 1);
    assert.ok(ratioSmall > 1.18 && ratioSmall < 1.22, `${STEPS[i]} is one 1.2 step above ${STEPS[i - 1]} on a phone (${ratioSmall.toFixed(3)})`);
    assert.ok(ratioLarge > 1.3 && ratioLarge < 1.34, `${STEPS[i]} is one 1.32 step above ${STEPS[i - 1]} on a desktop (${ratioLarge.toFixed(3)})`);
  }
  const bodySize = resolve('--fs-base', VIEWPORT_MAX);
  assert.ok(Math.abs(bodySize - 19) < 0.5, 'the body size is 19px at 1440');
});

test('every reading size sits below the heading steps and the lead sits between base and lg', () => {
  for (const vw of [VIEWPORT_MIN, VIEWPORT_MAX]) {
    const [xs, sm, bodySize, lead, lg] = ['xs', 'sm', 'base', 'lead', 'lg'].map((s) => resolve(`--fs-${s}`, vw)) as [number, number, number, number, number];
    assert.ok(xs < sm && sm < bodySize && bodySize < lead && lead < lg, `ordered at ${vw}px`);
  }
});

test('heading roles keep the page title well above its sections', () => {
  for (const [role, size] of [['h1', '3xl'], ['h2', 'xl'], ['h3', 'lg'], ['h4', 'base']] as const) {
    assert.match(tokens, new RegExp(`--fs-${role}:\\s*var\\(--fs-${size}\\)`), `--fs-${role} maps to ${size}`);
    assert.match(base, new RegExp(`${role}\\s*\\{[^}]*font-size:\\s*var\\(--fs-${role}\\)`), `${role} in base.css uses --fs-${role}`);
  }
  for (const vw of [VIEWPORT_MIN, VIEWPORT_MAX]) {
    const ratio = resolve('--fs-3xl', vw) / resolve('--fs-xl', vw);
    assert.ok(ratio >= 1.4, `the h1 is at least 1.4 times the h2 at ${vw}px (${ratio.toFixed(2)})`);
  }
});

test('rhythm tokens are fluid and ascend from heading to section', () => {
  const names = ['--space-heading', '--space-flow', '--space-group', '--space-block', '--space-section'];
  for (const vw of [VIEWPORT_MIN, VIEWPORT_MAX]) {
    const values = names.map((n) => resolve(n, vw));
    for (let i = 1; i < values.length; i += 1) {
      assert.ok((values[i] ?? 0) > (values[i - 1] ?? 0), `${names[i]} is larger than ${names[i - 1]} at ${vw}px`);
    }
  }
  assert.ok(resolve('--space-hero', VIEWPORT_MAX) > resolve('--space-hero', VIEWPORT_MIN), 'the hero space is fluid');
  assert.match(tokens, /--section-y:\s*var\(--space-section\)/, 'the legacy section token aliases the rhythm token');
});

// Wave 9 (W9-4): the scale keeps growing to 1920 without moving the 360 and 1440 values, and the reading sizes stop at 1440.
const VIEWPORT_FULL_HD = 1920;

test('the heading steps grow to 1920, still about one modular step apart, while the reading sizes stay at their 1440 size', () => {
  const at1920 = STEPS.map((s) => resolve(`--fs-${s}`, VIEWPORT_FULL_HD));
  for (let i = 0; i < STEPS.length; i += 1) {
    assert.ok((at1920[i] ?? 0) > resolve(`--fs-${STEPS[i]}`, VIEWPORT_MAX) + 1, `--fs-${STEPS[i]} is larger at 1920 than at 1440`);
    if (i === 0) continue;
    const ratio = (at1920[i] ?? 0) / (at1920[i - 1] ?? 1);
    assert.ok(ratio > 1.3 && ratio < 1.4, `${STEPS[i]} is one step above ${STEPS[i - 1]} at 1920 (${ratio.toFixed(3)})`);
  }
  for (const size of ['xs', 'sm', 'base', 'lead']) {
    const grown = resolve(`--fs-${size}`, VIEWPORT_FULL_HD) - resolve(`--fs-${size}`, VIEWPORT_MAX);
    assert.ok(grown < 0.5, `--fs-${size} stops at about its 1440 size (${grown.toFixed(2)}px more at 1920)`);
  }
});

test('the rhythm tokens keep growing to 1920 and stay in order there', () => {
  const names = ['--space-heading', '--space-flow', '--space-group', '--space-block', '--space-section', '--space-hero'];
  const values = names.map((n) => resolve(n, VIEWPORT_FULL_HD));
  names.forEach((n, i) => assert.ok((values[i] ?? 0) > resolve(n, VIEWPORT_MAX), `${n} is larger at 1920 than at 1440`));
  for (let i = 1; i < 5; i += 1) assert.ok((values[i] ?? 0) > (values[i - 1] ?? 0), `${names[i]} is larger than ${names[i - 1]} at 1920`);
});
