import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LOCKUP_CLEAR_SPACE, LOCKUP_GROUNDS, LOCKUP_SIZES, assertLockupGround } from '../../../src/components/brand/lockup.ts';
import { GROUNDS } from '../../../src/components/brand/types.ts';

/** D-8: the logo is dark on light only and never sits on a dark band. The rule is a pure function so it can be proven without Astro. */

test('the lockup throws on a dark ground and names the decision', () => {
  assert.throws(() => assertLockupGround('dark'), /D-8/);
  assert.throws(() => assertLockupGround('dark'), /never sits on a dark band/);
});

test('the lockup accepts light and tint', () => {
  assert.doesNotThrow(() => assertLockupGround('light'));
  assert.doesNotThrow(() => assertLockupGround('tint'));
});

test('every ground is either allowed or throws, so a new ground cannot slip through', () => {
  for (const ground of GROUNDS) {
    if (LOCKUP_GROUNDS.includes(ground)) assert.doesNotThrow(() => assertLockupGround(ground));
    else assert.throws(() => assertLockupGround(ground));
  }
  assert.deepEqual([...LOCKUP_GROUNDS], ['light', 'tint']);
});

test('clear space is one token per size and Lockup.astro uses the same tokens for artwork height and padding', () => {
  const source = readFileSync(new URL('../../../src/components/brand/Lockup.astro', import.meta.url), 'utf8');
  assert.match(source, /assertLockupGround\(ground\)/);
  assert.match(source, /padding: var\(--lockup-h\)/);
  assert.match(source, /block-size: var\(--lockup-h\)/);
  for (const size of LOCKUP_SIZES) {
    const token = LOCKUP_CLEAR_SPACE[size];
    assert.match(token, /^--sp-\d+$/);
    const rule = size === 'md' ? /--lockup-h: var\(--sp-6\)/ : new RegExp(`\\.lockup--${size} \\{\\s*--lockup-h: var\\(${token}\\)`);
    assert.match(source, rule, `${size} sets its height and clear space from ${token}`);
  }
  assert.equal(LOCKUP_CLEAR_SPACE.md, '--sp-6');
});
