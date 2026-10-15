import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { INTRODUCTIONS_DISCLAIMER } from '../../../src/components/blocks/introductions.ts';
import { makeDist } from '../shared/fixture-dist.ts';

// Wave 7 (WP-40): claims-denylist.json version 3. Every new rule has positive cases (the wording is caught) and negative cases (the
// legitimate neighbour is not), and the verbatim Investor Introductions disclaimer is a mandatory negative case for every rule.

interface Hit {
  rule: string;
  match: string;
}
interface RequiredRule {
  id: string;
  text: string;
  routes: string | string[];
  ifBuilt?: boolean;
}
interface Denylist {
  version: number;
  rules: { id: string }[];
  contextRules: { id: string }[];
  required: RequiredRule[];
  manifestRules: { id: string }[];
}
interface RuleSet {
  scanRules: unknown[];
  required: RequiredRule[];
  manifestRules: unknown[];
}
interface Finding {
  where: string;
  rule: string;
  message: string;
}
const api = claimsAudit as unknown as {
  loadDenylist(): RuleSet;
  parseDenylist(document: Denylist): RuleSet;
  scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[];
  textRouteOf(path: string): string;
  plainText(text: string): string;
  checkRequired(pages: { route: string; html: string; isHtml: boolean; plain?: boolean }[], rules: RequiredRule[], options?: { generatedImages?: boolean }): { rule: string; route: string }[];
  auditDist(dist: string, options: { set: RuleSet; manifest: { slots: [] } }): { files: number; findings: Finding[] };
};

const document = JSON.parse(readFileSync(new URL('../../../claims-denylist.json', import.meta.url), 'utf8')) as Denylist;
const html = (text: string): Hit[] => api.scan(`<main><p>${text}</p></main>`, { route: '/x/', flagValues: {} });
const plain = (text: string): Hit[] => api.scan(text, { route: '/x/', plain: true, flagValues: {} });
const caught = (hits: Hit[], rule: string): boolean => hits.some((h) => h.rule === rule);

const WAVE7_RULES = ['W7-C09-no-fee', 'W7-C09-no-equity', 'W7-C09-free-of-charge', 'W7-response-time', 'W7-application-counts', 'W7-package-seat-count'];

test('the denylist is version 3 and every rule id is unique', () => {
  assert.equal(document.version, 3);
  const ids = [...document.rules, ...document.contextRules, ...document.required, ...document.manifestRules].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.doesNotThrow(() => api.loadDenylist());
});

test('the wave 7 rules are context rules: built output only, never applied to source files', () => {
  const contextIds = document.contextRules.map((r) => r.id);
  for (const id of WAVE7_RULES) assert.ok(contextIds.includes(id), id);
  assert.deepEqual(document.rules.map((r) => r.id).filter((id) => id.startsWith('W7-')), []);
});

const CASES: readonly (readonly [string, readonly string[], readonly string[]])[] = [
  [
    'W7-C09-no-fee',
    ['There is no fee to apply.', 'No upfront fees, ever.', 'A fee-free first call.', 'No hidden fees.'],
    ['WE takes no fee or stake tied to any investment.', 'The fee does not depend on whether any investment closes.', 'No feedback loop is perfect.', 'Fees are shared when you ask for the current rate.'],
  ],
  [
    'W7-C09-no-equity',
    ['We take no equity.', 'An equity-free model.', 'It is non-dilutive.', 'WE asks for no stake in your company.', 'Zero equity required.'],
    ['WE takes no fee or stake tied to any investment.', 'A founder keeps equity in their own company.', 'Equity is discussed in the fundability guide.'],
  ],
  [
    'W7-C09-free-of-charge',
    ['The first call is free of charge.', 'Available at no cost.', 'The first call is no-cost to you.', 'Available at no charge.', 'It costs nothing to apply.', 'Completely free.'],
    ['Praise costs nothing. It has no cost figures.', 'Free-form notes are welcome.', 'A free-standing page.'],
  ],
  [
    'W7-response-time',
    ['We reply within 24 hours.', 'Expect an answer within two business days.', 'You will hear back within 3 days.', 'Within one working day, we confirm the plan.', 'A 24-hour response.', 'Same-day reply.'],
    ['Choose a response expectation you can meet, such as “within one working day”.', 'Finish the sketch within one session.', 'Within 30 days of the report, the founder reviews it.'],
  ],
  [
    'W7-application-counts',
    ['Our acceptance rate is low.', 'We reviewed 1,200 applications.', 'We received over 300 applications.', '12% of applicants are accepted.'],
    ['Each application is read by a person.', 'The application asks four questions.', 'A clear no is as useful as a yes.'],
  ],
  [
    'W7-package-seat-count',
    ['Launch includes 3 seats.', 'Studio has five dedicated seats.', 'Two seats in Spark.', 'Accelerate: 4 team seats.'],
    ['Studio is an embedded team. Seats are the unit of work.', 'Seats are set per package when you ask for the rate.', 'Spark is sized for a first product.', 'This page lists no seat counts.'],
  ],
];

