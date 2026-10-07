import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractJsonLd, validateDocument, validatePage } from '../../../scripts/validate-jsonld.mjs';
import { articleNode, faqPageNode, graph, organizationNode, pageNode, websiteNode } from '../../../src/lib/schema.ts';
import { pageHtml } from './helpers.ts';

const org = organizationNode('https://worldenterprise.org/logo.svg');
const web = websiteNode();
const pageOf = (path: string) => pageNode({ path, name: 'P', description: 'D', type: 'WebPage' });

test('a page built from the real builders validates, with and without breadcrumbs', () => {
  assert.deepEqual(validatePage({ path: '/program/', html: pageHtml() }), []);
  assert.deepEqual(validatePage({ path: '/', html: pageHtml({ path: '/', withBreadcrumb: false }) }), []);
});

test('a parse failure is reported, not thrown', () => {
  const html = '<script type="application/ld+json">{ nope </script>';
  assert.equal(extractJsonLd(html).errors.length, 1);
  assert.ok(validatePage({ path: '/x/', html }).some((e) => e.includes('does not parse')));
});

test('types outside the allowlist and forbidden types are errors', () => {
  const doc = graph([org, web, pageOf('/x/'), { '@type': 'Event', '@id': 'https://worldenterprise.org/x/#event', name: 'E' }]);
  assert.ok(validateDocument(doc).some((e) => e.includes('forbidden @type Event')));
  const odd = graph([org, web, pageOf('/x/'), { '@type': 'Recipe', '@id': 'https://worldenterprise.org/x/#r' }]);
  assert.ok(validateDocument(odd).some((e) => e.includes('not on the allowlist')));
  for (const type of ['Offer', 'Review', 'Person', 'AggregateRating']) {
    const bad = graph([org, web, pageOf('/x/'), { '@type': type, '@id': `https://worldenterprise.org/x/#${type}` }]);
    assert.ok(validateDocument(bad).some((e) => e.includes(`forbidden @type ${type}`)), type);
  }
});

test('forbidden properties: offers, price, identifiers, street address, founding date', () => {
  for (const key of ['offers', 'price', 'foundingDate', 'taxID', 'streetAddress']) {
    const doc = graph([{ ...org, [key]: 'x' }, web, pageOf('/x/')]);
    assert.ok(validateDocument(doc).some((e) => e.includes(`forbidden property "${key}"`)), key);
  }
});

test('dangling and duplicate @id values are errors', () => {
  const dangling = graph([org, web, { ...pageOf('/x/'), about: { '@id': 'https://worldenterprise.org/#missing' } }]);
  assert.ok(validateDocument(dangling).some((e) => e.includes('does not resolve')));
  assert.ok(validateDocument(graph([org, org, web, pageOf('/x/')])).some((e) => e.includes('duplicate @id')));
});

test('required properties are enforced', () => {
  const { description: _d, ...thin } = org as Record<string, unknown>;
  assert.ok(validateDocument(graph([thin, web, pageOf('/x/')])).some((e) => e.includes('missing required property "description"')));
  const faq = { ...faqPageNode('/faq/', [{ question: 'Q', answer: 'A' }]), mainEntity: [] };
  assert.ok(validateDocument(graph([org, web, pageOf('/faq/'), faq])).some((e) => e.includes('"mainEntity"')));
});

test('an article by a Person-like author fails; the editorial Organization passes', () => {
  const ok = articleNode({ path: '/insights/a/', headline: 'H', description: 'D', published: new Date('2026-01-01T00:00:00Z') });
  assert.deepEqual(validateDocument(graph([org, web, pageOf('/insights/a/'), ok])), []);
  const bad = { ...ok, author: { '@type': 'Organization', name: 'Someone Else' } };
  assert.ok(validateDocument(graph([org, web, pageOf('/insights/a/'), bad])).some((e) => e.includes('author must be')));
});

test('the page node url must match the canonical', () => {
  const html = pageHtml({ canonical: 'https://worldenterprise.org/program/' }).replace('"url":"https://worldenterprise.org/program/","name":"Program"', '"url":"https://worldenterprise.org/other/","name":"Program"');
  assert.ok(validatePage({ path: '/program/', html }).some((e) => e.includes('differs from the canonical')));
});
