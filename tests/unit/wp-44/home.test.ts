import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { HOLDING_LIMIT, MATERIAL_KINDS, MATERIAL_LIMIT, leaveWithColumn, leaveWithColumns } from '../../../src/components/home/leave-with/leave-with.ts';
import { BASIS_LABEL, PROOF, resolveProof } from '../../../src/components/home/proof/proof.ts';
import { STAGES } from '../../../src/components/program/stages.ts';
import { PACKAGE_PARAM, packages } from '../../../src/data/packages.ts';
import { routes } from '../../../src/data/routes.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const launched = new Set(routes.filter((r) => r.launch).map((r) => r.path));

interface DenyRule {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
  readonly markerAllowed?: boolean;
}
const denylist = JSON.parse(read('claims-denylist.json')) as { rules: readonly DenyRule[]; contextRules: readonly DenyRule[] };

const HOME_FILES = ['src/pages/index.astro', 'src/content/pages/home/index.mdx', 'src/components/home/LatestInsights.astro'];

function listFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(rel) : [rel];
  });
}

const NEW_FILES = [...listFiles('src/components/home/leave-with'), ...listFiles('src/components/home/proof')];

/** The words a reader sees in a page source: front matter, style blocks, tags and comments removed. */
function visibleText(source: string): string {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
  return body
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ');
}

/** Every quoted string literal of a module, for copy that lives in a .ts file. */
function stringLiterals(source: string): string[] {
  return [...source.matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? '');
}

// ---- What you leave with ----

test('there is one column per stage, in stage order, and each is read from the stage data', () => {
  const columns = leaveWithColumns();
  assert.deepEqual(columns.map((c) => c.id), ['dream', 'build', 'grow']);
  assert.deepEqual(columns.map((c) => c.id), STAGES.map((s) => s.id));
  for (const [index, column] of columns.entries()) {
    const stage = STAGES[index];
    assert.ok(stage, `stage ${index}`);
    assert.equal(column.name, stage.name);
    assert.equal(column.altitude, stage.altitude);
    assert.equal(column.promise, stage.promise);
    assert.equal(column.path, stage.path);
  }
});

test('every artifact and every exit-evidence sentence on the home page exists in the stage data', () => {
  for (const column of leaveWithColumns()) {
    const stage = STAGES.find((s) => s.id === column.id);
    assert.ok(stage, `${column.id} is a stage`);
    assert.ok(column.holding.length > 0 && column.holding.length <= HOLDING_LIMIT, `${column.id} holds 1 to ${HOLDING_LIMIT} items`);
    assert.ok(column.material.length > 0 && column.material.length <= MATERIAL_LIMIT, `${column.id} lists 1 to ${MATERIAL_LIMIT} working materials`);
    for (const sentence of column.holding) assert.ok(stage.exitEvidence.includes(sentence), `${column.id}: "${sentence}" is not exit evidence of the stage`);
    for (const item of column.material) {
      assert.ok(stage.artifacts.some((a) => a.path === item.path && a.title === item.title && a.kind === item.kind), `${column.id}: ${item.path} is not an artifact of the stage`);
      assert.ok(MATERIAL_KINDS.includes(item.kind), `${item.path} is a ${item.kind}`);
      assert.ok(launched.has(item.path), `${item.path} is not a launched route`);
    }
    assert.ok(launched.has(column.path), `${column.path} is not a launched route`);
  }
});

test('the column order follows the stage data, so a reordered or extended stage list moves the home page with it', () => {
  const [first, ...rest] = STAGES;
  assert.ok(first);
  const reversed = leaveWithColumns([...rest, first]);
  assert.deepEqual(reversed.map((c) => c.id), [...rest, first].map((s) => s.id));
  assert.deepEqual(leaveWithColumn(first).holding, first.exitEvidence.slice(0, HOLDING_LIMIT));
});

