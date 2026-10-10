import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PACKAGE_IDS, getPackage, packages } from '../../../src/data/packages.ts';
import { stageLabel } from '../../../src/components/pricing/stages.ts';
import { CUSTOM_PLAN_BANNER, applyHandoffHref, packageBanner, packageFromSearch } from '../../../src/scripts/team-composer.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

test('packageFromSearch reads exactly one known package id from the query', () => {
  assert.equal(packageFromSearch('?package=launch'), 'launch');
  assert.equal(packageFromSearch('package=studio'), 'studio');
  assert.equal(packageFromSearch('?package=SPARK'), 'spark');
  assert.equal(packageFromSearch('?foo=1&package=accelerate&bar=2'), 'accelerate');
});

test('packageFromSearch ignores an empty, unknown or repeated value, as the contract says', () => {
  for (const search of ['', '?', '?package=', '?package=gold', '?package=launch&package=spark', '?package=launch&package=launch', '?pkg=launch']) {
    assert.equal(packageFromSearch(search), null, search);
  }
});

test('packageBanner names the package and the stage it is sized for, and falls back to a custom plan', () => {
  assert.deepEqual(packageBanner(null), CUSTOM_PLAN_BANNER);
  for (const pkg of packages) {
    const banner = packageBanner(pkg.id);
    assert.equal(banner.title, `Sketching for ${pkg.name}`);
    assert.equal(banner.detail, `Sized for: ${pkg.stageFit}`);
  }
});

test('applyHandoffHref puts the package in the query, before the team fragment', () => {
  assert.equal(applyHandoffHref('/apply/', {}), '/apply/');
  assert.equal(applyHandoffHref('/worldenterprise/apply/', { qa: 1 }), '/worldenterprise/apply/#team=qa:1');
  assert.equal(applyHandoffHref('/apply/', {}, 'launch'), '/apply/?package=launch');
  assert.equal(applyHandoffHref('/worldenterprise/apply/', { qa: 1 }, 'studio'), '/worldenterprise/apply/?package=studio#team=qa:1');
  assert.equal(applyHandoffHref('/apply/', { qa: 1 }, null), '/apply/#team=qa:1');
});

test('the Composer form stays one GET form and carries the package as a real control named package', () => {
  const astro = read('src/components/islands/we-team-composer/TeamComposer.astro');
  assert.equal((astro.match(/<form\b/g) ?? []).length, 1);
  assert.match(astro, /<form class="composer__form" method="get" action=\{href\('\/apply\/'\)\}>/);
  assert.match(astro, /<select id="composer-package" name=\{PACKAGE_PARAM\}/);
  assert.match(astro, /<label for="composer-package">/);
  assert.match(astro, /<option value="">/);
  assert.match(astro, /packages\.map\(\(pkg\) => <option value=\{pkg\.id\}>\{stageLabel\(pkg\)\} \(\{pkg\.name\}\)<\/option>\)/);
});

test('the select offers every package once, and the stage labels are distinct', () => {
  assert.equal(PACKAGE_IDS.length, 4);
  const labels = packages.map((p) => stageLabel(p));
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(new Set(packages.map((p) => p.id)).size, packages.length);
});

test('the cards, the picker and the pricing page link every package into the Composer and the application', () => {
  const cards = read('src/components/pricing/PackageCards.astro');
  assert.match(cards, /const applyPath = href\('\/apply\/'\)/);
  assert.match(cards, /withPackage\(applyPath, pkg\.id\)/);
  assert.match(cards, /const composerPath = href\('\/tools\/team-composer\/'\)/);
  assert.match(cards, /withPackage\(composerPath, pkg\.id\)/);
  assert.match(cards, /id=\{`package-\$\{pkg\.id\}`\}/);
  const picker = read('src/components/pricing/PackagePicker.astro');
  assert.match(picker, /name="stage"/);
  assert.match(picker, /role="status" aria-live="polite"/);
  assert.match(picker, /#package-/);
});

test('the live regions on the picker and the Composer package block are empty or fixed text at load, never display:none', () => {
  const picker = read('src/components/pricing/PackagePicker.astro');
  const status = /<p[^>]*data-status[^>]*>([^<]*)<\/p>/.exec(picker);
  assert.ok(status, 'the picker has a status paragraph');
  assert.equal((status[1] ?? '').trim(), '');
  assert.doesNotMatch(picker, /\.picker__status[^{]*\{[^}]*display:\s*none/);
});

test('pricing.mdx keeps the data import, the four package names, the rate link and the add-on offer', () => {
  const mdx = read('src/content/pages/pricing/pricing.mdx');
  assert.match(mdx, /data\/packages(?:\.ts)?['"]/);
  for (const pkg of packages) assert.ok(mdx.includes(pkg.name), pkg.name);
  assert.ok(mdx.includes('contact/?topic=seat-rate'));
  assert.ok(mdx.includes('<InvestorIntroductionsOffer'));
  assert.doesNotMatch(mdx, /[$€£]\s?\d|\bdollars\b|\bper month\b/i);
  assert.doesNotMatch(mdx, /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:dedicated\s+)?seats?\b/i);
});

test('the pricing page order is cards, explainer, picker, drivers, add-on, not-published, questions', () => {
  const mdx = read('src/content/pages/pricing/pricing.mdx');
  const order = ['<PackageCards', '<SeatExplainer', '<PackagePicker', '## What drives the number of seats', '<InvestorIntroductionsOffer', '<NotPublished', '## Questions about seats and packages'];
  const positions = order.map((marker) => mdx.indexOf(marker));
  assert.ok(positions.every((p) => p >= 0), `all sections present: ${positions.join(',')}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('the not-published block never names the add-on, so the disclaimer rule is not triggered by it', () => {
  const block = read('src/components/pricing/NotPublished.astro');
  assert.doesNotMatch(block, /Investor Introductions/);
  assert.ok(getPackage('spark').name === 'Spark');
});
