import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;

// The hero action row must not change its line count when the web fonts replace the fallback fonts (layout shift on a font swap, seen
// on /program/how-it-works/ at 412 px). The row is laid out by the width of its container, never by the width of its labels:
// .hero__actions is an inline-size container and .hero__actions-row stacks its buttons in a column below a container width that no
// label pair reaches under either font. The e2e check (wave7/wp-45/hero-actions.spec.ts) measures the result; this pins the rule.

const css = readFileSync(`${ROOT}src/styles/hero.css`, 'utf8');
const markup = readFileSync(`${ROOT}src/components/hero/HeroActions.astro`, 'utf8');

test('the hero actions are an inline-size container named hero-actions', () => {
  const block = /\.hero__actions\s*\{([^}]*)\}/.exec(css);
  assert.ok(block, '.hero__actions rule not found');
  assert.match(block[1] ?? '', /container:\s*hero-actions\s*\/\s*inline-size/);
});

test('the row stacks in a column at 42rem or less of container width, full width on a phone', () => {
  const row = /\.hero__actions-row\s*\{([\s\S]*?)\n  \}\n/.exec(css);
  assert.ok(row, '.hero__actions-row rule not found');
  const body = row[1] ?? '';
  const queries = [...body.matchAll(/@container hero-actions \(max-width: (\d+(?:\.\d+)?)rem\)\s*\{([^}]*)\}/g)];
  const stack = queries.find((q) => /flex-direction:\s*column/.test(q[2] ?? ''));
  assert.ok(stack, 'the column rule of .hero__actions-row is missing');
  assert.ok(Number(stack[1]) >= 42, `the stack must apply at least up to 42rem (the widest label pair is about 600 px), got ${stack[1]}rem`);
  assert.match(stack[2] ?? '', /flex-wrap:\s*nowrap/);
  const phone = queries.find((q) => /align-items:\s*stretch/.test(q[2] ?? ''));
  assert.ok(phone, 'the full-width rule for a phone is missing');
  assert.ok(Number(phone[1]) >= 24.5, `the full-width rule must cover a 390 px phone, got ${phone[1]}rem`);
});

test('the actions are not tied to the viewport width', () => {
  const block = /\.hero__actions-row\s*\{([\s\S]*?)\n  \}\n/.exec(css);
  assert.ok(block, '.hero__actions-row rule not found');
  assert.doesNotMatch(block[1] ?? '', /@media/, 'the row must be laid out by its container, not by a viewport query');
});

test('every action sits inside the row, and the row inside the container', () => {
  const container = markup.indexOf('class="hero__actions"');
  const row = markup.indexOf('class="hero__actions-row"');
  assert.ok(container >= 0 && row > container, 'the row must be a child of the container');
  for (const marker of ['data-hero-action="primary"', 'data-hero-action="secondary"', '<slot />']) {
    assert.ok(markup.indexOf(marker) > row, `${marker} must be inside the row`);
  }
});
