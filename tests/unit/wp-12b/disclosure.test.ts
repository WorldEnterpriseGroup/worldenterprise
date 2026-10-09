import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GENERATED_SOURCE, hasGeneratedImages, PHOTO_DISCLOSURE } from '../../../src/lib/photo-disclosure.ts';
import { SOURCES } from './manifest-check.ts';
import type { Manifest } from './manifest-check.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(`${ROOT}src/assets/photo/manifest.json`, 'utf8')) as Manifest;
const footer = readFileSync(`${ROOT}src/components/layout/Footer.astro`, 'utf8');

/** What the footer decides, with the same function it calls. */
const footerShowsDisclosure = (slots: readonly { source?: string }[]): boolean => hasGeneratedImages(slots);

test('the manifest uses the two source values the disclosure understands, so a typo cannot hide the line', () => {
  assert.equal(GENERATED_SOURCE, 'generated');
  assert.deepEqual([...SOURCES], ['vector', GENERATED_SOURCE]);
  for (const slot of manifest.slots) assert.ok((SOURCES as readonly string[]).includes(slot.source), `${slot.id} source "${slot.source}"`);
});

test('the disclosure renders only when a manifest slot has source "generated"', () => {
  const generated = manifest.slots.some((slot) => slot.source === 'generated');
  assert.equal(footerShowsDisclosure(manifest.slots), generated);
  assert.equal(footerShowsDisclosure(manifest.slots), false, 'phase A ships vector slots only, so the footer is unchanged');

  const vectorOnly = manifest.slots.map((slot) => ({ source: slot.source }));
  assert.equal(footerShowsDisclosure(vectorOnly), false);
  for (const id of ['svc-a', 'band-1', 'stage-build']) {
    const flipped = manifest.slots.map((slot) => ({ source: slot.id === id ? 'generated' : slot.source }));
    assert.equal(footerShowsDisclosure(flipped), true, `one generated slot (${id}) turns the line on`);
  }
  assert.equal(footerShowsDisclosure([]), false);
});

test('the footer reads the same manifest, gates the line on that decision, and renders the exact disclosure text', () => {
  assert.equal(PHOTO_DISCLOSURE, 'Illustrative images, some AI-generated. Figures shown are not real people, founders, clients or WE staff.');
  assert.match(footer, /import manifest from '\.\.\/\.\.\/assets\/photo\/manifest\.json'/);
  assert.match(footer, /const showPhotoDisclosure = hasGeneratedImages\(manifest\.slots\)/);
  const gate = footer.indexOf('showPhotoDisclosure && (');
  const line = footer.indexOf('{PHOTO_DISCLOSURE}');
  assert.ok(gate > 0 && line > gate, 'the line sits inside the gate');
  assert.equal(footer.split('{PHOTO_DISCLOSURE}').length - 1, 1, 'and nowhere else in the footer');
});
