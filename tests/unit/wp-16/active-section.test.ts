import assert from 'node:assert/strict';
import test from 'node:test';
import { activeSectionId, primaryNav } from '../../../src/data/nav.ts';

test('the pages that a panel only lists have no current section', () => {
  for (const path of ['/apply/', '/apply/thanks/', '/contact/', '/trust/', '/pricing/']) {
    assert.equal(activeSectionId(path), null, path);
  }
});

test('the sections around them keep theirs', () => {
  const expected: Record<string, string> = {
    '/founders/': 'network',
    '/investors/': 'network',
    '/network/operators/': 'network',
    '/press/': 'about',
    '/about/manifesto/': 'about',
    '/fundability/': 'playbooks',
    '/fundability/data-room/': 'playbooks',
    '/research/saas-security-baseline-year-one/': 'playbooks',
    '/search/': 'resources',
    '/glossary/': 'resources',
    '/tools/team-composer/': 'resources',
    '/insights/some-article/': 'resources',
    '/program/dream/': 'program',
    '/services/digital-incubation/': 'services',
  };
  for (const [path, id] of Object.entries(expected)) assert.equal(activeSectionId(path), id, path);
});

test('every section id the function can return is a primary nav item', () => {
  const ids = new Set(primaryNav.map((item) => item.id));
  for (const path of ['/founders/', '/press/', '/search/', '/pricing/', '/program/how-it-works/', '/legal/privacy/', '/apply/']) {
    const id = activeSectionId(path);
    assert.ok(id === null || ids.has(id), `${path} -> ${id}`);
  }
});
