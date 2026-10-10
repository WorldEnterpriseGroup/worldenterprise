import assert from 'node:assert/strict';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { ALLOWED_TYPES as SCRIPT_ALLOWED, FORBIDDEN_TYPES as SCRIPT_FORBIDDEN, validateDocument } from '../../../scripts/validate-jsonld.mjs';
import { packages } from '../../../src/data/packages.ts';
import {
  ALLOWED_TYPES,
  FORBIDDEN_TYPES,
  articleNode,
  briefCitations,
  graph,
  organizationNode,
  packageCatalogNode,
  pageNode,
  websiteNode,
  withOrganizationEnrichment,
} from '../../../src/lib/schema.ts';
import { AI_CRAWLER_AGENTS, AI_CRAWLER_GROUPS, robotsTxt } from '../../../src/lib/seo.ts';

const audit = claimsAudit as unknown as {
  scan(text: string, options: { route: string; plain: boolean }): { rule: string; match: string }[];
};

const SERVICE_LINES = [
  'Brand and Identity',
  'Product and IT Development',
  'Customer Relations and Market Development',
  'Business Management and Operations',
  'Digital Incubation',
  'Fundability and Investor Readiness',
  'Professional-Services Coordination',
];
const org = organizationNode('https://worldenterprise.org/logo.svg');
const enriched = withOrganizationEnrichment([org], { packages, serviceLines: SERVICE_LINES });
const homePage = pageNode({ path: '/', name: 'WE', description: 'D', type: 'WebPage' });
const withBase = (nodes: readonly Record<string, unknown>[]) => graph([...nodes, websiteNode(), homePage]);
const orgDoc = (nodes: readonly Record<string, unknown>[] = enriched) => withBase(nodes);

test('the organisation lists the four packages as an OfferCatalog without a price', () => {
  const node = enriched[0] as Record<string, unknown>;
  const catalog = node['hasOfferCatalog'] as { '@type': string; itemListElement: { name: string; itemOffered: { '@id': string } }[] };
  assert.equal(catalog['@type'], 'OfferCatalog');
  assert.deepEqual(catalog.itemListElement.map((o) => o.name), packages.map((p) => `${p.name} package`));
  assert.equal(new Set(catalog.itemListElement.map((o) => o.itemOffered['@id'])).size, 4);
  const text = JSON.stringify(catalog);
  assert.doesNotMatch(text, /"(?:price|priceCurrency|priceSpecification|offers)"/);
  assert.doesNotMatch(text, /\d|[$€£]/, 'no digit, no currency sign, no seat count');
  assert.deepEqual(validateDocument(orgDoc()), []);
});

test('knowsAbout is limited to the seven service lines', () => {
  const node = enriched[0] as Record<string, unknown>;
  assert.deepEqual(node['knowsAbout'], SERVICE_LINES);
  assert.equal((node['knowsAbout'] as string[]).length, 7);
});

test('the enrichment is a transform: organizationNode alone still emits no Offer, and an empty input adds nothing', () => {
  assert.doesNotMatch(JSON.stringify(org), /Offer/);
  const bare = withOrganizationEnrichment([org], { packages: [], serviceLines: [] })[0] as Record<string, unknown>;
  assert.equal(bare['hasOfferCatalog'], undefined);
  assert.equal(bare['knowsAbout'], undefined);
  const other = pageNode({ path: '/a/', name: 'A', description: 'D', type: 'WebPage' });
  assert.deepEqual(withOrganizationEnrichment([other], { packages, serviceLines: SERVICE_LINES })[0], other);
});

test('sameAs stays the GitHub organisation only', () => {
  assert.deepEqual((org as Record<string, unknown>)['sameAs'], ['https://github.com/WorldEnterpriseGroup']);
});

test('Offer stays a forbidden type everywhere except inside the organisation catalog', () => {
  assert.ok(FORBIDDEN_TYPES.includes('Offer'));
  assert.ok(SCRIPT_FORBIDDEN.has('Offer'));
  const bare = { '@context': 'https://schema.org', '@graph': [{ '@type': 'Offer', name: 'x', itemOffered: { '@type': 'Service', name: 'y' } }] };
  assert.ok(validateDocument(bare).some((e: string) => /forbidden @type Offer/.test(e)));
  const onPage = { '@context': 'https://schema.org', '@graph': [org, { ...pageNode({ path: '/a/', name: 'A', description: 'D', type: 'WebPage' }), hasOfferCatalog: packageCatalogNode(packages) }] };
  assert.ok(validateDocument(onPage).some((e: string) => /forbidden @type Offer/.test(e)), 'a catalog on a page node is not the organisation');
});

