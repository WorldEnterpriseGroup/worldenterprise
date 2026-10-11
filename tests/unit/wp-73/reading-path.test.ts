import assert from 'node:assert/strict';
import test from 'node:test';
import { readingPath } from '../../../src/components/families/view.ts';
import type { ArticleRef } from '../../../src/components/families/view.ts';
import { SEGMENTS } from '../../../src/data/families.ts';

/**
 * WP-73: the reading path of a segment page renders from the articles whose `segments` field names the segment, and from nothing else.
 * `readingPath` is WP-71's view function; these fixtures pin the three cases the issue names: zero, one and many matching articles.
 */
const article = (title: string, segments: readonly string[], published?: string): ArticleRef => ({
  title,
  href: `/insights/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
  summary: `Summary of ${title}.`,
  segments,
  published: published === undefined ? undefined : new Date(published),
});

test('zero matching articles give an empty reading path, never a placeholder', () => {
  assert.deepEqual(readingPath([], 'solo-founders'), []);
  assert.deepEqual(readingPath([article('Cap tables', ['first-time-founders'])], 'solo-founders'), []);
});

test('one matching article gives a path of one', () => {
  const path = readingPath([article('Cap tables', ['first-time-founders']), article('Runway', ['solo-founders'])], 'solo-founders');
  assert.equal(path.length, 1);
  assert.equal(path[0]?.title, 'Runway');
  assert.equal(path[0]?.href, '/insights/runway/');
  assert.equal(path[0]?.description, 'Summary of Runway.');
});

test('many matching articles are all listed, newest first and then by title, and an article with several segments appears on each', () => {
  const articles = [
    article('Banking', ['solo-founders', 'student-founders'], '2026-10-01'),
    article('Agreements', ['solo-founders'], '2026-10-01'),
    article('Runway', ['solo-founders', 'non-technical-founders'], '2026-10-09'),
    article('Undated', ['solo-founders']),
    article('Elsewhere', ['global-remote-founders'], '2026-10-10'),
  ];
  assert.deepEqual(readingPath(articles, 'solo-founders').map((l) => l.title), ['Runway', 'Agreements', 'Banking', 'Undated']);
  assert.deepEqual(readingPath(articles, 'student-founders').map((l) => l.title), ['Banking']);
  assert.deepEqual(readingPath(articles, 'global-remote-founders').map((l) => l.title), ['Elsewhere']);
});

test('the order does not depend on the order the collection returns', () => {
  const articles = [article('B', ['solo-founders'], '2026-10-02'), article('A', ['solo-founders'], '2026-10-02'), article('C', ['solo-founders'], '2026-10-03')];
  const forward = readingPath(articles, 'solo-founders').map((l) => l.title);
  const backward = readingPath([...articles].reverse(), 'solo-founders').map((l) => l.title);
  assert.deepEqual(forward, ['C', 'A', 'B']);
  assert.deepEqual(backward, forward);
});

test('a slug of the registry is the only key: a short name or a label matches nothing', () => {
  const articles = [article('Runway', ['solo-founders'])];
  for (const entry of SEGMENTS.entries) {
    assert.equal(readingPath(articles, entry.short).length, entry.short === entry.slug ? 1 : 0, `${entry.short} is not a segment slug`);
    assert.equal(readingPath(articles, entry.label).length, 0, `${entry.label} is not a segment slug`);
  }
});
