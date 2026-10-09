import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');

function listFiles(dir: string, extension: string): string[] {
  return readdirSync(`${ROOT}${dir}`, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path, extension);
    return path.endsWith(extension) ? [path] : [];
  });
}

/** Opening `<img ...>` tags in the markup of a component, not in a comment. */
function imgTags(path: string): string[] {
  const markup = read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  return [...markup.matchAll(/<img\b(?:[^>"'{]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*>/g)].map((m) => m[0]);
}

/** Components whose image is the first thing on screen: fetchpriority="high", never lazy. The header wordmark is the other eager image. */
const LCP_FILES = new Set([
  'src/components/hero/HeroEditorial.astro',
  'src/components/hero/HeroAtlas.astro',
  'src/components/home/HomeHero.astro',
]);
const EAGER_FILES = new Set(['src/components/layout/Header.astro', 'src/components/ui/Figure.astro', 'src/components/media/AvifPicture.astro']);

test('every <img> has width, height and async decoding; only the LCP heroes are high priority and nothing else is eager', () => {
  const files = listFiles('src', '.astro');
  let seen = 0;
  for (const file of files) {
    for (const tag of imgTags(file)) {
      seen += 1;
      assert.match(tag, /\bwidth=/, `${file}: width`);
      assert.match(tag, /\bheight=/, `${file}: height`);
      assert.match(tag, /\bdecoding=(?:"async"|\{)/, `${file}: decoding`);
      if (LCP_FILES.has(file)) {
        assert.match(tag, /fetchpriority="high"/, `${file}: the LCP hero is high priority`);
        assert.doesNotMatch(tag, /loading=/, `${file}: the LCP hero is never lazy`);
      } else if (!EAGER_FILES.has(file)) {
        assert.match(tag, /loading="lazy"/, `${file}: ${tag.slice(0, 80)} is lazy`);
        assert.doesNotMatch(tag, /fetchpriority="high"/, `${file}: only the LCP heroes are high priority`);
      }
    }
  }
  assert.ok(seen >= 10, `found ${seen} <img> tags`);
});

test('high priority is confined to the three LCP heroes, the preload link, and the two components that take a priority flag', () => {
  const high = listFiles('src', '.astro').filter((file) => /fetchpriority/.test(read(file))).map((file) => relative('.', file)).sort();
  assert.deepEqual(high, [
    'src/components/home/HomeHero.astro',
    'src/components/hero/HeroAtlas.astro',
    'src/components/hero/HeroEditorial.astro',
    'src/components/media/AvifPicture.astro',
    'src/components/seo/SeoHead.astro',
    'src/components/ui/Figure.astro',
  ].sort());
  const picture = read('src/components/media/AvifPicture.astro');
  assert.match(picture, /loading=\{priority \? 'eager' : 'lazy'\}/, 'AvifPicture is lazy unless priority is set');
  assert.match(picture, /fetchpriority=\{priority \? 'high' : undefined\}/);
  assert.match(picture, /decoding="async"/, 'priority never turns decoding to sync (audit:images wants async)');
  assert.match(picture, /priority = false/, 'priority is off by default');
});

test('the heroes take an optional photo slot and the editorial hero fetches it at high priority without lazy loading', () => {
  const editorial = read('src/components/hero/HeroEditorial.astro');
  assert.match(editorial, /photo\?: SlotId/);
  assert.match(editorial, /const image = slotId \? await photoImage\(slotId\) : undefined/);
  const page = read('src/components/hero/PageHero.astro');
  assert.match(page, /photo\?: SlotId/);
  assert.match(page, /const editorial = photo !== undefined \|\| art !== undefined/, 'a page with no photo and no art gets the compact hero');
  assert.doesNotMatch(editorial, /loading="lazy"/);
});

test('only the home page passes a preload (its hero is the LCP), and the link names the type of the file it points at', () => {
  const users = listFiles('src/pages', '.astro').filter((file) => /preloadImage=/.test(read(file)));
  assert.deepEqual(users, ['src/pages/index.astro'], 'no other page preloads an image');
  assert.match(read('src/pages/index.astro'), /preloadImage=\{preloadOfPhoto\(heroImage\)\}/);
  assert.match(
    read('src/components/seo/SeoHead.astro'),
    /<link rel="preload" as="image" href=\{preloadImage\.href\} imagesrcset=\{preloadImage\.srcset\} imagesizes=\{preloadImage\.sizes\} type=\{preloadImage\.type\} fetchpriority="high" \/>/,
  );
});

test('cards and the image consumers serve the slot srcset and sizes and keep the display size as width and height', () => {
  const card = read('src/components/ui/Card.astro');
  assert.match(card, /srcset=\{image\.srcset\}/);
  assert.match(card, /sizes=\{image\.srcset === undefined \? undefined : image\.sizes\}/);
  assert.match(card, /loading="lazy" decoding="async"/);
  for (const name of ['Service', 'Article', 'Playbook', 'Brief', 'Template']) {
    const source = read(`src/components/cards/${name}Card.astro`);
    assert.match(source, /await photoImage\(photo\)/, `${name}Card builds its image with photoImage`);
    assert.match(source, /image=\{image\}/, `${name}Card hands it to Card`);
  }
  for (const path of ['src/components/services/LineAside.astro', 'src/pages/pricing/index.astro']) {
    assert.match(read(path), /await photoImage\(/, `${path} uses photoImage`);
    assert.match(read(path), /srcset=\{/, `${path} serves a srcset`);
  }
  assert.match(read('src/pages/program/who-its-for.astro'), /await photoImage\(s\.slot\)/);
});

test('photoImage uses the slot widths and sizes, and does not forward Astro priority, which would turn decoding to sync', () => {
  const source = read('src/components/media/photo-image.ts');
  assert.match(source, /widths: srcsetWidths\(spec, src\.width\)/);
  assert.match(source, /const sizes = overrides\.sizes \?\? spec\.sizes/);
  assert.match(source, /format: 'avif'/);
  assert.doesNotMatch(source, /priority/);
});
