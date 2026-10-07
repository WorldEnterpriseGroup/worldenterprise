import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anchorId, definedTermSetNode, faqPageNode, groupBy, initials } from '../../../src/components/reference/jsonld.ts';
import { liveGroups } from '../../../src/components/reference/resources.ts';

test('FAQPage node lists every question with a stable anchor', () => {
  const node = faqPageNode('/faq/', [
    { id: 'a', question: 'Q one?', answer: 'A one.' },
    { id: 'b', question: 'Q two?', answer: 'A two.' },
  ]);
  assert.equal(node['@type'], 'FAQPage');
  const main = node['mainEntity'] as { '@id': string; name: string; acceptedAnswer: { text: string } }[];
  assert.equal(main.length, 2);
  assert.equal(main[0]?.['@id'], `https://worldenterprise.org/faq/#${anchorId('faq', 'a')}`);
  assert.equal(main[1]?.acceptedAnswer.text, 'A two.');
});

test('DefinedTermSet node references its set and carries every term', () => {
  const node = definedTermSetNode('/glossary/', 'Glossary', [{ id: 'mvp', term: 'MVP', definition: 'Minimum viable product.' }]);
  assert.equal(node['@type'], 'DefinedTermSet');
  const terms = node['hasDefinedTerm'] as { name: string; inDefinedTermSet: { '@id': string } }[];
  assert.equal(terms[0]?.name, 'MVP');
  assert.equal(terms[0]?.inDefinedTermSet['@id'], node['@id']);
});

test('groupBy keeps first-seen group order', () => {
  const groups = groupBy([
    { group: 'B', n: 1 },
    { group: 'A', n: 2 },
    { group: 'B', n: 3 },
  ]);
  assert.deepEqual(groups.map((g) => g.group), ['B', 'A']);
  assert.deepEqual(groups[0]?.items.map((i) => i.n), [1, 3]);
});

test('initials returns sorted unique letters with # first', () => {
  assert.deepEqual(initials(['Burn', 'ARR', 'arr again', '3D', 'Cap table']), ['#', 'A', 'B', 'C']);
});

test('resource groups drop items whose route is not live and empty groups', () => {
  const groups = liveGroups((path) => path === '/library/');
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.items[0]?.path, '/library/');
  assert.deepEqual(liveGroups(() => false), []);
});
