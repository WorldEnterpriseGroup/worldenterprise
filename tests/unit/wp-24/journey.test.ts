import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PHASE_LABELS, journeyHolds } from '../../../src/components/hubs/journey.ts';
import { HUB_MOMENTS } from '../../../src/components/hubs/moments.ts';
import { PROGRAM_STEPS } from '../../../src/components/program/steps.ts';

// WP-24 (#90): the journey hub's moments draw the program's own steps. The journey pages state no duration and make no promise (the
// WP-72 contract reads the whole of main), so neither moment may carry a time, a figure or a program word, and the shared ecosystem
// block on every hub stays inside each hub's own copy contract.

const root = new URL('../../../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, root), 'utf8');

// The patterns of tests/e2e/wave8/wp-72/journey.spec.ts, wp-64/investor-journey.spec.ts and wp-76/tools-hub.spec.ts.
const DURATION = /\b\d+\s*[-–]?\s*(?:hours?|days?|weeks?|months?|quarters?|years?)\b|\b30\s*[/-]\s*60\s*[/-]\s*90\b/i;
const PROMISE = /\b(?:free of charge|no fee|no equity|success fee|guaranteed|perks?|accelerator|cohort|mentors?)\b/i;
const INVESTOR_NETWORK = /investor network|our investors|portfolio companies/i;
const TOOL_COUNT = /\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+) (?:free )?tools\b/i;

test('the journey holds follow the program: one per step, in order, with its title', () => {
  const holds = journeyHolds();
  assert.deepEqual(
    holds.map((h) => h.step),
    PROGRAM_STEPS.map((s) => s.title),
  );
  // icons.ts globs the files through Vite, so the test checks the icon file itself.
  for (const h of holds) assert.ok(existsSync(new URL(`src/assets/visuals/icons/icon-${h.icon}.svg`, root)), `${h.step}: no icon file for ${h.icon}`);
});

test('the way in comes first and the cycle closes the list, as steps four and five describe', () => {
  const phases = journeyHolds().map((h) => h.phase);
  assert.deepEqual(phases, ['way-in', 'way-in', 'way-in', 'cycle', 'cycle']);
  assert.match(PROGRAM_STEPS[3]?.body ?? '', /cycles/);
  assert.match(PROGRAM_STEPS[4]?.body ?? '', /next cycle/);
});

test('each hold is said in the words of its step body', () => {
  // A key phrase of every hold appears in its step's body, so the index paraphrases nothing the program does not say.
  const KEYS = ['one-page read', 'order form', 'roles the plan calls for', 'stated goal', 'next cycle holds'];
  journeyHolds().forEach((h, i) => {
    const key = KEYS[i] ?? '';
    assert.ok(h.holds.includes(key), `${h.step}: the hold does not carry "${key}"`);
    assert.ok((PROGRAM_STEPS[i]?.body ?? '').includes(key), `${h.step}: the step body does not say "${key}"`);
  });
});

test('the journey moments carry no duration, no figure word and no promise', () => {
  const words = [...journeyHolds().flatMap((h) => [h.step, h.holds]), ...Object.values(PHASE_LABELS)];
  for (const rel of ['src/components/hubs/JourneyLoop.astro', 'src/components/hubs/JourneyHolds.astro']) {
    const markup = read(rel).split('---').slice(2).join('---');
    words.push(markup.replace(/<style[\s\S]*?<\/style>/g, ''));
  }
  for (const text of words) {
    assert.doesNotMatch(text, DURATION);
    assert.doesNotMatch(text, PROMISE);
  }
  assert.doesNotMatch(read('src/pages/journey/[...hub].astro'), /LongHorizonTimeline|roundAgeBars|JOURNEY_CLOCK/);
  assert.deepEqual(HUB_MOMENTS['/journey/']?.moments, ['hub-journey-loop', 'hub-journey-hold']);
});

test('the ecosystem block on every hub meets the investors, journey and tools contracts', () => {
  const markup = read('src/components/hubs/HubEcosystem.astro').split('---').slice(2).join('---').replace(/<style[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(markup, INVESTOR_NETWORK);
  assert.doesNotMatch(markup, PROMISE);
  assert.doesNotMatch(markup, DURATION);
});

test('the tools hub filter names no number of tools', () => {
  assert.match(read('src/pages/tools/index.astro'), /<FilterIndex id="tool-filter"[^>]*counts=\{false\}/);
  const filter = read('src/components/hubs/FilterIndex.astro');
  assert.match(filter, /counts = true/);
  assert.match(filter, /\{counts && \(/);
  assert.doesNotMatch(read('src/pages/tools/index.astro').replace(/^---[\s\S]*?---/, ''), TOOL_COUNT);
});

test('the resources hub opens with "Start where you are": the WP-24 figures sit under that h2', () => {
  const page = read('src/pages/resources/index.astro');
  const stageHeading = page.indexOf('<h2 id="resources-stage">');
  const lead = page.indexOf('<HubLead label="The resources at a glance"');
  assert.ok(stageHeading > 0 && lead > stageHeading, 'the lead follows the stage heading');
  assert.match(page.slice(lead, page.indexOf('</HubLead>', lead)), /headingLevel=\{3\}/);
});
