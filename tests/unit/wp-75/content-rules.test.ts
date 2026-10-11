import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { compareFamily, comparisons, loadComparePages, visibleTexts } from './pages.ts';

/**
 * The wording rules of the comparison pages (brief, docs/wave8-contracts.md sections 0, 0.1 and 8.3): the claims denylist over every
 * string a reader sees, the blocked word confined to its one page, no company named, no number, no amount, no recommendation.
 */
interface Hit {
  readonly rule?: string;
  readonly id?: string;
  readonly match?: string;
  readonly [key: string]: unknown;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const BLOCKED_PAGE = 'incubator-vs-other-programs';

test('the claims denylist finds nothing in any string of any comparison page', () => {
  for (const page of loadComparePages()) {
    for (const text of visibleTexts(page)) assert.deepEqual(audit.scan(text, { route: page.route, plain: true, flagValues: {} }), [], `${page.route}: ${text}`);
  }
});

test('the whole page text, joined, also passes the denylist (a rule that spans two sentences)', () => {
  for (const page of loadComparePages()) {
    const text = visibleTexts(page).join(' ');
    assert.deepEqual(audit.scan(text, { route: page.route, plain: true, flagValues: {} }), [], page.route);
  }
});

test('the blocked word appears on the incubator-vs-other-programs page only, and nowhere in its title, description or eyebrow', () => {
  for (const page of loadComparePages()) {
    const everything = JSON.stringify({ data: page.raw, body: page.body });
    if (page.slug !== BLOCKED_PAGE) {
      assert.doesNotMatch(everything, /accelerat/i, `${page.path} carries the blocked word`);
      continue;
    }
    const head = [page.data.title, page.data.seoTitle ?? '', page.data.description, page.data.eyebrow ?? ''].join(' ');
    assert.doesNotMatch(head, /accelerat/i, 'the blocked word is not in the title, description or eyebrow of its own page');
  }
});

test('the blocked word never sits in a sentence about WE', () => {
  for (const page of loadComparePages()) {
    for (const text of visibleTexts(page)) {
      for (const sentence of text.split(/(?<=[.?!])\s+/)) {
        if (/\bWE\b/.test(sentence)) assert.doesNotMatch(sentence, /accelerat/i, `${page.path}: ${sentence}`);
      }
    }
  }
});

/** Named companies and programs the comparison pages must never mention. The list is a floor: the manual no-named-company review is the gate. */
const NAMED = [
  'Y Combinator', 'Techstars', '500 Startups', 'Plug and Play', 'Antler', 'Entrepreneur First', 'Founders Factory', 'Idealab', 'Betaworks',
  'Upwork', 'Fiverr', 'Toptal', 'Freelancer.com', 'Accenture', 'Deloitte', 'McKinsey', 'Thoughtworks', 'EPAM', 'Infosys', 'Wipro', 'Tata',
  'Microsoft', 'Google', 'Amazon', 'AWS', 'Salesforce', 'Shopify', 'Stripe', 'Slack', 'Atlassian', 'Zoom', 'Notion', 'HubSpot', 'Oracle', 'SAP',
  'Sequoia', 'Andreessen', 'Accel', 'Benchmark', 'Kleiner', 'Lightspeed', 'Index Ventures', 'Tiger Global',
];

test('no named company, program, investor or vendor appears in a string a reader sees', () => {
  for (const page of loadComparePages()) {
    const text = visibleTexts(page).join(' ');
    for (const name of NAMED) assert.ok(!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text), `${page.path} names ${name}`);
  }
});

test('the only numbers on a page are two dated references; no amount, count, rate, duration or response time', () => {
  for (const page of loadComparePages()) {
    const text = visibleTexts(page).join(' ').replace(/Securities Act of 1933/g, '').replace(/\b2005 report\b/g, '').replace(/Section 201\b/g, '');
    assert.doesNotMatch(text, /\d/, `${page.path} has a digit: ${text.match(/.{0,30}\d.{0,30}/)?.[0]}`);
    assert.doesNotMatch(text, /[$€£%]/, page.path);
    assert.doesNotMatch(text, /\b(?:two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million)\b(?!\s+(?:categor|side))/i, `${page.path} spells out a number`);
  }
});

