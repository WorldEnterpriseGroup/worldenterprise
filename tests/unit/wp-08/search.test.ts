import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_QUERY_LENGTH, normalizeBase, normalizeQuery, readQuery, resolveResultUrl, resultsStatus, withQuery } from '../../../src/components/islands/we-search/query.ts';

test('readQuery reads and normalises q', () => {
  assert.equal(readQuery('?q=%20data%20%20room%20'), 'data room');
  assert.equal(readQuery(''), '');
  assert.equal(readQuery('?other=1'), '');
});

test('normalizeQuery caps the length', () => {
  assert.equal(normalizeQuery('x'.repeat(500)).length, MAX_QUERY_LENGTH);
});

test('withQuery sets, replaces and removes q while keeping other parameters', () => {
  assert.equal(withQuery('', 'seat'), '?q=seat');
  assert.equal(withQuery('?q=old&x=1', 'new term'), '?q=new+term&x=1');
  assert.equal(withQuery('?q=old', ''), '');
  assert.equal(withQuery('?x=1', '   '), '?x=1');
});

test('base handling prefixes result URLs once', () => {
  assert.equal(normalizeBase('/worldenterprise/'), '/worldenterprise');
  assert.equal(normalizeBase('/'), '');
  assert.equal(resolveResultUrl('/program/', ''), '/program/');
  assert.equal(resolveResultUrl('/program/', '/worldenterprise'), '/worldenterprise/program/');
  assert.equal(resolveResultUrl('/worldenterprise/program/', '/worldenterprise'), '/worldenterprise/program/');
  assert.equal(resolveResultUrl('https://example.org/x', '/worldenterprise'), 'https://example.org/x');
});

test('status text covers zero, one and many results', () => {
  assert.equal(resultsStatus(0, 'x'), 'No results for “x”.');
  assert.equal(resultsStatus(1, 'x'), '1 result for “x”.');
  assert.equal(resultsStatus(12, 'x'), '12 results for “x”.');
});
