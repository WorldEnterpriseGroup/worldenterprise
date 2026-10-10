import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FIT_HEADING, FITS, NOT_FIT_HEADING, NOT_FITS } from '../../../src/components/apply/fit.ts';

// WP-43: the fit lists have one home (src/components/apply/fit.ts). who-its-for.astro and how-we-decide.astro render from it, and the
// render of who-its-for is pinned against the lists and the markup it had before the move.

interface Snapshot {
  fitHeading: string;
  notFitHeading: string;
  fits: string[];
  notFits: string[];
  whoItsForMarkup: string[];
}

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/fit-snapshot.json', import.meta.url), 'utf8')) as Snapshot;
const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('the fit data is the lists who-its-for rendered before the move, word for word', () => {
  assert.equal(FIT_HEADING, snapshot.fitHeading);
  assert.equal(NOT_FIT_HEADING, snapshot.notFitHeading);
  assert.deepEqual([...FITS], snapshot.fits);
  assert.deepEqual([...NOT_FITS], snapshot.notFits);
});

test('who-its-for renders the shared data with the markup it had before, and keeps no copy of the lists', () => {
  const page = source('src/pages/program/who-its-for.astro');
  for (const line of snapshot.whoItsForMarkup) assert.ok(page.includes(line), `who-its-for.astro no longer contains: ${line}`);
  assert.match(page, /from '\.\.\/\.\.\/components\/apply\/fit\.ts'/);
  for (const sentence of [...snapshot.fits, ...snapshot.notFits]) assert.ok(!page.includes(sentence), `who-its-for.astro still holds a copy of: ${sentence}`);
});

test('how-we-decide renders the same shared data', () => {
  const page = source('src/pages/program/how-we-decide.astro');
  assert.match(page, /from '\.\.\/\.\.\/components\/apply\/fit\.ts'/);
  assert.ok(page.includes('{FITS.map((item) => <li>{item}</li>)}'));
  assert.ok(page.includes('<LimitsBlock title={NOT_FIT_HEADING} items={NOT_FITS} />'));
  for (const sentence of [...snapshot.fits, ...snapshot.notFits]) assert.ok(!page.includes(sentence), `how-we-decide.astro holds its own copy of: ${sentence}`);
});

test('the fit lists carry no figure, duration or time promise (DP-5)', () => {
  for (const sentence of [...FITS, ...NOT_FITS]) assert.doesNotMatch(sentence, /\d/, sentence);
});
