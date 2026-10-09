import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as imagesAudit from '../../../scripts/audit-images.mjs';
import * as html from '../../../scripts/lib/html.mjs';
import { imageMediaType, preloadOf, preloadOfPhoto } from '../../../src/lib/image-type.ts';
import { cleanSite, makeDist, page } from '../shared/fixture-dist.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
interface Page {
  readonly route: string;
  readonly file: string;
  readonly html: string;
}

const readPages = (html as unknown as { readPages(root: string): Page[] }).readPages;
const auditMarkup = (imagesAudit as unknown as { auditMarkup(o: { root: string; pages: Page[] }): { findings: Finding[] } }).auditMarkup;

const IMG = '<img src="/_astro/hero.avif" alt="A model of three stages on a table" width="1024" height="576" fetchpriority="high" decoding="async">';

function audit(head: string, body = `<h1>Home</h1>${IMG}`): string {
  const root = makeDist({ ...cleanSite(), 'index.html': page({ head, body }), '_astro/hero.avif': 1000 });
  return auditMarkup({ root, pages: readPages(root) })
    .findings.filter((f) => f.level === 'error')
    .map((f) => f.message)
    .join('\n');
}

test('imageMediaType names the type of each format Astro can report, and throws for anything else', () => {
  assert.equal(imageMediaType('avif'), 'image/avif');
  assert.equal(imageMediaType('svg'), 'image/svg+xml');
  assert.equal(imageMediaType('jpg'), 'image/jpeg');
  assert.equal(imageMediaType('JPEG'), 'image/jpeg');
  assert.throws(() => imageMediaType('bmp'), /No media type is known for the image format "bmp"/);
});

test('preloadOf takes the type from the imported image, not from the caller', () => {
  assert.deepEqual(preloadOf({ src: '/_astro/hero.1a2b3c.avif', format: 'avif' }), { href: '/_astro/hero.1a2b3c.avif', type: 'image/avif' });
  assert.deepEqual(preloadOf({ src: '/_astro/hex.svg', format: 'svg' }), { href: '/_astro/hex.svg', type: 'image/svg+xml' });
});

test('preloadOfPhoto carries the srcset and sizes of a responsive photo, and a vector slot gets a plain preload', () => {
  const raster = { src: '/_astro/hero.1a2b3c.avif', format: 'avif', srcset: '/_astro/hero.640.avif 640w, /_astro/hero.1a2b3c.avif 1024w', sizes: '(min-width: 62rem) 32rem, 100vw' };
  assert.deepEqual(preloadOfPhoto(raster), { href: raster.src, type: 'image/avif', srcset: raster.srcset, sizes: raster.sizes });
  const vector = { src: '/_astro/hex.svg', format: 'svg', srcset: undefined, sizes: '100vw' };
  assert.deepEqual(preloadOfPhoto(vector), { href: '/_astro/hex.svg', type: 'image/svg+xml' });
  assert.throws(() => preloadOfPhoto({ ...raster, format: 'bmp' }), /No media type is known/);
});

test('the home page derives its hero preload from the same photoImage() result the hero renders', () => {
  const home = readFileSync(`${ROOT}src/pages/index.astro`, 'utf8');
  assert.match(home, /const heroImage = await photoImage\('band-1'\);/);
  assert.match(home, /preloadImage=\{preloadOfPhoto\(heroImage\)\}/);
  assert.match(home, /<HomeHero image=\{heroImage\}/);
  assert.doesNotMatch(home, /image\/svg\+xml/);
});

test('audit:images accepts a preload whose type matches the file and whose image the page uses', () => {
  assert.equal(audit('<link rel="preload" as="image" href="/_astro/hero.avif" type="image/avif" fetchpriority="high">'), '');
});

const SRCSET = '/_astro/hero.640.avif 640w, /_astro/hero.avif 1024w';
const SIZES = '(min-width: 62rem) 32rem, 100vw';
const RESPONSIVE_IMG = `<img src="/_astro/hero.avif" srcset="${SRCSET}" sizes="${SIZES}" alt="A model of three stages on a table" width="1024" height="576" fetchpriority="high" decoding="async">`;

function auditResponsive(head: string): string {
  const root = makeDist({ ...cleanSite(), 'index.html': page({ head, body: `<h1>Home</h1>${RESPONSIVE_IMG}` }), '_astro/hero.avif': 1000, '_astro/hero.640.avif': 800 });
  return auditMarkup({ root, pages: readPages(root) })
    .findings.filter((f) => f.level === 'error')
    .map((f) => f.message)
    .join('\n');
}

test('audit:images accepts a responsive preload whose imagesrcset and imagesizes are the <img> srcset and sizes', () => {
  assert.equal(auditResponsive(`<link rel="preload" as="image" href="/_astro/hero.avif" imagesrcset="${SRCSET}" imagesizes="${SIZES}" type="image/avif" fetchpriority="high">`), '');
});

test('audit:images rejects a responsive preload whose imagesrcset or imagesizes differ from the <img> (negative proof: two fetches)', () => {
  const twice = /preload imagesrcset and imagesizes match no <img> srcset and sizes on the page/;
  assert.match(auditResponsive(`<link rel="preload" as="image" href="/_astro/hero.avif" imagesrcset="/_astro/hero.avif 1024w" imagesizes="${SIZES}" type="image/avif">`), twice);
  assert.match(auditResponsive(`<link rel="preload" as="image" href="/_astro/hero.avif" imagesrcset="${SRCSET}" imagesizes="100vw" type="image/avif">`), twice);
  assert.match(auditResponsive(`<link rel="preload" as="image" href="/_astro/hero.avif" imagesrcset="${SRCSET}" type="image/avif">`), twice);
});

test('audit:images rejects a preload that declares the wrong type for its file (negative proof)', () => {
  assert.match(audit('<link rel="preload" as="image" href="/_astro/hero.avif" type="image/svg+xml">'), /declares type "image\/svg\+xml" for a \.avif file \(expected "image\/avif"\)/);
});

test('audit:images rejects a preload that no <img> on the page uses (negative proof)', () => {
  assert.match(audit('<link rel="preload" as="image" href="/_astro/other.avif" type="image/avif">'), /preloaded image is not used by any <img>/);
});

test('the first-viewport images load at high priority from the hero, and the pages no longer render a second one', () => {
  // WP-17 moved the program, playbooks, fundability, apply, contact and stage images into the hero `photo` slot.
  const hero = readFileSync(`${ROOT}src/components/hero/HeroEditorial.astro`, 'utf8');
  const images = hero.match(/<img\b[^>]*>/g) ?? [];
  assert.ok(images.length > 0, 'HeroEditorial renders the photo');
  for (const image of images) {
    assert.match(image, /fetchpriority="high"/, image);
    assert.doesNotMatch(image, /loading="lazy"/, image);
    assert.match(image, /decoding="async"/, image);
  }
  for (const file of [
    'src/pages/program/index.astro',
    'src/pages/playbooks/index.astro',
    'src/pages/fundability/index.astro',
    'src/pages/apply/index.astro',
    'src/pages/contact/index.astro',
    'src/components/program/StageBody.astro',
  ]) {
    assert.doesNotMatch(readFileSync(`${ROOT}${file}`, 'utf8'), /<img\b/, `${file} opens with the hero image, so its body renders no second image`);
  }
});
