import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { CATEGORIES, CATEGORY_IDS, FAQ_ITEMS, HREFS } from '../../../src/components/partners/copy.ts';
import { PARTNER_CATEGORIES, FORM_ROUTES } from '../../../src/data/forms.ts';
import { isClaimUsable } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { routes } from '../../../src/data/routes.ts';
import { site } from '../../../src/data/site.ts';
import { INTRODUCTIONS_DISCLAIMER } from '../../../src/components/blocks/introductions.ts';
import { schemas } from '../../../src/lib/content-schemas.ts';
import { PARTNER_MDX, PARTNER_ROUTES, contentFile, read, root } from './surfaces.ts';

/** The shape of the partner journey: six routes with their files, valid frontmatter, the network rewrite and the form wiring. */

const NETWORK_ASTRO = 'src/pages/network/index.astro';
const NETWORK_MDX = 'src/content/pages/network/index.mdx';

test('the six partner routes are WP-65 routes in the ledger, launched, with the layouts the plan names', () => {
  const owned = routes.filter((r) => r.owner === 'WP-65');
  assert.deepEqual(owned.map((r) => r.path).sort(), PARTNER_ROUTES.map((r) => r.path).sort());
  for (const expected of PARTNER_ROUTES) {
    const row = owned.find((r) => r.path === expected.path);
    assert.ok(row, expected.path);
    assert.equal(row.layout, expected.layout, expected.path);
    assert.notEqual(row.launch, false, `${expected.path} is launched`);
    assert.equal(row.indexable, expected.path !== '/network/partners/enquire/thanks/', `${expected.path} indexable`);
  }
});

test('each route has its page file and its content file, and no route file is added beyond the six', () => {
  for (const route of PARTNER_ROUTES) {
    assert.ok(existsSync(join(root, route.page)), route.page);
    assert.ok(existsSync(join(root, route.content)), route.content);
  }
  assert.deepEqual(Object.values(HREFS).sort(), PARTNER_ROUTES.map((r) => r.path).sort());
});

test('each page uses the layout its row names and no raw h1', () => {
  for (const route of PARTNER_ROUTES) {
    const text = read(route.page);
    assert.match(text, new RegExp(`import ${route.layout} from`), `${route.page} uses ${route.layout}`);
    assert.doesNotMatch(text, /<h1[\s>]/, `${route.page} renders a raw h1`);
    assert.match(text, /ogSlot="og-network"/, `${route.page} has a social card`);
  }
});

test('frontmatter parses under the pages schema; titles fit 60 characters with the suffix; descriptions are 50 to 160 and unique', () => {
  const descriptions = new Set<string>();
  for (const file of [...PARTNER_MDX, NETWORK_MDX]) {
    const parsed = schemas.pages.safeParse(parse(contentFile(file).frontmatter));
    assert.ok(parsed.success, `${file}: ${parsed.success ? '' : parsed.error.message}`);
    const { title, description } = parsed.data;
    assert.ok(`${title} | ${site.titleSuffix}`.length <= 60, `${file} title is too long`);
    assert.ok(description.length >= 50 && description.length <= 160, `${file} description is ${description.length}`);
    assert.ok(!descriptions.has(description), `${file} repeats a description`);
    descriptions.add(description);
  }
});

test('claims cited exist, are usable, and the partner pages cite C-26', () => {
  for (const file of [...PARTNER_MDX, NETWORK_MDX]) {
    const claims = (parse(contentFile(file).frontmatter) as { claimsUsed?: string[] }).claimsUsed ?? [];
    assert.ok(claims.length >= 1, `${file} cites a claim`);
    for (const id of claims) assert.ok(isClaimUsable(id as ClaimId), `${file} cites unusable ${id}`);
  }
  for (const file of PARTNER_MDX) {
    const claims = (parse(contentFile(file).frontmatter) as { claimsUsed: string[] }).claimsUsed;
    assert.ok(claims.includes('C-26'), `${file} cites C-26`);
  }
});

