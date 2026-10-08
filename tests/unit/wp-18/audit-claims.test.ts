import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as auditMod from '../../../scripts/audit-claims.mjs';
import { makeDist } from '../shared/fixture-dist.ts';

interface CompiledRule {
  readonly id: string;
  readonly claim: string;
  readonly pattern: string;
}
interface RequiredRule {
  readonly id: string;
  readonly claim: string;
  readonly text: string;
  readonly routes: '*' | readonly string[];
  readonly when?: string;
}
interface RuleSet {
  readonly rules: readonly CompiledRule[];
  readonly contextRules: readonly CompiledRule[];
  readonly scanRules: readonly CompiledRule[];
  readonly required: readonly RequiredRule[];
  readonly manifestRules: readonly CompiledRule[];
}
interface Hit {
  readonly rule: string;
  readonly claim: string;
  readonly match: string;
}
interface Page {
  readonly route: string;
  readonly html: string;
  readonly isHtml?: boolean;
}
interface Finding {
  readonly rule: string;
  readonly where?: string;
  readonly route?: string;
  readonly slot?: string;
  readonly message: string;
}
interface Slot {
  readonly id: string;
  readonly source?: string;
  readonly alt?: string;
}
interface Manifest {
  readonly slots: readonly Slot[];
}
const audit = auditMod as unknown as {
  parseDenylist(document: unknown): RuleSet;
  loadDenylist(source?: string): RuleSet;
  scan(html: string, options?: { route?: string; flagValues?: Record<string, unknown> }): Hit[];
  flagIsOn(flagValues: unknown, name: string): boolean;
  routeOf(path: string): string;
  decodeEntities(text: string): string;
  stripElements(html: string, matches: (tag: string) => boolean): string;
  stripClaimAllowed(html: string, ruleId: string): string;
  stripGenericDefinitions(html: string): string;
  visibleText(html: string): string;
  bodyText(html: string): string;
  hasGeneratedImages(manifest: unknown): boolean;
  checkRequired(pages: readonly Page[], required: readonly RequiredRule[], options?: { generatedImages?: boolean }): Finding[];
  checkManifest(manifest: unknown, rules: readonly CompiledRule[]): Finding[];
  auditDist(dist: string, options?: { manifest?: Manifest; flagValues?: Record<string, unknown> }): { files: number; findings: Finding[] };
};

const ROOT = new URL('../../../', import.meta.url).pathname;
const SET = audit.loadDenylist();
const PHOTO_LINE = 'Illustrative images, some AI-generated. Figures shown are not real people, founders, clients or WE staff.';
const DISCLAIMER = 'WE makes no promise of funding.';
const DISCLAIMER_ROUTES = ['/', '/fundability/', '/investors/', '/program/grow/', '/services/fundability-and-investor-readiness/', '/pricing/'];

function ids(html: string, route = '/', flagValues: Record<string, unknown> = {}): string[] {
  return audit.scan(html, { route, flagValues }).map((h) => h.rule);
}

// ---- the denylist file ----

test('the denylist parses and keeps the four sections separate', () => {
  assert.ok(SET.rules.length >= 32);
  assert.deepEqual(
    SET.contextRules.map((r) => r.id),
    ['C-18-pbc', 'C-05-fundable-outcome', 'C-13-peers', 'C-21-phrase', 'Q-spelling', 'Q-we-case'],
  );
  assert.deepEqual(SET.required.map((r) => r.id), ['R-C05-no-funding-disclaimer', 'R-photo-disclosure']);
  assert.deepEqual(SET.manifestRules.map((r) => r.id), ['Q-photo-alt']);
  assert.equal(SET.scanRules.length, SET.rules.length + SET.contextRules.length);
});

test('the unconditional rules stay free of contextual wording the source tests could not tolerate', () => {
  const unconditional = SET.rules.map((r) => r.id);
  for (const contextual of ['C-18-pbc', 'C-05-fundable-outcome', 'C-13-peers', 'C-21-phrase', 'Q-spelling', 'Q-we-case']) {
    assert.ok(!unconditional.includes(contextual), `${contextual} belongs in contextRules`);
  }
  for (const added of ['C-11-years', 'C-20-frameworks', 'C-14-intro-positive']) assert.ok(unconditional.includes(added), `${added} is a rule`);
});

