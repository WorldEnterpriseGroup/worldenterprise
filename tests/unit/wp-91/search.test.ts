import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chunkEnds, coverageNote, HYDRATE_CEILING, HYDRATE_CHUNK, hydrationLimit } from '../../../src/components/islands/we-search/hydrate.ts';
import { kindsPresent } from '../../../src/components/islands/we-search/query.ts';

const root = new URL('../../../', import.meta.url).pathname;

test('every result is read up to the ceiling, in chunks, with the limit as the last round', () => {
  assert.deepEqual(chunkEnds(0), []);
  assert.deepEqual(chunkEnds(1), [1]);
  assert.deepEqual(chunkEnds(HYDRATE_CHUNK), [HYDRATE_CHUNK]);
  assert.deepEqual(chunkEnds(120), [50, 100, 120]);
  assert.deepEqual(chunkEnds(300).at(-1), 300, 'a 300-route index is read whole');
  assert.equal(chunkEnds(10_000).at(-1), HYDRATE_CEILING, 'a search with more matches stops at the ceiling');
  assert.equal(hydrationLimit(10_000), HYDRATE_CEILING);
  assert.equal(hydrationLimit(-1), 0);
});

test('the ceiling is above the size of the site (about 300 routes at 120 articles), so the old 50-result limit is gone', () => {
  assert.ok(HYDRATE_CEILING >= 300);
  assert.ok(HYDRATE_CEILING > 50 && HYDRATE_CHUNK <= 50);
  const script = readFileSync(`${root}src/scripts/search.ts`, 'utf8');
  assert.ok(!/HYDRATE_LIMIT/.test(script), 'search.ts no longer limits the chips to the first 50 matches');
  assert.ok(script.includes("from '../components/islands/we-search/hydrate.ts'"));
});

test('the coverage note appears only for a search with more matches than the ceiling', () => {
  assert.equal(coverageNote(HYDRATE_CEILING), '');
  assert.equal(coverageNote(HYDRATE_CEILING + 1), ` The filter covers the first ${HYDRATE_CEILING} matches.`);
});

test('a type found only among the later results still gets its chip, because the kinds are read from every chunk', () => {
  // 60 articles first, then a playbook at position 75: the first chunk shows one type, the second adds the second.
  const urls = [...Array.from({ length: 60 }, (_, i) => `/insights/a-${i}/`), ...Array.from({ length: 20 }, (_, i) => `/playbooks/p-${i}/`)];
  const ends = chunkEnds(urls.length);
  const seen = ends.map((end) => kindsPresent(urls.slice(0, end)));
  assert.deepEqual(seen[0], ['article']);
  assert.deepEqual(seen[1], ['article', 'playbook']);
});
