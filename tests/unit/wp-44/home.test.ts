/**
 * The home page (WP-44, recomposed by WP-53 for the long-horizon positioning): the order of the argument, the galaxy hero, the
 * retired seat, package, proof and FAQ blocks, the required lines and the truth policy over every line the page shows.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SITUATIONS, TEAM_ROLES } from '../../../src/components/home/home.ts';
import { HONESTY_LINE, NO_FUNDING_LINE } from '../../../src/components/program/clock.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface DenyRule {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
}
const denylist = JSON.parse(read('claims-denylist.json')) as { rules: readonly DenyRule[]; contextRules: readonly DenyRule[] };

const PAGE = 'src/pages/index.astro';
const SECTIONS = ['HomeHero', 'HomeJourney', 'HomeClock', 'HomeTeam', 'HomeUbf'].map((n) => `src/components/home/${n}.astro`);
const HOME_FILES = [PAGE, ...SECTIONS, 'src/components/home/LatestInsights.astro'];
const DATA_FILES = ['src/components/home/home.ts', 'src/components/home/hero-image.ts', 'src/components/program/clock.ts', 'src/components/program/ctas.ts'];

/** The words a reader sees in a page source: front matter, style and script blocks, tags, expressions and comments removed. */
function visibleText(source: string): string {
  return source
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ');
}

/** Every quoted string literal of a module or frontmatter, for copy that lives in code (module paths left out). */
function stringLiterals(source: string): string[] {
  return [...source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
    .filter((literal) => !/^\.{1,2}\//.test(literal));
}

const copy = [
  ...HOME_FILES.map((f) => visibleText(read(f))),
  ...HOME_FILES.flatMap((f) => stringLiterals(read(f).split('<style>')[0] ?? '')),
  ...DATA_FILES.flatMap((f) => stringLiterals(read(f))),
  read('src/content/pages/home/index.mdx'),
].join('\n');

// ---- Order and composition ----

test('the page is an argument in the planned order, from the galaxy to the closing band', () => {
  const home = read(PAGE);
  const order = ['<HomeHero', '<HomeJourney', '<HomeClock', '<HomeTeam', '<HomeUbf', 'id="home-who-title"', '<LatestInsights />', 'id="home-end-title"'];
  let at = -1;
  for (const marker of order) {
    const next = home.indexOf(marker, at + 1);
    assert.ok(next > at, `${marker} comes after the previous section`);
    at = next;
  }
});

test('the seat, package, pricing, proof and FAQ blocks are gone from the home page', () => {
  const sources = HOME_FILES.map(read).join('\n');
  assert.doesNotMatch(sources, /SeatDiagram|packages\.ts|PACKAGE_PARAM|\/pricing\/|team-composer|PromiseProof|LeaveWith|FaqList|HOME_FAQ_IDS|CtaBand/);
  assert.doesNotMatch(copy, /\b(?:Spark|Accelerate|Studio)\b/, 'no package name');
  assert.doesNotMatch(copy, /\bseats?\b/i, 'no seat language');
  assert.doesNotMatch(copy, /[$€£]\s?\d|\bUSD\b|\bper (?:month|seat|hour)\b/i, 'no amount');
});

test('every section is a full-width band; the media columns use the split layout', () => {
  for (const file of SECTIONS) assert.match(read(file), /<section class="(?:[\w-]+ )?band[ "]/, `${file} is a band`);
  const home = read(PAGE);
  assert.match(home, /<section class="band band--soft home-who"/);
  assert.match(home, /<section class="band band--deep home-end"/);
  for (const file of [PAGE, ...SECTIONS.filter((f) => !f.endsWith('HomeJourney.astro'))]) assert.match(read(file), /class="[^"]*\bsplit\b/, `${file} pairs text with a visual`);
});

// ---- The hero ----

test('the hero is the galaxy: the still poster is the LCP image, preloaded, and the scene loads over it', () => {
  const home = read(PAGE);
  assert.match(home, /const heroImage = await heroPoster\(\);/);
  assert.match(home, /<HomeHero image=\{heroImage\}/);
  assert.match(home, /preloadImage=\{preloadOfPhoto\(heroImage\)\}/);
  assert.match(home, /title="WE build worlds\."/);
  assert.match(home, /primary=\{START_REVIEW\}/);
  assert.doesNotMatch(home, /fetchpriority/i, 'the page sets no fetchpriority of its own; the hero component owns it');
  const hero = read('src/components/home/HomeHero.astro');
  assert.match(hero, /<Scene scene="galaxy" poster=\{HERO_POSTER\}/);
  assert.match(hero, /sizes=\{image\.sizes\} fill decorative/, 'the scene asks for the same file as the LCP image');
  assert.match(hero, /class="home-hero band band--deep"/);
  assert.match(read('src/components/home/hero-image.ts'), /export const HERO_POSTER: PosterKey = 'galaxy';/);
});