test('no artifact path or title is typed into the home sources; they come from the stage data only', () => {
  const artifactPaths = STAGES.flatMap((s) => s.artifacts.map((a) => a.path));
  const artifactTitles = STAGES.flatMap((s) => s.artifacts.map((a) => a.title));
  const sources = [...HOME_FILES, ...NEW_FILES].filter((f) => !f.endsWith('proof.ts'));
  for (const file of sources) {
    const text = read(file);
    for (const path of artifactPaths) assert.ok(!text.includes(path), `${file} types the artifact path ${path}`);
    for (const title of artifactTitles) assert.ok(!text.includes(title), `${file} types the artifact title "${title}"`);
    assert.doesNotMatch(text, /['"]\/(?:playbooks|library)\//, `${file} links a playbook or template by a typed path`);
  }
  assert.match(read('src/components/home/leave-with/leave-with.ts'), /from '\.\.\/\.\.\/program\/stages\.ts'/);
  assert.match(read('src/components/home/leave-with/LeaveWith.astro'), /leaveWithColumns\(\)/);
});

// ---- No catalogue statistic ----

test('the catalogue-count band is gone: no fact band, no collection counts, no number in the page copy', () => {
  const home = read('src/pages/index.astro');
  assert.doesNotMatch(home, /FactBand|What is on this site|aria-label="What is on this site"/);
  assert.doesNotMatch(home, /getPublished|FRAMEWORKS|frameworkCount|const counts|STAGES\.length|services\.length\s*,?\s*\}/);
  assert.doesNotMatch(home, /Stages from idea to first customers|Templates and library items|Insight articles|Research briefs|Published frameworks/);
  const copy = [...HOME_FILES.map((f) => visibleText(read(f))), ...NEW_FILES.filter((f) => f.endsWith('.astro')).map((f) => visibleText(read(f)))].join('\n');
  assert.doesNotMatch(copy, /(?<![\w-])\d[\d,.]*(?![\w-])/, 'a bare number in the visible copy');
  assert.doesNotMatch(copy, /\b\d+\s*(?:playbooks?|templates?|articles?|insights?|service lines?|frameworks?|stages?|briefs?)\b/i);
});

test('the copy a stage hands the home page holds no number either', () => {
  for (const column of leaveWithColumns()) {
    for (const text of [column.promise, ...column.holding, ...column.material.map((m) => `${m.title} ${m.note}`)]) {
      assert.doesNotMatch(text, /(?<![\w-])\d[\d,.]*(?![\w-])/, `${column.id}: "${text}"`);
    }
  }
});

// ---- Promise and proof ----

test('the four published statements are kept, each with a source page that is a launched row', () => {
  assert.deepEqual(PROOF.map((r) => r.claim), [
    'WE is a digital incubator for SaaS and works fully remotely.',
    'Team seats are dedicated to one company and steered by WE.',
    'Each stage ends with evidence you can inspect, not a promised outcome.',
    'WE does not promise funding.',
  ]);
  for (const row of PROOF) {
    assert.ok(launched.has(row.sourceHref), `${row.sourceHref} is not a launched route`);
    assert.ok(row.source.length > 0 && row.basis in BASIS_LABEL);
  }
});

test('a source whose page is not built keeps its label and loses its link, and the order is kept', () => {
  const none = resolveProof(() => false);
  assert.deepEqual(none.map((r) => r.source), PROOF.map((r) => r.source));
  assert.ok(none.every((r) => r.sourceHref === undefined));
  const some = resolveProof((path) => path === '/fundability/');
  assert.deepEqual(some.map((r) => r.sourceHref), [undefined, undefined, undefined, '/fundability/']);
  assert.deepEqual(resolveProof(() => true).map((r) => r.sourceHref), PROOF.map((r) => r.sourceHref));
});

test('the proof block leads with the source and links the row to it', () => {
  const block = read('src/components/home/proof/PromiseProof.astro');
  const kicker = block.indexOf('proof__kicker">');
  const source = block.indexOf('<p class="proof__source">');
  const claim = block.indexOf('<p class="proof__claim">');
  assert.ok(kicker > 0 && kicker < source && source < claim, 'kicker, then the source, then the claim');
  assert.match(block, /\.proof__link::after \{[^}]*position: absolute;[^}]*inset: 0;/);
  assert.match(read('src/pages/index.astro'), /resolveProof\(\(path\) => state\.isLive\(path\)\)/);
  assert.doesNotMatch(read('src/pages/index.astro'), /EvidenceLedger/);
});

// ---- Packages teaser ----

test('the packages teaser lists the four packages from packages.ts, links apply with the package id and links pricing, with no amount', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /import \{ PACKAGE_PARAM, packages \} from '\.\.\/data\/packages\.ts';/);
  assert.match(home, /packages\.map\(\(pkg\) =>/);
  assert.match(home, /\{pkg\.name\}/);
  assert.match(home, /\{pkg\.stageFit\}/);
  assert.match(home, /\{pkg\.depth\} depth/);
  assert.match(home, /href=\{href\(`\/apply\/\?\$\{PACKAGE_PARAM\}=\$\{pkg\.id\}`\)\}/);
  assert.match(home, /href=\{href\('\/pricing\/'\)\}/);
  assert.equal(PACKAGE_PARAM, 'package');
  assert.deepEqual(packages.map((p) => p.name), ['Spark', 'Launch', 'Accelerate', 'Studio']);
  assert.ok(launched.has('/apply/') && launched.has('/pricing/'));
  const section = home.slice(home.indexOf('id="home-packages"'), home.indexOf('id="home-proof"'));
  assert.doesNotMatch(visibleText(section),/[$€£]|\bUSD\b|\bper (?:month|seat)\b|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:dedicated\s+|team\s+)?seats?\b/i, 'no amount and no seat count in the teaser');
});

// ---- Order, deferral, the hero ----

