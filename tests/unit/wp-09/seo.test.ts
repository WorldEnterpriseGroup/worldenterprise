import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupSitemapRoutes, isSitemapUrl, robotsTxt, securityTxt, speculationRules, withLastmod } from '../../../src/lib/seo.ts';

test('sitemap filter drops noindex routes, fixtures and the styleguide', () => {
  assert.equal(isSitemapUrl('https://worldenterprise.org/program/'), true);
  assert.equal(isSitemapUrl('https://worldenterprise.org/'), true);
  assert.equal(isSitemapUrl('https://worldenterprise.org/sitemap/'), false);
  assert.equal(isSitemapUrl('https://worldenterprise.org/search/'), false);
  assert.equal(isSitemapUrl('https://worldenterprise.org/apply/thanks/'), false);
  assert.equal(isSitemapUrl('https://worldenterprise.org/styleguide/'), false);
  assert.equal(isSitemapUrl('https://worldenterprise.org/insights/fixture-article/'), false);
});

test('withLastmod adds an ISO date only when the lookup finds one', () => {
  const item = { url: 'https://worldenterprise.org/program/' };
  const date = new Date('2026-09-30T12:00:00Z');
  assert.equal(withLastmod(item, () => date).lastmod, '2026-09-30T12:00:00.000Z');
  assert.equal(withLastmod(item, () => undefined).lastmod, undefined);
  assert.equal(withLastmod(item, () => new Date('nope')).lastmod, undefined);
});

test('robots.txt allows all in production and disallows all in preview', () => {
  const prod = robotsTxt(false);
  assert.match(prod, /^User-agent: \*\nAllow: \/\n/);
  assert.match(prod, /Sitemap: https:\/\/worldenterprise\.org\/sitemap-index\.xml\n$/);
  assert.ok(!/Disallow/.test(prod));
  const preview = robotsTxt(true);
  assert.match(preview, /Disallow: \/\n/);
  assert.ok(!/Sitemap/.test(preview));
});

test('security.txt is withheld until a mailbox is confirmed (C-22)', () => {
  const expires = new Date('2027-10-06T00:00:00Z');
  assert.equal(securityTxt({ contact: null, expires }), null);
  const body = securityTxt({ contact: 'security@worldenterprise.org', expires });
  assert.match(body ?? '', /^Contact: mailto:security@worldenterprise\.org\n/);
  assert.match(body ?? '', /Expires: 2027-10-06T00:00:00\.000Z/);
});

test('speculation rules exclude the thanks page and search and honour the preview base', () => {
  const prod = JSON.stringify(speculationRules('/'));
  assert.ok(prod.includes('"href_matches":"/*"'));
  assert.ok(prod.includes('/apply/thanks/') && prod.includes('/search/*'));
  assert.ok(prod.includes('"eagerness":"moderate"'));
  assert.ok(JSON.stringify(speculationRules('/worldenterprise/')).includes('"/worldenterprise/*"'));
});

test('site map grouping follows first-seen order and labels from the navigation data', () => {
  const labels = new Map([['/program/', 'Program'], ['/insights/a-b/', 'A better title']]);
  const sections = groupSitemapRoutes(['/', '/program/', '/program/how-it-works/', '/insights/a-b/', '/glossary/'], (p) => labels.get(p));
  assert.deepEqual(sections.map((s) => s.label), ['Home', 'Program', 'Insights', 'Reference']);
  assert.equal(sections[1]?.links[1]?.label, 'How it works');
  assert.equal(sections[2]?.links[0]?.label, 'A better title');
});
