import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import * as seoAudit from '../../../scripts/audit-seo.mjs';
import { createLastmodLookup, frontmatterDate, pageFileDate } from '../../../src/lib/lastmod.ts';

// SEO P2-7: the sitemap says what the page says. The lookup follows the same fallback chain the layouts use for `updated`, and the
// built-site audit fails when a lastmod contradicts the page's own article:modified_time.

const doc = (extra: string): string => `---\ntitle: T\n${extra}\n---\n\nBody.\n`;

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'we-lastmod19-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

test('publishedDate is the last frontmatter fallback, after updatedDate and updated', () => {
  assert.equal(frontmatterDate(doc('publishedDate: 2026-10-06'))?.toISOString(), '2026-10-06T00:00:00.000Z');
  assert.equal(frontmatterDate(doc('publishedDate: 2026-10-06\nupdatedDate: 2026-10-09'))?.toISOString(), '2026-10-09T00:00:00.000Z');
  assert.equal(frontmatterDate(doc('publishedDate: 2026-10-06\nupdated: 2026-10-08'))?.toISOString(), '2026-10-08T00:00:00.000Z');
});

test('a literal updated date in a page file is read, a computed or missing one is not', () => {
  assert.equal(pageFileDate("<BaseLayout\n  updated={new Date('2026-10-06')}\n>")?.toISOString(), '2026-10-06T00:00:00.000Z');
  assert.equal(pageFileDate('<BaseLayout updated={ new Date( "2026-10-06T12:00:00Z" ) } />')?.toISOString(), '2026-10-06T12:00:00.000Z');
  assert.equal(pageFileDate('<BaseLayout updated={updatedDate ?? publishedDate} />'), undefined);
  assert.equal(pageFileDate("<BaseLayout updated={new Date('soon')} />"), undefined);
  assert.equal(pageFileDate('<BaseLayout />'), undefined);
});

test('an article with only publishedDate gets it as lastmod instead of the commit date, and a page without an entry uses its own literal', () => {
  const root = tree({
    'src/content/insights/build/post.mdx': doc('publishedDate: 2026-10-06'),
    'src/pages/insights/[slug].astro': '',
    'src/pages/faq/index.astro': "<BaseLayout updated={new Date('2026-10-06')} />",
    'src/pages/resources/index.astro': '<BaseLayout />',
  });
  try {
    const git = (path: string): Date => new Date(path.includes('resources') ? '2026-10-07T03:39:16Z' : '2026-10-08T03:06:12Z');
    const lookup = createLastmodLookup({ root, git });
    assert.equal(lookup('/insights/post/')?.toISOString(), '2026-10-06T00:00:00.000Z');
    assert.equal(lookup('/faq/')?.toISOString(), '2026-10-06T00:00:00.000Z', 'the literal beats the commit that touched the page file');
    assert.equal(lookup('/resources/')?.toISOString(), '2026-10-07T03:39:16.000Z', 'with no date anywhere on the page, git is the only evidence');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const { auditSitemap, parseSitemap } = seoAudit as unknown as {
  auditSitemap(pages: { path: string; html: string }[], entries: unknown[], options: { noindexPaths: Set<string> }): string[];
  parseSitemap(xml: string): unknown[];
};

const options = { noindexPaths: new Set<string>() };
const page = (path: string, modified?: string): { path: string; html: string } => ({
  path,
  html: modified === undefined ? '<html></html>' : `<html><head><meta property="article:modified_time" content="${modified}"></head></html>`,
});
const sitemap = (path: string, lastmod: string): unknown[] =>
  parseSitemap(`<urlset><url><loc>https://worldenterprise.org${path}</loc><lastmod>${lastmod}</lastmod></url></urlset>`);

test('the sitemap audit fails a lastmod that contradicts the page, and names both dates', () => {
  const errors = auditSitemap([page('/faq/', '2026-10-06T00:00:00.000Z')], sitemap('/faq/', '2026-10-07T03:39:16.000Z'), options);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /\/faq\/ lastmod 2026-10-07T03:39:16\.000Z differs from the page's own article:modified_time 2026-10-06T00:00:00\.000Z/);
});

test('the sitemap audit passes the same instant in any spelling, and a page that states no date', () => {
  assert.deepEqual(auditSitemap([page('/faq/', '2026-10-06T00:00:00.000Z')], sitemap('/faq/', '2026-10-06T00:00:00Z'), options), []);
  assert.deepEqual(auditSitemap([page('/resources/')], sitemap('/resources/', '2026-10-07T03:39:16.000Z'), options), []);
});