test('the page is an argument in the planned order', () => {
  const home = read('src/pages/index.astro');
  const order = ['<HomeHero', '<HomeAudience />', 'id="home-leave-with"', 'id="home-team"', 'id="home-packages"', 'id="home-proof"', 'id="home-fundable"', '<Content />', 'id="home-remote"', 'id="home-services"', '<LatestInsights />', 'id="home-faq"', '<CtaBand'];
  let at = -1;
  for (const marker of order) {
    const next = home.indexOf(marker, at + 1);
    assert.ok(next > at, `${marker} comes after the previous section`);
    at = next;
  }
});

test('every section below the first screen after the hero band defers its rendering; the hero, the first band and the one above the closing band do not', () => {
  const home = read('src/pages/index.astro');
  const sections = [...home.matchAll(/<section class="([^"]*)"(?: aria-labelledby="([^"]*)")?/g)].map((m) => ({ classes: m[1] ?? '', id: m[2] ?? '(none)' }));
  assert.ok(sections.length >= 9, `${sections.length} sections`);
  for (const section of sections) {
    if (section.id === 'home-leave-with') assert.doesNotMatch(section.classes, /section--defer/, 'the band under the hero renders at once');
    // The last section sits right above the closing band. A skipped section keeps its placeholder height, so on a phone its last question
    // overflowed into the band and axe measured it as covered (target-size). Rendered at once, its box is its real height.
    else if (section.id === 'home-faq') assert.doesNotMatch(section.classes, /section--defer/, 'the section above the closing band renders at once');
    else assert.match(section.classes, /section--defer/, `${section.id} defers rendering`);
  }
  assert.match(read('src/components/home/LatestInsights.astro'), /class="section section--defer" aria-labelledby="home-insights"/);
  assert.match(read('src/styles/layout.css'), /\.section--defer \{\s*content-visibility: auto;\s*contain-intrinsic-size: auto /);
});

test('the hero, its preload and the lazy band image are untouched', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /const heroImage = await photoImage\('band-1'\);/);
  assert.match(home, /preloadImage=\{preloadOfPhoto\(heroImage\)\}/);
  assert.match(home, /<HomeHero image=\{heroImage\} eyebrow=\{data\.eyebrow \?\? 'World Enterprise Incubator'\} title="Build the evidence a SaaS idea needs to be a company\."/);
  assert.match(home, /loading="lazy" decoding="async" \/>/);
  assert.doesNotMatch(home, /fetchpriority/i, 'the page sets no fetchpriority of its own; the hero component owns it');
});

test('the no-funding disclaimer is rendered on the home page', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /import NoFundingDisclaimer from '\.\.\/components\/blocks\/NoFundingDisclaimer\.astro';/);
  const fundable = home.slice(home.indexOf('id="home-fundable"'), home.indexOf('<Content />'));
  assert.match(fundable, /<NoFundingDisclaimer \/>/);
  assert.match(read('src/components/blocks/NoFundingDisclaimer.astro'), /WE makes no promise of funding\./);
});

test('styling stays in scoped style blocks: the new components and the page import no stylesheet and set no global rule', () => {
  for (const file of ['src/pages/index.astro', ...NEW_FILES.filter((f) => f.endsWith('.astro'))]) {
    const text = read(file);
    assert.doesNotMatch(text, /import '[^']*\.css'/, file);
    assert.doesNotMatch(text, /<style is:global|:global\(/, file);
    assert.match(text, /<style>[\s\S]*@layer pages \{/, `${file} styles inside @layer pages`);
  }
});

// ---- Truth policy ----

test('the copy this package adds passes the denylist rules and the wave 7 context rules', () => {
  const copy = [
    visibleText(read('src/pages/index.astro')),
    read('src/content/pages/home/index.mdx'),
    ...leaveWithColumns().flatMap((c) => [c.promise, ...c.holding, ...c.material.flatMap((m) => [m.title, m.note])]),
    ...PROOF.flatMap((r) => [r.claim, r.source]),
    ...packages.flatMap((p) => [p.name, p.stageFit, p.depth]),
    ...stringLiterals(read('src/components/home/proof/proof.ts')),
  ].join('\n');
  const rules = [...denylist.rules, ...denylist.contextRules.filter((r) => r.id.startsWith('W7-'))];
  assert.ok(rules.length > 10, 'the denylist rules are loaded');
  for (const rule of rules) {
    const hit = new RegExp(rule.pattern, rule.flags ?? '').exec(copy);
    assert.equal(hit, null, `${rule.id} matches "${hit?.[0] ?? ''}"`);
  }
  assert.doesNotMatch(copy, /\bno fees?\b|\bno equity\b|equity-free|free of charge|\bno stake\b|within \d+ (?:hours|days)/i);
});

test('the home page names no company, person, date, cohort or testimonial', () => {
  const copy = visibleText(read('src/pages/index.astro'));
  assert.doesNotMatch(copy, /\b(?:cohort|alumni|portfolio|testimonial|demo day|batch of)\b/i);
  assert.doesNotMatch(copy, /\b(?:19|20)\d\d\b/);
});
