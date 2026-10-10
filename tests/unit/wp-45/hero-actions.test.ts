import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;

// The hero action row must not change its line count when the web fonts replace the fallback fonts (layout shift on a font swap,
// seen on /program/how-it-works/ at 390 px). On a phone the row is a column, so the count of rows is the count of buttons with either font.

test('hero actions stack in a column on a phone, so a font swap cannot wrap a button', () => {
  const css = readFileSync(`${ROOT}src/styles/hero.css`, 'utf8');
  const block = /\.hero__actions\s*\{([\s\S]*?)\n  \}\n/.exec(css);
  assert.ok(block, '.hero__actions rule not found');
  const body = block[1] ?? '';
  const phone = /@media \(max-width: (\d+(?:\.\d+)?)rem\)\s*\{([^}]*)\}/.exec(body);
  assert.ok(phone, 'the phone rule of .hero__actions is missing');
  assert.ok(Number(phone[1]) >= 30, `the stack must apply at least up to 30rem (390 px is 24.4rem), got ${phone[1]}rem`);
  assert.match(phone[2] ?? '', /flex-direction:\s*column/);
  assert.match(phone[2] ?? '', /align-items:\s*stretch/);
});
