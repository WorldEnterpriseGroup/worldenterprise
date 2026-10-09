import assert from 'node:assert/strict';
import test from 'node:test';
import { displayAttributes, srcsetWidths } from '../../../src/assets/photo/responsive.ts';
import { SLOT_SPECS } from '../../../src/assets/photo/slots.ts';

test('every slot ships widths that end at its master and never exceed it', () => {
  for (const spec of SLOT_SPECS) {
    assert.ok(spec.widths.length > 0, spec.id);
    assert.equal(Math.max(...spec.widths), spec.group === 'og' ? 1200 : spec.width, `${spec.id} widest width is the master`);
    assert.deepEqual([...spec.widths].sort((a, b) => a - b), [...spec.widths], `${spec.id} widths ascend`);
    assert.ok(spec.widths.every((w) => w <= spec.width), `${spec.id} offers no width above the master`);
  }
});

test('each profile has its own srcset: cards 512/768/1024, landscape 512/1024, 16:9 bands 640/1024 at the 1K master', () => {
  const widthsOf = (id: string): readonly number[] => SLOT_SPECS.find((s) => s.id === id)?.widths ?? [];
  assert.deepEqual(widthsOf('svc-a'), [512, 768, 1024]);
  assert.deepEqual(widthsOf('topic-dream'), [512, 1024]);
  assert.deepEqual(widthsOf('band-1'), [640, 1024]);
  assert.deepEqual(widthsOf('band-4'), [640, 1024]);
  assert.deepEqual(widthsOf('og-home'), [1200]);
});

test('every slot has a sizes attribute for its layout, and cards size to their display width', () => {
  for (const spec of SLOT_SPECS) assert.ok(spec.sizes.length > 0, `${spec.id} has sizes`);
  const sizesOf = (id: string): string => SLOT_SPECS.find((s) => s.id === id)?.sizes ?? '';
  assert.equal(sizesOf('svc-a'), '(min-width: 36rem) 512px, 100vw');
  assert.equal(sizesOf('topic-dream'), '(min-width: 36rem) 512px, 100vw');
  assert.equal(sizesOf('stage-dream'), '(min-width: 36rem) 26rem, 100vw');
  assert.equal(sizesOf('inset-program'), '(min-width: 62rem) 32rem, 100vw');
  assert.equal(sizesOf('band-1'), '(min-width: 62rem) 32rem, 100vw');
  assert.equal(sizesOf('band-4'), '(min-width: 64rem) 1024px, 100vw');
});

test('srcsetWidths drops widths the file cannot serve and always ends at the file width', () => {
  assert.deepEqual(srcsetWidths({ widths: [512, 768, 1024] }, 1024), [512, 768, 1024]);
  assert.deepEqual(srcsetWidths({ widths: [640, 1024, 1536, 2048] }, 1024), [640, 1024]);
  assert.deepEqual(srcsetWidths({ widths: [512, 768, 1024] }, 800), [512, 768, 800]);
  assert.deepEqual(srcsetWidths({ widths: [512, 1024] }, 512), [512]);
});

test('width and height attributes are the display size, so cards land in the 60 KB budget and bands in the 120 KB one', () => {
  const card = SLOT_SPECS.find((s) => s.id === 'svc-a');
  const band = SLOT_SPECS.find((s) => s.id === 'band-4');
  assert.ok(card && band);
  assert.deepEqual(displayAttributes(card, 1024, 768), { width: 512, height: 384 });
  assert.deepEqual(displayAttributes(band, 1024, 576), { width: 1024, height: 576 });
  assert.deepEqual(displayAttributes(card, 400, 300), { width: 400, height: 300 }, 'a file narrower than the display keeps its own size');
  for (const spec of SLOT_SPECS.filter((s) => s.group !== 'og')) {
    const { width, height } = displayAttributes(spec, spec.width, spec.height);
    assert.ok(width <= 1024, `${spec.id} attribute is within the 1024 cap`);
    assert.equal(Math.abs(width / height - spec.width / spec.height) < 0.01, true, `${spec.id} keeps its aspect`);
  }
});
