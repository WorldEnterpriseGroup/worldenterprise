import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { displayAttributes, srcsetWidths } from '../../../src/assets/photo/responsive.ts';
import { SLOT_SPECS } from '../../../src/assets/photo/slots.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');

/** The `<img>` every LCP hero carries: the slot srcset and sizes, the display size, high priority and no `loading`. */
const LCP_IMG =
  /<img src=\{image\.src\} srcset=\{image\.srcset\} sizes=\{image\.srcset === undefined \? undefined : image\.sizes\} width=\{image\.width\} height=\{image\.height\} alt=\{image\.alt\} fetchpriority="high" decoding="async" \/>/;

test('the three hero components render the responsive LCP image and never the bare master', () => {
  for (const path of ['src/components/hero/HeroEditorial.astro', 'src/components/hero/HeroAtlas.astro', 'src/components/home/HomeHero.astro']) {
    const source = read(path);
    assert.match(source, LCP_IMG, `${path}: srcset, sizes, display size and high priority`);
    assert.doesNotMatch(source, /image\.src\.src|getPhoto\(/, `${path}: no bare master`);
    assert.doesNotMatch(source, /loading=/, `${path}: the LCP image is never lazy`);
  }
  assert.match(read('src/components/hero/HeroEditorial.astro'), /await photoImage\(slotId\)/);
  assert.match(read('src/components/hero/HeroAtlas.astro'), /await photoImage\(photo\)/);
});

test('the home page builds its hero image once, renders it and preloads exactly that srcset and sizes', () => {
  const home = read('src/pages/index.astro');
  assert.equal(home.match(/photoImage\('band-1'\)/g)?.length, 1, 'the LCP image is built in one place');
  assert.match(home, /<HomeHero image=\{heroImage\}/);
  assert.match(home, /preloadImage=\{preloadOfPhoto\(heroImage\)\}/);
  assert.match(read('src/components/home/HomeHero.astro'), /image: PhotoImage;/);
  const head = read('src/components/seo/SeoHead.astro');
  assert.match(head, /imagesrcset=\{preloadImage\.srcset\}/);
  assert.match(head, /imagesizes=\{preloadImage\.sizes\}/);
});

test('the home band is a lazy responsive image from the band-4 slot', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /const band = await photoImage\('band-4'\);/);
  assert.match(
    home,
    /<img class="home-band" src=\{band\.src\} srcset=\{band\.srcset\} sizes=\{band\.srcset === undefined \? undefined : band\.sizes\} width=\{band\.width\} height=\{band\.height\} alt=\{band\.alt\} loading="lazy" decoding="async" \/>/,
  );
});

test('the home hero slots ship a narrower variant besides the 1024 master, and the display size stays 1024x576', () => {
  for (const id of ['band-1', 'band-4']) {
    const spec = SLOT_SPECS.find((s) => s.id === id);
    assert.ok(spec, `${id} exists`);
    assert.deepEqual(srcsetWidths(spec, spec.width), [640, 1024], `${id}: the 640 variant is built from the master at build time`);
    assert.deepEqual(displayAttributes(spec, spec.width, spec.height), { width: 1024, height: 576 }, `${id}: display size`);
    assert.match(spec.sizes, /100vw/, `${id}: a phone gets the full width`);
  }
});

test('photoImage reports the format of its files so a preload can name the right type', () => {
  const source = read('src/components/media/photo-image.ts');
  assert.match(source, /format: 'svg'/);
  assert.match(source, /format: 'avif'/);
});
