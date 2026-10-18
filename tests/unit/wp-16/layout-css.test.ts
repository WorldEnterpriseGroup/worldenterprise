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

// WP-17 replaced PageHeader with the hero components; the measure prop keeps the same job: the hero copy and the body share a left edge.
test('the hero takes the body measure so the hero and the reading column share a left edge', () => {
  assert.match(read('src/components/hero/types.ts'), /export type HeroMeasure = 'default' \| 'prose' \| 'rail';/);
  for (const hero of ['HeroCompact', 'HeroEditorial', 'HeroArticle']) {
    assert.match(read(`src/components/hero/${hero}.astro`), /prose.{0,20}'container container--prose'/, `${hero} puts a prose measure in the reading column`);
  }
  assert.match(read('src/layouts/types.ts'), /measure\?: HeroMeasure \| undefined/);
  // WP-109: the prose layouts put their text beside a rail (ProseRail), so the body starts at the frame's left edge and the hero shares it.
  assert.match(read('src/layouts/GuideLayout.astro'), /measure = 'default'/);
  assert.match(read('src/layouts/LegalLayout.astro'), /measure = 'default'/);
  assert.match(read('src/layouts/TemplateLayout.astro'), /measure = 'default'/);
  assert.match(read('src/layouts/MarketingLayout.astro'), /'prose'/);
  assert.match(read('src/layouts/ReferenceLayout.astro'), /measure=\{measure \?\? \(wide \? 'default' : 'prose'\)\}/);
});

test('the article hero uses the same container as its body', () => {
  const hero = read('src/components/hero/HeroArticle.astro');
  assert.match(hero, /measure = 'rail'/);
  assert.match(hero, /: 'container'/, 'the rail measure sits in the page container, like the article body');
  assert.match(read('src/layouts/ArticleLayout.astro'), /<div class="container with-rail">/);
});

test('the breadcrumb is one line and every crumb can shrink, the current page first, so neither a font swap nor a long label moves the page', () => {
  const crumbs = rule(read('src/styles/components.css'), '.breadcrumbs').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(rule(crumbs, '& ol'), /flex-wrap:\s*nowrap/);
  const item = rule(crumbs, '& li');
  assert.match(item, /display:\s*flex/);
  assert.match(item, /flex:\s*0 1 auto/);
  assert.match(item, /min-inline-size:\s*0/);
  assert.match(item, /white-space:\s*nowrap/);
  // The text is cut on the link or the span, a flex item of the crumb's width. A clipped inline child keeps a box past the viewport edge.
  const text = rule(item, '& > :is(a, [aria-current])');
  assert.match(text, /min-inline-size:\s*0/);
  assert.match(text, /overflow:\s*hidden/);
  assert.match(text, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(item.replace(text, ''), /overflow:\s*(hidden|clip)/, 'the crumb itself does not clip');
  // The current page gives way before the ancestors do.
  assert.match(rule(item, '&:last-child'), /flex-shrink:\s*100/);
  assert.match(rule(item, '&:not(:last-child)::after'), /flex:\s*none/);
});

test('the byline holds two lines on a phone, where the fallback font wraps it and the web font may not', () => {
  const byline = rule(read('src/styles/components.css'), '.byline').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(byline, /@media \(max-width: 40rem\)\s*\{\s*min-block-size:\s*2lh;\s*\}/);
});
