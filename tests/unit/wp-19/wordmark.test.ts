import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LOGO_PATH, articleNode, logoUrl, organizationNode, withArticleImage } from '../../../src/lib/schema.ts';

// perf P2-3 and P2-6, SEO P2-4: the wordmark is small and has one stable URL for structured data, and Article and Report nodes
// carry the page's social card as their image.

const root = new URL('../../../', import.meta.url);
const bundled = readFileSync(new URL('src/assets/brand/we-logo-wordmark.svg', root), 'utf8');
const published = readFileSync(new URL('public/press/we-logo-wordmark.svg', root), 'utf8');

test('the wordmark is optimised: flat fills, no gradients, a viewBox, and under 10 KB', () => {
  assert.ok(bundled.length < 10 * 1024, `${bundled.length} bytes`);
  assert.doesNotMatch(bundled, /linearGradient|radialGradient|<defs|xlink|stop-color/);
  assert.match(bundled, /viewBox="0 0 505\.45 35\.62"/);
  assert.match(bundled, /^<svg\b/);
  const fills = new Set([...bundled.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]));
  assert.ok([...fills].every((fill) => /^#[0-9a-f]{6}$/.test(fill as string)), [...fills].join(' '));
});

test('the downloadable press copy is byte for byte the bundled wordmark, so the two cannot drift', () => {
  assert.equal(published, bundled);
});

test('the organisation logo URL is the stable press file, never a hashed build asset', () => {
  assert.equal(LOGO_PATH, '/press/we-logo-wordmark.svg');
  assert.equal(logoUrl(), 'https://worldenterprise.org/press/we-logo-wordmark.svg');
  assert.doesNotMatch(logoUrl(), /_astro|\.[A-Za-z0-9_-]{8}\.svg$/);
  assert.equal(organizationNode(logoUrl()).logo, logoUrl());
});

const article = articleNode({ path: '/insights/a/', headline: 'A', description: 'd', published: new Date('2026-10-06T00:00:00Z') });
const report = articleNode({ path: '/research/b/', headline: 'B', description: 'd', published: new Date('2026-10-06T00:00:00Z'), type: 'Report' });
const service = { '@type': 'Service', '@id': 'x#service', name: 'S' };
const CARD = 'https://worldenterprise.org/_astro/og-default.abc12345.avif';

test('Article and Report nodes get the social card as their image; other nodes are left alone', () => {
  const [a, r, s] = withArticleImage([article, report, service], CARD);
  assert.equal(a?.image, CARD);
  assert.equal(r?.image, CARD);
  assert.equal(s, service);
  assert.equal('image' in service, false);
});

test('an image the node already has wins, and a placeholder card (no url) adds nothing', () => {
  const own = { ...article, image: 'https://worldenterprise.org/own.avif' };
  assert.equal(withArticleImage([own], CARD)[0]?.image, 'https://worldenterprise.org/own.avif');
  const untouched = withArticleImage([article, report], undefined);
  assert.equal(untouched[0], article);
  assert.equal('image' in (untouched[1] ?? {}), false);
});

test('the input nodes are not mutated', () => {
  withArticleImage([article], CARD);
  assert.equal('image' in article, false);
});
