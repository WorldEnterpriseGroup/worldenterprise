import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findDenied } from '../../../src/components/visuals/contracts.ts';

// WP-22 (#88): source rules for the media components and their islands. The strict CSP (no inline style or script), the image audit
// (width, height, lazy loading, async decoding), the media rules (no autoplay, preload none, a captions track, a transcript) and the
// copy rules are checked on the files themselves, before any build.

const root = new URL('../../../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, root), 'utf8');

const COMPONENTS = [
  'src/components/media/CaptionedVideo.astro',
  'src/components/media/LightboxGallery.astro',
  'src/components/media/Carousel.astro',
  'src/components/media/DecadeFilm.astro',
  'src/components/media/DecadeCarousel.astro',
  'src/components/media/WorldsGallery.astro',
];
const SCRIPTS = ['src/scripts/media-video.ts', 'src/scripts/media-lightbox.ts', 'src/scripts/media-carousel.ts'];

/** The template of an .astro file: everything after the frontmatter, without <style> and <script> blocks. */
function template(source: string): string {
  const body = source.replace(/^---[\s\S]*?\n---\n/, '');
  return body.replace(/<style\b[\s\S]*?<\/style>/g, '').replace(/<script\b[\s\S]*?<\/script>/g, '');
}

test('no inline style attributes, no fetchpriority, no inline event handlers', () => {
  for (const rel of COMPONENTS) {
    const source = read(rel);
    const markup = template(source);
    assert.ok(!/\sstyle=/.test(markup), `${rel}: style attribute`);
    assert.ok(!/fetchpriority/i.test(source), `${rel}: fetchpriority`);
    assert.ok(!/\son[a-z]+=/.test(markup), `${rel}: inline handler`);
  }
});

test('island scripts are bundled modules imported by the component, never inline code', () => {
  const pairs: Record<string, string> = {
    'src/components/media/CaptionedVideo.astro': 'defineWeVideo',
    'src/components/media/LightboxGallery.astro': 'defineWeLightbox',
    'src/components/media/Carousel.astro': 'defineWeCarousel',
  };
  for (const [rel, fn] of Object.entries(pairs)) {
    const scripts = [...read(rel).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, rel);
    const [, attrs, body] = scripts[0] ?? [];
    assert.ok(!/is:inline/.test(attrs ?? ''), `${rel}: no is:inline`);
    assert.match(body ?? '', new RegExp(`import \\{ ${fn} \\} from '\\.\\./\\.\\./scripts/media-[a-z]+\\.ts';\\s*${fn}\\(\\);`));
  }
});

test('every <img> carries width, height, lazy loading and async decoding', () => {
  for (const rel of COMPONENTS) {
    for (const [tag] of template(read(rel)).matchAll(/<img\b[\s\S]*?\/?>/g)) {
      for (const attr of ['width=', 'height=', 'alt=', 'loading="lazy"', 'decoding="async"']) assert.ok(tag.includes(attr), `${rel}: ${attr} in ${tag}`);
    }
  }
});

test('the video never autoplays, fetches nothing before play, and has captions and a transcript', () => {
  const markup = template(read('src/components/media/CaptionedVideo.astro'));
  const video = /<video\b[\s\S]*?>/.exec(markup)?.[0] ?? '';
  assert.match(video, /preload="none"/);
  assert.match(video, /\scontrols\b/);
  assert.match(video, /poster=/);
  assert.match(video, /width=\{width\}/);
  assert.match(video, /height=\{height\}/);
  assert.ok(!/autoplay/i.test(markup), 'no autoplay');
  assert.ok(!/\bloop\b/.test(video), 'no loop');
  assert.match(markup, /<track kind="captions"/);
  assert.match(markup, /<details class="cvideo__transcript">/);
  assert.match(markup, /<time datetime=/);
  assert.match(markup, /download=\{downloadName\}/);
  assert.ok(markup.indexOf('video/webm') < markup.indexOf('video/mp4'), 'AV1 WebM is offered before the MP4');
  assert.ok(!/\.play\(/.test(read('src/scripts/media-video.ts')), 'the island never starts playback');
});

test('the gallery is an ordered list of real links, and the viewer is a native dialog', () => {
  const markup = template(read('src/components/media/LightboxGallery.astro'));
  assert.match(markup, /<ol class="lightbox__grid"/);
  assert.match(markup, /<a\s+class="lightbox__link"\s+href=\{item\.full\.src\}/);
  assert.match(markup, /<dialog class="lightbox__dialog"[^>]*closedby="any"/);
  assert.match(markup, /aria-live="polite"/);
  for (const hook of ['data-prev', 'data-next', 'data-close', 'data-position']) assert.ok(markup.includes(hook), hook);
  assert.ok(!/<dialog[\s\S]*<img/.test(markup), 'no server-rendered image inside the closed viewer');
  assert.ok(/<button type="button"/.test(markup));
});

test('the carousel is an ordered list with hidden-until-ready controls and no autoplay', () => {
  const source = read('src/components/media/Carousel.astro');
  const markup = template(source);
  assert.match(markup, /<ol class="carousel__track"[^>]*tabindex="0"/);
  assert.match(markup, /aria-roledescription="carousel"/);
  assert.match(markup, /data-controls hidden/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(source, /scroll-snap-type: x mandatory/);
  assert.match(source, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.carousel__track \{\s*scroll-behavior: smooth;/);
  assert.match(source, /@supports selector\(::scroll-marker\)/);
  assert.match(source, /@supports selector\(::scroll-button\(\*\)\)/);
  const script = read('src/scripts/media-carousel.ts');
  assert.ok(!/setInterval/.test(script), 'no autoplay timer');
  assert.ok(!/behavior:\s*'smooth'/.test(script), 'the script never forces smooth scrolling');
});

test('islands build DOM without innerHTML and pass the copy rules', () => {
  for (const rel of SCRIPTS) {
    const source = read(rel);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(source), `${rel}: no HTML strings`);
    for (const [, text] of source.matchAll(/'([^'\n]{12,})'/g)) assert.equal(findDenied(text ?? ''), null, `${rel}: ${text}`);
  }
  for (const rel of COMPONENTS) {
    const prose = template(read(rel)).replace(/<[^>]+>/g, ' ').replace(/\{[^}]*\}/g, ' ');
    assert.equal(findDenied(prose), null, rel);
  }
});

test('the placements are additive: /about/ keeps its bands, /network/ keeps its sections', () => {
  const about = read('src/pages/about/index.astro');
  for (const id of ['id="worlds"', 'id="flight"', 'id="team"', 'id="plain"', 'id="decade"']) assert.ok(about.includes(id), `/about/ ${id}`);
  assert.match(about, /<DecadeFilm id="about-film" \/>/);
  assert.match(about, /<DecadeCarousel id="about-milestones"/);
  const network = read('src/pages/network/index.astro');
  for (const id of ['id="network-parts"', 'id="network-path"', 'id="network-worlds"']) assert.ok(network.includes(id), `/network/ ${id}`);
  assert.match(network, /<WorldsGallery id="network-worlds-gallery"/);
});
