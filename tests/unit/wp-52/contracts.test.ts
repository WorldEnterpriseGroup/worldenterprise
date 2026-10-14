import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BAND_TONES,
  VisualContractError,
  bandTone,
  cleanText,
  data,
  findDenied,
  milestones,
  orbitBodies,
  orbitPosterKey,
  ratioClass,
  sceneLabels,
  sceneRatio,
  stat,
  statSource,
  survivalSeries,
  teamRoles,
} from '../../../src/components/visuals/contracts.ts';
import { UBF_COMPONENTS } from '../../../src/components/visuals/ubf.ts';

const SOURCE = { label: 'U.S. Bureau of Labor Statistics, Business Employment Dynamics', href: 'https://www.bls.gov/bdm/bdmage.htm' };

test('copy: banned positioning words, UK spelling and lowercase "We build" are refused', () => {
  for (const bad of ['Join our cohort', 'An accelerator for founders', 'Free office hours', 'Perks for members', 'Weekly mentor calls', 'Our alumni', 'The investor network', 'The demo day', 'Brand colour', 'We build worlds', 'A valuation cap', 'Pro rata rights']) {
    assert.notEqual(findDenied(bad), null, bad);
    assert.throws(() => cleanText('T', 'label', bad), VisualContractError, bad);
  }
  for (const ok of ['WE builds worlds with the company', 'Dream', 'Fundability and Investor Readiness', 'Share still operating after ten years']) {
    assert.equal(findDenied(ok), null, ok);
    assert.equal(cleanText('T', 'label', ok), ok);
  }
});

test('copy: no prices anywhere in the visuals', () => {
  for (const price of ['$4,500 a month', '€300', '1200 USD', 'From $ 9']) assert.throws(() => cleanText('T', 'label', price), /price/, price);
  assert.throws(() => cleanText('T', 'label', '   '), /empty/);
  assert.equal(cleanText('T', 'alt', '', { allowEmpty: true }), '');
});

test('scene ratios map to classes and unknown ratios fail', () => {
  assert.equal(sceneRatio('Scene', '21/9'), '21/9');
  assert.equal(ratioClass('16/9'), 'ratio-16-9');
  assert.throws(() => sceneRatio('Scene', '2/1'), VisualContractError);
});

test('scene labels: bounds, trimming and descriptions are checked', () => {
  assert.equal(sceneLabels('X', [{ label: ' Dream ' }], 1, 3)[0]?.label, 'Dream');
  assert.throws(() => sceneLabels('X', [], 1, 3), /1 to 3 labels/);
  assert.throws(() => sceneLabels('X', [{ label: 'A', description: 'free trial' }], 1, 3), /free/);
  assert.equal(orbitBodies('Orbit', Array.from({ length: 12 }, (_, i) => ({ label: `Body ${i}` }))).length, 12);
  assert.throws(() => orbitBodies('Orbit', Array.from({ length: 13 }, (_, i) => ({ label: `Body ${i}` }))));
});

test('orbit posters exist only for the canonical layouts', () => {
  assert.equal(orbitPosterKey(7, 'single'), 'orbit-7-single');
  assert.equal(orbitPosterKey(10, 'nested'), 'orbit-10-nested');
  assert.equal(orbitPosterKey(5, 'single'), null);
  assert.equal(orbitPosterKey(7, 'nested'), null);
});

test('statistics need a source with an https link, a number, and never a price', () => {
  assert.throws(() => statSource('S', undefined), /needs a source/);
  assert.throws(() => statSource('S', { label: ' ' }), /needs a source/);
  assert.throws(() => statSource('S', { label: 'BLS', href: 'http://www.bls.gov' }), /https/);
  assert.equal(statSource('S', SOURCE).label, SOURCE.label);
  assert.equal(stat('S', { value: '49.2%', label: 'Still operating after five years', source: SOURCE }).value, '49.2%');
  assert.throws(() => stat('S', { value: 'Most', label: 'x', source: SOURCE }), /no number/);
  assert.throws(() => stat('S', { value: '$12', label: 'x', source: SOURCE }), /price/);
});