test('the primary action everywhere on the page is the readiness review', () => {
  const ctas = read('src/components/program/ctas.ts');
  assert.match(ctas, /START_REVIEW: Action = \{ label: 'Start a readiness review', href: '\/apply\/' \}/);
  assert.match(read(PAGE), /href=\{href\(START_REVIEW\.href\)\}>\{START_REVIEW\.label\}/);
  assert.match(read('src/content/pages/home/index.mdx'), /\{ label: Start a readiness review, href: \/apply\/, variant: primary \}/);
});

// ---- Required lines ----

test('the no-funding line is on the page, and every block of figures carries the honesty line', () => {
  assert.equal(NO_FUNDING_LINE, 'WE makes no promise of funding.');
  assert.equal(HONESTY_LINE, "These figures describe all new U.S. businesses, not WE's results.");
  assert.match(read(PAGE), /\{NO_FUNDING_LINE\}/);
  for (const file of ['HomeClock', 'HomeJourney'].map((n) => `src/components/home/${n}.astro`)) {
    const source = read(file);
    assert.match(source, /\{HONESTY_LINE\}/, `${file} shows the honesty line`);
  }
});

test('the home page renders no figure of its own: every statistic comes from clock.ts with its source', () => {
  for (const file of SECTIONS) {
    const text = visibleText(read(file));
    assert.doesNotMatch(text, /\d+(?:\.\d+)?\s*%/, `${file} types a percentage`);
  }
  assert.match(read('src/components/home/HomeClock.astro'), /stats\('ST-01', 'ST-02', 'ST-03'\)/);
});

test('the team is shown as roles, never as seats or prices, and the payment block ships the C-07 fallback', () => {
  assert.ok(TEAM_ROLES.length >= 6 && TEAM_ROLES.length <= 10);
  const team = read('src/components/home/HomeTeam.astro');
  assert.match(team, /<TeamConstellation/);
  assert.match(team, /WE is paid for work already done, never in advance of it\./);
  assert.doesNotMatch(team, /equity/i, 'the equity wording waits for C-07 (PAGE-AGENT-BRIEF: gated lines ship as their fallback)');
});

test('the seven situations are listed as situations, never as identities', () => {
  assert.equal(SITUATIONS.length, 7);
  assert.equal(new Set(SITUATIONS.map((s) => s.id)).size, 7);
  for (const s of SITUATIONS) assert.doesNotMatch(s.label, /\b(?:women|men|veterans?|immigrants?|minorit|retirees?|young|old|black|white|asian|latin)/i, s.label);
});

// ---- Style ----

test('styling stays in scoped style blocks inside @layer pages, with no inline style or script', () => {
  for (const file of HOME_FILES) {
    const text = read(file);
    assert.doesNotMatch(text, /import '[^']*\.css'/, file);
    assert.doesNotMatch(text, /<style is:global|:global\(|is:inline|\sstyle="/, file);
    if (text.includes('<style>')) assert.match(text, /<style>\s*@layer pages \{/, `${file} styles inside @layer pages`);
  }
});

// ---- Truth policy ----

test('the copy passes the claims denylist and the wave 7 context rules', () => {
  const rules = [...denylist.rules, ...denylist.contextRules.filter((r) => r.id.startsWith('W7-'))];
  assert.ok(rules.length > 10, 'the denylist rules are loaded');
  for (const rule of rules) {
    const hit = new RegExp(rule.pattern, rule.flags ?? '').exec(copy);
    assert.equal(hit, null, `${rule.id} matches "${hit?.[0] ?? ''}"`);
  }
  assert.doesNotMatch(copy, /\bno fees?\b|\bno equity\b|equity-free|free of charge|\bno stake\b|within \d+ (?:hours|days)/i);
});

test('the copy keeps the language guide: no banned word, third person for WE, no client, person or testimonial', () => {
  assert.doesNotMatch(
    copy,
    /\b(?:free|perks?|accelerators?|cohorts?|mentors?|mentorship|alumni|investor network|demo day|batch|graduation|graduate|employer of record|staffing|investor)\b/i,
  );
  assert.doesNotMatch(copy, /\bWe (?:build|steer|coordinate|recruit|review|work)\b/, 'third person: "WE builds", never "We build"');
  assert.doesNotMatch(copy, /\b(?:testimonial|portfolio|case stud)/i);
  assert.doesNotMatch(copy, /\bincubator\b/i, 'WE is a business incubation and consulting firm');
});
