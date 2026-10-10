import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import type { DefinitionMarkers } from '../../../src/components/reference/jsonld.ts';
import {
  anchorId,
  definedTermSetNode,
  definitionMarkers,
  faqPageNode,
  GLOSSARY_GROUP_ORDER,
  groupAnchorId,
  groupBy,
  initials,
  orderedGroups,
} from '../../../src/components/reference/jsonld.ts';
import { site } from '../../../src/data/site.ts';
import { scan } from '../../../scripts/audit-claims.mjs';

/**
 * WP-77 page: the grouped list, the jump list, the stable anchors, the claims markers, and a snapshot proving the JSON-LD builders that
 * existed before this package still produce the same output (jsonld.ts stays additive).
 */
const root = new URL('../../../', import.meta.url).pathname;

function readText(path: string): string {
  try {
    return readFileSync(new URL(path, `file://${root}`), 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${path}: ${(error as Error).message}`);
  }
}

const origin = (value: unknown): string => JSON.stringify(value).replaceAll(site.origin, 'ORIGIN');

// ---------------------------------------------------------------------------------------------------------------------------------
// The existing builders are unchanged
// ---------------------------------------------------------------------------------------------------------------------------------

test('snapshot: anchorId, groupBy and initials behave as before', () => {
  assert.equal(anchorId('term', 'seed-round'), 'term-seed-round');
  assert.equal(anchorId('faq', 'what-is-a-seat'), 'faq-what-is-a-seat');
  assert.deepEqual(
    groupBy([
      { id: 'a', group: 'B' },
      { id: 'b', group: 'A' },
      { id: 'c', group: 'B' },
    ]),
    [
      { group: 'B', items: [{ id: 'a', group: 'B' }, { id: 'c', group: 'B' }] },
      { group: 'A', items: [{ id: 'b', group: 'A' }] },
    ],
  );
  assert.deepEqual(initials(['Burn', 'ARR', 'arr again', '3D', 'Cap table']), ['#', 'A', 'B', 'C']);
});

test('snapshot: definedTermSetNode output is unchanged', () => {
  const node = definedTermSetNode('/glossary/', 'Glossary', [
    { id: 'mvp', term: 'MVP', definition: 'Minimum viable product.' },
    { id: 'seed-round', term: 'Seed round', definition: 'An early financing round.' },
  ]);
  assert.equal(
    origin(node),
    '{"@type":"DefinedTermSet","@id":"ORIGIN/glossary/#termset","url":"ORIGIN/glossary/","name":"Glossary","inLanguage":"en-US","isPartOf":{"@id":"ORIGIN/#website"},"hasDefinedTerm":[{"@type":"DefinedTerm","@id":"ORIGIN/glossary/#term-mvp","name":"MVP","description":"Minimum viable product.","inDefinedTermSet":{"@id":"ORIGIN/glossary/#termset"}},{"@type":"DefinedTerm","@id":"ORIGIN/glossary/#term-seed-round","name":"Seed round","description":"An early financing round.","inDefinedTermSet":{"@id":"ORIGIN/glossary/#termset"}}]}',
  );
});

test('snapshot: faqPageNode output is unchanged', () => {
  const node = faqPageNode('/faq/', [{ id: 'what-is-a-seat', question: 'What is a seat?', answer: 'A dedicated team slot.' }]);
  assert.equal(
    origin(node),
    '{"@type":"FAQPage","@id":"ORIGIN/faq/#faq","url":"ORIGIN/faq/","inLanguage":"en-US","isPartOf":{"@id":"ORIGIN/#website"},"mainEntity":[{"@type":"Question","@id":"ORIGIN/faq/#faq-what-is-a-seat","name":"What is a seat?","acceptedAnswer":{"@type":"Answer","text":"A dedicated team slot."}}]}',
  );
});

// ---------------------------------------------------------------------------------------------------------------------------------
// DefinedTermSet completeness and the anchors
// ---------------------------------------------------------------------------------------------------------------------------------

const entries = parse(readText('src/data/glossary.yaml')) as { id: string; term: string; definition: string; group: string }[];

test('the DefinedTermSet lists every term once, with the stable per-term anchor and no per-term page', () => {
  const node = definedTermSetNode('/glossary/', 'Glossary', entries) as { hasDefinedTerm: { '@id': string; name: string }[] };
  assert.equal(node.hasDefinedTerm.length, entries.length);
  assert.equal(new Set(node.hasDefinedTerm.map((t) => t['@id'])).size, entries.length);
  for (const [i, e] of entries.entries()) {
    assert.equal(node.hasDefinedTerm[i]?.['@id'], `${site.origin}/glossary/#term-${e.id}`);
    assert.equal(node.hasDefinedTerm[i]?.name, e.term);
  }
  assert.ok(!readText('src/pages/glossary/index.astro').includes('getStaticPaths'), 'the glossary has no per-term pages');
});

