import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { SEGMENTS } from '../../../src/data/families.ts';

/**
 * WP-73: which articles the reading path of each segment page draws on, read from the collection files as the template reads them
 * through the `segments` field. WP-99 asserts at least three live articles per segment at release (or lists the segment in the cut
 * notes); this test only guards what is true on any branch: every tagged value is a registry slug, and every segment has at least
 * one article to read, so a segment page never renders an empty path because of a tagging regression.
 */
const root = new URL('../../../', import.meta.url).pathname;
const INSIGHTS = join(root, 'src/content/insights');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : /\.mdx?$/.test(name) ? [path] : [];
  });
}

function segmentsOf(path: string): string[] {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, 'utf8'))?.[1];
  if (front === undefined) return [];
  return (parse(front) as { segments?: string[]; draft?: boolean }).segments ?? [];
}

const tagged = filesUnder(INSIGHTS).map((path) => ({ path, segments: segmentsOf(path) }));
const slugs = SEGMENTS.entries.map((entry) => entry.slug);

test('every segments value in an article is a registry slug', () => {
  for (const { path, segments } of tagged) {
    for (const segment of segments) assert.ok(slugs.includes(segment), `${path} lists "${segment}", which is not a segment slug`);
  }
});

test('every segment has at least one article that lists it', () => {
  for (const slug of slugs) {
    const count = tagged.filter((article) => article.segments.includes(slug)).length;
    assert.ok(count >= 1, `${slug}: no article lists this segment, so its reading path would be empty`);
  }
});