test('the denylist file is valid JSON with version 2', () => {
  const doc = JSON.parse(readFileSync(join(ROOT, 'claims-denylist.json'), 'utf8')) as { version: number };
  assert.equal(doc.version, 2);
});

test('parseDenylist rejects a duplicate id, a bad pattern, bad routes and an unknown condition', () => {
  const ok = { id: 'X-1', claim: 'C-01', pattern: 'x' };
  assert.throws(() => audit.parseDenylist({ rules: [ok], contextRules: [ok] }), /used twice/);
  assert.throws(() => audit.parseDenylist({ rules: [{ ...ok, pattern: '(' }] }), /invalid pattern/);
  assert.throws(() => audit.parseDenylist({ rules: [{ id: 'X-2', pattern: '' }] }), /non-empty string/);
  assert.throws(() => audit.parseDenylist({ rules: [{ ...ok, allowPaths: '^/a/$' }] }), /allowPaths must be an array/);
  assert.throws(() => audit.parseDenylist({ required: [{ id: 'R-1', text: 'x', routes: ['no-slash'] }] }), /routes must be/);
  assert.throws(() => audit.parseDenylist({ required: [{ id: 'R-2', text: 'x', routes: '*', when: 'always' }] }), /unknown "when"/);
  assert.throws(() => audit.parseDenylist({ rules: 'nope' }), /must be an array/);
  assert.doesNotThrow(() => audit.parseDenylist({}));
});

// ---- C-18-pbc and the flag switch ----

test('C-18-pbc: PBC wording is caught while the flag is off and passes once it is on', () => {
  for (const text of ['A public benefit corporation building digital companies.', 'WE is a Delaware PBC.', 'A benefit corporation.']) {
    assert.ok(ids(`<p>${text}</p>`).includes('C-18-pbc'), text);
    assert.ok(!ids(`<p>${text}</p>`, '/', { pbcWording: true }).includes('C-18-pbc'), `${text} with the flag on`);
  }
});

test('C-18-pbc: unrelated words do not match, and the rule reaches meta, alt and JSON-LD', () => {
  assert.ok(!ids('<p>Public standards and a benefit to founders.</p>').includes('C-18-pbc'));
  assert.ok(ids('<meta name="description" content="A public benefit corporation">').includes('C-18-pbc'));
  assert.ok(ids('<img alt="PBC badge" src="x">').includes('C-18-pbc'));
  assert.ok(ids('<script type="application/ld+json">{"description":"a public benefit corporation"}</script>').includes('C-18-pbc'));
});

test('flagIsOn reads plain and dotted flag names and treats anything but true as off', () => {
  assert.equal(audit.flagIsOn({ pbcWording: true }, 'pbcWording'), true);
  assert.equal(audit.flagIsOn({ pbcWording: false }, 'pbcWording'), false);
  assert.equal(audit.flagIsOn({ seatPrice: { published: true } }, 'seatPrice.published'), true);
  assert.equal(audit.flagIsOn({ seatPrice: { published: 'yes' } }, 'seatPrice.published'), false);
  assert.equal(audit.flagIsOn({}, 'missing.flag'), false);
});

// ---- C-05-fundable-outcome ----

test('C-05-fundable-outcome: "fundable" as a promised outcome is caught', () => {
  for (const text of [
    'from first idea to a fundable company',
    'from first idea toward a fundable company',
    'Earn customers and become fundable',
    'helps founders becoming fundable',
    'Three fundable companies',
  ]) {
    assert.ok(ids(`<p>${text}</p>`).includes('C-05-fundable-outcome'), text);
  }
});

test('C-05-fundable-outcome: Fundability and a question about being fundable pass', () => {
  for (const text of [
    'Fundability and investor readiness',
    'Will WE make my company fundable?',
    'WE makes no promise of funding.',
    'What investors mean by fundable is their own judgment.',
  ]) {
    assert.ok(!ids(`<p>${text}</p>`).includes('C-05-fundable-outcome'), text);
  }
});

// ---- C-13-peers: path allow, marker allow ----

