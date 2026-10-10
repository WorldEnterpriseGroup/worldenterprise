import assert from 'node:assert/strict';
import test from 'node:test';
import { compareActions, firstLive, industryActions, journeyActions, segmentActions } from '../../../src/components/families/actions.ts';
import { COMPARE_ROWS } from '../../../src/components/families/copy.ts';
import {
  assertFamilyData,
  cardFor,
  entryIdFor,
  findHubPage,
  hasEntry,
  hubEntryId,
  idVariants,
  liveCards,
  resolveEntries,
} from '../../../src/components/families/paths.ts';
import type { CompareData, IndustryData, JourneyData, Registry, RegistryEntry, SegmentData } from '../../../src/components/families/types.ts';
import { compareView, industryView, journeySteps, journeyView, readingPath, routeOf, segmentView } from '../../../src/components/families/view.ts';
import { PROGRAM_STEPS } from '../../../src/components/program/steps.ts';

// WP-71: the pure layer under the family templates, driven by fabricated registries and pages. The real registry (WP-60's
// src/data/families.ts) is exercised by families-registry.test.ts once it is in the tree.

const entry = (slug: string, order: number, extra: Partial<RegistryEntry> = {}): RegistryEntry => ({
  slug,
  path: `/industries/${slug}/`,
  label: `Label ${slug}`,
  order,
  launch: true,
  ...extra,
});

const registry: Registry = {
  id: 'industries',
  folder: 'industries',
  entries: [entry('c-third', 3), entry('a-first', 1), entry('b-second', 2), entry('d-cut', 4, { launch: false }), entry('e-nofile', 5)],
};

const page = (id: string, description = `About ${id}`) => ({ id, description });

// ---------------------------------------------------------------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------------------------------------------------------------

test('entry ids mirror the folder, and an index id has both spellings', () => {
  assert.equal(entryIdFor(registry, 'a-first'), 'industries/a-first');
  assert.equal(hubEntryId(registry), 'industries/index');
  assert.deepEqual(idVariants('industries/index'), ['industries/index', 'industries']);
  assert.deepEqual(idVariants('industries/a-first'), ['industries/a-first']);
  assert.equal(hasEntry(new Set(['industries']), 'industries/index'), true);
  assert.equal(hasEntry(new Set(['industries/index']), 'industries/index'), true);
  assert.equal(hasEntry(new Set(['industries/x']), 'industries/index'), false);
});

test('a route exists only for a launched slug that has a page, in registry order, not file order', () => {
  const pages = [page('industries/b-second'), page('industries/d-cut'), page('industries/c-third'), page('industries/a-first'), page('industries/index')];
  assert.deepEqual(
    resolveEntries(registry, pages).map((r) => r.entry.slug),
    ['a-first', 'b-second', 'c-third'],
  );
});

test('a slug with no pages entry produces no route, and a page the registry does not list produces none', () => {
  const pages = [page('industries/a-first'), page('industries/unlisted')];
  assert.deepEqual(
    resolveEntries(registry, pages).map((r) => r.entry.slug),
    ['a-first'],
  );
  assert.deepEqual(resolveEntries(registry, []), []);
});

test('the hub page is found under either id spelling, or is undefined', () => {
  assert.equal(findHubPage(registry, [page('industries/index')])?.id, 'industries/index');
  assert.equal(findHubPage(registry, [page('industries')])?.id, 'industries');
  assert.equal(findHubPage(registry, [page('industries/a-first')]), undefined);
});

test('assertFamilyData throws a precise message for a missing object, a wrong id and a wrong slug', () => {
  const ok: SegmentData = { id: 'segments', slug: 'solo', whoFor: 'x', challenges: [], sources: [] };
  assert.equal(assertFamilyData<SegmentData>({ ...registry, id: 'segments', folder: 'founders' }, 'solo', ok, 'segments'), ok);
  assert.throws(() => assertFamilyData(registry, 'solo', undefined, 'industries'), /no `family` object/);
  assert.throws(() => assertFamilyData(registry, 'solo', ok, 'industries'), /family\.id is "segments" but the industries template renders "industries"/);
  assert.throws(() => assertFamilyData({ ...registry, id: 'segments' }, 'other', ok, 'segments'), /family\.slug is "solo"/);
});

test('a card for an entry with a blocked word is the label alone', () => {
  assert.deepEqual(cardFor(entry('a-first', 1), page('industries/a-first')), {
    title: 'Label a-first',
    href: '/industries/a-first/',
    description: 'About industries/a-first',
  });
  const blocked = cardFor(entry('x', 1, { blockedWord: 'cohort' }), page('industries/x'));
  assert.deepEqual(blocked, { title: 'Label x', href: '/industries/x/' });
  assert.equal('description' in blocked, false);
});

