import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import * as auditMod from '../../../scripts/audit-claims.mjs';
import { INTRODUCTIONS_DISCLAIMER } from '../../../src/components/blocks/introductions.ts';
import { isClaimUsable } from '../../../src/data/claims.ts';
import { flags } from '../../../src/data/flags.ts';
import { site } from '../../../src/data/site.ts';
import { stageLineList, stageLinePhrase } from '../../../src/components/program/stages.ts';
import { GENERATED_SOURCE, hasGeneratedImages, PHOTO_DISCLOSURE, PHOTO_DISCLOSURE_HREF } from '../../../src/lib/photo-disclosure.ts';

interface Rule {
  readonly id: string;
  readonly regex: RegExp;
}
interface RuleSet {
  readonly contextRules: readonly Rule[];
  readonly required: readonly { readonly id: string; readonly text: string }[];
}
const audit = auditMod as unknown as {
  loadDenylist(): RuleSet;
  hasGeneratedImages(manifest: unknown): boolean;
};

const ROOT = new URL('../../../', import.meta.url).pathname;
const SET = audit.loadDenylist();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

function* walk(dir: string, extensions: RegExp): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === '.astro') continue;
    if (statSync(path).isDirectory()) yield* walk(path, extensions);
    else if (extensions.test(name)) yield path;
  }
}

const rel = (path: string): string => relative(ROOT, path);

// ---- P0-2: no "fundable company" outcome, and the description says what WE does not promise ----

test('the site description promises no funding and never presents "fundable" as an outcome', () => {
  assert.doesNotMatch(site.description, /fundable/i);
  assert.match(site.description, /WE promises no funding/);
  assert.ok(site.description.length <= 160, `description is ${site.description.length} characters`);
});

test('the navigation copy carries no PBC wording and no "fundable" outcome', () => {
  const nav = read('src/data/nav.ts');
  assert.doesNotMatch(nav, /public benefit|benefit corporation|\bPBC\b/i);
  assert.doesNotMatch(nav, /fundable/i);
  assert.match(nav, /lead: 'A digital incubator for SaaS\. Dedicated team seats, steered by WE, from first idea to first customers\.'/);
});

test('"fundable" as an outcome and the peers family appear in source only where a rule allows them', () => {
  const byId = new Map(SET.contextRules.map((rule) => [rule.id, rule]));
  const files = [...walk(join(ROOT, 'src'), /\.(astro|ts|md|mdx|yaml)$/)];
  const allowed: Readonly<Record<string, readonly string[]>> = {
    // The ladder describes the excluded claims by name, and these are the sites the built-output audit allows.
    'C-05-fundable-outcome': ['src/data/claims.ts'],
    'C-13-peers': [
      'src/data/claims.ts',
      'src/data/faq.yaml',
      'src/content/research/early-stage-saas-metrics-definitions.md',
      // Navigation entries for a route that is not launched; l2 items are never rendered.
      'src/data/nav.ts',
      'src/data/routes.ts',
      // The comparison page's slug and its blockedWord field: the one registry entry whose label drops the word (families.test.ts proves it).
      'src/data/families.ts',
      // The denylist already allows the word on the route ^/compare/incubator-vs-other-programs/$, because that page compares the category.
      'src/content/pages/compare/incubator-vs-other-programs.mdx',
    ],
    'C-21-phrase': ['src/data/claims.ts', 'src/pages/program/dedicated-teams.astro'],
  };
  for (const [id, exempt] of Object.entries(allowed)) {
    const rule = byId.get(id);
    assert.ok(rule, `${id} is in claims-denylist.json`);
    const offenders = files.map(rel).filter((file) => {
      if (exempt.includes(file)) return false;
      rule.regex.lastIndex = 0;
      return rule.regex.test(read(file));
    });
    assert.deepEqual(offenders, [], `${id} found in source`);
  }
});

test('UK spellings and the pronoun "We" for the company are absent from content and data files', () => {
  const byId = new Map(SET.contextRules.map((rule) => [rule.id, rule]));
  const files = [...walk(join(ROOT, 'src/content'), /\.(md|mdx|yaml)$/), ...walk(join(ROOT, 'src/data'), /\.yaml$/)];
  for (const id of ['Q-spelling', 'Q-we-case']) {
    const rule = byId.get(id);
    assert.ok(rule, `${id} is in claims-denylist.json`);
    const offenders = files.map(rel).filter((file) => {
      rule.regex.lastIndex = 0;
      return rule.regex.test(read(file));
    });
    assert.deepEqual(offenders, [], `${id} found in content`);
  }
});

