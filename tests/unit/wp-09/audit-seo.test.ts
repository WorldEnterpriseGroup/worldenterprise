import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditPage, auditSitemap, auditUniqueness, expectsNoindex, mainHeadings, parseSitemap, pathFromFile } from '../../../scripts/audit-seo.mjs';
import { NOINDEX, pageHtml } from './helpers.ts';

const options = { noindexPaths: NOINDEX, preview: false };

function errorsFor(path: string, html: string): string[] {
  return auditPage({ path, html }, options).errors;
}

test('a well-formed page passes and og:image is only a warning', () => {
  const result = auditPage({ path: '/program/', html: pageHtml() }, options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
});

test('file paths map to route paths', () => {
  assert.equal(pathFromFile('index.html'), '/');
  assert.equal(pathFromFile('program/index.html'), '/program/');
  assert.equal(pathFromFile('404.html'), '/404.html');
});

test('title rules: length and suffix', () => {
  assert.ok(errorsFor('/program/', pageHtml({ title: `${'Long '.repeat(14)}| World Enterprise` })).some((e) => e.includes('limit 60')));
  assert.ok(errorsFor('/program/', pageHtml({ title: 'Program' })).some((e) => e.includes('must end with')));
  assert.deepEqual(errorsFor('/', pageHtml({ path: '/', title: 'World Enterprise: A business incubation and consulting firm' })), []);
});

test('canonical must be single, absolute, self-referential and slash-terminated', () => {
  assert.ok(errorsFor('/program/', pageHtml({ canonical: 'https://worldenterprise.org/other/' })).some((e) => e.includes('canonical is')));
  assert.ok(errorsFor('/program/', pageHtml().replace(/<link rel="canonical"[^>]*>/, '')).some((e) => e.includes('exactly one canonical')));
  assert.deepEqual(errorsFor('/404.html', pageHtml({ path: '/404.html', robots: 'noindex,follow' })), []);
});

test('headings are judged inside <main> only; chrome headings before the h1 are ignored', () => {
  const html = pageHtml();
  assert.deepEqual(mainHeadings(html)?.map((h) => h.level), [1, 2, 3]);
  assert.deepEqual(errorsFor('/program/', html), []);
  assert.ok(errorsFor('/program/', pageHtml({ main: '<h1>A</h1><h3>Skipped</h3>' })).some((e) => e.includes('skips from h1 to h3')));
  assert.ok(errorsFor('/program/', pageHtml({ main: '<h1>A</h1><h1>B</h1>' })).some((e) => e.includes('exactly one h1')));
  assert.ok(errorsFor('/program/', pageHtml({ main: '<h2>A</h2>' })).some((e) => e.includes('expected h1') || e.includes('exactly one h1')));
});

test('noindex rules: ledger routes, fixtures, styleguide and preview', () => {
  assert.ok(expectsNoindex('/sitemap/', options));
  assert.ok(expectsNoindex('/insights/fixture-article/', options));
  assert.ok(expectsNoindex('/styleguide/', options));
  assert.ok(!expectsNoindex('/program/', options));
  assert.ok(expectsNoindex('/program/', { ...options, preview: true }));
  assert.ok(errorsFor('/sitemap/', pageHtml({ path: '/sitemap/', robots: 'index,follow' })).some((e) => e.includes('expected noindex')));
  assert.ok(errorsFor('/program/', pageHtml({ robots: 'noindex,follow' })).some((e) => e.includes('indexable')));
});

test('Open Graph: required tags, AVIF image and large card', () => {
  assert.ok(errorsFor('/program/', pageHtml().replace(/<meta property="og:url"[^>]*>/, '')).some((e) => e.includes('og:url')));
  assert.deepEqual(errorsFor('/program/', pageHtml({ ogImage: 'https://worldenterprise.org/og-home.avif' })), []);
  assert.ok(errorsFor('/program/', pageHtml({ ogImage: 'https://worldenterprise.org/og-home.png' })).some((e) => e.includes('AVIF')));
});

test('uniqueness is judged among indexable pages only', () => {
  const a = { path: '/a/', html: pageHtml({ path: '/a/' }) };
  const b = { path: '/b/', html: pageHtml({ path: '/b/' }) };
  const c = { path: '/sitemap/', html: pageHtml({ path: '/sitemap/', robots: 'noindex,follow' }) };
  assert.equal(auditUniqueness([a, b], options).length, 2);
  assert.deepEqual(auditUniqueness([a, c], options), []);
});

test('sitemap: noindex routes must not be listed, indexable pages must be, lastmod must be a date', () => {
  const pages = [{ path: '/', html: '' }, { path: '/program/', html: '' }, { path: '/sitemap/', html: '' }];
  const xml = (urls: string[]): string => `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;
  assert.deepEqual(auditSitemap(pages, parseSitemap(xml(['https://worldenterprise.org/', 'https://worldenterprise.org/program/'])), options), []);
  assert.ok(auditSitemap(pages, parseSitemap(xml(['https://worldenterprise.org/', 'https://worldenterprise.org/program/', 'https://worldenterprise.org/sitemap/'])), options).some((e) => e.includes('noindex route')));
  assert.ok(auditSitemap(pages, parseSitemap(xml(['https://worldenterprise.org/'])), options).some((e) => e.includes('missing')));
  const bad = parseSitemap('<urlset><url><loc>https://worldenterprise.org/</loc><lastmod>soon</lastmod></url></urlset>');
  assert.ok(auditSitemap([{ path: '/', html: '' }], bad, options).some((e) => e.includes('invalid lastmod')));
});
