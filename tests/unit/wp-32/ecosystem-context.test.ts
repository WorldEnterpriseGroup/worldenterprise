import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';

// Wave 10 (WP-32, D-W10-1): the claims denylist is scoped, not deleted. The peers, mentor, accelerator, alumni, investor-network and demo-day
// wording is allowed in the ecosystem context (the routes /ecosystem/**, /sbir-sttr/**, /data/**, and any element marked
// data-context="ecosystem") and banned everywhere else. The W10 rules and W8-C13-own-peers apply everywhere, the ecosystem context included.

interface Hit {
  rule: string;
  match: string;
}
const api = claimsAudit as unknown as {
  scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[];
  stripEcosystemContext(html: string): string;
  ECOSYSTEM_ROUTES: RegExp;
};
const page = (body: string, route: string): string[] => api.scan(`<main>${body}</main>`, { route, flagValues: {} }).map((h) => h.rule);
const plain = (text: string, route: string): string[] => api.scan(text, { route, plain: true, flagValues: {} }).map((h) => h.rule);

const OUTSIDE = '/services/digital-incubation/';
const ECOSYSTEM_ROUTES = ['/ecosystem/', '/ecosystem/accelerators/', '/sbir-sttr/', '/sbir-sttr/phase-i/', '/data/', '/data/startup-survival/'];
const ECOSYSTEM_SENTENCES = [
  'Many founders join an accelerator or a cohort-based program run by an independent organization.',
  'A mentor from a university program can help with the first customer interviews.',
  'Alumni of these programs often share introductions.',
  'Y Combinator, Techstars and 500 Global run programs with a demo day.',
  'Angel groups keep an investor network that founders can ask to join.',
  'A network of investors meets at the demo day of an outside program.',
  'SBDCs and SCORE offer mentorship to small businesses.',
];

test('the ecosystem routes are exactly /ecosystem/**, /sbir-sttr/** and /data/**', () => {
  for (const route of ECOSYSTEM_ROUTES) assert.ok(api.ECOSYSTEM_ROUTES.test(route), route);
  for (const route of ['/', '/ecosystems/', '/database/', '/data-room/', '/fundability/data-room/', '/insights/ecosystem/', '/sbir/', '/program/']) {
    assert.equal(api.ECOSYSTEM_ROUTES.test(route), false, route);
  }
});

test('allowed inside: the outside-ecosystem wording passes on the ecosystem routes', () => {
  for (const route of ECOSYSTEM_ROUTES) {
    for (const sentence of ECOSYSTEM_SENTENCES) assert.deepEqual(page(`<p>${sentence}</p>`, route), [], `${route}: ${sentence}`);
  }
});

test('allowed inside: a marked element passes on any page, and its text twin route logic stays route based', () => {
  for (const sentence of ECOSYSTEM_SENTENCES) {
    assert.deepEqual(page(`<section data-context="ecosystem"><h2>Beyond this site</h2><p>${sentence}</p></section>`, OUTSIDE), [], sentence);
    assert.deepEqual(page(`<section data-context='ecosystem'><div><p>${sentence}</p></div></section>`, '/insights/fundable/example/'), [], sentence);
  }
  assert.deepEqual(plain('A cohort-based accelerator with a demo day.', '/ecosystem/'), []);
});

test('banned outside: the same sentences are caught on an ordinary page', () => {
  // Two sentences were never banned outside: a bare demo day, a bare "mentorship", and a bare third-party investor network (only "our" or "the WE" network and a "network of investors" were).
  for (const sentence of ECOSYSTEM_SENTENCES.filter((s) => !s.includes('Y Combinator') && !s.includes('keep an investor network') && !s.includes('mentorship'))) assert.ok(page(`<p>${sentence}</p>`, OUTSIDE).length > 0, `ordinary page: ${sentence}`);
  assert.ok(page('<p>Many founders join an accelerator.</p>', '/ecosystems/').includes('C-13-peers'), 'a look-alike route is not the ecosystem');
  assert.ok(page('<p>Many founders join an accelerator.</p>', '/fundability/data-room/').includes('C-13-peers'));
  assert.ok(page('<p>A network of investors.</p>', OUTSIDE).includes('C-14-investor-network'));
  assert.ok(page('<p>The demo day results.</p>', OUTSIDE).includes('C-14-demo-day-outcomes'));
});

