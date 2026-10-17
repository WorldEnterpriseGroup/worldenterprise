import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FILTER_SLOTS, countLabel, filterSlots, itemClasses, slotClass } from '../../../src/components/hubs/filter.ts';

// WP-24 (#90): the script-free filter on the hubs. A radio group above the items; one `:has(:checked)` rule per slot hides every item
// outside the chosen group. These tests hold the slot model, the CSS that serves it and the pages that use it.

const root = new URL('../../../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, root), 'utf8');

test('filterSlots numbers the non-empty options in order and rejects bad keys', () => {
  const slots = filterSlots([
    { key: 'template', label: 'Templates', count: 5 },
    { key: 'empty', label: 'Nothing', count: 0 },
    { key: 'guide', label: 'Guides', count: 1 },
  ]);
  assert.deepEqual(
    slots.map((s) => [s.key, s.slot]),
    [
      ['template', 0],
      ['guide', 1],
    ],
  );
  assert.throws(() => filterSlots([{ key: 'Bad Key', label: 'x', count: 1 }]), RangeError);
  assert.throws(() => filterSlots([{ key: 'a', label: 'A', count: 1 }, { key: 'a', label: 'A again', count: 2 }]), RangeError);
  assert.throws(() => filterSlots([{ key: 'a', label: ' ', count: 1 }]), RangeError);
  const many = Array.from({ length: FILTER_SLOTS + 1 }, (_, i) => ({ key: `k${i}`, label: `K${i}`, count: 1 }));
  assert.throws(() => filterSlots(many), RangeError);
  assert.equal(filterSlots(many.slice(0, FILTER_SLOTS)).length, FILTER_SLOTS);
});

test('itemClasses marks an item for every group it belongs to, once each', () => {
  const slots = filterSlots([
    { key: 'a', label: 'A', count: 2 },
    { key: 'b', label: 'B', count: 1 },
  ]);
  assert.equal(itemClasses(slots, ['a']), 'fi-item fi-0');
  assert.equal(itemClasses(slots, ['b', 'a', 'b']), 'fi-item fi-1 fi-0');
  assert.equal(slotClass(3), 'fi-3');
  assert.throws(() => itemClasses(slots, ['missing']), RangeError);
});

test('countLabel picks the singular for one', () => {
  assert.equal(countLabel(1, 'tool', 'tools'), '1 tool');
  assert.equal(countLabel(0, 'tool', 'tools'), '0 tools');
  assert.equal(countLabel(6, 'tool', 'tools'), '6 tools');
});

test('the filter CSS has one rule per slot, starts on "All" and needs no script', () => {
  const source = read('src/components/hubs/FilterIndex.astro');
  for (let slot = 0; slot < FILTER_SLOTS; slot += 1) {
    assert.match(source, new RegExp(`fi__input--${slot}:checked`), `slot ${slot} has no :checked rule`);
  }
  assert.match(source, /type="radio" name=\{id\} value="all" checked/, '"All" is the checked default, so no-JS readers see every item');
  assert.ok(!/<script\b/.test(source), 'FilterIndex ships no script');
  assert.ok(!/\sstyle=/.test(source.replace(/<style\b[\s\S]*?<\/style>/g, '')), 'no style attribute (CSP)');
  assert.match(source, /<fieldset/, 'a native fieldset groups the radios (keyboard: Tab to the group, arrows between options)');
  assert.match(source, /<legend/, 'the group has a visible legend');
});

test('every hub that filters wires its items to the same slots', () => {
  const uses: Record<string, string> = {
    'src/pages/insights/index.astro': 'desk-filter',
    'src/pages/tools/index.astro': 'tool-filter',
    'src/pages/library/index.astro': 'kind-filter',
    'src/pages/resources/index.astro': 'stage-filter',
  };
  for (const [rel, id] of Object.entries(uses)) {
    const source = read(rel);
    assert.match(source, new RegExp(`<FilterIndex\\s+id="${id}"`), `${rel}: FilterIndex ${id}`);
    assert.match(source, /itemClasses\(/, `${rel}: items carry itemClasses()`);
    assert.match(source, /filterSlots\(/, `${rel}: slots come from filterSlots()`);
  }
});
