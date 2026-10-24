import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// WP-51 (issue #72, W9-4, W9-7): the wave 9 layout foundation that the family packages build on. The names here are the contract in
// docs/wave9-contracts.md; a rename breaks this test before it breaks a family page.

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');
const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const tokens = strip(read('src/styles/tokens.css'));
const layout = strip(read('src/styles/layout.css'));
const hero = strip(read('src/styles/hero.css'));

test('the content frame is 110rem and every container uses it through --page-max', () => {
  assert.match(tokens, /--content-max:\s*110rem;/);
  assert.match(tokens, /--page-max:\s*var\(--content-max\);/);
  assert.match(tokens, /--prose-max:\s*clamp\(46rem,[^;]*57rem\);/, 'the reading column holds 46rem and grows to 57rem only together with the reading type');
  assert.match(tokens, /--split-text:\s*40rem;/);
  assert.match(layout, /\.container\s*\{\s*inline-size:\s*min\(100% - 2 \* var\(--gutter\), var\(--page-max\)\);/);
});

test('the gutter and the band padding are fluid: 16px on a phone, 80px and 128px at 1920', () => {
  const resolve = (name: string, vw: number): number => {
    const m = new RegExp(`${name}:\\s*clamp\\(([\\d.]+)rem,\\s*([\\d.]+)rem \\+ ([\\d.]+)vw,\\s*([\\d.]+)rem\\)`).exec(tokens);
    assert.ok(m, `${name} is a clamp()`);
    const [min, b, s, max] = m.slice(1).map(Number) as [number, number, number, number];
    return Math.min(Math.max(b * 16 + (s / 100) * vw, min * 16), max * 16);
  };
  assert.equal(resolve('--gutter', 320), 16);
  assert.ok(Math.abs(resolve('--gutter', 1920) - 80) < 0.5, 'gutter at 1920');
  assert.ok(Math.abs(resolve('--band-pad', 1920) - 128) < 0.5, 'band padding at 1920');
  // 1760px of frame plus two 80px gutters is exactly 1920: no empty side bands on a full-HD screen.
  assert.equal(110 * 16 + 2 * resolve('--gutter', 1920), 1920);
});

test('the full-bleed primitives exist under the contract names', () => {
  for (const selector of ['.band', '.band--soft', '.band--tint-blue', '.band--tint-sand', '.band--tint-stone', '.band--deep', '.split', '.split--reverse', '.split--even', '.split--media-first', '.bleed-media', '.bleed-media--start']) {
    assert.ok(new RegExp(`${selector.replace(/[.-]/g, '\\$&')}(?![\\w-])`).test(layout), `${selector} is defined in layout.css`);
  }
  assert.match(layout, /\.band\s*\{[^}]*overflow-x:\s*clip/, 'a band clips its bleeding media');
  assert.match(layout, /:is\(\.flow-wide, \.prose\) :where\(p,[^)]*\)[^{]*\{\s*max-inline-size:\s*min\(var\(--prose-max\), 76ch\)/, 'reading text keeps its measure in the wide frame, small type included');
  assert.doesNotMatch(layout + tokens, /container--wide|--page-wide/);
});

test('a dark band re-points the text tokens to the deep tokens, whose contrast pairs are annotated', () => {
  for (const pair of ['color-band-deep-text color-band-deep-bg', 'color-band-deep-muted color-band-deep-bg', 'color-band-deep-link color-band-deep-bg']) {
    assert.match(read('src/styles/tokens.css'), new RegExp(`@pair ${pair} 4\\.5`), `${pair} is audited`);
  }
  for (const token of ['--color-text', '--color-text-muted', '--color-link', '--color-focus']) {
    assert.match(layout, new RegExp(`\\.band--deep\\s*\\{[^}]*${token}:\\s*var\\(`), `.band--deep sets ${token}`);
  }
});

test('the layouts and shared components expose the additive wave 9 props', () => {
  const marketing = read('src/layouts/MarketingLayout.astro');
  assert.match(marketing, /width\?: 'content' \| 'prose';/);
  assert.match(marketing, /width = 'content'/, 'MarketingLayout defaults to the wide frame');
  assert.match(marketing, /'container flow-wide prose'/);
  assert.match(read('src/components/ui/Section.astro'), /deep: 'section--soft section--tinted band--deep'/);
  assert.match(read('src/components/ui/Prose.astro'), /width\?: 'prose' \| 'content';/);
  assert.match(read('src/components/hero/HeroEditorial.astro'), /frame\?: 'default' \| 'wide';/);
  assert.match(read('src/components/hero/types.ts'), /HERO_MODES = \[[^\]]*'scene'/);
  assert.match(hero, /@media \(min-width: 100rem\)\s*\{\s*grid-template-columns:\s*minmax\(0, 5fr\) minmax\(0, 7fr\)/);
});

test('ArticleLayout and BriefLayout take an optional aside slot in the rail, and an article with no related items has no related section', () => {
  const article = read('src/layouts/ArticleLayout.astro');
  const brief = read('src/layouts/BriefLayout.astro');
  assert.match(article, /Astro\.slots\.has\('aside'\)/);
  assert.match(article, /\(toc\.length > 0 \|\| hasAside\) && \(\s*<aside class="rail"/);
  assert.match(article, /<slot name="aside" \/>\s*<\/aside>/);
  assert.match(article, /related\.length > 0 && \(\s*<div class="section section--soft section--defer">/);
  assert.match(brief, /<MethodologyBox[^>]*\/>\s*<slot name="aside" \/>\s*<\/aside>/);
});

test('above 1920 the root font size scales with the window, and never drops below the reader\'s own size', () => {
  assert.match(tokens, /--root-size:\s*max\(100%, 100vw \/ 120\);/, '16px at 1920, 32px at 3840, the browser default below');
  assert.match(strip(read('src/styles/base.css')), /html\s*\{\s*font-size:\s*var\(--root-size\);/);
  // A breakpoint in rem or em uses the initial font size, so scaling the root moves none of them; a px breakpoint would not scale either.
  for (const file of ['tokens.css', 'base.css', 'layout.css', 'hero.css', 'utilities.css']) {
    const css = strip(read(`src/styles/${file}`));
    for (const block of css.match(/(?:^|[\s,}])html\s*\{[^}]*\}/g) ?? []) {
      for (const [, value] of block.matchAll(/font-size:\s*([^;]+);/g)) assert.equal(value.trim(), 'var(--root-size)', `${file} sets no other root font size`);
    }
  }
});
