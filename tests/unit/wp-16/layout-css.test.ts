import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');

/** The text between the braces of the first rule that starts with `selector {`, nested rules included. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule not found`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${selector} rule is not closed`);
}

test('the page frame no longer clips sideways overflow (the blind spot of the 390px tests)', () => {
  const css = read('src/styles/layout.css');
  for (const selector of ['.page', '.page__main,\n  .page > main']) {
    assert.doesNotMatch(rule(css, selector).replace(/\/\*[\s\S]*?\*\//g, ''), /overflow-x:\s*(clip|hidden)/, `${selector} must not clip`);
  }
});

test('no container--wide is left: header and body share the one container width', () => {
  assert.doesNotMatch(read('src/styles/layout.css'), /container--wide/);
  assert.doesNotMatch(read('src/styles/tokens.css'), /--page-wide/);
});

test('a fieldset and a field may shrink to the column, and their controls fill it and no more', () => {
  const css = read('src/styles/components.css');
  assert.match(rule(css, '.fieldset'), /min-inline-size:\s*0/);
  const field = rule(css, '.field');
  assert.match(field, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(field, /inline-size:\s*100%/);
  assert.match(field, /max-inline-size:\s*100%/);
  assert.match(field, /box-sizing:\s*border-box/);
});

test('a table frame scrolls, shows a scroll cue and has a visible focus ring', () => {
  const frame = rule(read('src/styles/components.css'), '.table-wrap').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(frame, /overflow-x:\s*auto/);
  assert.equal((frame.match(/\blocal\b/g) ?? []).length, 2, 'two cover layers');
  assert.equal((frame.match(/no-repeat scroll\b/g) ?? []).length, 2, 'two shadow layers');
  assert.match(frame, /&:focus-visible\s*\{[^}]*outline:\s*3px solid/);
});

test('the desk rail wraps into a grid from 48rem and keeps the scroller only below it', () => {
  const rail = read('src/components/insights/DeskRail.astro');
  assert.match(rail, /@media \(min-width: 48rem\)\s*\{\s*\.desk-rail__list\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill/);
  assert.match(rail, /@media \(min-width: 48rem\)\s*\{\s*\.desk-rail__list\s*\{[^}]*overflow:\s*visible/);
});

test('PageHeader takes the body measure so the header and the reading column share a left edge', () => {
  const header = read('src/components/layout/PageHeader.astro');
  assert.match(header, /measure\?: 'wide' \| 'prose'/);
  assert.match(header, /'container--prose': measure === 'prose'/);
  for (const layout of ['GuideLayout', 'LegalLayout', 'MarketingLayout', 'TemplateLayout']) {
    assert.match(read(`src/layouts/${layout}.astro`), /<PageHeader [^>]*measure="prose"/, `${layout} has a prose body`);
  }
  assert.match(read('src/layouts/ReferenceLayout.astro'), /measure=\{wide \? 'wide' : 'prose'\}/);
});

test('the article header uses the same container as its body', () => {
  const article = read('src/layouts/ArticleLayout.astro');
  assert.match(article, /<header class="page-header page-header--article">\s*<div class="container stack">/);
  assert.match(article, /<div class="container with-rail">/);
});

test('the breadcrumb is one line, and only the current page gives way, so a font swap cannot move the page', () => {
  const crumbs = rule(read('src/styles/components.css'), '.breadcrumbs').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(rule(crumbs, '& ol'), /flex-wrap:\s*nowrap/);
  const item = rule(crumbs, '& li');
  assert.match(item, /flex:\s*none/);
  assert.match(item, /white-space:\s*nowrap/);
  const last = rule(item, '&:last-child');
  assert.match(last, /flex:\s*0 1 auto/);
  assert.match(last, /min-inline-size:\s*0/);
  assert.match(last, /overflow:\s*hidden/);
  assert.match(last, /text-overflow:\s*ellipsis/);
});

test('the byline holds two lines on a phone, where the fallback font wraps it and the web font may not', () => {
  const byline = rule(read('src/styles/components.css'), '.byline').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(byline, /@media \(max-width: 40rem\)\s*\{\s*min-block-size:\s*2lh;\s*\}/);
});
