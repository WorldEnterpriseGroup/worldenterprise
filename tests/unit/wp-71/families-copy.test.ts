import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import * as copy from '../../../src/components/families/copy.ts';
import { FAMILY_OG, OG_REQUEST, ogSlotFor } from '../../../src/components/families/og.ts';
import type { OgFamily } from '../../../src/components/families/og.ts';
import { OG_IDS } from '../../../src/assets/photo/slots.ts';
import { ogSlotForPath } from '../../../src/components/media/OgMap.ts';

// WP-71: the words the family templates fix, and the Open Graph mapping. The fixed sentences are template copy: they appear on every page
// of a family, so they are scanned against the claims denylist and the wave 8 copy rules here, once, instead of per page.

interface Hit {
  rule: string;
  match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

/** Every string reachable from the copy module's data exports. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const data = Object.entries(copy).filter(([, value]) => typeof value !== 'function');
const all = [...new Set(data.flatMap(([, value]) => strings(value)))];

test('the copy module carries the headings, the five fixed sentences and the hub fallbacks', () => {
  assert.equal(Object.keys(copy.FIXED).length, 5);
  assert.ok(all.length >= 40, `expected at least 40 strings, found ${all.length}`);
});

test('the fixed sentences are exactly the wording of the contract', () => {
  assert.equal(copy.FIXED.segment, 'This page describes a situation. It is not an eligibility rule.');
  assert.equal(copy.FIXED.industry, 'This page is about considerations. It does not describe any WE company or result.');
});

test('the claims denylist finds nothing in the template copy', () => {
  for (const text of all) {
    for (const route of ['/founders/solo-founders/', '/industries/fintech/', '/compare/build-vs-buy/', '/journey/first-months/']) {
      assert.deepEqual(audit.scan(text, { route, plain: true, flagValues: {} }), [], `${route}: ${text}`);
    }
  }
});

test('the template copy keeps the wave 8 copy rules: no number, no promise, no blocked word, US spelling, no exclamation', () => {
  for (const text of all) {
    assert.doesNotMatch(text, /\d/, `${text}: a digit`);
    assert.doesNotMatch(text, /[$€£%!]/, `${text}: a currency sign, a percentage or an exclamation mark`);
    assert.doesNotMatch(text, /\b(free|no fee|no equity|no cost|success fees?|guarantee[sd]?|instantly|immediately)\b/i, text);
    assert.doesNotMatch(text, /\b(accelerators?|cohorts?|mentors?|perks?|alumni|portfolio companies)\b/i, text);
    assert.doesNotMatch(text, /\b(colour|centre|programme|organis|recognis|behaviour)\w*/i, `${text}: British spelling`);
    assert.doesNotMatch(text, /\b(we) (are|do|will|can)\b/, `${text}: a lowercase "we" for the company`);
  }
});

test('headings and labels are sentence case', () => {
  const labelled = [
    ...strings(copy.HEADINGS),
    ...strings(copy.EYEBROWS),
    ...copy.COMPARE_ROWS.map((row) => row.label),
    copy.COMPARE_QUESTION_COLUMN,
    copy.COMPARE_CAPTION,
    ...strings(copy.HEADINGS_HUB),
  ];
  for (const text of labelled) {
    for (const word of text.split(/\s+/).slice(1)) assert.doesNotMatch(word, /^[A-Z][a-z]+$/, `${text}: not sentence case`);
  }
});

test('"As of" dates are formatted in UTC so the build host cannot move the day', () => {
  assert.equal(copy.asOfLabel(new Date('2026-10-12')), 'As of October 12, 2026');
  assert.equal(copy.asOfLabel(new Date('2026-01-01T00:00:00Z')), 'As of January 1, 2026');
  assert.equal(copy.stepEyebrow(2, 5), 'Step 2 of 5');
});

test('every family has a card from the existing og slots, and the cards agree with OgMap where it names the section', () => {
  const known: readonly string[] = OG_IDS;
  for (const family of Object.keys(FAMILY_OG) as OgFamily[]) assert.ok(known.includes(ogSlotFor(family)), `${family} maps to an unknown slot`);
  assert.equal(Object.keys(FAMILY_OG).length, 10);
  assert.equal(ogSlotFor('segments'), ogSlotForPath('/founders/first-time-founders/'));
  assert.equal(ogSlotFor('investors'), ogSlotForPath('/investors/'));
  assert.equal(ogSlotFor('partners'), ogSlotForPath('/network/partners/'));
  assert.equal(ogSlotFor('resources'), ogSlotForPath('/resources/'));
  assert.equal(ogSlotFor('brand-story'), ogSlotForPath('/about/brand-story/'));
});

test('the OP-OG request lists a dedicated AVIF card per family group and the lane paths a dedicated set would change', () => {
  assert.equal(OG_REQUEST.cards.length, 8);
  // The resources family keeps the existing og-resources card, so it is the one family with no dedicated card requested.
  const covered = OG_REQUEST.cards.flatMap((card) => card.families).sort();
  assert.deepEqual(covered, Object.keys(FAMILY_OG).filter((family) => family !== 'resources').sort());
  for (const card of OG_REQUEST.cards) assert.match(card.file, /^src\/assets\/og\/og-[a-z]+\.avif$/);
  assert.ok(OG_REQUEST.lanePaths.some((p) => p.includes('src/components/media/OgMap.ts')));
  assert.ok(OG_REQUEST.lanePaths.some((p) => p.includes('src/assets/photo/slots.ts')));
});

test('the handoff states the OP-OG request, the card files and the lane paths (when the handoff exists)', () => {
  let text: string;
  try {
    text = readFileSync(new URL('../../../.astro-magazine/handoffs/wp-71.md', import.meta.url), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  assert.match(text, /OP-OG/);
  for (const card of OG_REQUEST.cards) assert.ok(text.includes(card.file), `the handoff does not name ${card.file}`);
  for (const lane of ['src/assets/og/', 'src/assets/photo/slots.ts', 'src/components/media/OgMap.ts']) assert.ok(text.includes(lane), `the handoff does not name ${lane}`);
});
