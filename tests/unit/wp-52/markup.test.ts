/**
 * Source-level checks of the visuals markup (ARCHITECTURE 3.2 and the CSP rules): no style attributes or inline scripts anywhere in
 * the library, every scene wrapper hands Scene a poster and alt text, every chart requires a source, and no visible copy in the library
 * uses a denied word.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDenied } from '../../../src/components/visuals/contracts.ts';
import { SCENE_NAMES } from '../../../src/scripts/visuals/types.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = [...walk(join(ROOT, 'src/components/visuals')), ...walk(join(ROOT, 'src/scripts/visuals'))].filter((f) => /\.(astro|ts|css)$/.test(f));
const astro = files.filter((f) => f.endsWith('.astro'));
const read = (f: string): string => readFileSync(f, 'utf8');

test('the library exists', () => {
  assert.ok(astro.length >= 20, `${astro.length} components`);
});

test('no style attributes, cssText, setAttribute("style"), inline scripts or inline handlers', () => {
  for (const f of files) {
    const src = read(f);
    const rel = relative(ROOT, f);
    assert.doesNotMatch(src, /\sstyle=["'{\\]/, `${rel}: style attribute`);
    assert.doesNotMatch(src, /\.style\.cssText/, `${rel}: cssText`);
    assert.doesNotMatch(src, /setAttribute\(\s*['"]style['"]/, `${rel}: setAttribute style`);
    assert.doesNotMatch(src, /is:inline/, `${rel}: inline script`);
    assert.doesNotMatch(src, /\son[a-z]+=["{]/, `${rel}: inline event handler`);
    assert.doesNotMatch(src, /(?:src|href)=["']data:|blob:/, `${rel}: data or blob URL`);
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)[^'"\s]*\.(?:js|css|woff2?)\b/, `${rel}: third-party asset`);
  }
});

test('every scene wrapper renders Scene with a poster and alt text, and each scene has a wrapper', () => {
  const wrappers = astro.filter((f) => /\/(GalaxyScene|LaunchTrajectory|OrbitSystem|WorldForge|StarfieldBand|AccretionScene)\.astro$/.test(f));
  assert.equal(wrappers.length, 6);
  const used = new Set<string>();
  for (const f of wrappers) {
    const src = read(f);
    const rel = relative(ROOT, f);
    assert.match(src, /<Scene\b/, rel);
    assert.match(src, /\bposter[=:]/, `${rel}: poster`);
    assert.match(src, /\balt=|^\s+alt,$/m, `${rel}: alt`);
    const name = /scene(?:="|: ')([a-z]+)['"]/.exec(src)?.[1];
    if (name !== undefined) used.add(name);
  }
  assert.deepEqual([...used].sort(), [...SCENE_NAMES].sort());
});

test('Scene always renders its poster image with alt, dimensions and async decoding, and a real pause button', () => {
  const src = read(join(ROOT, 'src/components/visuals/Scene.astro'));
  assert.match(src, /<img[\s\S]*?class="scene__poster"[\s\S]*?alt=\{altText\}[\s\S]*?decoding="async"/);
  assert.match(src, /width=\{image\.width\}/);
  assert.match(src, /height=\{image\.height\}/);
  assert.match(src, /<button class="scene__toggle" type="button"/);
});

test('every chart and stat component validates its source', () => {
  for (const name of ['StatTile', 'StatTiles', 'SurvivalCurve', 'BarChart', 'DonutChart', 'SourceNote']) {
    const f = astro.find((x) => x.endsWith(`/charts/${name}.astro`));
    assert.ok(f, name);
    assert.match(read(f), /statSource\(|stat\(/, `${name} checks its source`);
  }
});

test('default copy, alt text and titles in the library pass the denylist and show no prices', () => {
  for (const f of astro) {
    const src = read(f);
    const strings = [...src.matchAll(/(?:alt|title|label|caption|labelsName|center)\s*=\s*'([^']{3,})'/g), ...src.matchAll(/>([^<>{}]{4,})</g)].map((m) => (m[1] ?? '').trim());
    for (const s of strings) {
      assert.equal(findDenied(s), null, `${relative(ROOT, f)}: "${s}"`);
      assert.doesNotMatch(s, /[$€£]\s?\d/, `${relative(ROOT, f)}: price in "${s}"`);
      assert.doesNotMatch(s, /\b(?:20|twenty)\+?\s+years?\b|two decades/i, `${relative(ROOT, f)}: C-11 in "${s}"`);
    }
  }
});

test('the team visuals carry no cart, selector or price logic', () => {
  for (const f of astro.filter((x) => x.includes('/seats/'))) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /<script|<form|<select|<input|price|cart|checkout/i, relative(ROOT, f));
  }
});

test('the hero poster slot: Scene renders a slotted poster instead of its own, GalaxyScene forwards it, and no visual sets fetch priority', () => {
  const scene = read(join(ROOT, 'src/components/visuals/Scene.astro'));
  assert.match(scene, /<slot name="poster" \/>/);
  assert.match(scene, /Astro\.slots\.has\('poster'\) \? null : await posterImage\(/, 'no lazy poster is generated when the hero brings its own');
  assert.match(read(join(ROOT, 'src/components/visuals/GalaxyScene.astro')), /<slot name="poster" slot="poster" \/>/);
  for (const f of files) assert.doesNotMatch(read(f), /fetchpriority/, `${relative(ROOT, f)}: high priority belongs to the hero components (wp-12b)`);
});

test('Band and Split render the docs/wave9-contracts.md markup, and the contract names exist', () => {
  const band = read(join(ROOT, 'src/components/visuals/Band.astro'));
  assert.match(band, /<section\s+class:list=\{\['band', t !== 'plain' && `band--\$\{t\}`/);
  assert.match(band, /<div class="container band__content">/);
  assert.match(band, /<slot name="scene" \/>/);
  const split = read(join(ROOT, 'src/components/visuals/Split.astro'));
  assert.match(split, /'split', reverse && 'split--reverse', even && 'split--even', mediaFirst && 'split--media-first'/);
  assert.match(split, /<div class="split__text">\s*<slot \/>\s*<\/div>\s*<div class="split__media">\s*<slot name="media" \/>/);
  for (const [alias, target] of [
    ['OrbitDiagram', 'OrbitSystem'],
    ['SeatBuilder', 'TeamConstellation'],
    ['HexField', 'HexFieldIllustration'],
  ] as const) {
    const src = read(join(ROOT, `src/components/visuals/${alias}.astro`));
    assert.match(src, new RegExp(`type Props = ComponentProps<typeof ${target}>`), alias);
    assert.match(src, new RegExp(`<${target} \\{\\.\\.\\.Astro\\.props\\} />`), alias);
  }
  assert.doesNotMatch(read(join(ROOT, 'src/components/visuals/SeatBuilder.astro')).replace(/\/\*[\s\S]*?\*\//g, ''), /<script|<form|<select|<input/);
});