test('C-13-peers: implied peers, mentors and cohorts are caught', () => {
  for (const text of ['Peer sessions where founders compare notes.', 'Join the next cohort.', 'Meet your mentor.', 'Our alumni network.', 'WE is an accelerator.']) {
    assert.ok(ids(`<p>${text}</p>`, '/services/digital-incubation/').includes('C-13-peers'), text);
  }
});

test('C-13-peers: the FAQ and the metrics definitions page are allowed by path, other pages are not', () => {
  const html = '<p>Is WE an accelerator? This site does not describe a cohort calendar.</p>';
  assert.ok(!ids(html, '/faq/').includes('C-13-peers'));
  assert.ok(!ids('<p>one cohort</p>', '/research/early-stage-saas-metrics-definitions/').includes('C-13-peers'));
  assert.ok(ids(html, '/pricing/').includes('C-13-peers'));
  assert.ok(ids(html, '/faq/extra/').includes('C-13-peers'), 'the allow is anchored to the exact route');
});

test('C-13-peers: an element marked for this rule, or for all rules, is skipped', () => {
  const marked = (value: string) => `<section><p>WE has <span data-claim-allow="${value}">no cohort and no mentors</span>.</p></section>`;
  assert.ok(!ids(marked('C-13-peers')).includes('C-13-peers'));
  assert.ok(!ids(marked('*')).includes('C-13-peers'));
  assert.ok(!ids(marked('C-21-phrase, C-13-peers')).includes('C-13-peers'));
  assert.ok(ids(marked('C-21-phrase')).includes('C-13-peers'), 'a marker for another rule does not help');
  assert.ok(ids(marked('C-13-peers-extra')).includes('C-13-peers'), 'the marker must name the rule exactly');
});

test('C-13-peers: a marker skips only its own element, nested content included, and nothing after it', () => {
  const html = '<div data-claim-allow="C-13-peers"><div><p>no cohort</p></div><p>no mentor</p></div><p>a cohort starts soon</p>';
  const hits = audit.scan(html, { route: '/x/', flagValues: {} }).filter((h) => h.rule === 'C-13-peers');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.match, 'cohort');
  const onlyMarked = '<div data-claim-allow="C-13-peers"><div><p>no cohort</p></div><p>no mentor</p></div><p>Nothing else.</p>';
  assert.ok(!ids(onlyMarked, '/x/').includes('C-13-peers'));
});

test('a marker does not hide text in JSON-LD, so a structured-data claim still fails', () => {
  const html = '<p data-claim-allow="C-13-peers">no cohort</p><script type="application/ld+json">{"text":"join the next cohort"}</script>';
  assert.ok(ids(html, '/x/').includes('C-13-peers'));
});

test('markers are honored only by rules that opt in', () => {
  const html = '<p data-claim-allow="*">A priced seat: $49 per seat.</p>';
  assert.ok(ids(html).includes('C-06-currency-per-seat'));
});

// ---- C-21-phrase ----

test('C-21-phrase is allowed on the dedicated-teams page only', () => {
  const html = '<h2>Two companies, one objective</h2>';
  assert.ok(!ids(html, '/program/dedicated-teams/').includes('C-21-phrase'));
  for (const route of ['/', '/pricing/', '/insights/what-a-dedicated-team-seat-is-and-is-not/', '/program/dedicated-teams/extra/']) {
    assert.ok(ids(html, route).includes('C-21-phrase'), route);
  }
  assert.ok(ids('<p>Two companies one objective</p>', '/pricing/').includes('C-21-phrase'));
  assert.ok(!ids('<p>Two companies with different objectives</p>', '/pricing/').includes('C-21-phrase'));
});

// ---- C-11-years, C-20-frameworks, C-14-intro-positive ----

test('C-11-years catches a years-of-experience claim and not a plain duration', () => {
  for (const text of ['Over 20 years of experience', '20+ years', 'twenty years in the field', 'two decades of work']) {
    assert.ok(ids(`<p>${text}</p>`).includes('C-11-years'), text);
  }
  for (const text of ['The review takes 2 weeks', 'a 12 year old standard is not 20 or 30', 'Since 2022']) {
    assert.ok(!ids(`<p>${text}</p>`).includes('C-11-years'), text);
  }
});