for (const [rule, positives, negatives] of CASES) {
  test(`${rule} catches its wording in a page and in a text file`, () => {
    for (const text of positives) {
      assert.equal(caught(html(text), rule), true, `html: ${text}`);
      assert.equal(caught(plain(text), rule), true, `plain: ${text}`);
    }
  });
  test(`${rule} leaves its legitimate neighbours alone`, () => {
    for (const text of negatives) {
      assert.equal(caught(html(text), rule), false, `html: ${text}`);
      assert.equal(caught(plain(text), rule), false, `plain: ${text}`);
    }
  });
}

test('the verbatim Investor Introductions disclaimer passes every rule, in a page and in a text file', () => {
  assert.deepEqual(html(INTRODUCTIONS_DISCLAIMER), []);
  assert.deepEqual(plain(INTRODUCTIONS_DISCLAIMER), []);
  assert.deepEqual(plain(`## What WE does not do\n\n${INTRODUCTIONS_DISCLAIMER}\n`), []);
});

test('the disclaimer a required rule demands is the one the site renders, word for word', () => {
  const required = document.required.filter((r) => /disclaimer/.test(r.id) && r.id.includes('C14'));
  assert.ok(required.length >= 3);
  for (const rule of required) assert.equal(rule.text, INTRODUCTIONS_DISCLAIMER, rule.id);
});

test('a data-claim-allow marker exempts a page element but never a text file', () => {
  assert.equal(caught(html('<span data-claim-allow="W7-C09-no-fee">no fee</span>'), 'W7-C09-no-fee'), false);
  assert.equal(caught(html('<span data-claim-allow="*">no fee</span>'), 'W7-C09-no-fee'), false);
  assert.equal(caught(plain('<span data-claim-allow="*">no fee</span>'), 'W7-C09-no-fee'), true);
});

test('plain-text scanning drops link addresses, so a slug is not copy', () => {
  assert.equal(api.plainText('[Read more](https://worldenterprise.org/no-fee-free-of-charge/ "Title") and <https://worldenterprise.org/no-fee/>'), '[Read more] and ');
  assert.equal(caught(plain('[Pricing](https://worldenterprise.org/no-equity/) explains seats.'), 'W7-C09-no-equity'), false);
  assert.equal(caught(plain('See https://worldenterprise.org/free-of-charge/ for details.'), 'W7-C09-free-of-charge'), false);
});

test('a Markdown twin stands for its page, and a text file for itself', () => {
  assert.equal(api.textRouteOf('insights/x.md'), '/insights/x/');
  assert.equal(api.textRouteOf('index.md'), '/');
  assert.equal(api.textRouteOf('faq.md'), '/faq/');
  assert.equal(api.textRouteOf('llms.txt'), '/llms.txt');
  assert.equal(api.textRouteOf('robots.txt'), '/robots.txt');
});

// A set with the real scan rules and only the wave 7 required rules, so a small fixture dist is not asked for the pages of the whole site.
const set = api.parseDenylist({ ...document, required: document.required.filter((r) => r.id.startsWith('R-W7')) });
const manifest = { slots: [] as [] };
const NO_FUNDING = 'WE makes no promise of funding.';
const LLMS = `# World Enterprise\n\n> A business incubation and consulting firm.\n\n## What WE does not do\n\n${NO_FUNDING}\n\n${INTRODUCTIONS_DISCLAIMER}\n\n- [Pricing](https://worldenterprise.org/pricing.md)\n`;
const home = '<!doctype html><html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1><p>A page.</p></main></body></html>';

