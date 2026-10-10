import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// WCAG 2.2 target size (2.5.8, minimum): a breadcrumb link is at least 24 CSS px tall. WP-75's e2e measured the links 23px tall at 390px
// ("Home" 36x23, "Compare" 55x23) on every page with a trail. The floor is a constant 1.5rem on the item and on the link, so the trail
// also keeps one height when the web font swaps in.

const css = readFileSync(new URL('../../../src/styles/components.css', import.meta.url), 'utf8');

/** The text between the braces of the first rule in `within` that starts with `selector {`, nested rules included. */
function rule(within: string, selector: string): string {
  const start = within.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule not found`);
  const open = within.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < within.length; i += 1) {
    if (within[i] === '{') depth += 1;
    if (within[i] === '}') depth -= 1;
    if (depth === 0) return within.slice(open + 1, i);
  }
  throw new Error(`${selector} rule is not closed`);
}

const crumbs = rule(css, '.breadcrumbs').replace(/\/\*[\s\S]*?\*\//g, '');
const item = rule(crumbs, '& li');
const link = rule(item, '& > a');
const text = rule(item, '& > :is(a, [aria-current])');
/** The item's own declarations: everything in `& li` outside its nested rules. */
const itemOwn = item.replace(text, '').replace(link, '').replace(rule(item, '&:last-child'), '').replace(rule(item, '&:not(:last-child)::after'), '');

test('a breadcrumb item and its link each have a 24px (1.5rem) minimum height', () => {
  assert.match(itemOwn, /min-block-size:\s*1\.5rem/, 'the item has the floor');
  assert.match(link, /^\s*min-block-size:\s*1\.5rem;\s*$/, 'the link has the floor');
});

test('the floor is a constant, not a multiple of the line height, so a font swap cannot change it', () => {
  assert.doesNotMatch(`${itemOwn}${link}`, /min-block-size:\s*[\d.]+(?:lh|em|%)/);
});

test('the one-line trail rules are unchanged: crumbs still shrink and ellipsise on the link or span', () => {
  assert.match(text, /min-inline-size:\s*0/);
  assert.match(text, /overflow:\s*hidden/);
  assert.match(text, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(link, /overflow|text-overflow/, 'the link rule adds only the floor');
});
