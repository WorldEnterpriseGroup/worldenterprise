import assert from 'node:assert/strict';
import test from 'node:test';
import { PACKAGE_PARAM, PACKAGE_IDS, getPackage, packages } from '../../../src/data/packages.ts';
import { pickerResult } from '../../../src/components/pricing/package-picker.ts';
import { withPackage } from '../../../src/components/pricing/package-links.ts';
import { STAGE_LABELS, stageLabel } from '../../../src/components/pricing/stages.ts';

const BASES = { apply: '/worldenterprise/apply/', composer: '/worldenterprise/tools/team-composer/' };

test('withPackage puts the package id in the query of a resolved path, the form the contract names', () => {
  assert.equal(PACKAGE_PARAM, 'package');
  assert.equal(withPackage('/apply/', 'launch'), '/apply/?package=launch');
  assert.equal(withPackage('/tools/team-composer/', 'studio'), '/tools/team-composer/?package=studio');
  assert.equal(withPackage('/worldenterprise/apply/', 'spark'), '/worldenterprise/apply/?package=spark');
});

test('every package is the answer for exactly the stage it is sized for', () => {
  const seen = new Set<string>();
  for (const pkg of packages) {
    const result = pickerResult(pkg.stageKey, BASES);
    assert.ok(result, `${pkg.stageKey} has a result`);
    assert.equal(result.id, pkg.id);
    assert.equal(result.name, pkg.name);
    seen.add(result.id);
  }
  assert.deepEqual([...seen].sort(), [...PACKAGE_IDS].sort());
});

test('the result carries the published stage fit and depth, and links with the package id on the base-aware paths', () => {
  const result = pickerResult('first-product', BASES);
  assert.ok(result);
  const launch = getPackage('launch');
  assert.ok(result.status.includes(launch.stageFit), 'the stage-fit sentence is verbatim');
  assert.ok(result.status.includes(`depth in every service line is ${launch.depth}`));
  assert.equal(result.applyHref, '/worldenterprise/apply/?package=launch');
  assert.equal(result.composerHref, '/worldenterprise/tools/team-composer/?package=launch');
  assert.equal(result.cardHref, '#package-launch');
});

test('an unknown, empty or inherited stage key has no result', () => {
  for (const bad of ['', 'series-b', 'Idea or prototype', '__proto__', 'constructor', 'toString']) {
    assert.equal(pickerResult(bad, BASES), null, bad);
  }
});

test('the result says nothing about amounts or seat counts', () => {
  for (const pkg of packages) {
    const result = pickerResult(pkg.stageKey, BASES);
    assert.ok(result);
    assert.doesNotMatch(result.status, /[$€£]|\bseats?\b|\bper\s+(?:month|seat)\b/i, pkg.id);
  }
});

test('each short stage label is made of words from its stage-fit sentence, and there is one per stage', () => {
  assert.deepEqual(Object.keys(STAGE_LABELS).sort(), packages.map((p) => p.stageKey).sort());
  const filler = new Set(['or', 'a', 'an', 'of', 'the']);
  for (const pkg of packages) {
    const label = stageLabel(pkg);
    assert.ok(label.length > 0 && label.length < 50, `${pkg.id} label is short`);
    const sentence = pkg.stageFit.toLowerCase();
    for (const word of label.toLowerCase().split(/[\s,]+/).filter((w) => w !== '' && !filler.has(w))) {
      assert.ok(sentence.includes(word), `"${word}" of the ${pkg.id} label appears in its stage fit`);
    }
  }
});
