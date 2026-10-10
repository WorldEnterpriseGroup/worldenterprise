import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPARE_CAPTION, FIXED, HEADINGS } from '../../../src/components/families/copy.ts';
import type { CompareData, FamilyData, FamilySource, IndustryData, JourneyData, SegmentData } from '../../../src/components/families/types.ts';
import { assembleTwins } from '../../../src/components/geo/assemble.ts';
import type { PageData, TwinContent } from '../../../src/components/geo/assemble.ts';
import { COMPARISONS, INDUSTRIES, JOURNEY, SEGMENTS } from '../../../src/data/families.ts';
import type { FamilyDefinition } from '../../../src/data/families.ts';
import { PROGRAM_STEPS } from '../../../src/components/program/steps.ts';
import { REQUIRED } from '../wp-41/content.ts';

/**
 * The family twins, over fabricated pages and the real registries. A page exists when its registry entry is launched and a pages entry
 * holds it, so each test picks the first launched slug of the registry instead of naming one.
 */

const day = new Date('2026-10-12');
const slugOf = (registry: FamilyDefinition): { readonly slug: string; readonly path: string } => {
  const entry = registry.entries.find((candidate) => candidate.launch);
  assert.ok(entry !== undefined, `${registry.id} launches at least one page`);
  return entry;
};

const source = (id: string): FamilySource => ({ id, title: `Source ${id}`, publisher: 'A Publisher', url: `https://example.org/${id}`, accessed: day });

const empty: TwinContent = { insights: [], research: [], pages: [], services: [], playbooks: [], faq: [], glossary: [], referenceUpdated: day };
const all = { required: REQUIRED, isEligible: (): boolean => true };

function pageEntry(registry: FamilyDefinition, slug: string, family: FamilyData | undefined, body: string): { id: string; body: string; data: PageData } {
  return { id: `${registry.folder}/${slug}`, body, data: { title: `Title of ${slug}`, description: `Description of ${slug}.`, updated: day, family } };
}

const segment = slugOf(SEGMENTS);
const segmentData: SegmentData = {
  id: 'segments',
  slug: segment.slug,
  whoFor: 'A founder with an idea and no team.',
  challenges: [{ title: 'No time', text: 'Everything is the founder.' }],
  sources: [source('a')],
};

test('a segment twin equals its source after the documented transforms: the fixed sentence, the body, the sections, the reading path', () => {
  const content: TwinContent = {
    ...empty,
    insights: [
      { id: 'fundable/for-segment', body: 'Text.', data: { title: 'For the segment', description: 'Why.', topic: 'fundable', segments: [segment.slug], publishedDate: day, sources: [] } },
      { id: 'fundable/for-others', body: 'Text.', data: { title: 'For others', description: 'No.', topic: 'fundable', segments: ['elsewhere'], publishedDate: day, sources: [] } },
    ],
    pages: [pageEntry(SEGMENTS, segment.slug, segmentData, 'The page body.\n\n- one')],
  };
  const { twins, skipped } = assembleTwins(content, all);
  const twin = twins.find((t) => t.route === segment.path);
  assert.ok(twin !== undefined, JSON.stringify(skipped));
  assert.equal(twin.title, `Title of ${segment.slug}`);
  assert.equal(twin.lead, `Description of ${segment.slug}.`);
  assert.equal(
    twin.body,
    [
      `> **${HEADINGS.shared.about}**`,
      '>',
      `> ${FIXED.segment}`,
      '',
      'The page body.\n\n- one',
      '',
      `## ${HEADINGS.segments.whoFor}`,
      '',
      'A founder with an idea and no team.',
      '',
      `## ${HEADINGS.segments.challenges}`,
      '',
      '### No time',
      '',
      'Everything is the founder.',
      '',
      `## ${HEADINGS.segments.reading}`,
      '',
      '- [For the segment](/insights/for-segment/): Why.',
      '',
      `## ${HEADINGS.shared.sources}`,
      '',
      '1. Source a. A Publisher. <https://example.org/a>. Accessed October 12, 2026.',
    ].join('\n'),
  );
});