test('words the brief bans never appear: free, no equity, no fee, success fee, perks, cohort, mentor, a 30-60-90 plan, superlatives', () => {
  const banned: [string, RegExp][] = [
    ['free', /\bfree\b/i],
    ['no equity', /\bno[- ]equity\b|\bnon-dilutive\b|\btakes no stake\b/i],
    ['no fee', /\bno[- ]fee\b|\bfee[- ]free\b/i],
    ['success fee', /success[- ]fee/i],
    ['perks', /\bperks?\b/i],
    ['cohort', /\bcohorts?\b/i],
    ['mentor', /\bmentor/i],
    ['30/60/90', /\b30\b|\b60\b|\b90\b/],
    ['superlative', /\b(?:best|leading|top|greatest|finest|unmatched|unrivaled|world-class|#1|number one)\b/i],
    ['guarantee', /\bguarantee/i],
    ['recommendation', /\byou should\b|\bwe recommend\b|\bis better than\b|\bis the better\b|\bchoose\b/i],
    ['UK spelling', /\b(?:programme|organisation|colour|licence|labour|centre)\b/i],
  ];
  for (const page of loadComparePages()) {
    const text = visibleTexts(page).join(' ');
    for (const [name, pattern] of banned) assert.doesNotMatch(text, pattern, `${page.path} has a banned word (${name})`);
  }
});

test('no sentence describes the WE fee or equity model, in either direction, and the investor-introductions add-on is not named', () => {
  for (const page of loadComparePages()) {
    for (const text of visibleTexts(page)) {
      for (const sentence of text.split(/(?<=[.?!])\s+/)) {
        if (!/\bWE\b/.test(sentence)) continue;
        assert.doesNotMatch(sentence, /\b(?:fee|fees|equity|stake|price|pricing|charge|charges|pay|paid|cost|costs|invoice)\b/i, `${page.path}: ${sentence}`);
      }
    }
    assert.doesNotMatch(visibleTexts(page).join(' '), /investor introduction|introductions? to investors/i, page.path);
  }
});

test('the SAFE-mechanics terms are omitted, since the comparison template has no generic-definition wrapper', () => {
  for (const page of loadComparePages()) {
    assert.doesNotMatch(JSON.stringify({ raw: page.raw, body: page.body }), /\bSAFE\b|simple agreement|convertible note|valuation cap|pro rata|pro-rata/i, page.path);
    assert.doesNotMatch(page.body, /data-generic-definition|data-claim-allow/, page.path);
  }
});

test('the other category is never described as worse, and no side is recommended: no second-person advice in a cell about the other side', () => {
  for (const page of comparisons()) {
    const family = compareFamily(page);
    const cells = family.sides.flatMap((side) => [side.whatItIs, side.whoItFits, side.asksOfFounder]).concat(family.whereEachFits);
    for (const cell of cells) assert.doesNotMatch(cell, /\b(?:worse|inferior|avoid|only option|bad|poor|risky|dangerous|cheap|cheaper|expensive)\b/i, `${page.path}: ${cell}`);
  }
});

test('the body states no link and no component, so a page renders the same without JavaScript', () => {
  for (const page of loadComparePages()) {
    assert.doesNotMatch(page.body, /<[A-Za-z]/, `${page.path} has markup in the body`);
    assert.doesNotMatch(page.body, /\]\(/, `${page.path} has a Markdown link in the body`);
  }
});

test('every page says what it compares through the family sides and the body has the two WE sections in order', () => {
  for (const page of comparisons()) {
    const headings = [...page.body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]);
    assert.deepEqual(headings, ['Where WE sits', 'WE is probably not the right fit if'], page.path);
  }
});

test('the scan has teeth: planted wording is found, and the blocked word is allowed on its own route only', () => {
  const options = { plain: true, flagValues: {} };
  assert.notDeepEqual(audit.scan('WE is free of charge for founders.', { route: '/compare/build-vs-buy/', ...options }), []);
  assert.notDeepEqual(audit.scan('A founder joins a cohort with a mentor.', { route: '/compare/build-vs-buy/', ...options }), []);
  assert.notDeepEqual(audit.scan('Accelerators run fixed-term programs.', { route: '/compare/build-vs-buy/', ...options }), []);
  assert.deepEqual(audit.scan('Accelerators run fixed-term programs.', { route: '/compare/incubator-vs-other-programs/', ...options }), []);
});
