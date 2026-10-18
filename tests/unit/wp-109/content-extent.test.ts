import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ALLOWED_BANDS, ALLOWED_ROUTES, MAX_SIDE_GAP, MIN_CONTENT_SPAN, offenders } from '../../e2e/wave8/wp-51/lib/content-extent.ts';
import type { BandExtent } from '../../e2e/wave8/wp-51/lib/content-extent.ts';

const band = (name: string, left: number, right: number): BandExtent => ({ name, height: 400, left, right, span: 1920 - left - right });
const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('a band that spans the frame passes and a lone reading column fails with its numbers', () => {
  assert.deepEqual(offenders([band('section "Wide"', 80, 80)]), []);
  const [lone] = offenders([band('section "Lone"', 80, 1104)]);
  assert.match(lone ?? '', /Lone.*content 736px wide, 80px empty on the left, 1104px empty on the right/);
});

test('the thresholds are the ones of the issue', () => {
  assert.equal(MIN_CONTENT_SPAN, 1440);
  assert.equal(MAX_SIDE_GAP, 240);
  assert.equal(offenders([band('a', 240, 240)]).length, 0, 'a gap of exactly 240px passes');
  assert.equal(offenders([band('a', 241, 80)]).length, 1, 'a gap of 241px fails');
  assert.equal(offenders([band('a', 80, 80)].map((b) => ({ ...b, span: 1439 }))).length, 1, 'a span of 1439px fails');
});

test('an allowlisted band is skipped by name', () => {
  assert.deepEqual(offenders([band('section.x "Skip me"', 80, 1000)], ['Skip me']), []);
});

test('every allowlist entry carries a written reason', () => {
  for (const entry of [...ALLOWED_ROUTES, ...ALLOWED_BANDS]) assert.ok(entry.reason.trim().length >= 40, `${'path' in entry ? entry.path : entry.match} needs a reason`);
});

test('the layout contracts of the shared primitives stay in place', () => {
  const layout = read('src/styles/layout.css');
  assert.match(layout, /\.with-rail--page/, 'the prose rail');
  assert.match(layout, /\.band--end > \.container/, 'the closing band');
  assert.match(layout, /\.container > \.container:not\(\.container--prose\)/, 'a nested container is not inset twice');
  for (const layout of ['GuideLayout', 'LegalLayout', 'TemplateLayout']) assert.match(read(`src/layouts/${layout}.astro`), /ProseRail/, `${layout} puts its text beside the rail`);
  assert.match(read('src/layouts/MarketingLayout.astro'), /hasFrameBlocks/, 'a marketing body with frame blocks keeps the whole frame');
});