test('hub cards keep only routes that are live in this build', () => {
  const pages = [page('industries/a-first'), page('industries/b-second'), page('industries/c-third')];
  const cards = liveCards(registry, pages, (path) => path !== '/industries/b-second/');
  assert.deepEqual(
    cards.map((c) => c.title),
    ['Label a-first', 'Label c-third'],
  );
  assert.deepEqual(liveCards(registry, pages, () => false), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// view
// ---------------------------------------------------------------------------------------------------------------------------------

test('the reading path lists articles that name the segment: zero, one or many, newest first, then by title', () => {
  const articles = [
    { title: 'Zeta', href: '/insights/zeta/', segments: ['solo'], published: new Date('2026-01-01') },
    { title: 'Alpha', href: '/insights/alpha/', segments: ['solo', 'team'], published: new Date('2026-01-01') },
    { title: 'Newest', href: '/insights/newest/', segments: ['solo'], published: new Date('2026-06-01'), summary: 'Summary' },
    { title: 'Other', href: '/insights/other/', segments: ['team'] },
  ];
  assert.deepEqual(
    readingPath(articles, 'solo').map((l) => l.title),
    ['Newest', 'Alpha', 'Zeta'],
  );
  assert.equal(readingPath(articles, 'solo')[0]?.description, 'Summary');
  assert.equal(readingPath(articles, 'team').length, 2);
  assert.deepEqual(readingPath(articles, 'nobody'), []);
});

test('the segment view passes the page data through unchanged', () => {
  const data: SegmentData = { id: 'segments', slug: 'solo', whoFor: 'A founder on their own.', challenges: [{ title: 'T', text: 'X' }], sources: [] };
  const view = segmentView(data, []);
  assert.equal(view.whoFor, data.whoFor);
  assert.deepEqual(view.challenges, data.challenges);
});

const sources = (ids: string[]) => ids.map((id) => ({ id, title: `Title ${id}`, publisher: 'Publisher', url: `https://example.org/${id}`, accessed: new Date('2026-09-01') }));

const industry: IndustryData = {
  id: 'industries',
  slug: 'fintech',
  buyer: 'Buyer text.',
  perimeter: [
    { title: 'One', text: 'First.', jurisdiction: 'US', asOf: new Date('2026-10-12'), sourceId: 'b' },
    { title: 'Two', text: 'Second.', jurisdiction: 'EU', asOf: new Date('2026-01-01'), sourceId: 'a' },
  ],
  dataQuestions: ['Where does the data live?'],
  salesCycle: 'Cycle text.',
  sources: sources(['a', 'b']),
};

test('the industry view numbers each item by its source position, and formats "as of" in UTC', () => {
  const view = industryView(industry);
  assert.deepEqual(
    view.perimeter.map((p) => [p.sourceNumber, p.sourceHref, p.asOf]),
    [
      [2, '#source-b', 'As of October 12, 2026'],
      [1, '#source-a', 'As of January 1, 2026'],
    ],
  );
});

test('an industry item that cites an unknown source throws, naming the page and the item', () => {
  const broken: IndustryData = { ...industry, perimeter: [{ ...industry.perimeter[0]!, sourceId: 'zzz' }] };
  assert.throws(() => industryView(broken), /fintech.*"One".*"zzz"/);
});

const compare: CompareData = {
  id: 'compare',
  slug: 'a-vs-b',
  sides: [
    { name: 'Left', whatItIs: 'L1', whoItFits: 'L2', asksOfFounder: 'L3', askThis: ['lq'] },
    { name: 'Right', whatItIs: 'R1', whoItFits: 'R2', asksOfFounder: 'R3', askThis: ['rq'] },
  ],
  whereEachFits: ['left fits', 'right fits'],
  definitions: [{ term: 'Term', text: 'Def.', sourceId: 'a' }],
  sources: sources(['a']),
};

test('the comparison view is neutral: swapping the sides swaps every cell and nothing else', () => {
  const forward = compareView(compare);
  const swapped = compareView({ ...compare, sides: [compare.sides[1], compare.sides[0]], whereEachFits: [compare.whereEachFits[1], compare.whereEachFits[0]] });
  assert.deepEqual(forward.rows.map((r) => r.label), COMPARE_ROWS.map((r) => r.label));
  assert.deepEqual(swapped.names, [forward.names[1], forward.names[0]]);
  for (const [i, row] of forward.rows.entries()) assert.deepEqual(swapped.rows[i]?.cells, [row.cells[1], row.cells[0]]);
  assert.deepEqual(swapped.asks, [forward.asks[1], forward.asks[0]]);
  assert.deepEqual(swapped.fits, [forward.fits[1], forward.fits[0]]);
  assert.deepEqual(forward.definitions[0], { term: 'Term', text: 'Def.', sourceNumber: 1, sourceHref: '#source-a' });
});

test('a definition that cites an unknown source throws', () => {
  assert.throws(() => compareView({ ...compare, definitions: [{ term: 'T', text: 'x', sourceId: 'nope' }] }), /a-vs-b.*"nope"/);
});

test('journey steps equal the program steps in order with no duration, and are marked relative to the page step', () => {
  const steps = journeySteps(PROGRAM_STEPS, 3);
  assert.deepEqual(steps.map((s) => s.title), PROGRAM_STEPS.map((s) => s.title));
  assert.deepEqual(steps.map((s) => s.state), ['done', 'done', 'current', 'next', 'next']);
  assert.deepEqual(journeySteps(PROGRAM_STEPS).map((s) => s.state), ['next', 'next', 'next', 'next', 'next']);
  for (const step of steps) assert.doesNotMatch(`${step.title} ${step.body}`, /\b(days?|weeks?|months?|hours?)\b.*\d|\d.*\b(days?|weeks?|months?|hours?)\b/i);
});

const journey: JourneyData = {
  id: 'journey',
  slug: 'after-you-apply',
  stage: 'conversion',
  step: 2,
  questions: ['q'],
  checklist: [
    { id: 'c1', text: 'Live link', href: '/tools/#section' },
    { id: 'c2', text: 'Dead link', href: '/gone/' },
    { id: 'c3', text: 'No link' },
  ],
  sources: [],
};

test('a checklist link renders only when its route is live; a hash or query does not change the route', () => {
  const view = journeyView(journey, PROGRAM_STEPS, (path) => path === '/tools/');
  assert.deepEqual(view.checklist, [{ id: 'c1', text: 'Live link', href: '/tools/#section' }, { id: 'c2', text: 'Dead link' }, { id: 'c3', text: 'No link' }]);
  assert.equal(view.current, 2);
  assert.equal(routeOf('/a/?x=1#y'), '/a/');
  assert.equal(routeOf('/a/'), '/a/');
});

test('a journey step outside the program throws', () => {
  assert.throws(() => journeyView({ ...journey, step: 0 }, PROGRAM_STEPS, () => true), /step 0/);
  assert.throws(() => journeyView({ ...journey, step: PROGRAM_STEPS.length + 1 }, PROGRAM_STEPS, () => true), /outside the 5 steps/);
  assert.equal(journeyView({ ...journey, step: undefined }, PROGRAM_STEPS, () => true).current, undefined);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------------------------------------------------------------

const all = () => true;
const only = (...paths: string[]) => (path: string) => paths.includes(path);

test('hero actions follow section 6.2 with every candidate checked against the live routes', () => {
  assert.deepEqual(industryActions(all), {
    primary: { label: 'Apply', href: '/apply/' },
    secondary: { label: 'Read the sector articles', href: '/insights/topic/sectors/' },
  });
  assert.equal(industryActions(only('/apply/', '/briefs/')).secondary?.href, '/briefs/');
  assert.equal(compareActions(all).secondary?.href, '/program/how-it-works/');
  assert.deepEqual(compareActions(only('/apply/')), { primary: { label: 'Apply', href: '/apply/' } });
});

test('with nothing live a hero carries no action at all', () => {
  const none = () => false;
  for (const actions of [industryActions(none), compareActions(none), journeyActions('index', none), segmentActions(undefined, [], none)]) {
    assert.deepEqual(actions, {});
  }
});

test('a segment page prefers its own brief, then tools or contact by override, then the brief hub', () => {
  const briefs = [{ slug: 'security-review', path: '/briefs/security-review/', label: 'Security review' }];
  assert.equal(segmentActions({ variant: 'brief', briefId: 'security-review' }, briefs, all).secondary?.href, '/briefs/security-review/');
  assert.equal(segmentActions({ variant: 'brief', briefId: 'unknown' }, briefs, all).secondary?.href, '/briefs/');
  assert.equal(segmentActions({ variant: 'tools' }, briefs, all).secondary?.href, '/tools/');
  assert.equal(segmentActions({ variant: 'contact' }, briefs, all).secondary?.href, '/contact/');
  assert.equal(segmentActions(undefined, briefs, all).secondary?.href, '/briefs/');
  // The brief is not live, so the hub stands in; neither live, no secondary.
  assert.equal(segmentActions({ variant: 'brief', briefId: 'security-review' }, briefs, only('/apply/', '/briefs/')).secondary?.href, '/briefs/');
  assert.equal(segmentActions(undefined, briefs, only('/apply/')).secondary, undefined);
});

test('the journey hub and pages point at the next page in order; the last points at the tools hub', () => {
  assert.equal(journeyActions('index', all).secondary?.href, '/journey/after-you-apply/');
  assert.equal(journeyActions('after-you-apply', all).secondary?.href, '/journey/first-months/');
  assert.equal(journeyActions('first-months', all).secondary?.href, '/journey/onboarding-checklist/');
  assert.equal(journeyActions('onboarding-checklist', all).secondary?.href, '/tools/');
  assert.equal(journeyActions('unknown-slug', all).secondary, undefined);
  assert.equal(journeyActions('index', only('/apply/')).secondary, undefined);
});

test('firstLive skips undefined and dead candidates', () => {
  assert.equal(firstLive([undefined, { label: 'A', href: '/a/' }], only('/a/'))?.href, '/a/');
  assert.equal(firstLive([{ label: 'A', href: '/a/' }], () => false), undefined);
});
