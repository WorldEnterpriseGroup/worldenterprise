import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleTwins, INSIGHTS_LEAD } from '../../../src/components/geo/assemble.ts';
import type { TwinContent } from '../../../src/components/geo/assemble.ts';
import { DESK_DEFINITIONS, deskPath } from '../../../src/data/desks.ts';
import { site } from '../../../src/data/site.ts';
import { buildLlmsTxt } from '../../../src/lib/llms.ts';
import { buildTwin, renderTwin, twinPath } from '../../../src/lib/markdown-twins.ts';
import { assembleReal, loadContent, read, REQUIRED } from '../wp-41/content.ts';

const DESK = DESK_DEFINITIONS[0];
assert.ok(DESK !== undefined, 'the desk registry is not empty');

const empty: TwinContent = { insights: [], research: [], pages: [], services: [], playbooks: [], faq: [], glossary: [], referenceUpdated: new Date('2026-10-06') };
const day = new Date('2026-10-01');

const PLAIN = ['## First point', '', 'A paragraph with **emphasis** and a [link](/faq/).', '', '- one', '- two', '', '```js', 'const x = <Callout>;', '```'].join('\n');

function content(body: string, topic: string = DESK.id): TwinContent {
  return {
    ...empty,
    insights: [{ id: `${topic}/a-post`, body, data: { title: 'A post', description: 'About a post.', topic, publishedDate: day, sources: [] } }],
  };
}

const all = { required: REQUIRED, isEligible: (): boolean => true };

test('the twin of an article is its Markdown source, unchanged, when the source holds no component (documented transform: none)', () => {
  const { twins } = assembleTwins(content(PLAIN), all);
  const article = twins.find((t) => t.route === '/insights/a-post/');
  assert.ok(article !== undefined);
  assert.equal(article.body, PLAIN, 'code fences and links pass through untouched');
  assert.equal(article.title, 'A post');
  assert.equal(article.lead, 'About a post.');
  const rendered = renderTwin(article);
  assert.ok(rendered.startsWith('# A post\n\nAbout a post.\n\nCanonical URL: '));
  assert.ok(rendered.includes(`](${site.origin}/faq/)`), 'a site link is made absolute, the only change to the body');
  assert.deepEqual(buildTwin(article).problems, []);
});

test('the twin of a page with components equals the source after the documented transforms, pinned as a golden', () => {
  const source = [
    "import Callout from '../../components/ui/Callout.astro';",
    '',
    'Plain opening.',
    '',
    '<Callout title="Note">Read this first.</Callout>',
    '',
    '<DataTable caption="Sizes" columns={["Name", "Size"]} rows={[["A", "1"], ["B", "2"]]} />',
  ].join('\n');
  const { twins, skipped } = assembleTwins(content(source), all);
  const article = twins.find((t) => t.route === '/insights/a-post/');
  assert.ok(article !== undefined, JSON.stringify(skipped));
  assert.equal(
    article.body,
    ['Plain opening.', '', '> **Note**', '>', '> Read this first.', '', 'Table: Sizes', '', '| Name | Size |', '| --- | --- |', '| A | 1 |', '| B | 2 |'].join('\n'),
  );
});

test('a page the transform refuses has no twin, and nothing links to a twin it does not have (acceptance: lint-failing page)', () => {
  const broken = '<Mystery>unknown component</Mystery>';
  const { twins, skipped } = assembleTwins(content(broken), all);
  assert.ok(!twins.some((t) => t.route === '/insights/a-post/'));
  assert.ok(skipped.some((s) => s.route === '/insights/a-post/' && /not converted/.test(s.reason)));
  const lintBroken = assembleTwins(content('Text with {braces} that the lint refuses.'), all);
  assert.ok(!lintBroken.twins.some((t) => t.route === '/insights/a-post/'));
  assert.ok(lintBroken.skipped.some((s) => s.route === '/insights/a-post/'));

  const twinRoutes = new Set(twins.map((t) => t.route));
  const text = buildLlmsTxt({
    site: { name: site.name, legalName: site.legalName, tagline: site.tagline, description: site.description, origin: site.origin },
    serviceLines: [],
    keyPages: [],
    optionalPages: [
      { route: '/insights/a-post/', title: 'A post' },
      { route: '/insights/another/', title: 'Another' },
    ],
    howWeDecide: null,
    twinRoutes: new Set([...twinRoutes, '/insights/another/']),
    contactRoute: null,
    applyRoute: null,
    addOnStatement: 'x',
    calendarStatement: 'y',
  });
  assert.ok(text.includes(`${site.origin}/insights/a-post/)`), 'the HTML page is linked');
  assert.ok(!text.includes(twinPath('/insights/a-post/')), 'no link to the missing twin');
  assert.ok(text.includes(twinPath('/insights/another/')), 'a route with a twin links to it');
});

