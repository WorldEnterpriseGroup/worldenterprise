import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { assertFamilyData, cardFor, liveCards, resolveEntries } from '../../../src/components/families/paths.ts';
import type { CompareData, IndustryData, JourneyData, Registry, SegmentData } from '../../../src/components/families/types.ts';
import { compareView, industryView, journeyView, segmentView } from '../../../src/components/families/view.ts';
import { PROGRAM_STEPS } from '../../../src/components/program/steps.ts';
import { BRIEFS, COMPARISONS, INDUSTRIES, JOURNEY, SEGMENTS, familyLabel } from '../../../src/data/families.ts';

// WP-71 against the real registry (WP-60's src/data/families.ts), with fabricated page content: the registry says which slugs exist,
// the fixtures stand in for the content packages' files. Fixture text is plain filler, never published copy.

const ROOT = new URL('../../../', import.meta.url).pathname;
const text = (slug: string) => `Fixture text for ${slug}.`;
const source = (id: string) => ({ id, title: `Fixture source ${id}`, publisher: 'Fixture publisher', url: `https://example.org/${id}`, accessed: new Date('2026-09-01') });

const segment = (slug: string): SegmentData => ({ id: 'segments', slug, whoFor: text(slug), challenges: [{ title: 'Challenge', text: text(slug) }], sources: [source('a')] });
const industry = (slug: string): IndustryData => ({
  id: 'industries',
  slug,
  buyer: text(slug),
  perimeter: [{ title: 'Item', text: text(slug), jurisdiction: 'US', asOf: new Date('2026-09-01'), sourceId: 'a' }],
  dataQuestions: [text(slug)],
  salesCycle: text(slug),
  sources: [source('a')],
});
const compare = (slug: string): CompareData => ({
  id: 'compare',
  slug,
  sides: [
    { name: 'First', whatItIs: text(slug), whoItFits: text(slug), asksOfFounder: text(slug), askThis: [text(slug)] },
    { name: 'Second', whatItIs: text(slug), whoItFits: text(slug), asksOfFounder: text(slug), askThis: [text(slug)] },
  ],
  whereEachFits: [text(slug), text(slug)],
  definitions: [{ term: 'Term', text: text(slug), sourceId: 'a' }],
  sources: [source('a')],
});
const journey = (slug: string, step: number): JourneyData => ({ id: 'journey', slug, stage: 'consideration', step, questions: [text(slug)], sources: [source('a')] });

/** One fixture `pages` entry per launched registry slug, as the glob loader would name them. */
const pagesFor = (registry: Registry) => registry.entries.map((e) => ({ id: `${registry.folder}/${e.slug}`, description: text(e.slug) }));

test('every launched segment slug gets a route and renders a fixture page', () => {
  const routes = resolveEntries(SEGMENTS, pagesFor(SEGMENTS));
  assert.deepEqual(routes.map((r) => r.entry.slug), SEGMENTS.entries.filter((e) => e.launch).map((e) => e.slug));
  for (const { entry } of routes) {
    const data = assertFamilyData<SegmentData>(SEGMENTS, entry.slug, segment(entry.slug), 'segments');
    assert.equal(segmentView(data, []).challenges.length, 1);
  }
});

test('every launched industry slug gets a route and renders a fixture page', () => {
  const routes = resolveEntries(INDUSTRIES, pagesFor(INDUSTRIES));
  assert.equal(routes.length, INDUSTRIES.entries.filter((e) => e.launch).length);
  for (const { entry } of routes) {
    const view = industryView(assertFamilyData<IndustryData>(INDUSTRIES, entry.slug, industry(entry.slug), 'industries'));
    assert.equal(view.perimeter[0]?.sourceNumber, 1);
  }
});

test('every launched comparison slug gets a route and renders a fixture page', () => {
  const routes = resolveEntries(COMPARISONS, pagesFor(COMPARISONS));
  assert.equal(routes.length, COMPARISONS.entries.filter((e) => e.launch).length);
  for (const { entry } of routes) {
    const view = compareView(assertFamilyData<CompareData>(COMPARISONS, entry.slug, compare(entry.slug), 'compare'));
    assert.equal(view.rows.length, 3);
  }
});

