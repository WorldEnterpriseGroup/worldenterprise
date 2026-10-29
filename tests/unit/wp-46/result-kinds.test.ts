import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESULT_KINDS, filteredStatus, isResultKind, kindLabel, kindsPresent, partialStatus, readType, resultKind, withType } from '../../../src/components/islands/we-search/query.ts';

test('a result URL says its type, with or without the preview base path', () => {
  assert.equal(resultKind('/insights/some-article/'), 'article');
  assert.equal(resultKind('/research/a-brief/'), 'research');
  assert.equal(resultKind('/playbooks/validate-the-problem/'), 'playbook');
  assert.equal(resultKind('/fundability/data-room/'), 'guide');
  assert.equal(resultKind('/library/investor-update/'), 'template');
  assert.equal(resultKind('/faq/'), 'faq');
  assert.equal(resultKind('/glossary/safe/'), 'glossary');
  assert.equal(resultKind('/worldenterprise/insights/some-article/', '/worldenterprise/'), 'article');
  assert.equal(resultKind('/worldenterprise/insights/some-article/', '/worldenterprise'), 'article');
  assert.equal(resultKind('/insights/some-article/', '/worldenterprise/'), 'article', 'a URL without the base is read as it is');
});

test('the hub of a type is that type, and a look-alike prefix is not', () => {
  assert.equal(resultKind('/insights/'), 'article');
  assert.equal(resultKind('/insights'), 'article');
  assert.equal(resultKind('/insightsfoo/'), null);
  assert.equal(resultKind('/research-and-more/'), null);
});

test('other pages and absolute URLs have no type', () => {
  assert.equal(resultKind('/program/'), null);
  assert.equal(resultKind('/'), null);
  assert.equal(resultKind('https://example.com/insights/x/'), null);
  assert.equal(resultKind('/worldenterprise/program/', '/worldenterprise'), null);
});

test('there are seven types, in chip order, each with a distinct route prefix', () => {
  assert.deepEqual(RESULT_KINDS.map((row) => row.id), ['article', 'research', 'playbook', 'guide', 'template', 'faq', 'glossary']);
  assert.equal(new Set(RESULT_KINDS.map((row) => row.prefix)).size, RESULT_KINDS.length);
  for (const row of RESULT_KINDS) assert.ok(row.prefix.startsWith('/') && row.prefix.endsWith('/'), row.prefix);
});

test('kindsPresent lists the types found, once each, in chip order', () => {
  const urls = ['/glossary/safe/', '/insights/a/', '/program/', '/insights/b/', '/playbooks/x/'];
  assert.deepEqual(kindsPresent(urls), ['article', 'playbook', 'glossary']);
  assert.deepEqual(kindsPresent([]), []);
  assert.deepEqual(kindsPresent(['/worldenterprise/faq/'], '/worldenterprise'), ['faq']);
});

test('readType reads a known type and ignores anything else, so a stale link still opens the page', () => {
  assert.equal(readType('?q=seat&type=playbook'), 'playbook');
  assert.equal(readType('?type=nonsense'), null);
  assert.equal(readType('?q=seat'), null);
  assert.equal(readType(''), null);
  assert.equal(isResultKind('guide'), true);
  assert.equal(isResultKind('Guide'), false);
});

test('withType sets or removes type and keeps the query and the other parameters', () => {
  assert.equal(withType('?q=seat', 'guide'), '?q=seat&type=guide');
  assert.equal(withType('?q=seat&type=guide', 'faq'), '?q=seat&type=faq');
  assert.equal(withType('?q=seat&type=guide', null), '?q=seat');
  assert.equal(withType('?type=guide', null), '');
  assert.equal(withType('', null), '');
});

test('the status line for a filtered list names the type and its count', () => {
  assert.equal(kindLabel('playbook'), 'Playbook');
  assert.equal(filteredStatus(3, 'seat', 'playbook'), '3 Playbook results for “seat”.');
  assert.equal(filteredStatus(1, 'seat', 'faq'), '1 FAQ result for “seat”.');
  assert.equal(filteredStatus(0, 'seat', 'guide'), 'No Guide results for “seat”.');
});

test('the status line while the count is not final names the type and the rows read so far', () => {
  assert.equal(partialStatus(10, 'the', 'article'), '10 Article results for “the” so far. Counting the rest.');
  assert.equal(partialStatus(1, 'the', 'faq'), '1 FAQ result for “the” so far. Counting the rest.');
});

test('the partial status can carry a different closing sentence', () => {
  assert.equal(partialStatus(3, 'the', 'guide', 'The rest could not be read.'), '3 Guide results for “the” so far. The rest could not be read.');
});
