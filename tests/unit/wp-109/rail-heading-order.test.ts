import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('the call to action that leads a page takes the h2 level and the one that follows the body keeps h3', () => {
  const rail = read('src/components/layout/ProseRail.astro');
  assert.match(rail, /ctaAtStart && <CtaAside model=\{model\} level=\{2\} \/>/, 'the start column comes first in the document: an h3 there skips a level after the h1');
  assert.match(rail, /!ctaAtStart && <CtaAside model=\{model\} \/>/, 'the end column follows the body headings: the default h3 is right');
  const aside = read('src/components/cta/CtaAside.astro');
  assert.match(aside, /level = 3/, 'the default level of an aside is h3');
  assert.match(aside, /headingLevel=\{level\}/, 'the level reaches the band');
});

test('the press logo preview paints with a brand token, not a raw colour', () => {
  const press = read('src/pages/press/index.astro');
  assert.doesNotMatch(press, /#fff\b/i);
  assert.match(press, /\.press-logo__preview \{[^}]*background: var\(--we-white\)/s);
});

test('the content-extent spec never skips: a skipped measurement is a measurement nobody made', () => {
  const spec = read('tests/e2e/wave8/wp-109/content-extent.spec.ts');
  assert.doesNotMatch(spec, /\.(skip|fixme)\s*\(/, 'the spec must run in every project it is configured for and fail on a missing page');
  assert.match(spec, /expect\(isBuilt\(path\)[^;]*\)\.toBe\(true\)/, 'a family route that is not built fails the spec');
  const config = read('playwright.config.ts');
  assert.match(config, /testIgnore: WAVE8_FIXED_VIEWPORT_SPECS/, 'the mobile project leaves the fixed-viewport spec out by configuration');
});
