import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { INTRODUCTIONS_DISCLAIMER } from '../../../src/components/blocks/introductions.ts';
import * as copy from '../../../src/components/investors/copy.ts';
import { INVESTOR_FAQ } from '../../../src/components/investors/faq.ts';
import { faqPageNode } from '../../../src/components/reference/jsonld.ts';
import { claimRegistry } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { routes } from '../../../src/data/routes.ts';
import { MDX_PAGES, parseMdx, surfaces } from './sentences.ts';

/**
 * The structure and the truth policy of the investor journey. The pages are built in CI; here the source files are read, so a rule that is
 * only visible in a build is pinned at the markup that produces it.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

const PAGE_FILES: readonly { readonly file: string; readonly route: string }[] = [
  { file: 'src/pages/investors/index.astro', route: '/investors/' },
  { file: 'src/pages/investors/meet-startups/index.astro', route: '/investors/meet-startups/' },
  { file: 'src/pages/investors/what-you-can-see/index.astro', route: '/investors/what-you-can-see/' },
  { file: 'src/pages/investors/readiness-criteria/index.astro', route: '/investors/readiness-criteria/' },
  { file: 'src/pages/investors/showcase-format/index.astro', route: '/investors/showcase-format/' },
  { file: 'src/pages/investors/faq/index.astro', route: '/investors/faq/' },
  { file: 'src/pages/investors/interest/index.astro', route: '/investors/interest/' },
  { file: 'src/pages/investors/interest/thanks.astro', route: '/investors/interest/thanks/' },
];

test('every investor route is registered, and only the thank-you page is excluded from the index', () => {
  const rows = routes.filter((r) => r.path.startsWith('/investors/'));
  assert.deepEqual(rows.map((r) => r.path).sort(), PAGE_FILES.map((p) => p.route).sort());
  for (const row of rows) {
    // The hub row predates wave 8 (WP-11); WP-64 owns the page file through the write set, and the other seven rows are WP-64's.
    assert.equal(row.owner, row.path === '/investors/' ? 'WP-11' : 'WP-64', row.path);
    assert.equal(row.indexable === false, row.path === '/investors/interest/thanks/', `${row.path} indexable`);
  }
});

test('every page file exists, uses the layout the route registry names, and carries no h1 of its own', () => {
  for (const { file, route } of PAGE_FILES) {
    const text = read(file);
    const layout = routes.find((r) => r.path === route)?.layout;
    assert.ok(layout !== undefined && text.includes(`<${layout}`), `${file} renders ${layout}`);
    assert.doesNotMatch(text, /<h1\b/, `${file}: the layout owns the h1`);
    assert.match(text, new RegExp(`path="${route.replace(/\//g, '\\/')}"`), `${file} declares its path`);
  }
});

test('a page leaves the closing call to action to the map: no CtaBand, no after slot', () => {
  for (const { file } of PAGE_FILES) {
    const text = read(file);
    assert.doesNotMatch(text, /<CtaBand\b/, file);
    assert.doesNotMatch(text, /slot="after"/, file);
    assert.doesNotMatch(text, /slot="cta-end"/, file);
  }
});

test('every page keeps the no-funding sentence, and a page that names the add-on shows the verbatim disclaimer', () => {
  for (const { file, route } of PAGE_FILES) {
    const mdx = MDX_PAGES.find((p) => p.route === route);
    const text = read(file) + (mdx === undefined ? '' : read(mdx.path));
    // The form page carries the sentence in the form itself (InvestorInterestForm renders FORM_NOTICES.noFunding).
    assert.ok(/<NoFundingDisclaimer\s*\/>/.test(text), `${file} renders the no-funding disclaimer`);
    const names = /\binvestor\s+introductions?\b/i.test(text);
    if (names) assert.match(text, /<(?:IntroductionsDisclaimer|InvestorIntroductionsOffer)\b/, `${file} names the add-on without its disclaimer`);
  }
  assert.equal(copy.FUNDING_SENTENCE, 'WE makes no promise of funding.');
});

test('the hub keeps the not-an-offer callout, the offer block, the limits and the consent-gated showcase', () => {
  const hub = read('src/pages/investors/index.astro');
  assert.match(hub, /<Callout tone="notice" title=\{HUB\.notOfferTitle\}>/);
  assert.equal(copy.HUB.notOfferTitle, 'Not an offer of securities');
  assert.match(hub, /<InvestorIntroductionsOffer variant="full" headingLevel=\{2\} idPrefix="intro-offer" \/>/);
  assert.match(hub, /<LimitsBlock\b/);
  assert.match(hub, /<PortfolioShowcase\b/);
  assert.ok(copy.HUB.limits.includes('WE does not negotiate terms, advise on securities or handle funds.'));
});

test('the add-on offer block is used once per page, with an id prefix no other page uses', () => {
  const prefixes = PAGE_FILES.flatMap(({ file }) => [...read(file).matchAll(/<InvestorIntroductionsOffer\b[^>]*\bidPrefix="([^"]+)"/g)].map((m) => m[1] ?? ''));
  assert.deepEqual(prefixes.sort(), ['intro-offer', 'meet-intro']);
  for (const { file } of PAGE_FILES) assert.ok((read(file).match(/<InvestorIntroductionsOffer\b/g) ?? []).length <= 1, file);
});

test('a link in a content file goes through MaybeLink, and no content file writes a raw internal link', () => {
  for (const { path } of MDX_PAGES) {
    const text = read(path);
    assert.doesNotMatch(text, /\]\(\//, `${path}: a raw markdown link`);
    assert.doesNotMatch(text, /href="\//, `${path}: a raw href`);
    assert.doesNotMatch(text, /<a\b/, `${path}: an anchor`);
  }
});

test('the investor FAQ has eight to ten questions, one add-on answer with the verbatim disclaimer, and builds its own FAQPage node', () => {
  assert.ok(INVESTOR_FAQ.length >= 8 && INVESTOR_FAQ.length <= 10, `${INVESTOR_FAQ.length} questions`);
  assert.equal(new Set(INVESTOR_FAQ.map((f) => f.id)).size, INVESTOR_FAQ.length, 'unique ids');
  const naming = INVESTOR_FAQ.filter((f) => /investor introductions/i.test(f.answer));
  assert.equal(naming.length, 1);
  assert.ok(naming[0]?.answer.includes(INTRODUCTIONS_DISCLAIMER));
  assert.ok(read('src/components/investors/faq.ts').replace(/\s+/g, ' ').includes(INTRODUCTIONS_DISCLAIMER), 'the literal is in the file, as tests/unit/wp-18 requires');
  const node = faqPageNode('/investors/faq/', INVESTOR_FAQ) as { '@type': string; mainEntity: unknown[] };
  assert.equal(node['@type'], 'FAQPage');
  assert.equal(node.mainEntity.length, INVESTOR_FAQ.length);
  assert.match(read('src/pages/investors/faq/index.astro'), /faqPageNode\('\/investors\/faq\/', INVESTOR_FAQ\)/);
  for (const item of INVESTOR_FAQ) for (const id of item.claims) assert.equal(claimRegistry[id as ClaimId]?.enabled, true, `${item.id} cites ${id}`);
});

test('no page emits an Offer, and no structured data is added outside the layout and the FAQ node', () => {
  for (const { file } of PAGE_FILES) {
    const text = read(file);
    assert.doesNotMatch(text, /"@type"\s*:\s*"Offer"|'@type':\s*'Offer'|\bOffer\b.*jsonLd/, file);
    assert.doesNotMatch(text, /application\/ld\+json/, file);
  }
});

test('the showcase-format page names no company, no number with a currency or percent sign, and no example company', () => {
  const text = [
    ...Object.values(parseMdx('src/content/pages/investors/showcase-format/index.mdx').frontmatter),
    ...parseMdx('src/content/pages/investors/showcase-format/index.mdx').body,
    ...copy.FORMAT.fields.flat(),
    ...copy.FORMAT.rules,
    copy.FORMAT.never,
    ...copy.CONSENT_SCOPES.map((s) => s.text),
  ].join('\n');
  assert.doesNotMatch(text, /[$€£]\s?\d|\d\s?[$€£%]|\d+\s?%/);
  assert.doesNotMatch(text, /\bexample (?:company|startup|co)\b/i);
  assert.doesNotMatch(text, /\b(?:Inc|LLC|Ltd|Corp|GmbH|Labs)\b\.?/, 'no company-like name');
  assert.doesNotMatch(text, /\d/, 'no digit at all');
});

test('the investor copy states no amount, count, date, response time or fee wording, and none of the wave 8 bans', () => {
  const texts = surfaces()
    .filter((s) => !s.path.endsWith('statements.ts') && !s.path.endsWith('introductions.ts'))
    .flatMap((s) => s.strings);
  for (const text of texts) {
    assert.doesNotMatch(text, /\d/, `${text}: a digit`);
    assert.doesNotMatch(text, /[$€£%]/, `${text}: a currency sign or a percentage`);
    assert.doesNotMatch(text, /!/, `${text}: an exclamation mark`);
    assert.doesNotMatch(text, /\b(within|hours?|days?|weeks?|months?|minutes?|instantly|immediately|guarantee[sd]?|free of charge|no cost|for free|\bfree\b|perks|accelerator|cohort|mentors?|alumni|success fee|investor network|our investors|portfolio companies|our portfolio|our mentors)\b/i, text);
    assert.doesNotMatch(text, /no fee(?! or stake tied to any investment)|no equity|no stake/i, text);
    assert.doesNotMatch(text, /\bnow\b.{0,20}\b(?:accepting|open)\b/i, text);
    assert.doesNotMatch(text, /\b(?:colour|organis|favour|behaviour)/i, `${text}: US spelling`);
  }
});

test('the copy names no company, person, logo, testimonial or statistic', () => {
  const text = surfaces().flatMap((s) => s.strings).join('\n');
  assert.doesNotMatch(text, /testimonial|case stud|logo wall|\bclients?\b|\bbacked by\b|\bportfolio\b(?!\s+is published)/i);
});

test('the thank-you page promises no response time and no meeting, and the form pages offer no mailto', () => {
  const thanks = [read('src/pages/investors/interest/thanks.astro'), read('src/content/pages/investors/interest/thanks.mdx'), JSON.stringify(copy.THANKS)].join('\n');
  assert.doesNotMatch(thanks, /\b(?:within|hours?|days?|weeks?|soon|shortly|promptly|quickly)\b/i);
  assert.doesNotMatch(thanks, /WE will (?:reply|respond|contact|get back|be in touch|arrange|schedule)/i);
  assert.doesNotMatch(thanks, /mailto:/i);
  assert.match(thanks, /cannot promise a meeting or a reply/);
  for (const { file } of PAGE_FILES) assert.doesNotMatch(read(file), /mailto:/i, file);
});

test('the interest form asks nothing about accreditation, amounts, fund size or return targets', () => {
  const form = read('src/components/forms/InvestorInterestForm.astro');
  assert.doesNotMatch(form, /accredit|\bamount\b|fund size|\bAUM\b|return target|\bcheque\b|\bcheck size\b/i);
  assert.match(read('src/pages/investors/interest/index.astro'), /<InvestorInterestForm\s*\/>/);
});

test('every sentence the pages show passes the claims denylist on its own route', () => {
  for (const { file, route } of PAGE_FILES) {
    const mdx = MDX_PAGES.find((p) => p.route === route);
    const text = [read(file), mdx === undefined ? '' : read(mdx.path)].join('\n');
    const hits = audit.scan(text, { route, plain: false, flagValues: {} }).filter((h) => !/disclaimer/i.test(h.rule));
    assert.deepEqual(hits.map((h) => `${h.rule}: ${h.match}`), [], file);
  }
});

test('the denylist catches what the investor copy must never say (positive cases)', () => {
  for (const bad of ['WE charges a success fee.', 'Join our investor network.', 'Meet our portfolio companies.', 'No fee, no equity.', 'WE guarantees a meeting.']) {
    assert.ok(audit.scan(bad, { route: '/investors/', plain: true, flagValues: {} }).length > 0, bad);
  }
});
