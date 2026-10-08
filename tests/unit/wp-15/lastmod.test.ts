import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createLastmodLookup, frontmatterDate, indexContent, indexPages } from '../../../src/lib/lastmod.ts';
import type { GitDate } from '../../../src/lib/lastmod.ts';
import { isSitemapUrl, withLastmod } from '../../../src/lib/seo.ts';

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'we-lastmod-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

const doc = (extra: string): string => `---\ntitle: T\n${extra}\n---\n\nBody.\n`;

test('frontmatterDate reads updated and updatedDate, quoted or not, and ignores bad values', () => {
  assert.equal(frontmatterDate(doc('updated: 2026-10-06'))?.toISOString(), '2026-10-06T00:00:00.000Z');
  assert.equal(frontmatterDate(doc('updatedDate: "2026-09-01"'))?.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(frontmatterDate(doc('updated: soon')), undefined);
  assert.equal(frontmatterDate(doc('title2: x')), undefined);
  assert.equal(frontmatterDate('no frontmatter here'), undefined);
});

test('the index skips underscore folders and non-markdown files', () => {
  const root = tree({
    'src/content/services/brand.mdx': doc(''),
    'src/content/insights/dream/first-idea.mdx': doc(''),
    'src/content/services/_fixtures/x.md': doc(''),
    'src/content/services/readme.txt': 'x',
  });
  try {
    const ids = indexContent(root).map((f) => `${f.collection}:${f.id}`).sort();
    assert.deepEqual(ids, ['insights:dream/first-idea', 'services:brand']);
    assert.equal(indexPages(root).fixed.size, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lookup prefers frontmatter, then the entry commit, then the page file commit, else nothing', () => {
  const root = tree({
    'src/pages/index.astro': '',
    'src/pages/faq/index.astro': '',
    'src/pages/program/index.astro': '',
    'src/pages/insights/[slug].astro': '',
    'src/pages/insights/topic/[topic].astro': '',
    'src/pages/about/frameworks/orbital/index.astro': '',
    'src/pages/untracked/index.astro': '',
    'src/content/pages/home/index.mdx': doc('updated: 2026-10-01'),
    'src/content/pages/program/index.mdx': doc('updated: 2026-10-05'),
    'src/content/pages/about/orbital.md': doc('updated: 2026-09-20'),
    'src/content/pages/insights/topic-dream.mdx': doc('updated: 2026-09-15'),
    'src/content/insights/dream/first-idea.mdx': doc('title2: no date here'),
  });
  const commits: Record<string, string> = {
    'src/pages/faq/index.astro': '2026-08-01T10:00:00Z',
    'src/content/insights/dream/first-idea.mdx': '2026-07-04T08:30:00Z',
  };
  const git: GitDate = (path) => (commits[path] === undefined ? undefined : new Date(commits[path]));
  try {
    const lookup = createLastmodLookup({ root, git });
    assert.equal(lookup('/')?.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(lookup('/program/')?.toISOString(), '2026-10-05T00:00:00.000Z');
    assert.equal(lookup('/about/frameworks/orbital/')?.toISOString(), '2026-09-20T00:00:00.000Z');
    assert.equal(lookup('/insights/topic/dream/')?.toISOString(), '2026-09-15T00:00:00.000Z');
    assert.equal(lookup('/insights/first-idea/')?.toISOString(), '2026-07-04T08:30:00.000Z');
    assert.equal(lookup('/faq/')?.toISOString(), '2026-08-01T10:00:00.000Z');
    assert.equal(lookup('/untracked/'), undefined);
    assert.equal(lookup('/missing/'), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a preview base path is stripped before matching', () => {
  const root = tree({ 'src/pages/program/index.astro': '', 'src/content/pages/program/index.mdx': doc('updated: 2026-10-05') });
  try {
    const lookup = createLastmodLookup({ root, base: '/worldenterprise', git: () => undefined });
    assert.equal(lookup('/worldenterprise/program/')?.toISOString(), '2026-10-05T00:00:00.000Z');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('withLastmod leaves an item untouched when no date is known and the sitemap filter drops noindex routes', () => {
  const item = { url: 'https://worldenterprise.org/program/' };
  assert.equal(withLastmod(item, () => undefined), item);
  assert.equal(withLastmod(item, () => new Date('2026-10-05T00:00:00Z')).lastmod, '2026-10-05T00:00:00.000Z');
  assert.equal(isSitemapUrl('https://worldenterprise.org/search/'), false);
  assert.equal(isSitemapUrl('https://worldenterprise.org/sitemap/'), false);
  assert.equal(isSitemapUrl('https://worldenterprise.org/apply/thanks/'), false);
  assert.equal(isSitemapUrl('https://worldenterprise.org/program/'), true);
});
