import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as copy from '../../../src/data/ecosystem/copy.ts';
import { CATEGORIES, countByCategory } from '../../../src/data/ecosystem/index.ts';
import { CATEGORY_IDS } from '../../../src/data/ecosystem/types.ts';

/**
 * WP-33 follow-up (issue #93): the /ecosystem/ hub was 55,192 px tall at 390 px because it printed all 67 programs in full. Each
 * category now shows a few compact rows and keeps its full list in a native <details>, so every program, anchor and filter hook stays
 * in the DOM and the page works without JavaScript. These checks pin the markup contract the filter script and the e2e suite rely on.
 */
const root = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${root}${path}`, 'utf8');

test('every category has a mid-sentence list name and a full-list label that names its count', () => {
  for (const id of CATEGORY_IDS) {
    const name = copy.CATEGORY_LIST_NAMES[id];
    assert.ok(name.length > 3, `${id}: list name`);
    assert.doesNotMatch(name, /^[A-Z][a-z]/, `${id}: the list name is mid-sentence, so it starts lower case unless it is an acronym`);
  }
  assert.equal(copy.ALL_IN_CATEGORY(20, copy.CATEGORY_LIST_NAMES['launch-programs']), 'All 20 accelerators and cohort programs');
  assert.equal(copy.ALL_IN_CATEGORY(9, copy.CATEGORY_LIST_NAMES.sba), 'All 9 SBA resource partners');
});

test('the preview is short and every category has more programs than it previews', () => {
  assert.equal(copy.PREVIEW_COUNT, 3);
  const counts = countByCategory();
  for (const c of CATEGORIES) assert.ok(counts[c.id] > copy.PREVIEW_COUNT, `${c.id} has only ${counts[c.id]} programs`);
});

test('the hub keeps each full list in a native <details> and previews compact rows the filter does not count', () => {
  const hub = read('src/pages/ecosystem/index.astro');
  assert.match(hub, /<details class="eco-group__all" data-eco-more>/);
  assert.match(hub, /<summary>\{ALL_IN_CATEGORY\(counts\[c\.id\], CATEGORY_LIST_NAMES\[c\.id\]\)\}<\/summary>/);
  assert.match(hub, /<EntryList entries=\{entriesIn\(c\.id\)\} level=\{4\} idPrefix="p-" \/>/, 'the full list carries the p- anchors');
  assert.match(hub, /data-eco-preview/);
  assert.match(hub, /idPrefix="top-"[\s\S]*?compact[\s\S]*?filterable=\{false\}/, 'preview rows use their own ids and no filter hooks');
  assert.match(hub, /<p class="eco-group__what"><strong>\{BEST_FOR_LABEL\}:<\/strong> \{c\.bestFor\}<\/p>/, 'each category carries a one-line blurb (the kinds band above already says what it is)');
  assert.match(hub, /href=\{href\(categoryPath\(c\.id\)\)\}/, 'each category links its own page');
  assert.match(hub, /class="table-wrap" tabindex="0" role="region" aria-label="Table: how to choose a kind of program"/);
});

test('a compact row leaves out the definition list and the source line; a non-filterable row leaves out the filter hooks', () => {
  const row = read('src/components/ecosystem/EntryRow.astro');
  assert.match(row, /\{!compact && \(\s*<dl class="eco-row__facts">/);
  assert.match(row, /\{!compact && <span class="eco-row__source">/);
  assert.match(row, /data-eco-row=\{filterable \? '' : undefined\}/);
  const list = read('src/components/ecosystem/EntryList.astro');
  assert.match(list, /compact=\{compact\} filterable=\{filterable\}/);
});

test('the filter opens the lists it narrows and reveals a linked program on load and on hashchange', () => {
  const script = read('src/scripts/ecosystem-filter.ts');
  assert.match(script, /details\[data-eco-more\]/);
  assert.match(script, /\[data-eco-preview\]/);
  assert.match(script, /addEventListener\('hashchange'/);
  assert.match(script, /removeEventListener\('hashchange'/);
  assert.match(script, /list\.open = true/);
  assert.match(script, /preview\.hidden = filtered/);
});