test('the page keeps its title and description, which resources.ts and llms-input.ts duplicate', () => {
  const page = readText('src/pages/glossary/index.astro');
  const description = 'Plain definitions of the funding, finance, product, legal and security terms early-stage SaaS founders meet, plus the words WE uses.';
  assert.ok(page.includes('title="Glossary"'));
  assert.ok(page.includes(`description="${description}"`));
  assert.ok(readText('src/components/reference/resources.ts').includes(description));
  // llms-input.ts states the first part only; it must not drift from the page.
  assert.ok(readText('src/components/geo/llms-input.ts').includes(description.slice(0, description.indexOf(', plus'))));
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Groups and the jump list
// ---------------------------------------------------------------------------------------------------------------------------------

test('groupAnchorId makes a stable lowercase hyphenated id', () => {
  assert.equal(groupAnchorId('Funding'), 'group-funding');
  assert.equal(groupAnchorId('Finance and metrics'), 'group-finance-and-metrics');
  assert.equal(groupAnchorId('Security and accessibility'), 'group-security-and-accessibility');
  assert.equal(groupAnchorId('Go-to-market'), 'group-go-to-market');
  assert.equal(groupAnchorId(' AI and data! '), 'group-ai-and-data');
  const ids = GLOSSARY_GROUP_ORDER.map(groupAnchorId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^group-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)));
});

test('orderedGroups follows GLOSSARY_GROUP_ORDER, puts an unknown group last, and keeps input order inside a group', () => {
  const items = [
    { id: '1', group: 'AI and data' },
    { id: '2', group: 'Brand new group' },
    { id: '3', group: 'Funding' },
    { id: '4', group: 'AI and data' },
    { id: '5', group: 'Another new group' },
  ];
  const result = orderedGroups(items);
  assert.deepEqual(
    result.map((g) => g.group),
    ['Funding', 'AI and data', 'Brand new group', 'Another new group'],
  );
  assert.deepEqual(
    result.find((g) => g.group === 'AI and data')?.items.map((i) => i.id),
    ['1', '4'],
  );
  assert.deepEqual(orderedGroups([]), []);
});

test('every real group appears in the jump list order, and no term falls outside a group', () => {
  const grouped = orderedGroups(entries);
  assert.equal(grouped.reduce((n, g) => n + g.items.length, 0), entries.length);
  assert.deepEqual(
    grouped.map((g) => g.group),
    GLOSSARY_GROUP_ORDER.filter((g) => entries.some((e) => e.group === g)),
  );
});

test('the component renders a keyboard-operable jump list of anchor links, a heading per group, and the stable term anchor', () => {
  const component = readText('src/components/reference/GlossaryList.astro');
  assert.match(component, /<nav class="glossary-index" aria-label="Jump to a group of terms">/);
  assert.match(component, /<a href=\{`#\$\{groupAnchorId\(section\.group\)\}`\}>/);
  assert.match(component, /<h2 id=\{groupAnchorId\(section\.group\)\}>/);
  assert.match(component, /<dt id=\{anchorId\('term', t\.id\)\}>/);
  assert.match(component, /<p \{\.\.\.definitionMarkers\(t\)\}>/);
  assert.doesNotMatch(component, /tabindex|onclick|addEventListener/i, 'native anchors need no script or tabindex');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Claims markers on synthetic flagged terms
// ---------------------------------------------------------------------------------------------------------------------------------

const html = (markers: DefinitionMarkers, text: string): string => {
  const attrs = Object.entries(markers)
    .map(([k, v]) => (v === '' ? k : `${k}="${v ?? ''}"`))
    .join(' ');
  return `<dl><div><dt>Term</dt><dd><p ${attrs}>${text}</p></dd></div></dl>`;
};

test('definitionMarkers: nothing for a plain term, one attribute per flag', () => {
  assert.deepEqual(definitionMarkers({}), {});
  assert.deepEqual(definitionMarkers({ genericDefinition: false, claimAllow: [] }), {});
  assert.deepEqual(definitionMarkers({ genericDefinition: true }), { 'data-generic-definition': '' });
  assert.deepEqual(definitionMarkers({ claimAllow: ['C-13-peers'] }), { 'data-claim-allow': 'C-13-peers' });
  assert.deepEqual(definitionMarkers({ genericDefinition: true, claimAllow: ['C-13-peers', 'C-14-success-based'] }), {
    'data-generic-definition': '',
    'data-claim-allow': 'C-13-peers C-14-success-based',
  });
});

test('a flagged SAFE-mechanics definition passes the claims scan and an unflagged one does not', () => {
  const text = 'A valuation cap limits the price at which an instrument converts.';
  const rules = (page: string): string[] => scan(page, { route: '/glossary/', flagValues: {} }).map((h: { rule: string }) => h.rule);
  assert.ok(rules(html({}, text)).includes('C-08-valuation-cap'), 'the denylist must catch the unmarked wording');
  assert.ok(!rules(html(definitionMarkers({ genericDefinition: true }), text)).includes('C-08-valuation-cap'));
});

test('a claim-allow marker exempts only the rule it names', () => {
  const text = 'A cohort is a group of founders who start together.';
  const rules = (page: string): string[] => scan(page, { route: '/glossary/', flagValues: {} }).map((h: { rule: string }) => h.rule);
  assert.ok(rules(html({}, text)).includes('C-13-peers'));
  assert.ok(!rules(html(definitionMarkers({ claimAllow: ['C-13-peers'] }), text)).includes('C-13-peers'));
  assert.ok(rules(html(definitionMarkers({ claimAllow: ['C-14-success-based'] }), text)).includes('C-13-peers'));
});

test('a marker never exempts a plain-text twin', () => {
  const rules = scan('A valuation cap limits the price.', { route: '/glossary.md', plain: true, flagValues: {} }).map((h: { rule: string }) => h.rule);
  assert.ok(rules.includes('C-08-valuation-cap'));
});