test('the manifesto does not say the program has no counters', () => {
  assert.doesNotMatch(read('src/content/pages/about/manifesto.md'), /no counters/i);
});

// ---- P1-12: the dead flag is gone ----

test('the unused limitsConfirmed flag is gone from the flags, the source, the scripts and the tests', () => {
  const name = ['limits', 'Confirmed'].join('');
  assert.ok(!(name in flags));
  const self = join(ROOT, 'tests/unit/wp-18/copy.test.ts');
  const offenders = [...walk(join(ROOT, 'src'), /\.(astro|ts|md|mdx|yaml|json)$/), ...walk(join(ROOT, 'scripts'), /\.(mjs|ts|js)$/), ...walk(join(ROOT, 'tests'), /\.(ts|mjs)$/)]
    .filter((file) => file !== self)
    .filter((file) => read(rel(file)).includes(name))
    .map(rel);
  assert.deepEqual(offenders, []);
});

// ---- P1-10: how WE is paid ----

test('the FAQ answers "How is WE paid?" by pointing to the written agreement, without terms or figures', () => {
  const list = parse(read('src/data/faq.yaml')) as readonly { id: string; question: string; answer: string }[];
  const entry = list.find((item) => item.id === 'how-paid');
  assert.ok(entry, 'the how-paid entry exists');
  assert.equal(entry.question, 'How is WE paid?');
  assert.match(entry.answer, /written agreement/);
  assert.match(entry.answer, /your own counsel/);
  assert.doesNotMatch(entry.answer, /\$|\d|success fee|equity|percent|%/i);
});

// ---- P1-7: one stage-to-service mapping ----

test('the stage helpers read the mapping in stages.ts', () => {
  assert.equal(stageLineList('dream'), 'C and E');
  assert.equal(stageLineList('build'), 'B and D');
  assert.equal(stageLineList('grow'), 'C, F and G');
  assert.equal(stageLinePhrase('dream'), 'lines C and E');
  assert.equal(stageLinePhrase('build'), 'lines B and D');
  assert.equal(stageLinePhrase('grow'), 'lines C, F and G');
});

// The founders table blocks moved verbatim to tests/unit/wp-62/legacy-founders-page.test.ts (W8-18).

// ---- P0-3: the photo disclosure ----

test('the disclosure line is the one the audit requires, and it links to the editorial policy', () => {
  assert.equal(PHOTO_DISCLOSURE, 'Illustrative images, some AI-generated. Figures shown are not real people, founders, clients or WE staff.');
  assert.equal(SET.required.find((rule) => rule.id === 'R-photo-disclosure')?.text, PHOTO_DISCLOSURE);
  assert.equal(PHOTO_DISCLOSURE_HREF, '/about/editorial-policy/');
});

test('the footer shows the disclosure only when a manifest slot is generated, by the same test the audit uses', () => {
  assert.equal(GENERATED_SOURCE, 'generated');
  const raster = { slots: [{ source: 'vector-fallback' }, { source: 'svg-composed' }, {}] };
  const mixed = { slots: [...raster.slots, { source: 'generated' }] };
  assert.equal(hasGeneratedImages(raster.slots), false);
  assert.equal(hasGeneratedImages(mixed.slots), true);
  assert.equal(hasGeneratedImages([]), false);
  assert.equal(audit.hasGeneratedImages(raster), hasGeneratedImages(raster.slots));
  assert.equal(audit.hasGeneratedImages(mixed), hasGeneratedImages(mixed.slots));
  const manifest = JSON.parse(read('src/assets/photo/manifest.json')) as { slots: readonly { source?: string }[] };
  assert.equal(audit.hasGeneratedImages(manifest), hasGeneratedImages(manifest.slots));
});

