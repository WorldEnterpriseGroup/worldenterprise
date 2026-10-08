import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;

test('the hub table of contents lays its entries on fixed grid tracks, not a wrapping row', () => {
  const layout = readFileSync(`${ROOT}src/layouts/HubLayout.astro`, 'utf8');
  assert.match(layout, /<ul class="toc__list" role="list">/);
  assert.doesNotMatch(layout, /<ul class="cluster"[^>]*>\s*\{toc\.map/);

  const css = readFileSync(`${ROOT}src/styles/components.css`, 'utf8');
  const rule = /\.toc__list\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(rule, /display:\s*grid/);
  // A track has a fixed maximum, so how many entries fit on a line depends on the container and never on the width of the words.
  assert.match(rule, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*\d+rem\),\s*\d+rem\)\)/);
});