test('C-20-frameworks catches the excluded framework names', () => {
  assert.ok(ids('<p>The Galactic Enterprise Framework</p>').includes('C-20-frameworks'));
  assert.ok(ids('<p>the World Enterprise Framework</p>').includes('C-20-frameworks'));
  assert.ok(!ids('<p>The ANDROID Ops Framework and the ORBITAL framework</p>').includes('C-20-frameworks'));
});

test('C-14-intro-positive catches a positive introductions claim and passes the negations', () => {
  for (const text of ['WE provides introductions to investors.', 'WE arranges curated investor introductions.', 'It makes introductions.', 'WE facilitates introductions.', 'WE offers investor introductions']) {
    assert.ok(ids(`<p>${text}</p>`).includes('C-14-intro-positive'), text);
  }
  for (const text of ['WE does not provide introductions to investors.', 'WE does not arrange meetings with investors.', 'WE makes no introductions.', 'WE does not offer introductions.']) {
    assert.ok(!ids(`<p>${text}</p>`).includes('C-14-intro-positive'), text);
  }
});

// ---- Q-spelling and Q-we-case ----

test('Q-spelling catches UK spellings and passes the US forms', () => {
  for (const text of ['A programme', 'your organisation', 'organised folder', 'organising', 'the colour palette', 'customer behaviour', 'open-source licences', 'editorial judgement', 'neighbours', 'a catalogue', 'favoured nation']) {
    assert.ok(ids(`<p>${text}</p>`).includes('Q-spelling'), text);
  }
  for (const text of ['A program', 'your organization', 'organized folder', 'organizing', 'the color palette', 'customer behavior', 'open-source licenses', 'editorial judgment', 'a licensed professional', 'a specialist', 'program of study']) {
    assert.ok(!ids(`<p>${text}</p>`).includes('Q-spelling'), text);
  }
});

test('Q-we-case flags the pronoun spelling of the company in sentences about what it does', () => {
  assert.ok(ids('<p>We coordinate your own counsel.</p>').includes('Q-we-case'));
  assert.ok(ids('<p>We steer the team.</p>').includes('Q-we-case'));
  assert.ok(!ids('<p>WE coordinates your own counsel.</p>').includes('Q-we-case'));
  assert.ok(!ids('<p>We have not given price points.</p>').includes('Q-we-case'));
  assert.ok(!ids('<p>we steer nothing</p>').includes('Q-we-case'));
});

// ---- existing behavior is unchanged ----

test('the original rules still fire, and a generic SAFE definition is still exempt', () => {
  assert.ok(ids('<p>Seats from $49 per seat</p>').includes('C-06-currency-per-seat'));
  assert.ok(ids('<p>There is no success fee.</p>').includes('C-08-success-fee'));
  assert.ok(ids('<img alt="$99 per seat" src="x">').includes('C-06-currency-per-seat'));
  assert.ok(ids('<p>Investors may get a valuation cap.</p>').includes('C-08-valuation-cap'));
  assert.ok(!ids('<dl data-generic-definition><dt>Term</dt><dd>A valuation cap limits conversion price.</dd></dl>').includes('C-08-valuation-cap'));
  assert.deepEqual(ids('<p>Dedicated team seats, steered by WE.</p>'), []);
});

// ---- helpers ----

test('stripElements removes balanced elements, spares siblings, and handles void tags', () => {
  const html = '<div id="a"><div>x</div><p>kept?</p></div><div id="b">stay</div><img data-x alt="gone" src="s"><p>end</p>';
  const out = audit.stripElements(html, (tag) => tag.includes('id="a"') || tag.includes('data-x'));
  assert.ok(!out.includes('kept?') && !out.includes('gone'));
  assert.ok(out.includes('stay') && out.includes('end'));
});

test('stripElements leaves the text alone when nothing matches and copes with an unclosed element', () => {
  assert.equal(audit.stripElements('<p>plain</p>', () => false), '<p>plain</p>');
  const out = audit.stripElements('<p>before</p><div data-x>never closed', (tag) => tag.includes('data-x'));
  assert.ok(out.includes('before') && !out.includes('never closed'));
});

