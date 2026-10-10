import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * src/styles/motion.css (WP-45 finding, closed by WP-60; docs/wave7-handoff.md). The build folds `animation` plus `animation-timeline` into one
 * shorthand that an engine without a timeline-aware shorthand drops whole, so every scroll-driven rule spells its animation as longhands. The
 * reveal moves and never fades, so axe never measures a contrast while a heading is at partial opacity.
 */
const motion = readFileSync(join(new URL('../../../', import.meta.url).pathname, 'src', 'styles', 'motion.css'), 'utf8');

test('every scroll-driven animation is written as longhands, never an `animation` shorthand', () => {
  assert.ok(motion.includes('animation-timeline'), 'the file still drives animation from a timeline');
  assert.deepEqual(motion.match(/^\s*animation:\s.*$/gm) ?? [], []);
  const names = motion.match(/^\s*animation-name:/gm) ?? [];
  const timelines = motion.match(/^\s*animation-timeline:/gm) ?? [];
  assert.equal(names.length, timelines.length, 'each timeline has a name beside it');
});

test('the reveal keyframes move and never fade', () => {
  const block = /@keyframes we-reveal\s*\{([\s\S]*?\}\s*\})/.exec(motion)?.[1] ?? '';
  assert.match(block, /transform/);
  assert.doesNotMatch(block, /opacity/);
});