test('Footer.astro derives the disclosure from the manifest and links the editorial policy', () => {
  const footer = read('src/components/layout/Footer.astro');
  assert.match(footer, /import manifest from '\.\.\/\.\.\/assets\/photo\/manifest\.json'/);
  assert.match(footer, /const showPhotoDisclosure = hasGeneratedImages\(manifest\.slots\)/);
  assert.match(footer, /\{PHOTO_DISCLOSURE\}/);
  assert.match(footer, /href=\{href\(PHOTO_DISCLOSURE_HREF\)\}/);
  assert.match(footer, /showPhotoDisclosure && \(/);
});

test('the editorial policy and the accessibility statement describe the disclosure', () => {
  const policy = read('src/content/pages/about/editorial-policy.md');
  assert.match(policy, /the footer of every page says so/);
  assert.match(policy, /not a real person|none depicts or stands for a real person, founder, client or member of WE staff/);
  const accessibility = read('src/content/pages/legal/accessibility.md');
  assert.match(accessibility, /Illustrative images are created or generated for this site/);
});

// ---- Owner decisions of 2026-10-09: hybrid pricing and the Investor Introductions add-on ----

const PACKAGES = ['Spark', 'Launch', 'Accelerate', 'Studio'] as const;

test('claims C-10 and C-14 are usable, and the seat price and legal flags stay off', () => {
  assert.equal(isClaimUsable('C-10'), true);
  assert.equal(isClaimUsable('C-14'), true);
  assert.equal(flags.seatPrice.published, false);
  assert.equal(flags.seatPrice.monthlyRate, null);
  assert.equal(flags.legalTerms, false);
  assert.equal(flags.pbcWording, false);
  assert.equal(flags.focusShiftConfirmed, false);
});

test('the pricing page names the four packages, publishes no amounts or seat counts, and says how to ask for the rate', () => {
  const sources = [read('src/content/pages/pricing/pricing.mdx'), read('src/pages/pricing/index.astro')];
  const mdx = sources[0] ?? '';
  for (const name of PACKAGES) assert.match(mdx, new RegExp(`\\b${name}\\b`), `${name} is on the pricing page`);
  for (const text of sources) {
    assert.doesNotMatch(text, /\$\s?\d|\bdollars?\b|\bper month\b|\/mo\b/i, 'an amount');
    assert.doesNotMatch(text, /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:dedicated\s+)?seats?\b/i, 'a seat count');
    assert.doesNotMatch(text, /\bnot packages\b|does not list [^.]*\bpackages?\b|\bwithout packages\b/i, 'a denial of packages');
  }
  // Words from KEY-VALUES.md that this site does not publish: the milestone scheme, the phases and the term.
  for (const text of sources) assert.doesNotMatch(text, /\bnine Milestones\b|\bRaise-Ready\b|\bFundability Certification\b|\bDelivery Hours\b|\b12[- ]month\b|\btwelve[- ]month\b/i);
  // The page formats a rate only behind flags.seatPrice, which stays off (asserted above).
  assert.doesNotMatch(mdx, /\bUSD\b/);
  assert.match(mdx, /contact\/\?topic=seat-rate/);
});

test('the contact form offers the seat-rate topic the pricing page links to', () => {
  const form = read('src/components/forms/ContactForm.astro');
  assert.match(form, /seat-rate/);
  assert.match(form, /Request the current seat rate/);
});

test('every source page that names Investor Introductions shows the verbatim disclaimer', () => {
  const trigger = SET.required.find((rule) => rule.id === 'R-C14-intro-disclaimer-wherever-named') as unknown as { whenMatches?: string } | undefined;
  assert.ok(trigger?.whenMatches, 'the trigger rule exists');
  const regex = new RegExp(trigger.whenMatches, 'i');
  const exempt = new Set([
    'src/components/blocks/InvestorIntroductionsOffer.astro',
    'src/components/blocks/IntroductionsDisclaimer.astro',
    'src/components/blocks/introductions.ts',
    // The ladder and the registry describe the claim; no page renders them.
    'src/data/claims.ts',
  ]);
  const uses = /<(?:IntroductionsDisclaimer|InvestorIntroductionsOffer)\b/;
  const named = [...walk(join(ROOT, 'src'), /\.(astro|ts|md|mdx|yaml)$/)].map(rel).filter((file) => !exempt.has(file));
  const withText = named.filter((file) => regex.test(read(file)));
  assert.ok(withText.length >= 1, 'the trigger matches at least the FAQ and the investor-choice article');
  // A content file that a page renders is covered when the page renders the disclaimer.
  const renderedBy: Readonly<Record<string, string>> = {
    'src/content/pages/investors/index.mdx': 'src/pages/investors/index.astro',
    'src/content/pages/network/index.mdx': 'src/pages/network/index.astro',
  };
  const shows = (file: string): boolean => {
    const text = read(file).replace(/\s+/g, ' ');
    return uses.test(text) || text.includes(INTRODUCTIONS_DISCLAIMER);
  };
  const missing = withText.filter((file) => !shows(file) && !(renderedBy[file] && shows(renderedBy[file])));
  assert.deepEqual(missing, [], 'a page names the add-on without the disclaimer');
  // And the pages the owner named render it, through the component.
  for (const file of [
    'src/pages/investors/index.astro',
    'src/pages/network/index.astro',
    'src/content/services/fundability-and-investor-readiness.mdx',
    'src/content/pages/pricing/pricing.mdx',
    'src/content/insights/fundable/choosing-the-right-first-investors-for-a-saas-company.mdx',
  ]) assert.match(read(file), uses, `${file} renders the disclaimer`);
  const topic = read('src/content/pages/insights/topic-fundable.mdx').replace(/\s+/g, ' ');
  assert.ok(topic.includes(INTRODUCTIONS_DISCLAIMER), 'the fundable topic page carries the disclaimer in its text');
});

