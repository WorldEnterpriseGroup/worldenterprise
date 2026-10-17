import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BASE_STYLESHEET, INLINE_CSS_CEILING, inlineAssetLimit } from '../../../src/lib/stylesheet-inlining.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const css = (bytes: number): Buffer => Buffer.alloc(bytes, 'a');

test('the shared base chunk always stays one external, cacheable stylesheet', () => {
  assert.equal(inlineAssetLimit('_astro/BaseLayout.-GyJwJ2W.css', css(100)), false);
  assert.equal(inlineAssetLimit('/abs/dist/_astro/BaseLayout.a1B2_c3.css', css(60_000)), false);
  assert.ok(BASE_STYLESHEET.test('BaseLayout.x.css'));
  assert.ok(!BASE_STYLESHEET.test('_astro/NotBaseLayout.x.css'));
});

test('component and page chunks above the old 4 KiB default are inlined (the home LCP defect)', () => {
  // The raw sizes the five render-blocking home chunks had in pipeline 70271 (Lighthouse showed their gzip sizes, 1 to 2.5 KB).
  for (const [file, bytes] of [
    ['_astro/index.f3_gPGYT.css', 5795],
    ['_astro/Scene.C_D3hUvM.css', 11346],
    ['_astro/positions.BuVX5LeQ.css', 5217],
    ['_astro/LongHorizonTimeline.C99FPke0.css', 5259],
    ['_astro/styleguide.LQwaufOt.css', 26781],
  ] as const) {
    assert.equal(inlineAssetLimit(file, css(bytes)), true, file);
  }
  assert.equal(inlineAssetLimit('_astro/tiny.css', css(10)), true);
});

test('a chunk above the ceiling stays external instead of being copied into every page', () => {
  assert.equal(inlineAssetLimit('_astro/Huge.abc.css', css(INLINE_CSS_CEILING)), true);
  assert.equal(inlineAssetLimit('_astro/Huge.abc.css', css(INLINE_CSS_CEILING + 1)), false);
});

test('non-CSS assets are never inlined, so no data: URI needs a CSP source', () => {
  for (const file of ['hero.avif', 'font.woff2', 'chunk.js', 'icon.svg', 'image.png']) {
    assert.equal(inlineAssetLimit(file, css(10)), false, file);
  }
});

test('astro.config.mjs uses the policy with inlineStylesheets auto', () => {
  const config = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
  assert.match(config, /inlineStylesheets:\s*'auto'/);
  assert.match(config, /assetsInlineLimit:\s*inlineAssetLimit\b/);
});

/** Every built page has at most one render-blocking stylesheet: the shared base. Skipped when there is no build output. */
test('built pages link only the shared base stylesheet', { skip: !existsSync(join(ROOT, 'dist/index.html')) && 'no dist/ build' }, () => {
  const pages: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.html')) pages.push(path);
    }
  };
  walk(join(ROOT, 'dist'));
  for (const page of pages) {
    const links = [...readFileSync(page, 'utf8').matchAll(/<link\b[^>]*\brel="?stylesheet"?[^>]*>/gi)].map((m) => m[0]);
    assert.ok(links.length <= 1, `${page.slice(ROOT.length)} has ${links.length} render-blocking stylesheets: ${links.join(' ')}`);
    for (const link of links) assert.match(link, /BaseLayout\.[\w-]+\.css/, `${page.slice(ROOT.length)} links ${link}`);
  }
});
