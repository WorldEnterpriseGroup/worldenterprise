import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESKS } from '../../../src/data/desks.ts';
import { BRIEF_IDS } from '../../../src/data/families.ts';
import { briefsSchema, familySchema, insightsSchema, pagesSchema, portfolioSchema } from '../../../src/lib/content-schemas.ts';

/** The wave 8 additions to the collection schemas (docs/wave8-contracts.md sections 2, 5.2, 6.1, 7, 8.2), parsed as plain Node. */

const text = (n: number): string => 'word '.repeat(Math.ceil(n / 5)).slice(0, n).trim().padEnd(n, 'x');
const source = (id: string) => ({ id, title: `Source ${id}`, publisher: 'Publisher', url: `https://example.gov/${id}`, accessed: '2026-10-12' });

const insight = {
  title: 'A title',
  description: text(80),
  topic: 'funding',
  publishedDate: '2026-10-12',
  sources: [source('a'), source('b')],
};

test('insights: the topic enum is exactly the registry desks', () => {
  for (const topic of DESKS) assert.ok(insightsSchema.safeParse({ ...insight, topic }).success, topic);
  assert.ok(!insightsSchema.safeParse({ ...insight, topic: 'finance' }).success);
});

test('insights: segments, related and cta are optional and default empty', () => {
  const parsed = insightsSchema.parse(insight);
  assert.deepEqual(parsed.segments, []);
  assert.deepEqual(parsed.related, []);
  assert.equal(parsed.cta, undefined);
});

test('insights: segments must be registry slugs', () => {
  assert.ok(insightsSchema.safeParse({ ...insight, segments: ['first-time-founders', 'solo-founders'] }).success);
  assert.ok(!insightsSchema.safeParse({ ...insight, segments: ['first-time'] }).success, 'the short name is not a slug');
});

test('insights: cta takes a variant and, only with the brief variant, a registry brief id', () => {
  assert.ok(insightsSchema.safeParse({ ...insight, cta: { variant: 'apply' } }).success);
  assert.ok(insightsSchema.safeParse({ ...insight, cta: { variant: 'brief', briefId: BRIEF_IDS[0] } }).success);
  assert.ok(!insightsSchema.safeParse({ ...insight, cta: { variant: 'brief', briefId: 'not-a-brief' } }).success);
  assert.ok(!insightsSchema.safeParse({ ...insight, cta: { variant: 'apply', briefId: BRIEF_IDS[0] } }).success);
  assert.ok(!insightsSchema.safeParse({ ...insight, cta: { variant: 'urgent' } }).success);
});

test('insights: the two-source rule still holds', () => {
  assert.ok(!insightsSchema.safeParse({ ...insight, sources: [source('a')] }).success);
  assert.ok(insightsSchema.safeParse({ ...insight, sources: [], noStatistics: true }).success);
});

const brief = {
  title: 'Funding paths',
  subtitle: 'The routes to capital, side by side',
  description: text(90),
  topics: ['funding'],
  audience: ['startup'],
  outline: ['What each instrument is', 'What to ask counsel'],
  updated: '2026-10-20',
};

test('briefs: the abstract schema takes one or two desks and the four audiences', () => {
  assert.ok(briefsSchema.safeParse(brief).success);
  assert.ok(briefsSchema.safeParse({ ...brief, topics: ['gtm', 'grow'], audience: ['corporate'] }).success);
  assert.ok(!briefsSchema.safeParse({ ...brief, topics: [] }).success);
  assert.ok(!briefsSchema.safeParse({ ...brief, topics: ['funding', 'legal', 'ai'] }).success);
  assert.ok(!briefsSchema.safeParse({ ...brief, audience: ['everyone'] }).success);
  assert.ok(!briefsSchema.safeParse({ ...brief, sentinel: 'a body sentence' }).success, 'the strict schema keeps body text out of the abstract');
});

const consentRecord = { recordedOn: '2026-10-20', scope: ['name'], reference: 'register-0001' };
const entry = { company: 'Example Co', consent: true, consentRecord, source: { kind: 'founder-written', reference: 'register-0001' } };

test('portfolio: an entry needs consent, a consent record and a source', () => {
  assert.ok(portfolioSchema.safeParse(entry).success);
  assert.ok(!portfolioSchema.safeParse({ ...entry, consent: false }).success);
  const { consentRecord: _unused, ...withoutRecord } = entry;
  assert.ok(!portfolioSchema.safeParse(withoutRecord).success);
  assert.ok(!portfolioSchema.safeParse({ ...entry, consentRecord: { ...consentRecord, scope: [] } }).success);
  assert.ok(!portfolioSchema.safeParse({ ...entry, source: 'a string' }).success);
});

test('portfolio: no metrics, logos, founder names, valuations or amounts can be added', () => {
  for (const field of ['metrics', 'logo', 'founders', 'valuation', 'amountRaised', 'revenue']) {
    assert.ok(!portfolioSchema.safeParse({ ...entry, [field]: 'x' }).success, field);
  }
});