// The investors page and Service Line F block moved verbatim to tests/unit/wp-64/legacy-investors-page.test.ts (W8-18).

test('the FAQ answers the two new questions, and the add-on answer carries the disclaimer', () => {
  const list = parse(read('src/data/faq.yaml')) as readonly { id: string; question: string; answer: string; claimsUsed: readonly string[] }[];
  const intro = list.find((item) => item.id === 'investor-introductions');
  assert.ok(intro, 'the investor-introductions entry exists');
  assert.ok(intro.answer.includes(INTRODUCTIONS_DISCLAIMER));
  assert.ok(intro.claimsUsed.includes('C-14'));
  assert.match(intro.answer, /separate paid add-on/);
  assert.match(intro.answer, /does not depend on whether any investment closes/);
  const packages = list.find((item) => item.id === 'packages');
  assert.ok(packages, 'the packages entry exists');
  assert.ok(packages.claimsUsed.includes('C-10'));
  assert.doesNotMatch(packages.answer, /\$|\d/);
  assert.ok(list.every((item) => !/\bnot packages\b/i.test(item.answer)), 'no entry denies packages');
});

test('the insights topic page keeps the verbatim disclaimer and a body of 120 to 200 words', () => {
  const raw = read('src/content/pages/insights/topic-fundable.mdx');
  const body = raw.replace(/^---[\s\S]*?---\s*/, '');
  const words = body.trim().split(/\s+/).length;
  assert.ok(words >= 120 && words <= 200, `the body has ${words} words`);
  assert.ok(body.replace(/\s+/g, ' ').includes(INTRODUCTIONS_DISCLAIMER));
});

test('each use of the Investor Introductions offer has its own id prefix, and none reuses another heading id on the page', () => {
  const prefixes: string[] = [];
  for (const file of walk(join(ROOT, 'src'), /\.(astro|mdx)$/)) {
    for (const match of read(rel(file)).matchAll(/<InvestorIntroductionsOffer\b[^>]*\bidPrefix="([^"]+)"/g)) prefixes.push(match[1] ?? '');
  }
  assert.ok(prefixes.length >= 3, 'the pages that pass a prefix');
  assert.equal(new Set(prefixes).size, prefixes.length, 'prefixes are unique');
  // The network page also renders NetworkIntro, whose heading id is network-intro-title (audit:a11y found the clash in pipeline 64639).
  assert.ok(!prefixes.includes('network-intro'));
  const ids = [...walk(join(ROOT, 'src'), /\.(astro|mdx)$/)].flatMap((file) => [...read(rel(file)).matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1] ?? ''));
  for (const prefix of prefixes) for (const suffix of ['title', 'how', 'criteria']) assert.ok(!ids.includes(`${prefix}-${suffix}`), `${prefix}-${suffix} is also a literal id`);
});

test('no page still denies that WE makes investor introductions or arranges investor meetings', () => {
  // These are the wordings the site used before the owner decision of 2026-10-09; the audit no longer has a rule that denies the add-on, so this guard does.
  const denial =
    /arrang\w*\s+(?:investor\s+)?(?:meetings|introductions)|\bmakes?\s+no\s+(?:investor\s+)?introductions|\bno\s+investor\s+introductions\b|\bdoes\s+not\s+(?:introduce|connect|match|broker)[^.]{0,60}\binvestors?\b/i;
  const exempt = new Set(['src/data/claims.ts']);
  const offenders = [...walk(join(ROOT, 'src'), /\.(astro|ts|md|mdx|yaml|json)$/)].map(rel).filter((file) => !exempt.has(file) && denial.test(read(file)));
  assert.deepEqual(offenders, []);
  for (const old of ['WE does not arrange meetings with investors.', 'WE makes no introductions.', 'WE does not connect founders with investors.']) assert.match(old, denial, old);
});
