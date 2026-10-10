import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { INTRODUCTIONS_FLAT_FEE } from '../../../src/components/blocks/introductions.ts';

/**
 * Seed file (docs/wave8-contracts.md, section 12, W8-18). The two tests below are the `/investors/` page blocks of
 * `tests/unit/wp-11/network.test.ts` and `tests/unit/wp-18/copy.test.ts`, moved here verbatim by WP-60 so that WP-64, which rewrites the
 * investors page, owns what they pin. WP-64 rewrites these assertions to the new page and keeps the disclaimer, the not-an-offer statement
 * and the flat-fee wording; the page-independent invariants stayed in the wp-11 and wp-18 files.
 */
const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

test('investors page carries the no-funding disclaimer and the not-an-offer statement', () => {
  const page = read('src/pages/investors/index.astro');
  assert.match(page, /<NoFundingDisclaimer\s*\/>/);
  assert.match(page, /Not an offer of securities/);
  assert.match(page, /does not offer securities|offer to sell, or a solicitation/);
  // Owner decision of 2026-10-09: introductions are a separate paid add-on, so the page no longer says WE arranges no meetings.
  assert.match(page, /<InvestorIntroductionsOffer\b/);
  assert.match(page, /does not negotiate terms, advise on securities or handle funds/i);
  assert.doesNotMatch(page, /does not arrange meetings with investors/i);
});

test('the investors page and Service Line F state the flat fee and no longer deny introductions', () => {
  const investors = read('src/pages/investors/index.astro') + read('src/content/pages/investors/index.mdx');
  const service = read('src/content/services/fundability-and-investor-readiness.mdx');
  assert.doesNotMatch(investors, /does not (?:arrange|broker|make)[^.]*(?:meetings|introductions)/i);
  assert.doesNotMatch(investors, /no introductions/i);
  assert.match(investors + service, /InvestorIntroductionsOffer/);
  assert.ok(INTRODUCTIONS_FLAT_FEE.length > 0);
  assert.doesNotMatch(service, /\bfinder\b/i, 'the finder wording is removed from line F');
  assert.match(service, /broker-dealer or investment adviser/);
});
