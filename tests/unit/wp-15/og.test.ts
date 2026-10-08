import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ogSlotForPath } from '../../../src/components/media/OgMap.ts';
import { routes } from '../../../src/data/routes.ts';
import { SLOT_SPECS } from '../../../src/assets/photo/slots.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

test('every route maps to a card slot that exists', () => {
  const known = new Set<string>(SLOT_SPECS.map((spec) => spec.id));
  for (const route of routes) {
    const slot = ogSlotForPath(route.path);
    assert.ok(known.has(slot), `${route.path} maps to unknown slot ${slot}`);
    assert.match(slot, /^og-/, `${route.path} maps to ${slot}, which is not an Open Graph card`);
  }
});

test('section routes get their own card and the rest get the default card', () => {
  assert.equal(ogSlotForPath('/'), 'og-home');
  assert.equal(ogSlotForPath('/program/dream/'), 'og-program');
  assert.equal(ogSlotForPath('/services/'), 'og-services');
  assert.equal(ogSlotForPath('/playbooks/'), 'og-playbooks');
  assert.equal(ogSlotForPath('/library/one-page-problem-brief/'), 'og-resources');
  assert.equal(ogSlotForPath('/insights/'), 'og-default');
  assert.equal(ogSlotForPath('/trust/'), 'og-default');
});

test('BaseLayout falls back to the section card instead of a fixed default', () => {
  const layout = readFileSync(`${ROOT}src/layouts/BaseLayout.astro`, 'utf8');
  assert.match(layout, /ogSlotForPath\(path\)/);
  assert.doesNotMatch(layout, /ogSlot\s*=\s*'og-default'/);
});
