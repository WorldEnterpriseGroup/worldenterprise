import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BAND_CROP_ASPECTS, cropViews, hexagonPoints, qaWidths } from '../../../scripts/photo/lib/qa-views.mjs';
import { selectFromQa, validateQaResult } from '../../../scripts/photo/lib/qa.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const extract = JSON.parse(readFileSync(`${ROOT}.astro-magazine/media/shotlist-extract.json`, 'utf8')) as { slots: { id: string; kind: string; group: string; people: string; generateNow: boolean }[] };
const schema = JSON.parse(readFileSync(`${ROOT}scripts/photo/qa-result.schema.json`, 'utf8')) as { required: string[]; properties: { checks: { required: string[] } } };

interface Result {
  slot: string;
  candidate: string;
  reviewer: string;
  verdict: 'pass' | 'fail';
  score: number;
  alt: string | null;
  reasons: string[];
  checks: Record<string, Record<string, unknown>>;
}

function result(slot: string, candidate: string, patch: Partial<Result> = {}): Result {
  return {
    slot,
    candidate,
    reviewer: 'qa-agent',
    verdict: 'pass',
    score: 8,
    alt: 'A tabletop model of blue hexagon tiles with one small amber tile.',
    reasons: [],
    checks: {
      copyMatch: { pass: true, note: 'Matches the copy.' },
      palette: { pass: true, note: 'Blue, white, one amber.', amberObjects: 1 },
      people: { pass: true, note: 'No person.', facesVisible: false, impliedIdentity: false },
      artifacts: { pass: true, note: 'Clean.', textOrGlyphs: false, handsOrFingers: false, malformedHexagons: false },
      cropSafety: { pass: true, note: 'Safe at both widths.', widths: [{ width: 512, pass: true }, { width: 768, pass: true }, { width: 1024, pass: true }] },
    },
    ...patch,
  };
}

test('the result schema file names the same required fields and checks the validator enforces', () => {
  assert.deepEqual([...schema.required].sort(), ['alt', 'candidate', 'checks', 'reasons', 'reviewer', 'score', 'slot', 'verdict'].sort());
  assert.deepEqual([...schema.properties.checks.required].sort(), ['artifacts', 'copyMatch', 'cropSafety', 'palette', 'people']);
});

test('a complete passing result validates, including the srcset widths it must cover', () => {
  assert.deepEqual(validateQaResult(result('svc-c', 'object-0'), { slotId: 'svc-c', candidate: 'object-0', srcsetWidths: [512, 768, 1024] }), []);
});

test('a result that skips a srcset width, a check, a note or the alt is rejected', () => {
  assert.match(validateQaResult(result('svc-c', 'object-0'), { srcsetWidths: [512, 640, 768, 1024] }).join('\n'), /misses the 640px/);
  const missing = result('svc-c', 'object-0');
  delete missing.checks.people;
  assert.match(validateQaResult(missing).join('\n'), /checks\.people is missing/);
  const quiet = result('svc-c', 'object-0');
  quiet.checks.palette.note = '';
  assert.match(validateQaResult(quiet).join('\n'), /palette\.note is empty/);
  assert.match(validateQaResult(result('svc-c', 'object-0', { alt: null })).join('\n'), /alt is empty/);
  assert.match(validateQaResult(result('svc-c', 'object-0', { score: 11 })).join('\n'), /score/);
  assert.match(validateQaResult(result('svc-c', 'object-0', { verdict: 'maybe' as 'pass' })).join('\n'), /neither pass nor fail/);
  assert.match(validateQaResult(result('svc-c', 'object-0'), { slotId: 'svc-b' }).join('\n'), /expected svc-b/);
});

test('verdict pass is impossible with a failing check, a second amber object, a face, text, hands or a malformed hexagon', () => {
  const cases: [string, (r: Result) => void, RegExp][] = [
    ['failing check', (r) => (r.checks.copyMatch.pass = false), /copyMatch does not pass/],
    ['two amber objects', (r) => (r.checks.palette.amberObjects = 2), /exactly one/],
    ['a face', (r) => (r.checks.people.facesVisible = true), /face or an implied identity/],
    ['an implied founder', (r) => (r.checks.people.impliedIdentity = true), /face or an implied identity/],
    ['glyphs', (r) => (r.checks.artifacts.textOrGlyphs = true), /artifact flag/],
    ['fingers', (r) => (r.checks.artifacts.handsOrFingers = true), /artifact flag/],
    ['a bad hexagon', (r) => (r.checks.artifacts.malformedHexagons = true), /artifact flag/],
  ];
  for (const [name, mutate, expected] of cases) {
    const bad = result('svc-c', 'object-0');
    mutate(bad);
    assert.match(validateQaResult(bad).join('\n'), expected, name);
  }
  const cropped = result('svc-c', 'object-0');
  (cropped.checks.cropSafety.widths as { width: number; pass: boolean }[])[0].pass = false;
  assert.match(validateQaResult(cropped).join('\n'), /cropSafety passes although a width fails/);
  const fail = result('svc-c', 'object-0', { verdict: 'fail', alt: null, reasons: ['second amber object'] });
  fail.checks.palette.pass = false;
  fail.checks.palette.amberObjects = 2;
  assert.deepEqual(validateQaResult(fail), [], 'a fail needs no alt and may have failing checks');
});