test('stripClaimAllowed accepts double, single and bare attribute values', () => {
  for (const attr of ['data-claim-allow="C-X"', "data-claim-allow='C-X'", 'data-claim-allow=C-X']) {
    assert.ok(!audit.stripClaimAllowed(`<p ${attr}>secret</p><p>open</p>`, 'C-X').includes('secret'), attr);
    assert.ok(audit.stripClaimAllowed(`<p ${attr}>secret</p><p>open</p>`, 'C-X').includes('open'), attr);
  }
});

test('visibleText decodes entities and collapses whitespace; bodyText leaves out attributes and JSON-LD', () => {
  assert.equal(audit.visibleText('<p>WE&#39;s   plan &amp; more</p>').trim(), "WE's plan & more");
  const html = '<p title="hidden">shown</p><script type="application/ld+json">{"a":"ld"}</script><meta content="meta">';
  assert.ok(audit.visibleText(html).includes('hidden') && audit.visibleText(html).includes('ld'));
  assert.equal(audit.bodyText(html), 'shown');
});

test('decodeEntities handles named, decimal and hex references and leaves unknown ones', () => {
  assert.equal(audit.decodeEntities('&amp;&lt;&gt;&quot;&#39;&#x27;&nbsp;&rsquo;&bogus;&#0;'), '&<>"\'\' ’&bogus;&#0;');
});

test('routeOf maps built files to routes', () => {
  assert.equal(audit.routeOf('index.html'), '/');
  assert.equal(audit.routeOf('about/index.html'), '/about/');
  assert.equal(audit.routeOf('about/frameworks/orbital/index.html'), '/about/frameworks/orbital/');
  assert.equal(audit.routeOf('404.html'), '/404.html');
  assert.equal(audit.routeOf('sitemap-index.xml'), '/sitemap-index.xml');
});

// ---- required text ----

function disclaimerPages(withText: readonly string[]): Page[] {
  return DISCLAIMER_ROUTES.map((route) => ({ route, html: `<main><h1>Page</h1>${withText.includes(route) ? `<p>${DISCLAIMER} This is general information.</p>` : '<p>Nothing.</p>'}</main>`, isHtml: true }));
}

test('required: the no-funding disclaimer must be present on each listed route', () => {
  const rule = SET.required.find((r) => r.id === 'R-C05-no-funding-disclaimer');
  assert.ok(rule);
  assert.deepEqual([...(rule.routes as readonly string[])].sort(), [...DISCLAIMER_ROUTES].sort());
  assert.deepEqual(audit.checkRequired(disclaimerPages(DISCLAIMER_ROUTES), SET.required, { generatedImages: false }), []);
  const partial = audit.checkRequired(disclaimerPages(DISCLAIMER_ROUTES.filter((r) => r !== '/pricing/')), SET.required, { generatedImages: false });
  assert.equal(partial.length, 1);
  assert.equal(partial[0]?.route, '/pricing/');
  assert.match(partial[0]?.message ?? '', /required text is missing/);
});

test('required: a listed route that was not built is a finding', () => {
  const pages = disclaimerPages(DISCLAIMER_ROUTES).filter((p) => p.route !== '/investors/');
  const findings = audit.checkRequired(pages, SET.required, { generatedImages: false });
  assert.equal(findings.length, 1);
  assert.match(findings[0]?.message ?? '', /was not built/);
});

test('required: hidden text does not count, but whitespace, entities and curly apostrophes are tolerated', () => {
  const required = [{ id: 'R-T', claim: 'C-05', text: "WE doesn't promise funding.", routes: ['/x/'] }];
  const find = (html: string) => audit.checkRequired([{ route: '/x/', html, isHtml: true }], required, {}).length;
  assert.equal(find('<p>WE doesn&#39;t   promise\n funding.</p>'), 0);
  assert.equal(find('<p>WE doesn’t <b>promise</b> funding.</p>'), 0);
  assert.equal(find('<p title="WE doesn\'t promise funding.">x</p>'), 1);
  assert.equal(find('<script type="application/ld+json">{"t":"WE doesn\'t promise funding."}</script>'), 1);
  assert.equal(find('<!-- WE doesn\'t promise funding. --><p>x</p>'), 1);
  assert.equal(find('<p>we DOESN\'T promise FUNDING.</p>'), 0);
});

