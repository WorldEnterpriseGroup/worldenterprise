import assert from 'node:assert/strict';
import test from 'node:test';

// WP-22 (#88): the pure logic of the media islands. The modules define custom elements at import time, so a stand-in HTMLElement is
// installed before they load; the DOM behavior itself is covered by the Playwright specs in tests/e2e/wave8/wp-22/.

const g = globalThis as unknown as { HTMLElement?: unknown };
g.HTMLElement ??= class {};

const lightbox = await import('../../../src/scripts/media-lightbox.ts');
const carousel = await import('../../../src/scripts/media-carousel.ts');
const video = await import('../../../src/scripts/media-video.ts');

test('lightbox steps wrap around the set and jump to the ends', () => {
  const { stepIndex } = lightbox;
  assert.equal(stepIndex(0, 7, 1), 1);
  assert.equal(stepIndex(6, 7, 1), 0);
  assert.equal(stepIndex(0, 7, -1), 6);
  assert.equal(stepIndex(3, 7, 'first'), 0);
  assert.equal(stepIndex(3, 7, 'last'), 6);
  assert.equal(stepIndex(0, 0, 1), 0);
});

test('lightbox position and announcement read "n of N"', () => {
  assert.equal(lightbox.positionLabel(0, 7), '1 of 7');
  assert.equal(lightbox.announcement(2, 7, 'Year 1, launch.'), 'Image 3 of 7: Year 1, launch.');
});

test('lightbox reads each item from the link it upgrades', () => {
  const entry = lightbox.readItem({
    href: 'https://example.test/_astro/a.avif',
    dataset: { srcset: 'a.avif 1280w', width: '2560', height: '1440', alt: 'Alt', caption: 'Caption', credit: 'Rendered by WE' },
  });
  assert.deepEqual(entry, { href: 'https://example.test/_astro/a.avif', srcset: 'a.avif 1280w', width: 2560, height: 1440, alt: 'Alt', caption: 'Caption', credit: 'Rendered by WE' });
  const bare = lightbox.readItem({ href: 'x.avif', dataset: { width: 'wide', height: '-3' } });
  assert.equal(bare.srcset, undefined);
  assert.equal(bare.width, 0);
  assert.equal(bare.height, 0);
  assert.equal(bare.alt, '');
});

test('carousel status reads "Item n of N"', () => {
  assert.equal(carousel.statusLabel(0, 7), 'Item 1 of 7');
  assert.equal(carousel.statusLabel(6, 7), 'Item 7 of 7');
});

test('carousel finds the items in view and keeps a chosen item current while it is visible', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ start: i * 100, end: i * 100 + 90 }));
  assert.deepEqual(carousel.visibleRange(items, 0, 300), [0, 2]);
  assert.deepEqual(carousel.visibleRange(items, 150, 480), [2, 4]);
  assert.deepEqual(carousel.visibleRange(items, 400, 700), [4, 6]);
  assert.deepEqual(carousel.visibleRange([], 0, 300), [-1, -1]);
  assert.equal(carousel.pickCurrent(6, [4, 6]), 6, 'item 7 chosen at the end stays current');
  assert.equal(carousel.pickCurrent(1, [4, 6]), 4, 'an item scrolled away gives way to the first in view');
  assert.equal(carousel.pickCurrent(3, [-1, -1]), 3);
});

test('pauseAll pauses only the videos that are playing', () => {
  const make = (paused: boolean): { paused: boolean; pause(): void } => ({
    paused,
    pause() {
      this.paused = true;
    },
  });
  const videos = [make(false), make(true), make(false)];
  const root = { querySelectorAll: () => videos } as unknown as ParentNode;
  assert.equal(video.pauseAll(root), 2);
  assert.ok(videos.every((v) => v.paused));
  assert.equal(video.pauseAll(root), 0);
});
