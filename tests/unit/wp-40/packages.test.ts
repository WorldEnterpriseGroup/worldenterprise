import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PACKAGE_IDS,
  PACKAGE_NOT_SURE,
  PACKAGE_PARAM,
  getPackage,
  isPackageId,
  packageForStage,
  packages,
  parsePackageParam,
} from '../../../src/data/packages.ts';

const pricing = readFileSync(new URL('../../../src/content/pages/pricing/pricing.mdx', import.meta.url), 'utf8');

test('there are four packages, in the published order, with unique ids and names', () => {
  assert.deepEqual([...PACKAGE_IDS], ['spark', 'launch', 'accelerate', 'studio']);
  assert.deepEqual(packages.map((p) => p.id), [...PACKAGE_IDS]);
  assert.deepEqual(packages.map((p) => p.name), ['Spark', 'Launch', 'Accelerate', 'Studio']);
  assert.equal(new Set(packages.map((p) => p.stageKey)).size, 4);
});

test('no field carries a digit, a currency sign or a seat count (F-4, C-06, C-10)', () => {
  for (const p of packages) {
    for (const [key, value] of Object.entries(p)) {
      assert.equal(typeof value, 'string', `${p.id}.${key}`);
      assert.doesNotMatch(String(value), /\d|[$€£]|\bseats?\b|\bUSD\b|\bper\s+(?:month|seat)\b/i, `${p.id}.${key}`);
    }
  }
});

test('the package data is the table on the pricing page, until the page renders from it', () => {
  const rows = [...pricing.matchAll(/^\s*\['(Spark|Launch|Accelerate|Studio)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'\],?$/gm)];
  if (rows.length > 0) {
    assert.equal(rows.length, 4, 'the pricing table lists exactly the four packages');
    assert.deepEqual(
      rows.map((m) => [m[1], m[2], m[3]]),
      packages.map((p) => [p.name, p.stageFit, p.depth]),
    );
  } else {
    // WP-42 moved the table into a component. Then the page must read this module, so the two cannot drift.
    assert.match(pricing, /data\/packages(?:\.ts)?['"]/, 'pricing.mdx no longer lists the rows, so it must import src/data/packages.ts');
  }
});

test('every package name is on the pricing page, or the page renders from this module', () => {
  const renderedFromModule = /data\/packages(?:\.ts)?['"]/.test(pricing);
  for (const p of packages) assert.ok(renderedFromModule || pricing.includes(p.name), `${p.name} on pricing page`);
});

test('isPackageId and getPackage', () => {
  assert.equal(isPackageId('studio'), true);
  assert.equal(isPackageId('Studio'), false);
  assert.equal(isPackageId(PACKAGE_NOT_SURE), false);
  assert.equal(isPackageId(undefined), false);
  assert.equal(getPackage('launch').name, 'Launch');
});

test('parsePackageParam reads a query value and ignores anything unknown', () => {
  assert.equal(PACKAGE_PARAM, 'package');
  assert.equal(parsePackageParam('spark'), 'spark');
  assert.equal(parsePackageParam('  Accelerate '), 'accelerate');
  assert.equal(parsePackageParam('STUDIO'), 'studio');
  for (const bad of ['', ' ', 'platinum', 'spark,launch', 'spark launch', PACKAGE_NOT_SURE, '__proto__', 'constructor', null, undefined]) {
    assert.equal(parsePackageParam(bad), null, String(bad));
  }
});

test('packageForStage maps each stage key to its package and ignores an unknown key', () => {
  for (const p of packages) assert.equal(packageForStage(p.stageKey)?.id, p.id);
  assert.equal(packageForStage('series-b'), null);
  assert.equal(packageForStage(''), null);
});
