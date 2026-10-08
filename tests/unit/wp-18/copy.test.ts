import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import * as auditMod from '../../../scripts/audit-claims.mjs';
import { flags } from '../../../src/data/flags.ts';
import { site } from '../../../src/data/site.ts';
import { founderStageRows, FOUNDER_ENTRY_POINTS, stageLineList, stageLinePhrase } from '../../../src/components/program/stages.ts';
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

test('the flags that remain are all off', () => {
  assert.equal(flags.pbcWording, false);
  assert.equal(flags.legalTerms, false);
  assert.equal(flags.focusShiftConfirmed, false);
  assert.equal(flags.seatPrice.published, false);
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

test('the founders table has one row per entry point and states the same lines the stage data does', () => {
  const rows = founderStageRows();
  assert.equal(rows.length, FOUNDER_ENTRY_POINTS.length);
  assert.deepEqual(rows.map((row) => row[0]), ['Idea (Dream)', 'Prototype (Build)', 'First customers (Grow)']);
  assert.match(rows[0]?.[1] ?? '', /service lines C and E fit here/);
  assert.match(rows[1]?.[1] ?? '', /service lines B and D fit here/);
  assert.match(rows[2]?.[1] ?? '', /service lines C, F and G fit here/);
});

test('the founders page and the services hub build their stage text from the helpers', () => {
  const founders = read('src/pages/founders/index.astro');
  const services = read('src/pages/services/index.astro');
  assert.match(founders, /founderStageRows\(\)/);
  assert.match(services, /stageLinePhrase\('dream'\)/);
  assert.match(services, /stageLinePhrase\('build'\)/);
  for (const [name, text] of [['founders', founders], ['services', services]] as const) {
    assert.doesNotMatch(text, /Dream, with lines?|Build, with lines?|\blines? [A-G] and [A-G]\b/, `${name} hard-codes a stage mapping`);
  }
});

// ---- P1-6: the framework count ----

test('the home counter is the length of the framework list, gated on the frameworks page being live', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /import \{ FRAMEWORKS \} from '\.\.\/components\/about\/frameworks\.ts'/);
  assert.match(home, /state\.isLive\('\/about\/frameworks\/'\) \? FRAMEWORKS\.length : 0/);
  assert.doesNotMatch(home, /startsWith\(['"]\/about\/frameworks\//);
});

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