test('selectFromQa takes the highest-scoring passing candidate per slot, lower offset on a tie', () => {
  const { picks, skipped } = selectFromQa(
    [result('svc-c', 'object-0', { score: 6 }), result('svc-c', 'object-500', { score: 9 }), result('band-1', 'object-0', { score: 7 }), result('band-1', 'object-500', { score: 7 }), result('inset-contact', 'object-0', { verdict: 'fail', alt: null })],
    extract,
  );
  assert.deepEqual(picks.find((p: { slot: string }) => p.slot === 'svc-c')?.candidate, 'object-500');
  assert.deepEqual(picks.find((p: { slot: string }) => p.slot === 'band-1')?.candidate, 'object-0');
  assert.equal(picks.some((p: { slot: string }) => p.slot === 'inset-contact'), false);
  assert.ok(skipped.some((s: { slot: string; reason: string }) => s.slot === 'inset-contact' && /no passing candidate/.test(s.reason)));
});

test('figure policy: figures only on recommended slots, and the stage trio takes figures only if all three pass with one', () => {
  const stage = (id: string, figureScore: number | null) => [
    ...(figureScore === null ? [] : [result(id, 'figure-1000', { score: figureScore })]),
    result(id, 'object-0', { score: 5 }),
  ];
  const all = [...stage('stage-dream', 9), ...stage('stage-build', 9), ...stage('stage-grow', 9)];
  const trio = selectFromQa(all, extract).picks;
  for (const id of ['stage-dream', 'stage-build', 'stage-grow']) assert.equal(trio.find((p: { slot: string }) => p.slot === id)?.candidate, 'figure-1000', id);

  const partial = [...stage('stage-dream', 9), ...stage('stage-build', null), ...stage('stage-grow', 9)];
  for (const id of ['stage-dream', 'stage-build', 'stage-grow']) assert.equal(selectFromQa(partial, extract).picks.find((p: { slot: string }) => p.slot === id)?.candidate, 'object-0', `${id} falls back to objects together`);

  assert.equal(selectFromQa(all, extract, { figures: 'none' }).picks.find((p: { slot: string }) => p.slot === 'stage-dream')?.candidate, 'object-0');

  const optional = selectFromQa([result('svc-a', 'figure-1000', { score: 10 }), result('svc-a', 'object-0', { score: 3 })], extract).picks;
  assert.equal(optional.find((p: { slot: string }) => p.slot === 'svc-a')?.candidate, 'object-0', 'an optional slot takes a figure only by choice, not by default');
  const recommended = selectFromQa([result('svc-b', 'figure-1000', { score: 8 }), result('svc-b', 'object-0', { score: 9 })], extract).picks;
  assert.equal(recommended.find((p: { slot: string }) => p.slot === 'svc-b')?.candidate, 'object-0', 'the higher score wins on a recommended slot');
});

test('crop views: band crops at 1.9:1, 3.2:1 and 5:1 centred with a 12 percent side margin, the stage hexagon, the 70 percent card crop', () => {
  assert.deepEqual([...BAND_CROP_ASPECTS], [1.9, 3.2, 5]);
  const band = cropViews('band', [1024, 576]);
  assert.equal(band.length, 3);
  band.forEach((view: { rect: { width: number; height: number; top: number }; safe: { left: number; width: number } }, i: number) => {
    assert.equal(view.rect.width, 1024);
    assert.ok(Math.abs(view.rect.width / view.rect.height - (BAND_CROP_ASPECTS[i] as number)) < 0.02);
    assert.equal(view.rect.top, Math.round((576 - view.rect.height) / 2));
    assert.equal(view.safe.left, Math.round(1024 * 0.12));
    assert.equal(view.safe.width, Math.round(1024 * 0.76));
  });
  assert.equal(hexagonPoints([1000, 500]), '0,250 250,25 750,25 1000,250 750,475 250,475');
  const card = cropViews('inset', [1024, 768]);
  assert.deepEqual(card[0].rect, { left: 154, top: 115, width: 717, height: 538 });
  assert.equal(cropViews('stage', [1024, 768])[0].name, 'hexagon clip');
  assert.deepEqual(qaWidths([768, 512, 1024]), [512, 768, 1024]);
});