test('required: the photo disclosure is required on every HTML page only when an image is generated', () => {
  const pages: Page[] = [
    { route: '/', html: '<footer>none</footer>', isHtml: true },
    { route: '/about/', html: `<footer><p>${PHOTO_LINE} <a href="/about/editorial-policy/">Editorial policy</a></p></footer>`, isHtml: true },
    { route: '/sitemap.xml', html: '<urlset></urlset>', isHtml: false },
  ];
  const photoOnly = SET.required.filter((r) => r.id === 'R-photo-disclosure');
  assert.deepEqual(audit.checkRequired(pages, photoOnly, { generatedImages: false }), []);
  assert.deepEqual(audit.checkRequired(pages, photoOnly, {}), [], 'an unset state counts as no generated image');
  const missing = audit.checkRequired(pages, photoOnly, { generatedImages: true });
  assert.deepEqual(missing.map((f) => f.route), ['/']);
});

test('the photo disclosure line in the denylist is the line the footer renders', async () => {
  const lib = (await import('../../../src/lib/photo-disclosure.ts')) as { PHOTO_DISCLOSURE: string };
  assert.equal(lib.PHOTO_DISCLOSURE, PHOTO_LINE);
  assert.equal(SET.required.find((r) => r.id === 'R-photo-disclosure')?.text, PHOTO_LINE);
});

// ---- manifest ----

test('hasGeneratedImages is true only for a slot whose source is "generated"', () => {
  assert.equal(audit.hasGeneratedImages({ slots: [{ id: 'a', source: 'vector-fallback' }, { id: 'b', source: 'svg-composed' }] }), false);
  assert.equal(audit.hasGeneratedImages({ slots: [{ id: 'a', source: 'vector-fallback' }, { id: 'b', source: 'generated' }] }), true);
  assert.equal(audit.hasGeneratedImages({ slots: [] }), false);
  assert.equal(audit.hasGeneratedImages({}), false);
  assert.equal(audit.hasGeneratedImages(null), false);
});

test('Q-photo-alt: an identity word or an empty alt on a generated slot is a finding; other slots are not checked', () => {
  const rules = SET.manifestRules;
  const slot = (alt: string | undefined, source = 'generated'): Manifest => ({ slots: [{ id: 's1', source, ...(alt === undefined ? {} : { alt }) }] });
  for (const alt of ['A founder at a desk', 'A customer reading a screen', 'Two clients talking', 'A team member at work', 'Our team around a table', 'A staff member', 'An employee typing']) {
    assert.equal(audit.checkManifest(slot(alt), rules).length, 1, alt);
  }
  assert.equal(audit.checkManifest(slot('A pair of hands arranging index cards on a desk'), rules).length, 0);
  assert.equal(audit.checkManifest(slot(''), rules).length, 1);
  assert.equal(audit.checkManifest(slot(undefined), rules).length, 1);
  assert.equal(audit.checkManifest(slot('A founder at a desk', 'vector-fallback'), rules).length, 0, 'vector slots are not figure slots');
  assert.equal(audit.checkManifest({}, rules).length, 0);
});

test('the shipped photo manifest passes the manifest rules and agrees with the audit about generated images', async () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'src/assets/photo/manifest.json'), 'utf8')) as Manifest;
  assert.deepEqual(audit.checkManifest(manifest, SET.manifestRules), []);
  const lib = (await import('../../../src/lib/photo-disclosure.ts')) as { hasGeneratedImages(slots: readonly { source?: string }[]): boolean };
  assert.equal(lib.hasGeneratedImages(manifest.slots), audit.hasGeneratedImages(manifest));
});

// ---- end to end over a built directory ----

function page(body: string, footer = '<p>Footer</p>'): string {
  return `<!doctype html><html lang="en"><head><title>T</title></head><body><main>${body}</main><footer>${footer}</footer></body></html>`;
}

function cleanSite(footer?: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const route of DISCLAIMER_ROUTES) {
    const rel = route === '/' ? 'index.html' : `${route.slice(1)}index.html`;
    files[rel] = page(`<h1>Page</h1><p>${DISCLAIMER}</p>`, footer);
  }
  files['about/index.html'] = page('<h1>About</h1><p>A digital incubator for SaaS.</p>', footer);
  return files;
}

