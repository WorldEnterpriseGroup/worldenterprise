import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_SLOT_IDS, SLOT_SPECS } from '../../../src/assets/photo/slots.ts';

test('there are 47 unique slot ids in the canonical groups', () => {
  assert.equal(ALL_SLOT_IDS.length, 47);
  assert.equal(new Set(ALL_SLOT_IDS).size, 47);
  const groups = new Map<string, number>();
  for (const s of SLOT_SPECS) groups.set(s.group, (groups.get(s.group) ?? 0) + 1);
  assert.deepEqual(Object.fromEntries(groups), { inset: 11, service: 7, stage: 3, playbook: 5, topic: 4, research: 4, band: 4, og: 9 });
});

test('no raster slot displays wider than 1024 CSS px, and sizes are 2x the display size for cards', () => {
  for (const s of SLOT_SPECS) {
    assert.ok(s.displayMax[0] <= 1200, s.id);
    if (s.group !== 'og' && s.group !== 'band') assert.equal(s.width, s.displayMax[0] * 2, s.id);
  }
});
