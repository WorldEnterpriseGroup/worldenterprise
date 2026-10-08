import assert from 'node:assert/strict';
import test from 'node:test';
import * as validator from '../../../scripts/validate-jsonld.mjs';
import { articleNode, organizationNode } from '../../../src/lib/schema.ts';
import { pageHtml } from '../wp-09/helpers.ts';

// The built-page validator now holds Article and Report nodes to the page's og:image and the logo to a stable URL.

const { validatePage } = validator as unknown as { validatePage(page: { path: string; html: string }): string[] };

const CARD = 'https://worldenterprise.org/_astro/og-default.abc12345.avif';
const published = new Date('2026-10-06T00:00:00Z');
const node = (image?: string) => ({ ...articleNode({ path: '/insights/a/', headline: 'A', description: 'd', published }), ...(image === undefined ? {} : { image }) });
const errors = (html: string): string => validatePage({ path: '/insights/a/', html }).join('\n');

test('an Article whose image is the og:image passes', () => {
  assert.equal(errors(pageHtml({ path: '/insights/a/', ogImage: CARD, extraNodes: [node(CARD)] })), '');
});

test('an Article without an image fails when the page has a social card, and names the card', () => {
  assert.match(errors(pageHtml({ path: '/insights/a/', ogImage: CARD, extraNodes: [node()] })), /image must be the page's og:image https:\/\/worldenterprise\.org\/_astro\/og-default\.abc12345\.avif, found undefined/);
});

test('an Article with a different image fails', () => {
  assert.match(errors(pageHtml({ path: '/insights/a/', ogImage: CARD, extraNodes: [node('https://worldenterprise.org/other.avif')] })), /image must be the page's og:image/);
});

test('a page with no social card (a placeholder slot) is not held to an image', () => {
  assert.equal(errors(pageHtml({ path: '/insights/a/', extraNodes: [node()] })), '');
});

test('a hashed build asset as the organisation logo fails, a stable file passes', () => {
  const hashed = organizationNode('https://worldenterprise.org/_astro/we-logo-wordmark.CSQDO1LA.svg');
  const html = pageHtml({ path: '/program/' }).replace(JSON.stringify(organizationNode('https://worldenterprise.org/logo.svg').logo), JSON.stringify(hashed.logo));
  assert.match(validatePage({ path: '/program/', html }).join('\n'), /organisation logo must be a stable URL/);
  assert.deepEqual(validatePage({ path: '/program/', html: pageHtml({ path: '/program/' }) }), []);
});