test('no raw internal links in the MDX bodies', () => {
  for (const file of [...PARTNER_MDX, NETWORK_MDX]) {
    const text = read(file);
    assert.doesNotMatch(text, /\]\(\//, `${file} has a raw internal link`);
    assert.doesNotMatch(text, /href="\//, `${file} has a raw internal href`);
  }
});

test('the six categories are the registry categories without "other", each described once', () => {
  assert.deepEqual([...CATEGORY_IDS], PARTNER_CATEGORIES.filter((c) => c !== 'other'));
  assert.equal(CATEGORIES.length, 6);
  for (const category of CATEGORIES) {
    assert.ok(category.summary.length > 0 && category.goodEnquiry.length >= 1 && category.doesNot.length >= 1, category.id);
  }
  assert.equal(new Set(CATEGORIES.map((c) => c.label)).size, 6);
});

test('the FAQ has six to eight answers, each a question with at least one sentence, and the page builds FAQPage with the shared builder', () => {
  assert.ok(FAQ_ITEMS.length >= 6 && FAQ_ITEMS.length <= 8, `${FAQ_ITEMS.length} answers`);
  assert.equal(new Set(FAQ_ITEMS.map((i) => i.id)).size, FAQ_ITEMS.length);
  for (const item of FAQ_ITEMS) {
    assert.match(item.question, /\?$/, item.id);
    assert.ok(item.answer.length >= 1, item.id);
  }
  const page = read('src/pages/network/partners/faq.astro');
  assert.match(page, /import \{[^}]*faqPageNode[^}]*\} from '\.\.\/\.\.\/\.\.\/components\/reference\/jsonld\.ts'/);
  assert.match(page, /jsonLd=\{\[faqPageNode\(/);
  // The page never writes its own FAQPage, and no Offer node is ever published for a partner page.
  for (const route of PARTNER_ROUTES) {
    assert.doesNotMatch(read(route.page), /"@type"\s*:|'@type'\s*:/, `${route.page} writes its own JSON-LD`);
    assert.doesNotMatch(read(route.page), /\bOffer\b/, `${route.page} publishes an Offer`);
  }
});

test('the enquiry page renders the partner form, the form route is registered, and the thanks route is noindex', () => {
  assert.match(read('src/pages/network/partners/enquire/index.astro'), /<PartnerEnquiryForm\s*\/>/);
  assert.equal(FORM_ROUTES['/network/partners/enquire/'], 'intake');
  const thanks = routes.find((r) => r.path === '/network/partners/enquire/thanks/');
  assert.equal(thanks?.indexable, false);
  // The partner enquiry has no mailbox: no partner page offers a mailto link.
  for (const route of PARTNER_ROUTES) assert.doesNotMatch(read(route.page), /mailto:/, route.page);
  assert.doesNotMatch(read('src/components/partners/copy.ts'), /mailto:/);
});

test('every link in the copy module is a live ledger route', () => {
  const live = new Set(routes.filter((r) => r.launch !== false).map((r) => r.path));
  const hrefs = [...read('src/components/partners/copy.ts').matchAll(/href: (?:HREFS\.\w+|'([^']+)')/g)].map((m) => m[1]).filter((h): h is string => h !== undefined);
  assert.ok(hrefs.length >= 1);
  for (const href of [...hrefs, ...Object.values(HREFS)]) assert.ok(live.has(href), `${href} is a launched route`);
});

test('the network page no longer denies a partner program, links the partner pages and keeps the verbatim disclaimer', () => {
  const mdx = read(NETWORK_MDX);
  assert.doesNotMatch(mdx, /no partner program/i);
  assert.doesNotMatch(mdx, /perks? scheme/i);
  const astro = read(NETWORK_ASTRO);
  assert.match(astro, /HREFS\.hub/, 'the network page links the partners hub');
  assert.match(astro, /<InvestorIntroductionsOffer\b/, 'the disclaimer is rendered through the offer component');
  assert.ok(INTRODUCTIONS_DISCLAIMER.length > 0);
  // The page's own CtaBand is gone: the layout's CtaEnd resolves the call to action from the CTA map.
  assert.doesNotMatch(astro, /<CtaBand/);
});

test('no sentence on a partner page denies the program', () => {
  const denial = /\b(?:no|not a|without a)\s+partner(?:ship)?s?\s+program\b|\bdoes not (?:have|run|offer)\s+a\s+partner/i;
  for (const file of [...PARTNER_MDX, NETWORK_MDX, 'src/components/partners/copy.ts', NETWORK_ASTRO, 'src/components/network/NetworkIntro.astro']) {
    assert.doesNotMatch(read(file), denial, file);
  }
  for (const old of ['There is no partner program.', 'WE has no partnership program.', 'WE does not have a partner program.']) assert.match(old, denial, old);
});