test('a reading path lists only the articles that are live', () => {
  const content: TwinContent = {
    ...empty,
    insights: [{ id: 'fundable/hidden', body: 'Text.', data: { title: 'Hidden', description: 'Not built.', topic: 'fundable', segments: [segment.slug], publishedDate: day, sources: [] } }],
    pages: [pageEntry(SEGMENTS, segment.slug, segmentData, 'Body.')],
  };
  const { twins } = assembleTwins(content, { required: REQUIRED, isEligible: () => true, isLive: (route) => route !== '/insights/hidden/' });
  const twin = twins.find((t) => t.route === segment.path);
  assert.ok(twin !== undefined);
  assert.ok(!twin.body.includes('Hidden'), 'a route that is not built is not in the reading path');
  assert.ok(!twin.body.includes(`## ${HEADINGS.segments.reading}`), 'and an empty reading path has no heading');
});

const compare = slugOf(COMPARISONS);
const side = (name: string): CompareData['sides'][0] => ({ name, whatItIs: `${name} is a category.`, whoItFits: `${name} fits some.`, asksOfFounder: `${name} asks time.`, askThis: [`Ask ${name} one`, `Ask ${name} two`] });
const compareData: CompareData = {
  id: 'compare',
  slug: compare.slug,
  sides: [side('Left'), side('Right')],
  whereEachFits: ['Left fits here.', 'Right fits there.'],
  definitions: [{ term: 'Term', text: 'Defined.', sourceId: 'a' }],
  sources: [source('a')],
};

test('a comparison twin carries both sides through the same fields, in order, with the table as Markdown', () => {
  const { twins, skipped } = assembleTwins({ ...empty, pages: [pageEntry(COMPARISONS, compare.slug, compareData, 'Compare body.')] }, all);
  const twin = twins.find((t) => t.route === compare.path);
  assert.ok(twin !== undefined, JSON.stringify(skipped));
  assert.equal(
    twin.body,
    [
      `> **${HEADINGS.shared.about}**`,
      '>',
      `> ${FIXED.compare}`,
      '',
      'Compare body.',
      '',
      `## ${HEADINGS.compare.table}`,
      '',
      `Table: ${COMPARE_CAPTION}`,
      '',
      '| Question | Left | Right |',
      '| --- | --- | --- |',
      '| What it is | Left is a category. | Right is a category. |',
      '| Who it fits | Left fits some. | Right fits some. |',
      '| What it asks of a founder | Left asks time. | Right asks time. |',
      '',
      `## ${HEADINGS.compare.ask}`,
      '',
      '### Left',
      '',
      '- Ask Left one',
      '- Ask Left two',
      '',
      '### Right',
      '',
      '- Ask Right one',
      '- Ask Right two',
      '',
      `## ${HEADINGS.compare.fits}`,
      '',
      '### Left',
      '',
      'Left fits here.',
      '',
      '### Right',
      '',
      'Right fits there.',
      '',
      `## ${HEADINGS.compare.definitions}`,
      '',
      '- **Term.** Defined. Source 1.',
      '',
      `## ${HEADINGS.shared.sources}`,
      '',
      '1. Source a. A Publisher. <https://example.org/a>. Accessed October 12, 2026.',
    ].join('\n'),
  );
});

const industry = slugOf(INDUSTRIES);
const industryData: IndustryData = {
  id: 'industries',
  slug: industry.slug,
  buyer: 'A buyer decides.',
  perimeter: [{ title: 'A rule', text: 'It applies.', jurisdiction: 'US', asOf: day, sourceId: 'a' }],
  dataQuestions: ['Where is data held?'],
  salesCycle: 'It is long.',
  sources: [source('a')],
};

test('an industry twin renders the perimeter with its jurisdiction, date and numbered source', () => {
  const { twins, skipped } = assembleTwins({ ...empty, pages: [pageEntry(INDUSTRIES, industry.slug, industryData, 'Industry body.')] }, all);
  const twin = twins.find((t) => t.route === industry.path);
  assert.ok(twin !== undefined, JSON.stringify(skipped));
  assert.ok(twin.body.startsWith(`> **${HEADINGS.shared.about}**\n>\n> ${FIXED.industry}\n\nIndustry body.\n\n## ${HEADINGS.industries.buyer}\n\nA buyer decides.`));
  assert.ok(twin.body.includes('### A rule\n\nUS. As of October 12, 2026.\n\nIt applies.\n\nSource 1: Source a'));
  assert.ok(twin.body.includes(`## ${HEADINGS.industries.data}\n\n- Where is data held?\n\n## ${HEADINGS.industries.sales}\n\nIt is long.`));
});

const journey = slugOf(JOURNEY);
const journeyData: JourneyData = {
  id: 'journey',
  slug: journey.slug,
  stage: 'consideration',
  step: 2,
  questions: ['What does the agreement say?'],
  checklist: [
    { id: 'c1', text: 'Read the scope', href: '/faq/' },
    { id: 'c2', text: 'Read a page that is not built', href: '/nowhere/' },
  ],
  sources: [],
};