const NO_IMAGES: Manifest = { slots: [{ id: 'a', source: 'vector-fallback', alt: 'A paper atlas of hexagons' }] };
const WITH_IMAGES: Manifest = { slots: [{ id: 'a', source: 'vector-fallback', alt: 'A paper atlas of hexagons' }, { id: 'b', source: 'generated', alt: 'Hands arranging index cards on a desk' }] };

test('auditDist: a clean site with no generated images passes without the photo line', () => {
  const result = audit.auditDist(makeDist(cleanSite()), { manifest: NO_IMAGES, flagValues: {} });
  assert.deepEqual(result.findings, []);
  assert.equal(result.files, 7);
});

test('auditDist: once an image is generated, a page without the line fails and the line makes it pass', () => {
  const without = audit.auditDist(makeDist(cleanSite()), { manifest: WITH_IMAGES, flagValues: {} });
  assert.equal(without.findings.length, 7);
  assert.ok(without.findings.every((f) => f.rule === 'R-photo-disclosure'));
  const withLine = audit.auditDist(makeDist(cleanSite(`<p>${PHOTO_LINE} <a href="/about/editorial-policy/">Editorial policy</a></p>`)), { manifest: WITH_IMAGES, flagValues: {} });
  assert.deepEqual(withLine.findings, []);
});

test('auditDist: a missing disclaimer, a context-rule hit and a manifest alt problem are all reported', () => {
  const files = cleanSite();
  files['pricing/index.html'] = page('<h1>Pricing</h1><p>A programme for your organisation.</p>');
  const badManifest: Manifest = { slots: [{ id: 'g1', source: 'generated', alt: 'A founder at a desk' }] };
  const result = audit.auditDist(makeDist(files), { manifest: badManifest, flagValues: {} });
  const found = new Set(result.findings.map((f) => f.rule));
  assert.ok(found.has('R-C05-no-funding-disclaimer'));
  assert.ok(found.has('Q-spelling'));
  assert.ok(found.has('Q-photo-alt'));
  assert.ok(found.has('R-photo-disclosure'));
});

test('auditDist: the route comes from the file path, so a path allow applies to the right page only', () => {
  const files = cleanSite();
  files['faq/index.html'] = page('<h1>FAQ</h1><p>Is WE an accelerator?</p>');
  files['program/dedicated-teams/index.html'] = page('<h2>Two companies, one objective</h2>');
  const ok = audit.auditDist(makeDist(files), { manifest: NO_IMAGES, flagValues: {} });
  assert.deepEqual(ok.findings, []);
  files['pricing/index.html'] = page('<h1>Pricing</h1><p>' + DISCLAIMER + '</p><h2>Two companies, one objective</h2>');
  const bad = audit.auditDist(makeDist(files), { manifest: NO_IMAGES, flagValues: {} });
  assert.deepEqual(bad.findings.map((f) => f.rule), ['C-21-phrase']);
});

// ---- command line ----

function run(args: readonly string[]): { status: number | null; out: string } {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/audit-claims.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

function manifestFile(manifest: Manifest): string {
  const file = join(mkdtempSync(join(tmpdir(), 'we-manifest-')), 'manifest.json');
  writeFileSync(file, JSON.stringify(manifest));
  return file;
}

test('cli: exits 0 on a clean site, 1 on a finding and 2 when the directory or manifest cannot be read', () => {
  const dist = makeDist(cleanSite());
  const clean = run([dist, '--manifest', manifestFile(NO_IMAGES)]);
  assert.equal(clean.status, 0, clean.out);
  assert.match(clean.out, /7 files scanned, 0 findings/);

  const generated = run([dist, '--manifest', manifestFile(WITH_IMAGES)]);
  assert.equal(generated.status, 1, generated.out);
  assert.match(generated.out, /R-photo-disclosure/);

  assert.equal(run([join(dist, 'missing'), '--manifest', manifestFile(NO_IMAGES)]).status, 2);
  assert.equal(run([dist, '--manifest', join(dist, 'nope.json')]).status, 2);
  assert.equal(run([dist, '--bogus']).status, 2);
});

test('cli: --self-test passes', () => {
  const result = run(['--self-test']);
  assert.equal(result.status, 0, result.out);
  assert.doesNotMatch(result.out, /self-test FAIL/);
});