test('every launched journey slug gets a route and renders a fixture page', () => {
  const routes = resolveEntries(JOURNEY, pagesFor(JOURNEY));
  assert.equal(routes.length, JOURNEY.entries.filter((e) => e.launch).length);
  for (const [index, { entry }] of routes.entries()) {
    const data = assertFamilyData<JourneyData>(JOURNEY, entry.slug, journey(entry.slug, index + 1), 'journey');
    assert.equal(journeyView(data, PROGRAM_STEPS, () => true).steps.length, PROGRAM_STEPS.length);
  }
});

test('a registry slug with no pages entry produces no route, in every family', () => {
  for (const registry of [SEGMENTS, INDUSTRIES, COMPARISONS, JOURNEY]) {
    assert.deepEqual(resolveEntries(registry, []), [], registry.id);
    const [first, ...rest] = registry.entries;
    assert.ok(first);
    // One file present: exactly one route, never one per registry entry.
    assert.deepEqual(resolveEntries(registry, pagesFor(registry).slice(0, 1)).map((r) => r.entry.slug), [first.slug]);
    assert.ok(rest.length > 0);
  }
});

test('a family object that names another slug or family is refused, so a mis-filed page fails the build with its file named', () => {
  const [first, second] = SEGMENTS.entries;
  assert.ok(first && second);
  assert.throws(() => assertFamilyData<SegmentData>(SEGMENTS, first.slug, segment(second.slug), 'segments'), new RegExp(`founders/${first.slug}.*family\\.slug is "${second.slug}"`));
  assert.throws(() => assertFamilyData<IndustryData>(INDUSTRIES, 'fintech', segment('fintech'), 'industries'), /family\.id is "segments"/);
});

test('hub cards are labels from the registry; the entry that carries a blocked word is the label alone', () => {
  const blocked = COMPARISONS.entries.filter((e) => e.blockedWord !== undefined);
  assert.equal(blocked.length, 1);
  const [entry] = blocked;
  assert.ok(entry?.blockedWord);
  const card = cardFor(entry, { id: `compare/${entry.slug}`, description: `A description that names ${entry.blockedWord}.` });
  assert.equal(card.title, familyLabel(entry));
  assert.equal(card.description, undefined);
  // The slug in the href is the registry's own and may hold the word; the words a reader sees (title and description) never do.
  const listed = liveCards(COMPARISONS, pagesFor(COMPARISONS).map((p) => ({ ...p, description: `About ${entry.blockedWord}` })), () => true).find((c) => c.href === entry.path);
  assert.ok(listed);
  assert.doesNotMatch(`${listed.title} ${listed.description ?? ''}`, new RegExp(entry.blockedWord, 'i'));
});

test('every family folder has its route file, and each route file routes through the registry and the shared path helpers', () => {
  const files: readonly [string, string][] = [
    ['src/pages/founders/[segment].astro', 'SEGMENTS'],
    ['src/pages/industries/[vertical].astro', 'INDUSTRIES'],
    ['src/pages/compare/[pair].astro', 'COMPARISONS'],
    ['src/pages/journey/[page].astro', 'JOURNEY'],
    ['src/pages/industries/index.astro', 'INDUSTRIES'],
    ['src/pages/compare/index.astro', 'COMPARISONS'],
    ['src/pages/journey/index.astro', 'JOURNEY'],
  ];
  for (const [file, registry] of files) {
    assert.ok(existsSync(`${ROOT}${file}`), `${file} is missing`);
    const source = readFileSync(`${ROOT}${file}`, 'utf8');
    assert.match(source, new RegExp(`\\b${registry}\\b`), `${file} does not use ${registry}`);
    assert.match(source, /ogSlotFor\(/, `${file} does not set its open graph card`);
    if (file.includes('[')) {
      assert.match(source, /resolveEntries\(/, `${file} does not route through resolveEntries`);
      assert.match(source, /assertFamilyData</, `${file} does not check its family object`);
    }
  }
});

test('the briefs are not a WP-71 family: no route file and no template reads the briefs registry', () => {
  assert.ok(BRIEFS.entries.length > 0);
  for (const file of ['src/components/families/paths.ts', 'src/components/families/load.ts', 'src/components/families/FamilyHubPage.astro']) {
    assert.doesNotMatch(readFileSync(`${ROOT}${file}`, 'utf8'), /\bBRIEFS\b/, file);
  }
});