test('banned outside: text outside the marked element is still caught, and a different attribute value opens nothing', () => {
  assert.ok(page('<section data-context="ecosystem"><p>An accelerator.</p></section><p>Join the next cohort.</p>', OUTSIDE).includes('C-13-peers'));
  assert.ok(page('<section data-context="marketing"><p>An accelerator.</p></section>', OUTSIDE).includes('C-13-peers'));
  assert.ok(page('<section data-contexts="ecosystem"><p>An accelerator.</p></section>', OUTSIDE).includes('C-13-peers'));
  assert.ok(page('<section class="data-context=ecosystem"><p>An accelerator.</p></section>', OUTSIDE).includes('C-13-peers'), 'a class name is not the attribute');
  assert.ok(plain('Join the next cohort.', OUTSIDE).includes('C-13-peers'), 'a plain-text file has no marker');
  assert.ok(plain('Join the next cohort.', '/llms.txt.bak').includes('C-13-peers'));
});

test('always banned: WE as an accelerator, investor, fund, investor network or employer of record, on every route and inside a marked element', () => {
  const claims = [
    'WE is an accelerator for software founders.',
    'WE is also a venture fund.',
    'World Enterprise is an investor in its companies.',
    'WE operates as an employer of record for your team.',
    'WE acts as the investment adviser.',
    'Join our investor network.',
    "WE's investor network opens doors.",
    'The WE investor network is large.',
  ];
  for (const route of [OUTSIDE, ...ECOSYSTEM_ROUTES]) {
    for (const claim of claims) {
      assert.ok(page(`<p>${claim}</p>`, route).length > 0, `${route}: ${claim}`);
      assert.ok(page(`<div data-context="ecosystem"><p>${claim}</p></div>`, route).length > 0, `marked, ${route}: ${claim}`);
    }
  }
  assert.ok(page('<p>WE is an accelerator.</p>', '/ecosystem/').includes('W10-we-is-accelerator-or-investor'));
  assert.ok(page('<p>Join our investor network.</p>', '/ecosystem/').includes('W10-own-investor-network'));
});

test('always banned: WE running a cohort, a batch or a demo day, and implied affiliation with a named program', () => {
  const claims = [
    'WE runs a cohort twice a year.',
    'WE hosts a demo day in spring.',
    'Our demo day is open to investors.',
    'WE offers a batch for early teams.',
    'WE runs our first cohort this fall.',
    'WE is partnered with Techstars.',
    'In partnership with Y Combinator, WE supports founders.',
    'Endorsed by 500 Global.',
    'WE is affiliated with SCORE.',
  ];
  for (const route of ['/ecosystem/', '/sbir-sttr/', '/data/']) {
    for (const claim of claims) assert.ok(page(`<p>${claim}</p>`, route).length > 0, `${route}: ${claim}`);
  }
  assert.ok(page('<div data-context="ecosystem"><p>WE runs a cohort.</p></div>', OUTSIDE).includes('W8-C13-own-peers'));
  assert.ok(page('<p>WE hosts a demo day.</p>', '/ecosystem/').includes('W10-own-demo-day'));
  assert.ok(page('<p>WE is partnered with Techstars.</p>', '/ecosystem/').includes('W10-named-program-endorsement'));
});

test('always banned: a price WE would charge and the word free as an offer', () => {
  for (const route of [OUTSIDE, '/ecosystem/', '/sbir-sttr/', '/data/']) {
    for (const claim of ['The review costs $500 per month.', 'Starting at $2,000 a month.', 'Seats at $49/month.', 'WE offers the first review for free.', 'Our first call is free.', 'The audit is free of charge.']) {
      assert.ok(page(`<p>${claim}</p>`, route).length > 0, `${route}: ${claim}`);
    }
  }
});

test('the legitimate ecosystem sentences stay clean: denials, questions, award sizes and independent-program wording', () => {
  const clean = [
    'WE is not an accelerator, an investor or a fund.',
    'WE has no investor network and runs no cohort or demo day.',
    'Is WE an accelerator? No.',
    'A Phase I award can be several hundred thousand dollars, for example $314,363.',
    'These are independent programs WE encourages founders to consider; no affiliation implied.',
    'WE is not affiliated with Techstars or Y Combinator.',
    'Founders can join them, and WE works alongside, for the long run.',
    'Angel groups are investor-led and WE is investor-ready only in the sense of fundability.',
  ];
  for (const route of ECOSYSTEM_ROUTES) {
    for (const sentence of clean) assert.deepEqual(page(`<p>${sentence}</p>`, route), [], `${route}: ${sentence}`);
  }
});

test('stripEcosystemContext removes the marked element with its content and leaves the rest', () => {
  const out = api.stripEcosystemContext('<p>keep</p><div data-context="ecosystem"><div>an accelerator</div></div><p>keep too</p>');
  assert.match(out, /keep/);
  assert.match(out, /keep too/);
  assert.doesNotMatch(out, /accelerator/);
  assert.equal(api.stripEcosystemContext('<p>no marker</p>'), '<p>no marker</p>');
});