function audit(files: Record<string, string>): Finding[] {
  const root = makeDist({ 'dist/index.html': home, ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`dist/${k}`, v])) });
  return api.auditDist(`${root}/dist`, { set, manifest }).findings;
}

test('the claims audit scans llms.txt, llms-full.txt and the Markdown twins', () => {
  assert.deepEqual(audit({ 'llms.txt': LLMS, 'llms-full.txt': LLMS, 'faq/index.html': home, 'faq.md': '# FAQ\n\nA plain answer.\n' }), []);
  const dirty = audit({ 'llms.txt': `${LLMS}\nApplying is free of charge.\n`, 'insights/x/index.html': home, 'insights/x.md': '# X\n\nWe take no equity.\n' });
  assert.deepEqual(dirty.map((f) => f.rule).sort(), ['W10-free-offer', 'W7-C09-free-of-charge', 'W7-C09-no-equity']);
  assert.match(dirty.map((f) => f.where).join('\n'), /llms\.txt/);
  assert.match(dirty.map((f) => f.where).join('\n'), /x\.md/);
});

test('C-13-peers allows the FAQ sentence in llms.txt and llms-full.txt, and still flags it on an ordinary page', () => {
  const sentence = 'This site does not describe a cohort calendar or a demo day.';
  for (const route of ['/llms.txt', '/llms-full.txt']) {
    assert.equal(caught(api.scan(sentence, { route, plain: true, flagValues: {} }), 'C-13-peers'), false, `${route} may carry the sentence`);
  }
  assert.equal(caught(api.scan(sentence, { route: '/pricing/', plain: true, flagValues: {} }), 'C-13-peers'), true, 'an ordinary page is still flagged');
  assert.equal(caught(api.scan(sentence, { route: '/llms.txt.bak', plain: true, flagValues: {} }), 'C-13-peers'), true, 'the allowance is anchored to the two files');
});

test('a Markdown twin is held to the same denylist as its page, including a seat count', () => {
  const findings = audit({ 'pricing/index.html': home, 'pricing.md': '# Pricing\n\nLaunch includes 3 seats.\n' });
  assert.deepEqual(findings.map((f) => f.rule), ['W7-package-seat-count']);
});

test('required rules for the wave 7 pages are skipped until the page is built, then enforced', () => {
  assert.deepEqual(audit({}), [], 'nothing built, nothing required');
  const lacking = audit({ 'llms.txt': '# World Enterprise\n', 'program/how-we-decide/index.html': home });
  assert.deepEqual(lacking.map((f) => `${f.rule} ${f.where}`).sort(), [
    'R-W7-C05-no-funding-disclaimer /llms.txt',
    'R-W7-C05-no-funding-disclaimer /program/how-we-decide/',
    'R-W7-C14-intro-disclaimer /llms.txt',
  ]);
  const complete = audit({ 'llms.txt': LLMS, 'llms-full.txt': LLMS, 'program/how-we-decide/index.html': home.replace('A page.', NO_FUNDING) });
  assert.deepEqual(complete, []);
});

test('a built route that is not listed is not required, and a twin never stands in for its page', () => {
  const pages = [
    { route: '/program/how-we-decide/', html: '<main><p>Decisions.</p></main>', isHtml: true },
    { route: '/program/how-we-decide/', html: NO_FUNDING, isHtml: false, plain: true },
  ];
  const rule = set.required.filter((r) => r.id === 'R-W7-C05-no-funding-disclaimer');
  assert.deepEqual(api.checkRequired(pages, rule).map((f) => f.route), ['/program/how-we-decide/']);
});

test('ifBuilt is only valid on a list of routes', () => {
  const bad = { ...document, required: [{ id: 'R-bad', claim: 'C-05', text: 'x', routes: '*', ifBuilt: true }] };
  assert.throws(() => api.parseDenylist(bad as unknown as Denylist), /ifBuilt applies to a list of routes/);
  const worse = { ...document, required: [{ id: 'R-bad', claim: 'C-05', text: 'x', routes: ['/a/'], ifBuilt: 'yes' }] };
  assert.throws(() => api.parseDenylist(worse as unknown as Denylist), /ifBuilt must be a boolean/);
});