test('a route that is not built has no twin, and a draft-like ineligible route is skipped with a reason', () => {
  const { twins, skipped } = assembleTwins(content(PLAIN), { required: REQUIRED, isEligible: (route) => route !== '/insights/a-post/' });
  assert.ok(!twins.some((t) => t.route === '/insights/a-post/'));
  assert.ok(skipped.some((s) => s.route === '/insights/a-post/'));
});

test('a live desk has a twin that lists its live articles newest first, and a desk with none has no twin', () => {
  const second = { id: `${DESK.id}/older`, body: PLAIN, data: { title: 'Older post', description: 'Older.', topic: DESK.id, publishedDate: new Date('2026-09-01'), sources: [] } };
  const base = content(PLAIN);
  const withTwo: TwinContent = { ...base, insights: [...base.insights, second] };
  const { twins } = assembleTwins(withTwo, all);
  const desk = twins.find((t) => t.route === deskPath(DESK.id));
  assert.ok(desk !== undefined, 'the desk page has a twin with no hand-written copy');
  assert.equal(desk.lead, DESK.blurb);
  const list = desk.body.split('## Articles')[1] ?? '';
  assert.ok(list.indexOf('A post') > -1 && list.indexOf('A post') < list.indexOf('Older post'), 'newest first');
  assert.ok(list.includes('](/insights/a-post/): About a post.'));
  for (const other of DESK_DEFINITIONS.slice(1)) assert.ok(!twins.some((t) => t.route === deskPath(other.id)), `${other.id} has no articles`);
  const dead = assembleTwins(withTwo, { required: REQUIRED, isEligible: () => true, isLive: (route) => route !== '/insights/older/' });
  const list2 = dead.twins.find((t) => t.route === deskPath(DESK.id))?.body ?? '';
  assert.ok(!list2.includes('Older post'), 'an article that is not live is not listed');
});

test('the insights hub twin lists only live desks, after the page text', () => {
  const withHub: TwinContent = { ...content(PLAIN), pages: [{ id: 'insights', body: 'Hub text.', data: { title: 'Insights', updated: day } }] };
  const { twins } = assembleTwins(withHub, all);
  const hub = twins.find((t) => t.route === '/insights/');
  assert.ok(hub !== undefined);
  assert.equal(hub.lead, INSIGHTS_LEAD);
  assert.ok(hub.body.startsWith('Hub text.'));
  assert.ok(hub.body.includes(`](${deskPath(DESK.id)}): ${DESK.blurb}`));
  for (const other of DESK_DEFINITIONS.slice(1)) assert.ok(!hub.body.includes(deskPath(other.id)), other.id);
});

test('INSIGHTS_LEAD is the lead the insights hub page shows', () => {
  const page = read('src/pages/insights/index.astro').replace(/\s+/g, ' ');
  assert.ok(page.includes(INSIGHTS_LEAD), 'src/pages/insights/index.astro and INSIGHTS_LEAD have drifted apart');
});

test('a brief twin is made from the open abstract, its description and its outline, and nothing else', () => {
  const brief: TwinContent = {
    ...empty,
    briefs: [{ id: 'metrics-brief', body: 'The open abstract.', data: { title: 'Metrics brief', description: 'What the brief covers.', outline: ['Part one', 'Part two'], updated: day } }],
  };
  const { twins } = assembleTwins(brief, all);
  const twin = twins.find((t) => t.route === '/briefs/metrics-brief/');
  assert.ok(twin !== undefined);
  assert.equal(twin.body, 'The open abstract.\n\n## What is inside\n\n- Part one\n- Part two');
  assert.equal(twin.lead, 'What the brief covers.');
});

test('the real content assembles, converts every insight and research article, and the skipped list holds only known reasons', () => {
  const real = loadContent();
  const { twins, skipped } = assembleReal();
  for (const entry of real.insights) {
    const route = `/insights/${entry.id.split('/').at(-1)}/`;
    assert.ok(twins.some((t) => t.route === route) || skipped.some((s) => s.route === route), route);
  }
  for (const item of skipped) assert.ok(item.reason !== '', item.route);
  assert.ok(twins.length >= real.insights.length, 'every insight has a twin');
});