const page = { title: 'A page', description: text(80), updated: '2026-10-12' };

test('pages: only cta and family are new and both are optional', () => {
  const parsed = pagesSchema.parse(page);
  assert.equal(parsed.family, undefined);
  assert.equal(parsed.cta, undefined);
  assert.ok(!pagesSchema.safeParse({ ...page, audience: 'startup' }).success, 'the schema stays strict');
});

const segments = {
  id: 'segments',
  slug: 'solo-founders',
  whoFor: text(120),
  challenges: [1, 2, 3].map((n) => ({ title: `Challenge ${n}`, text: text(60) })),
};

test('family segments: shape, challenge counts and registry slug', () => {
  assert.ok(familySchema.safeParse(segments).success);
  assert.ok(!familySchema.safeParse({ ...segments, whoFor: text(40) }).success);
  assert.ok(!familySchema.safeParse({ ...segments, challenges: segments.challenges.slice(0, 2) }).success);
  assert.ok(!familySchema.safeParse({ ...segments, slug: 'unknown-founders' }).success);
  assert.ok(!familySchema.safeParse({ ...segments, challenges: [...segments.challenges, ...segments.challenges] }).success, 'at most five');
});

const industry = {
  id: 'industries',
  slug: 'fintech',
  buyer: text(80),
  perimeter: ['p1', 'p2', 'p3'].map((sourceId) => ({ title: 'Item', text: text(60), jurisdiction: 'US federal', asOf: '2026-10-12', sourceId })),
  dataQuestions: [text(30), text(30), text(30)],
  salesCycle: text(80),
  sources: ['p1', 'p2', 'p3'].map(source),
};

test('family industries: at least two sources and every perimeter sourceId must name one', () => {
  assert.ok(familySchema.safeParse(industry).success);
  assert.ok(!familySchema.safeParse({ ...industry, sources: [source('p1')] }).success);
  const dangling = { ...industry, perimeter: [...industry.perimeter.slice(0, 2), { ...industry.perimeter[2], sourceId: 'nope' }] };
  const result = familySchema.safeParse(dangling);
  assert.ok(!result.success);
  assert.match(result.error.message, /not in family\.sources/);
});

test('family industries: sources need an accessed date', () => {
  const { accessed: _unused, ...undated } = source('p1');
  assert.ok(!familySchema.safeParse({ ...industry, sources: [undated, source('p2'), source('p3')] }).success);
});

const side = { name: 'Side', whatItIs: text(60), whoItFits: text(60), asksOfFounder: text(60), askThis: [text(20), text(20)] };
const compare = {
  id: 'compare',
  slug: 'incubator-vs-accelerator',
  sides: [side, side],
  whereEachFits: [text(60), text(60)],
  definitions: ['s1', 's2'].map((sourceId) => ({ term: 'Term', text: text(60), sourceId })),
  sources: ['s1', 's2'].map(source),
};

test('family compare: exactly two sides, two situations, two definitions and a cited source for each', () => {
  assert.ok(familySchema.safeParse(compare).success);
  assert.ok(!familySchema.safeParse({ ...compare, sides: [side] }).success);
  assert.ok(!familySchema.safeParse({ ...compare, sides: [side, side, side] }).success);
  assert.ok(!familySchema.safeParse({ ...compare, whereEachFits: [text(60)] }).success);
  assert.ok(!familySchema.safeParse({ ...compare, definitions: compare.definitions.slice(0, 1) }).success);
  assert.ok(!familySchema.safeParse({ ...compare, definitions: [compare.definitions[0], { ...compare.definitions[1], sourceId: 'nope' }] }).success);
  assert.ok(!familySchema.safeParse({ ...compare, sides: [side, { ...side, extra: 'x' }] }).success, 'both sides take the same fields');
});

const journey = { id: 'journey', slug: 'after-you-apply', stage: 'consideration', step: 2, questions: [text(30)] };

test('family journey: stage, optional step and a fail-closed checklist href', () => {
  assert.ok(familySchema.safeParse(journey).success);
  assert.ok(familySchema.safeParse({ ...journey, slug: 'index' }).success, 'the hub is index.mdx');
  assert.ok(!familySchema.safeParse({ ...journey, step: 6 }).success);
  assert.ok(!familySchema.safeParse({ ...journey, stage: 'retention' }).success);
  const checklist = [{ id: 'problem-brief', text: text(30), href: '/library/problem-brief/' }];
  assert.ok(familySchema.safeParse({ ...journey, slug: 'onboarding-checklist', checklist }).success);
  assert.ok(!familySchema.safeParse({ ...journey, checklist: [...checklist, ...checklist] }).success, 'ids are unique');
  assert.ok(!familySchema.safeParse({ ...journey, checklist: [{ ...checklist[0], href: 'https://example.com/' }] }).success);
});

test('family: an unknown id fails and the union is discriminated on id', () => {
  assert.ok(!familySchema.safeParse({ ...segments, id: 'offers' }).success);
  assert.ok(!familySchema.safeParse({ ...segments, buyer: text(80) }).success, 'a field of another family fails');
});
