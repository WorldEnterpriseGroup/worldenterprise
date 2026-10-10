import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Static checks on the family templates for things a build would only show as a failed audit (audit:seo, the compare table, target size).

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (file: string): string => readFileSync(`${ROOT}${file}`, 'utf8');
const TEMPLATES = ['SegmentPage', 'IndustryPage', 'ComparePage', 'JourneyPage', 'FamilyHubPage'] as const;

test('every family template hands the page seoTitle to its layout, so a long title can carry a shorter search title', () => {
  for (const name of TEMPLATES) {
    const source = read(`src/components/families/${name}.astro`);
    assert.match(source, /^\s+seoTitle=\{(?:seoTitle|page\?\.data\.seoTitle)\}$/m, `${name} does not pass seoTitle to its layout`);
    if (name !== 'FamilyHubPage') assert.match(source, /const \{[^}]*\bseoTitle\b[^}]*\} = page\.data;/, `${name} does not read seoTitle from the page`);
  }
});

test('the compare table has equal option columns: a fixed layout scoped to the compare table, not to every data table', () => {
  const source = read('src/components/families/ComparePage.astro');
  assert.match(source, /<div class="cmp-table">\s*<DataTable/);
  assert.match(source, /\.cmp-table :global\(\.data-table\) \{[^}]*table-layout: fixed;/);
  assert.doesNotMatch(read('src/styles/components.css'), /table-layout/, 'the shared .data-table must keep its automatic layout');
});

test('a breadcrumb link is at least 24px tall (WCAG 2.2 target size, 2.5.8)', () => {
  const css = read('src/styles/components.css');
  const block = /\.breadcrumbs \{[\s\S]*?\n  \}\n/.exec(css)?.[0] ?? '';
  assert.match(block, /& > a \{\s*min-block-size: 1\.5rem;/);
});