test('survival series: one to three, years increasing from zero, percents in range', () => {
  const ok = { label: 'All', points: [{ year: 0, percent: 100 }, { year: 1, percent: 79.6 }] };
  assert.equal(survivalSeries('C', [ok]).length, 1);
  assert.throws(() => survivalSeries('C', []), /1 to 3/);
  assert.throws(() => survivalSeries('C', [ok, ok, ok, ok]), /1 to 3/);
  assert.throws(() => survivalSeries('C', [{ label: 'A', points: [{ year: 0, percent: 100 }] }]), /two points/);
  assert.throws(() => survivalSeries('C', [{ label: 'A', points: [{ year: 1, percent: 90 }, { year: 1, percent: 80 }] }]), /increase/);
  assert.throws(() => survivalSeries('C', [{ label: 'A', points: [{ year: 0, percent: 100 }, { year: 1, percent: 120 }] }]), /outside 0 to 100/);
});

test('chart data: counts, non-negative values, no prices in the display form', () => {
  assert.equal(data('Bar', [{ label: 'A', value: 1 }, { label: 'B', value: 0 }], 2, 10).length, 2);
  assert.throws(() => data('Bar', [{ label: 'A', value: 1 }], 2, 10), /2 to 10/);
  assert.throws(() => data('Bar', [{ label: 'A', value: -1 }, { label: 'B', value: 1 }], 2, 10), /zero or more/);
  assert.throws(() => data('Bar', [{ label: 'A', value: 1, display: '$1' }, { label: 'B', value: 1 }], 2, 10), /price/);
});

test('timeline milestones: horizon 1 to 20, in range, sorted, sourced when given', () => {
  const out = milestones('T', [{ at: 5, label: 'Five', kind: 'survival', source: SOURCE }, { at: 0.5, label: 'First payroll' }], 10);
  assert.deepEqual(out.map((m) => m.at), [0.5, 5]);
  assert.equal(out[0]?.kind, 'event');
  assert.throws(() => milestones('T', [{ at: 11, label: 'Late' }], 10), /outside/);
  assert.throws(() => milestones('T', [{ at: 1, label: 'x' }], 25), /horizon/);
  assert.throws(() => milestones('T', [], 10), /1 to 12/);
  assert.throws(() => milestones('T', [{ at: 1, label: 'x', source: { label: 'X', href: 'ftp://x' } }], 10), /https/);
});

test('team roles: one to ten, roles never priced', () => {
  assert.equal(teamRoles('Team', [{ role: 'Delivery lead', level: 'Steering' }]).length, 1);
  assert.throws(() => teamRoles('Team', []), /1 to 10/);
  assert.throws(() => teamRoles('Team', Array.from({ length: 11 }, () => ({ role: 'QA' }))), /1 to 10/);
  assert.throws(() => teamRoles('Team', [{ role: 'QA at $40 an hour' }]), /price/);
});

test('band tones are the six the layout layer defines; anything else is refused', () => {
  assert.deepEqual([...BAND_TONES], ['plain', 'soft', 'tint-blue', 'tint-sand', 'tint-stone', 'deep']);
  for (const tone of BAND_TONES) assert.equal(bandTone('Band', tone), tone);
  assert.throws(() => bandTone('Band', 'dark'), VisualContractError);
  assert.throws(() => bandTone('Band', 'wide'), VisualContractError);
});

test('the UBF planetarium has the ten components in order, each with a clean one-line definition', () => {
  assert.deepEqual(
    UBF_COMPONENTS.map((c) => c.label),
    ['Galaxy', 'Black Hole', 'Super Nova', 'Solar System', 'Sun', 'Super Star', 'Star', 'Moon', 'Comet', 'Asteroid'],
  );
  for (const c of UBF_COMPONENTS) {
    assert.equal(cleanText('UbfDiagram', 'description', c.description), c.description);
    assert.ok(c.description.length < 80, c.label);
  }
  assert.equal(orbitPosterKey(UBF_COMPONENTS.length, 'nested'), 'orbit-10-nested', 'the planetarium uses its own rendered poster');
});
