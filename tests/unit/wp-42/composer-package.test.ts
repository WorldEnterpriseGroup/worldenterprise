import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyHandoffHref } from '../../../src/scripts/team-composer.ts';

// Wave 9 (W9-13, WP-54): the packages are retired, so the Composer no longer carries a package. The hand-off to the application is the
// team alone, in the URL fragment, and the form stays one plain GET form that works without JavaScript.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

test('applyHandoffHref carries the team in the fragment and nothing in the query', () => {
  assert.equal(applyHandoffHref('/apply/', {}), '/apply/');
  assert.equal(applyHandoffHref('/apply/', { qa: 1 }), '/apply/#team=qa:1');
  assert.equal(applyHandoffHref('/worldenterprise/apply/', { qa: 1, 'front-end': 2 }), '/worldenterprise/apply/#team=front-end:2,qa:1');
});

test('the Composer form stays one GET form to the application, with no package control', () => {
  const astro = read('src/components/islands/we-team-composer/TeamComposer.astro');
  assert.equal((astro.match(/<form\b/g) ?? []).length, 1);
  assert.match(astro, /<form class="composer__form" method="get" action=\{href\('\/apply\/'\)\}>/);
  assert.doesNotMatch(astro, /<select\b/);
  assert.doesNotMatch(astro, /packages|PACKAGE_PARAM|data-package/);
});

test('the Composer script and page no longer read or write a package', () => {
  assert.doesNotMatch(read('src/scripts/team-composer.ts'), /data\/packages|PACKAGE_PARAM|\?package=/);
  const page = read('src/pages/tools/team-composer.astro');
  assert.doesNotMatch(page, /\/pricing\//);
  assert.match(page, /href: '\/how-we-work\/'/);
});
