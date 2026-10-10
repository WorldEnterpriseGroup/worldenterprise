import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { founderStageRows, FOUNDER_ENTRY_POINTS } from '../../../src/components/program/stages.ts';

/**
 * Seed file (docs/wave8-contracts.md, section 12, W8-18). The two tests below are the founders table blocks of
 * `tests/unit/wp-18/copy.test.ts`, moved here verbatim by WP-60 so that WP-62, which rewrites the founders page, owns what they pin.
 * The stage helper test (`stageLineList` and `stageLinePhrase` against stages.ts) stayed in the wp-18 file: it pins the data, not the page.
 */
const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

test('the founders table has one row per entry point and states the same lines the stage data does', () => {
  const rows = founderStageRows();
  assert.equal(rows.length, FOUNDER_ENTRY_POINTS.length);
  assert.deepEqual(rows.map((row) => row[0]), ['Idea (Dream)', 'Prototype (Build)', 'First customers (Grow)']);
  assert.match(rows[0]?.[1] ?? '', /service lines C and E fit here/);
  assert.match(rows[1]?.[1] ?? '', /service lines B and D fit here/);
  assert.match(rows[2]?.[1] ?? '', /service lines C, F and G fit here/);
});

test('the founders page and the services hub build their stage text from the helpers', () => {
  const founders = read('src/pages/founders/index.astro');
  const services = read('src/pages/services/index.astro');
  assert.match(founders, /founderStageRows\(\)/);
  assert.match(services, /stageLinePhrase\('dream'\)/);
  assert.match(services, /stageLinePhrase\('build'\)/);
  for (const [name, text] of [['founders', founders], ['services', services]] as const) {
    assert.doesNotMatch(text, /Dream, with lines?|Build, with lines?|\blines? [A-G] and [A-G]\b/, `${name} hard-codes a stage mapping`);
  }
});
