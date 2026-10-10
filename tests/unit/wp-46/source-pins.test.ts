import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');
const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MARKUP = [
  'src/components/islands/we-palette/WePalette.astro',
  'src/components/layout/Header.astro',
  'src/components/layout/MegaNav.astro',
  'src/components/layout/MobileNav.astro',
  'src/components/layout/UtilityBar.astro',
  'src/components/islands/we-search/WeSearch.astro',
];
const SCRIPTS = ['src/scripts/palette.ts', 'src/scripts/search.ts', 'src/components/islands/we-palette/match.ts', 'src/components/nav/commands.ts', 'src/components/nav/panels.ts'];

test('the palette adds no inline script and no style attribute, so the CSP audit is unchanged', () => {
  for (const file of MARKUP) {
    const source = read(file);
    assert.doesNotMatch(source, /\sstyle=/, `${file}: no style attribute`);
    assert.doesNotMatch(source, /\son[a-z]+=/, `${file}: no inline event handler`);
    assert.doesNotMatch(source, /<script[^>]*is:inline/, `${file}: no is:inline script`);
    // Every <script> is an import of a module and nothing else.
    for (const block of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      assert.match(block[1] ?? '', /^\s*import '[^']+';\s*$/, `${file}: a script block that is more than an import`);
    }
  }
  for (const file of SCRIPTS) {
    const code = stripComments(read(file));
    assert.doesNotMatch(code, /setAttribute\('style'|\.style\.cssText|\.innerHTML\s*=|eval\(|new Function\(/, file);
  }
});

test('the palette and the search load nothing from outside the site and send nothing anywhere', () => {
  for (const file of [...SCRIPTS, 'src/components/islands/we-palette/WePalette.astro']) {
    const code = stripComments(read(file));
    assert.doesNotMatch(code, /https?:\/\//, `${file}: no external address`);
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/, `${file}: no network call, no storage`);
  }
});

test('without JavaScript the utility bar and the drawer still link to /search/', () => {
  const bar = read('src/components/layout/UtilityBar.astro');
  assert.match(bar, /<a href=\{href\(link\.href\)\}[^>]*data-palette-fallback=\{link\.href === SEARCH_PATH \? '' : undefined\}/);
  assert.match(bar, /<button type="button" class="utility-bar__search" data-palette-open[^>]*\bhidden\b/, 'the button is hidden until the script reveals it');
  const drawer = read('src/components/layout/MobileNav.astro');
  assert.match(drawer, /<a class="mobile-drawer__find" href=\{href\('\/search\/'\)\} data-palette-fallback>/);
  assert.match(drawer, /<button type="button" class="mobile-drawer__find" data-palette-open[^>]*\bhidden\b/);
});

test('the palette is a modal dialog with a combobox and a listbox, and the script reveals the button only after reading the commands', () => {
  const markup = read('src/components/islands/we-palette/WePalette.astro');
  assert.match(markup, /<dialog [^>]*aria-labelledby="we-palette-title"/);
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /aria-controls="we-palette-list"/);
  assert.match(markup, /id="we-palette-list"[^>]*role="listbox"/);
  assert.match(markup, /data-commands=\{JSON\.stringify\(commands\)\}/);
  const script = stripComments(read('src/scripts/palette.ts'));
  assert.match(script, /showModal\(\)/);
  assert.match(script, /customElements\.define\('we-palette'/);
  assert.match(script, /parseCommands\(/);
  assert.match(script, /event\.isComposing/, 'IME composition does not trigger or steer the palette');
  assert.match(script, /pagehide/);
});

test('the disclosure buttons still claim no popup type, and the drawer keeps nav a direct child with Apply inside it', () => {
  for (const file of ['src/components/layout/MegaNav.astro', 'src/components/layout/MobileNav.astro', 'src/components/layout/UtilityBar.astro']) {
    assert.doesNotMatch(read(file), /aria-haspopup/, file);
  }
  const drawer = read('src/components/layout/MobileNav.astro');
  assert.match(drawer, /data-mobile-drawer>\s*<div class="mobile-drawer__head">/);
  assert.match(drawer, /<\/div>\s*<nav aria-label="Primary mobile">/);
  assert.match(drawer, /<\/nav>\s*\{\s*apply && showApplyBar && \(\s*<div class="mobile-drawer__apply">/);
  assert.equal(drawer.match(/>Menu</g)?.length, 1);
});

test('the layer order is repeated in every scoped style that opens a layer, and no layer is opened without it', () => {
  for (const file of ['src/components/layout/MegaNav.astro', 'src/components/layout/MobileNav.astro', 'src/components/layout/UtilityBar.astro']) {
    const source = read(file);
    assert.match(source, /<style>\s*@layer reset, tokens, base, layout, components, utilities, pages, print;/, file);
  }
});

test('the palette group labels are hidden from assistive technology, and each group is named by aria-label', () => {
  const script = read('src/scripts/palette.ts');
  assert.match(script, /group-label/);
  assert.match(script, /aria-hidden/);
  assert.match(script, /role', 'group'/);
  assert.match(script, /'aria-label'/);
});