test('a price inside the catalog still fails the validator', () => {
  const catalog = packageCatalogNode(packages) as { itemListElement: Record<string, unknown>[] };
  const priced = { ...(enriched[0] as Record<string, unknown>), hasOfferCatalog: { ...catalog, itemListElement: [{ ...catalog.itemListElement[0], price: '1' }, ...catalog.itemListElement.slice(1)] } };
  assert.ok(validateDocument(orgDoc([priced])).some((e: string) => /price/.test(e)));
  const specified = { ...(enriched[0] as Record<string, unknown>), hasOfferCatalog: { ...catalog, itemListElement: [{ ...catalog.itemListElement[0], priceSpecification: {} }] } };
  assert.ok(validateDocument(orgDoc([specified])).some((e: string) => /priceSpecification/.test(e)));
});

test('the validator accepts a WebApplication node with an id, a name and a url, and refuses one with offers or without an id', () => {
  const app = { '@type': 'WebApplication', '@id': 'https://worldenterprise.org/tools/x/#app', name: 'A tool', url: 'https://worldenterprise.org/tools/x/', applicationCategory: 'BusinessApplication' };
  assert.deepEqual(validateDocument(withBase([org, app])), []);
  assert.ok(validateDocument(withBase([org, { ...app, offers: { '@type': 'Offer' } }])).length > 0);
  const { '@id': _id, ...noId } = app;
  assert.ok(validateDocument(withBase([org, noId])).some((e: string) => /@id/.test(e)));
});

test('the type lists of the builder and of the validator are identical', () => {
  assert.deepEqual([...ALLOWED_TYPES].sort(), [...SCRIPT_ALLOWED].sort());
  assert.deepEqual([...FORBIDDEN_TYPES].sort(), [...SCRIPT_FORBIDDEN].sort());
  for (const type of ['OfferCatalog', 'WebApplication', 'CreativeWork']) assert.ok(ALLOWED_TYPES.includes(type as never), type);
});

test('a research brief cites each source as a CreativeWork with its publisher, and validates', () => {
  const citation = briefCitations([
    { title: 'A study', publisher: 'A Publisher', url: 'https://example.org/a' },
    { title: 'A report', publisher: 'Another', url: 'https://example.org/b' },
  ]);
  assert.deepEqual(citation[0], { '@type': 'CreativeWork', name: 'A study', url: 'https://example.org/a', publisher: { '@type': 'Organization', name: 'A Publisher' } });
  const report = articleNode({ path: '/research/x/', headline: 'H', description: 'D', published: new Date('2026-10-01'), modified: new Date('2026-10-02'), type: 'Report', citation });
  assert.equal((report['citation'] as unknown[]).length, 2);
  const briefPage = pageNode({ path: '/research/x/', name: 'H', description: 'D', type: 'WebPage' });
  assert.deepEqual(validateDocument(graph([org, websiteNode(), briefPage, report])), []);
  const none = articleNode({ path: '/research/x/', headline: 'H', description: 'D', published: new Date('2026-10-01'), modified: new Date('2026-10-02'), type: 'Report', citation: [] });
  assert.equal(none['citation'], undefined, 'an empty citation list is left out');
});

test('the facts page is an AboutPage that is about the organisation', () => {
  const page = pageNode({ path: '/about/facts/', name: 'Facts about WE', description: 'D', type: 'AboutPage' });
  assert.equal(page['@type'], 'AboutPage');
  assert.deepEqual(page['about'], { '@id': 'https://worldenterprise.org/#org' });
});

test('robots.txt in production names the AI crawlers, allows them, and lists the sitemap', () => {
  const prod = robotsTxt(false);
  assert.match(prod, /^User-agent: \*\nAllow: \/\n/);
  assert.match(prod, /Sitemap: https:\/\/worldenterprise\.org\/sitemap-index\.xml\n$/);
  assert.ok(!/Disallow/.test(prod));
  for (const agent of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'Google-Extended', 'Applebot-Extended', 'PerplexityBot', 'CCBot']) {
    assert.match(prod, new RegExp(`^User-agent: ${agent}\\nAllow: /$`, 'm'), agent);
  }
  assert.deepEqual(AI_CRAWLER_AGENTS, AI_CRAWLER_GROUPS.flatMap((g) => [...g.agents]));
  assert.equal(new Set(AI_CRAWLER_AGENTS).size, AI_CRAWLER_AGENTS.length, 'no crawler is named twice');
});

test('robots.txt in preview disallows everything and names no crawler', () => {
  assert.equal(robotsTxt(true), 'User-agent: *\nDisallow: /\n');
});

test('robots.txt passes the denylist as plain text', () => {
  for (const preview of [false, true]) assert.deepEqual(audit.scan(robotsTxt(preview), { route: '/robots.txt', plain: true }), []);
});
