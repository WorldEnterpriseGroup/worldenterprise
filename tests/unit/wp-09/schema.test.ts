import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALLOWED_TYPES,
  FORBIDDEN_TYPES,
  articleNode,
  breadcrumbNode,
  definedTermSetNode,
  faqPageNode,
  graph,
  organizationNode,
  pageNode,
  pruneDanglingBreadcrumbs,
  searchActionNode,
  serviceNode,
  websiteNode,
  withSearchAction,
} from '../../../src/lib/schema.ts';
import { ALLOWED_TYPES as SCRIPT_ALLOWED, FORBIDDEN_TYPES as SCRIPT_FORBIDDEN, validateDocument } from '../../../scripts/validate-jsonld.mjs';

const org = organizationNode('https://worldenterprise.org/logo.svg');

test('the home page graph (no breadcrumbs) has no dangling breadcrumb reference', () => {
  const home = graph([org, websiteNode(), pageNode({ path: '/', name: 'World Enterprise Incubator', description: 'D', type: 'WebPage' })]);
  const page = (home['@graph'] as readonly Record<string, unknown>[]).find((n) => n['@type'] === 'WebPage');
  assert.equal(page?.breadcrumb, undefined);
  assert.deepEqual(validateDocument(home), []);
});

test('a breadcrumb reference is kept when its BreadcrumbList is in the graph', () => {
  const nodes = [org, websiteNode(), pageNode({ path: '/a/', name: 'A', description: 'D', type: 'WebPage' }), breadcrumbNode('/a/', [{ label: 'Home', href: '/' }])];
  const kept = pruneDanglingBreadcrumbs(nodes);
  assert.ok(kept[2]?.breadcrumb !== undefined);
});

test('SearchAction is added only on request and validates', () => {
  assert.equal(websiteNode().potentialAction, undefined);
  assert.equal(websiteNode({ searchEnabled: true }).potentialAction !== undefined, true);
  const [, site] = withSearchAction([org, websiteNode()]);
  assert.deepEqual(site?.potentialAction, searchActionNode());
  const doc = graph([org, ...withSearchAction([websiteNode()]), pageNode({ path: '/', name: 'H', description: 'D', type: 'WebPage' })]);
  assert.deepEqual(validateDocument(doc), []);
});

test('service, FAQ, glossary, article and report builders validate and use only allowed types', () => {
  const base = [org, websiteNode()];
  const pagePath = '/x/';
  const nodes = [
    ...base,
    pageNode({ path: pagePath, name: 'X', description: 'D', type: 'CollectionPage' }),
    breadcrumbNode(pagePath, [{ label: 'Home', href: '/' }, { label: 'X', href: pagePath }]),
    serviceNode({ path: pagePath, name: 'Brand and Identity', description: 'D', serviceType: 'Service Line A' }),
    faqPageNode(pagePath, [{ question: 'Is it an accelerator?', answer: 'No.' }]),
    definedTermSetNode(pagePath, 'Glossary', [{ term: 'SAFE', definition: 'A simple agreement for future equity.' }]),
    articleNode({ path: pagePath, headline: 'H', description: 'D', published: new Date('2026-01-01T00:00:00Z') }),
    articleNode({ path: pagePath, headline: 'H', description: 'D', published: new Date('2026-01-01T00:00:00Z'), type: 'Report' }),
  ];
  // Two article nodes share an @id here, so validate them separately.
  assert.deepEqual(validateDocument(graph(nodes.slice(0, -1))), []);
  assert.deepEqual(validateDocument(graph([...nodes.slice(0, -2), nodes.at(-1) ?? org])), []);
  const types = new Set<string>();
  JSON.stringify(nodes, (key, value: unknown) => {
    if (key === '@type' && typeof value === 'string') types.add(value);
    return value;
  });
  for (const type of types) assert.ok((ALLOWED_TYPES as readonly string[]).includes(type), `${type} is not allowed`);
});

test('no builder emits an Offer, Review, Person, Event or rating', () => {
  const text = JSON.stringify([org, serviceNode({ path: '/s/', name: 'S', description: 'D', serviceType: 'T' })]);
  for (const type of FORBIDDEN_TYPES) assert.ok(!text.includes(`"${type}"`), `${type} must not appear`);
  assert.ok(!/offers|price/.test(text));
});

test('the editorial author is an Organization, never a Person', () => {
  const node = articleNode({ path: '/i/', headline: 'H', description: 'D', published: new Date('2026-01-01T00:00:00Z') });
  assert.equal((node.author as Record<string, unknown>)['@type'], 'Organization');
});

test('the validator script mirrors the allowed and forbidden type lists in schema.ts', () => {
  assert.deepEqual([...SCRIPT_ALLOWED].sort(), [...ALLOWED_TYPES].sort());
  assert.deepEqual([...SCRIPT_FORBIDDEN].sort(), [...FORBIDDEN_TYPES].sort());
});
