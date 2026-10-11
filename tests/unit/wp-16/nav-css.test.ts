import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readPairs } from '../../../src/lib/contrast.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Evaluates `clamp(min, calc(base + (100vw - 1100px) * k), max)` from the logo rule at one viewport width, in px. */
function logoWidthAt(viewport: number): number {
  const css = stripComments(read('src/styles/components.css'));
  const match = /inline-size:\s*clamp\(\s*([\d.]+)rem,\s*calc\(\s*([\d.]+)rem \+ \(100vw - 1100px\) \* ([\d.]+)\s*\),\s*([\d.]+)rem\s*\)/.exec(css);
  assert.ok(match, 'the wide-header logo rule is a clamp over the viewport');
  const [, min, base, slope, max] = match.map(Number);
  assert.ok(min !== undefined && base !== undefined && slope !== undefined && max !== undefined);
  const raw = base * 16 + (viewport - 1100) * slope;
  return Math.min(max * 16, Math.max(min * 16, raw));
}

test('the logo holds its 160px brand minimum from 1100px and reaches 256px by 1279px, and does not shrink the 1440px header', () => {
  assert.equal(logoWidthAt(1100), 160);
  for (const viewport of [1100, 1140, 1180, 1230]) assert.ok(logoWidthAt(viewport) >= 160, `${viewport}px`);
  assert.ok(logoWidthAt(1279) >= 255.5, '1279px');
  assert.equal(logoWidthAt(1440), 256);
  assert.ok(logoWidthAt(1140) < logoWidthAt(1230), 'it grows with the viewport');
});

test('the logo cannot be squeezed by the flex row from 1100px, and the nav type steps down to 16px under 1280px', () => {
  const css = stripComments(read('src/styles/components.css'));
  assert.match(css, /@media \(min-width: 1100px\) \{\s*\.site-header__logo \{\s*flex: 0 0 auto;/);
  // The items take their size from the list (`font: inherit`), so the step-down is set on the list, not on the items.
  assert.match(css, /@media \(min-width: 1100px\) and \(max-width: 1279\.98px\) \{\s*\.mega-nav__list \{\s*gap: var\(--sp-1\);\s*font-size: 1rem;/);
});

test('the 1100 to 1279px override of the nav list comes after the base rule, because both have the same specificity and the later one wins', () => {
  const css = stripComments(read('src/styles/components.css'));
  const base = css.search(/\n {2}\.mega-nav__list \{/);
  const override = css.search(/@media \(min-width: 1100px\) and \(max-width: 1279\.98px\) \{\s*\.mega-nav__list \{/);
  assert.ok(base >= 0, 'the base .mega-nav__list rule is found at the top level of its block');
  assert.ok(override >= 0, 'the narrow-desktop override is found');
  assert.ok(override > base, 'the override comes after the base rule; before it, the base gap (--sp-4) beat the override and the header row overflowed at 1100 and 1140px');
  assert.equal(css.match(/\n {2}\.mega-nav__list \{/g)?.length, 1, 'one base rule, so "after the base rule" is unambiguous');
});

test('--apply-bar-h is defined once and drives the bar, the scroll padding and the footer', () => {
  const tokens = stripComments(read('src/styles/tokens.css'));
  assert.match(tokens, /--apply-bar-h:\s*calc\(var\(--target-min\) \+ 2 \* var\(--sp-3\) \+ 1px\)/);
  const css = stripComments(read('src/styles/components.css'));
  assert.match(css, /\.mobile-apply \{[^}]*min-block-size:\s*var\(--apply-bar-h\)/);
  assert.match(css, /html:has\(\.mobile-apply\) \{\s*scroll-padding-block-end:\s*calc\(var\(--apply-bar-h\) \+ var\(--sp-2\)\)/);
  assert.match(css, /body:has\(\.mobile-apply\) \.site-footer \{\s*padding-block-end:\s*calc\(var\(--sp-6\) \+ var\(--apply-bar-h\)\)/);
});

test('the Apply bar is not rendered on the application or on Contact', () => {
  const source = read('src/components/layout/MobileNav.astro');
  assert.match(source, /BARLESS_PREFIXES = \['\/apply\/', '\/contact\/'\] as const/);
  assert.match(source, /apply && showApplyBar && \(/);
});

test('disclosure buttons do not declare a popup type, because the panels are groups of links and not menus', () => {
  for (const file of ['src/components/layout/MegaNav.astro', 'src/components/layout/MobileNav.astro']) {
    assert.doesNotMatch(read(file), /aria-haspopup/, file);
  }
});

test('the header Apply button is marked as the current page on /apply/', () => {
  assert.match(read('src/components/layout/Header.astro'), /site-header__apply" href=\{href\(apply\.href\)\} aria-current=\{currentPath === apply\.href \? 'page' : undefined\}/);
});

test('hover and leave timers belong to one trigger, not to the module', () => {
  const script = stripComments(read('src/scripts/nav.ts'));
  const loop = script.indexOf('for (const t of triggers)');
  assert.notEqual(loop, -1);
  for (const name of ['hoverTimer', 'leaveTimer']) {
    const declaration = script.indexOf(`let ${name}`);
    assert.ok(declaration > loop, `${name} is declared inside the per-trigger loop`);
    assert.equal(script.split(`let ${name}`).length - 1, 1, `${name} is declared once`);
  }
});

test('the drawer script wraps Tab in both directions and guards focus that lands outside', () => {
  const script = stripComments(read('src/scripts/nav.ts'));
  assert.match(script, /drawer\.addEventListener\('keydown'/);
  assert.match(script, /e\.shiftKey && \(!inside \|\| active === first\)/);
  assert.match(script, /!e\.shiftKey && \(!inside \|\| active === last\)/);
  assert.match(script, /document\.addEventListener\('focusin'/);
  assert.match(script, /:focus-visible/);
});

test('the mega panel link is a grid with a hex bullet, a 38ch description and no amber heading underline', () => {
  const css = stripComments(read('src/styles/components.css'));
  assert.match(css, /\.mega-panel__column li > a \{[\s\S]*?display: grid;/);
  assert.match(css, /clip-path: var\(--hex-clip\);\s*background: var\(--we-tint\);/);
  assert.match(css, /max-inline-size: 38ch/);
  const heading = /\.mega-panel__heading \{[\s\S]*?\n  \}/.exec(css)?.[0] ?? '';
  assert.ok(heading !== '', 'heading rule found');
  assert.doesNotMatch(heading, /::after/);
  assert.doesNotMatch(heading, /color-highlight/);
});

test('the link descriptions are announced as descriptions and stay out of the link name', () => {
  const source = read('src/components/layout/MegaNav.astro');
  assert.match(source, /aria-describedby=\{l\.description \? descId : undefined\}/);
  assert.match(source, /class="mega-panel__desc" id=\{descId\} aria-hidden="true"/);
});

test('the control border meets 3:1 on white and on the soft surface', () => {
  const pairs = readPairs(read('src/styles/tokens.css')).filter((pair) => pair.foreground === 'color-border-strong');
  assert.deepEqual(
    pairs.map((pair) => pair.background).sort(),
    ['color-bg', 'color-bg-soft'],
  );
  for (const pair of pairs) assert.ok(pair.ratio >= 3.1, `${pair.background}: ${pair.ratio.toFixed(2)}`);
});

test('the hero panel keeps its normal focus ring inside the dark band', () => {
  const css = stripComments(read('src/styles/utilities.css'));
  assert.match(css, /& \.hero__panel :focus-visible \{\s*outline-color: var\(--color-focus\);/);
});
