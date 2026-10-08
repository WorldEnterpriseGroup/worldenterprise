import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCrumbs } from '../../../src/lib/breadcrumbs.ts';
import { articleNode, breadcrumbNode, graph, organizationNode, pageNode, serializeJsonLd, websiteNode } from '../../../src/lib/schema.ts';
import { buildTitle, canonicalUrl, clampDescription, DESCRIPTION_MAX, resolveRobots, TITLE_MAX } from '../../../src/lib/seo.ts';

test('titles follow "{Page} | World Enterprise Incubator"', () => {
  assert.equal(buildTitle('Program'), 'Program | World Enterprise Incubator');
  assert.match(buildTitle(), /^World Enterprise Incubator/);
  assert.ok(buildTitle('Program').length <= TITLE_MAX);
});

test('canonical URLs are absolute production URLs with a trailing slash', () => {
  assert.equal(canonicalUrl('/program/'), 'https://worldenterprise.org/program/');
  assert.equal(canonicalUrl('/'), 'https://worldenterprise.org/');
});

test('clampDescription keeps short text and trims long text at a word boundary', () => {
  assert.equal(clampDescription('  Short   text. '), 'Short text.');
  const long = 'word '.repeat(60);
  const clamped = clampDescription(long);
  assert.ok(clamped.length <= DESCRIPTION_MAX);
  assert.ok(clamped.endsWith('…'));
});

test('robots: preview and drafts never index; noindex routes keep following', () => {
  assert.equal(resolveRobots({}), 'index,follow');
  assert.equal(resolveRobots({ draft: true }), 'noindex,nofollow');
  assert.equal(resolveRobots({ noindex: true }), 'noindex,follow');
  assert.equal(resolveRobots({ noindex: true, follow: false }), 'noindex,nofollow');
});

test('breadcrumbs take ancestor labels from the navigation data', () => {
  const crumbs = buildCrumbs('/program/how-it-works/', 'How it works');
  assert.deepEqual(crumbs.map((c) => c.label), ['Home', 'Program', 'How it works']);
  assert.deepEqual(crumbs.map((c) => c.href), ['/', '/program/', '/program/how-it-works/']);
  assert.deepEqual(buildCrumbs('/404.html', 'Not found').map((c) => c.label), ['Home']);
});

test('breadcrumbs skip ancestors that are not launched routes', () => {
  assert.deepEqual(buildCrumbs('/legal/privacy/', 'Privacy notice').map((c) => c.href), ['/', '/legal/privacy/']);
  assert.deepEqual(buildCrumbs('/insights/topic/dream/', 'Dream').map((c) => c.href), ['/', '/insights/', '/insights/topic/dream/']);
  assert.deepEqual(buildCrumbs('/program/dream/', 'Dream').map((c) => c.href), ['/', '/program/', '/program/dream/']);
});

test('the organisation node has no founding date, EIN or street address', () => {
  const org = organizationNode('https://worldenterprise.org/logo.svg');
  const text = JSON.stringify(org);
  assert.equal(org['@type'], 'ProfessionalService');
  assert.equal(org['@id'], 'https://worldenterprise.org/#org');
  assert.ok(!/foundingDate|EIN|streetAddress/.test(text));
  assert.equal(org.naics, '541611');
});

test('every @id a page graph references resolves inside the graph', () => {
  const nodes = [
    organizationNode('https://worldenterprise.org/logo.svg'),
    websiteNode(),
    pageNode({ path: '/insights/x/', name: 'X', description: 'D', type: 'WebPage' }),
    breadcrumbNode('/insights/x/', buildCrumbs('/insights/x/', 'X')),
    articleNode({ path: '/insights/x/', headline: 'X', description: 'D', published: new Date('2026-01-01T00:00:00Z') }),
  ];
  const own = new Set(nodes.map((n) => n['@id'] as string));
  const referenced = (JSON.stringify(nodes).match(/\{"@id":"[^"]+"\}/g) ?? []).map((r) => r.slice(8, -2));
  assert.ok(referenced.length > 0);
  for (const id of referenced) assert.ok(own.has(id), `dangling reference ${id}`);
  assert.equal(graph(nodes)['@context'], 'https://schema.org');
});

test('serializeJsonLd escapes characters that could close the script element', () => {
  const out = serializeJsonLd({ text: '</script><b>&' });
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('>'));
  assert.ok(out.includes('\\u003c'));
});

test('the site description fits the meta description limit without clamping', async () => {
  const { site } = await import('../../../src/data/site.ts');
  assert.ok(site.description.length <= DESCRIPTION_MAX, `${site.description.length} characters`);
  assert.ok(buildTitle().length <= TITLE_MAX);
});
