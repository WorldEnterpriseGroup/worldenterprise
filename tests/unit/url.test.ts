import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAbsolute, buildAsset, buildHref, normalizeBase } from '../../src/lib/url-core.ts';

test('normalizeBase handles slashes and empties', () => {
  assert.equal(normalizeBase('/'), '');
  assert.equal(normalizeBase(undefined), '');
  assert.equal(normalizeBase('/worldenterprise/'), '/worldenterprise');
  assert.equal(normalizeBase('worldenterprise'), '/worldenterprise');
});

test('buildHref adds base and trailing slash', () => {
  assert.equal(buildHref('/program', '/'), '/program/');
  assert.equal(buildHref('/program/', '/worldenterprise/'), '/worldenterprise/program/');
  assert.equal(buildHref('program/how-it-works', '/worldenterprise'), '/worldenterprise/program/how-it-works/');
  assert.equal(buildHref('/', '/worldenterprise/'), '/worldenterprise/');
});

test('buildHref keeps file extensions, queries and fragments', () => {
  assert.equal(buildHref('/rss.xml', '/x'), '/x/rss.xml');
  assert.equal(buildHref('/search?q=safe', '/'), '/search/?q=safe');
  assert.equal(buildHref('/services#a', '/'), '/services/#a');
});

test('buildHref passes external and fragment references through', () => {
  assert.equal(buildHref('https://example.org/a', '/x'), 'https://example.org/a');
  assert.equal(buildHref('mailto:a@example.org', '/x'), 'mailto:a@example.org');
  assert.equal(buildHref('#main', '/x'), '#main');
  assert.equal(buildHref('//cdn.example.org/a', '/x'), '//cdn.example.org/a');
});

test('buildAsset prefixes the base only', () => {
  assert.equal(buildAsset('/favicon.svg', '/worldenterprise/'), '/worldenterprise/favicon.svg');
  assert.equal(buildAsset('favicon.svg', '/'), '/favicon.svg');
});

test('buildAbsolute ignores the preview base', () => {
  assert.equal(buildAbsolute('/program', 'https://worldenterprise.org/'), 'https://worldenterprise.org/program/');
  assert.equal(buildAbsolute('/', 'https://worldenterprise.org'), 'https://worldenterprise.org/');
});