test('a journey twin marks its step, lists the program steps unchanged, and links a checklist target only when it is live', () => {
  const { twins, skipped } = assembleTwins(
    { ...empty, pages: [pageEntry(JOURNEY, journey.slug, journeyData, 'Journey body.')] },
    { required: REQUIRED, isEligible: () => true, isLive: (route) => route === '/faq/' },
  );
  const twin = twins.find((t) => t.route === journey.path);
  assert.ok(twin !== undefined, JSON.stringify(skipped));
  assert.ok(twin.body.includes('Step 2 of 5'));
  for (const [index, step] of PROGRAM_STEPS.entries()) assert.ok(twin.body.includes(`${index + 1}. **${step.title}.** ${step.body}`));
  assert.ok(twin.body.includes('- [Read the scope](/faq/)'));
  assert.ok(twin.body.includes('- Read a page that is not built\n') || twin.body.endsWith('- Read a page that is not built'));
  assert.ok(!twin.body.includes('/nowhere/'), 'a checklist item whose target is not live is text, not a link');
  assert.ok(twin.body.includes(`> ${FIXED.checklist}`));
});

test('a hub twin lists the family pages that are live and, for the journey hub, the program steps and the hub questions', () => {
  const hub = { id: 'journey/index', body: 'Hub body.', data: { title: 'Journey', description: 'The steps.', updated: day, family: { ...journeyData, slug: 'index', step: undefined } as JourneyData } };
  const content: TwinContent = { ...empty, pages: [hub, pageEntry(JOURNEY, journey.slug, journeyData, 'Journey body.')] };
  const { twins, skipped } = assembleTwins(content, all);
  const twin = twins.find((t) => t.route === '/journey/');
  assert.ok(twin !== undefined, JSON.stringify(skipped));
  assert.ok(twin.body.startsWith(`> **${HEADINGS.shared.about}**\n>\n> ${FIXED.journey}\n\nHub body.`));
  assert.ok(twin.body.includes(`- [${JOURNEY.entries.find((e) => e.slug === journey.slug)?.label}](${journey.path}): Description of ${journey.slug}.`));
  assert.ok(twin.body.includes(`## ${HEADINGS.journey.questions}\n\n- What does the agreement say?`));

  const hidden = assembleTwins(content, { required: REQUIRED, isEligible: () => true, isLive: (route) => route !== journey.path });
  const hiddenHub = hidden.twins.find((t) => t.route === '/journey/');
  assert.ok(hiddenHub !== undefined);
  assert.ok(!hiddenHub.body.includes(journey.path), 'a journey page that is not live is not listed');
});

test('a family page with a malformed family object, or one that is not built, has no twin and is skipped with a reason', () => {
  const wrong = assembleTwins({ ...empty, pages: [pageEntry(SEGMENTS, segment.slug, { ...segmentData, slug: 'other' }, 'Body.')] }, all);
  assert.ok(!wrong.twins.some((t) => t.route === segment.path));
  assert.ok(wrong.skipped.some((s) => s.route === segment.path && /family object/.test(s.reason)));
  const missing = assembleTwins({ ...empty, pages: [pageEntry(SEGMENTS, segment.slug, undefined, 'Body.')] }, all);
  assert.ok(missing.skipped.some((s) => s.route === segment.path));
  const unbuilt = assembleTwins({ ...empty, pages: [pageEntry(SEGMENTS, segment.slug, segmentData, 'Body.')] }, { required: REQUIRED, isEligible: (route) => route !== segment.path });
  assert.ok(!unbuilt.twins.some((t) => t.route === segment.path));
  assert.ok(unbuilt.skipped.some((s) => s.route === segment.path));
});

test('a pages entry the registry does not launch makes no twin, so a pending family page never reaches a machine surface', () => {
  const pending = SEGMENTS.entries.find((entry) => !entry.launch);
  if (pending === undefined) return;
  const data: SegmentData = { ...segmentData, slug: pending.slug };
  const { twins, skipped } = assembleTwins({ ...empty, pages: [pageEntry(SEGMENTS, pending.slug, data, 'Body.')] }, all);
  assert.ok(!twins.some((t) => t.route === pending.path));
  assert.ok(!skipped.some((s) => s.route === pending.path), 'it is not even a candidate');
});
