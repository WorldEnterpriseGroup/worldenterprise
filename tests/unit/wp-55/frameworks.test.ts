import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import {
  ANDROID_PARTS,
  CONSULTING_LEVELS,
  FRAMEWORK_SYSTEMS,
  SCALE_LADDER,
  SMART,
  SUPERNOVA_PHASES,
  UBF_COMPONENTS,
  UBF_ENGAGEMENT,
  UBF_LIFECYCLE,
  frameworkById,
  ubfAnchor,
} from '../../../src/components/about/framework-data.ts';
import { SITUATIONS } from '../../../src/components/network/situations.ts';
import { getRoute } from '../../../src/data/routes.ts';

/**
 * WP-55 (issue #76, absorbs WP-48): the frameworks hub, the UBF page, About and the network family. These tests pin the framework
 * definitions to BRIEF.md, keep the banned positioning words off every file WP-55 rewrote, and keep the UBF route launched with its page.
 */
const root = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) walk(rel, found);
    else if (/\.(astro|ts|md|mdx)$/.test(name)) found.push(relative('.', rel));
  }
  return found;
}

/** Every file WP-55 rewrote in wave 9. Legacy pages it only touched for layout keep their ledgered copy and are not listed. */
const REWRITTEN = [
  ...walk('src/components/about'),
  ...walk('src/pages/about/frameworks'),
  'src/pages/about/index.astro',
  'src/pages/about/facts.astro',
  'src/content/pages/about/index.md',
  'src/content/pages/about/frameworks.md',
  'src/content/pages/about/ubf.md',
  'src/content/pages/about/orbital.md',
  'src/content/pages/about/android-ops.md',
  'src/content/pages/about/facts.mdx',
  'src/content/pages/about/brand-story.mdx',
  'src/pages/founders/index.astro',
  'src/content/pages/founders/index.mdx',
  'src/components/network/situations.ts',
  'src/pages/contact/index.astro',
  'src/content/pages/contact/contact.mdx',
  'src/pages/press/_boilerplate.ts',
];

/** The positioning bans of the redesign kit (ORCHESTRATION 2026-10-14, SALES.md) that apply to copy WP-55 wrote. */
const BANNED: readonly RegExp[] = [
  /\baccelerat(?:or|ors)\b/i,
  /\bcohorts?\b/i,
  /\bmentor(?:s|ship)?\b/i,
  /\balumni\b/i,
  /\bdemo day\b/i,
  /\bperks?\b/i,
  /\bpremier\b/i,
  /\brevolutionary\b/i,
  /\btestimonials?\b/i,
  /\btrusted by\b/i,
  /\b(?:20|twenty) years\b/i,
  /\bguarantee/i,
  /\bcertified\b/i,
  /\bfundable company\b|\bbecome fundable\b/i,
  /\bnon-dilutive\b|\bno equity\b/i,
  /\bdigital incubator\b/i,
  /\bWe (?:build|steer|coordinate)\b/,
  /\b(?:galactic|world) enterprise framework\b/i,
  /\bnine-milestone\b/i,
  /\bpackage tier\b/i,
  /\bwe invest\b|\bbacked by WE\b/i,
  /\b(?:organis|recognis|optimis|colour|centre|behaviour)/i,
];

test('the ten UBF components are the BRIEF components, in order, each with a quoted definition and an anchor', () => {
  assert.deepEqual(
    UBF_COMPONENTS.map((c) => c.name),
    ['Galaxy', 'Black Hole', 'Super Nova', 'Solar System', 'Sun', 'Super Star', 'Star', 'Moon', 'Comet', 'Asteroid'],
  );
  for (const c of UBF_COMPONENTS) {
    assert.match(c.definition, /[“"]/, `${c.name} quotes its source`);
    assert.ok(c.line.length > 0 && c.inPractice.length > 0, `${c.name} has a short line and how WE uses it`);
    assert.match(ubfAnchor(c.name), /^ubf-[a-z-]+$/);
  }
  assert.equal(new Set(UBF_COMPONENTS.map((c) => ubfAnchor(c.name))).size, 10, 'anchors are unique');
});

test('the five lifecycle steps map to Dream, Build and Grow', () => {
  assert.deepEqual(UBF_LIFECYCLE.map((s) => s.step), [1, 2, 3, 4, 5]);
  assert.deepEqual(UBF_LIFECYCLE.map((s) => s.stage), ['Dream', 'Dream', 'Build', 'Grow', 'Grow']);
  assert.ok(UBF_ENGAGEMENT.length >= 5, 'the engagement path has its steps');
  assert.equal(SCALE_LADDER.length, 4);
});

test('S.M.A.R.T., A.N.D.R.O.I.D. and SuperNova use the BRIEF wording', () => {
  assert.deepEqual(SMART.map((p) => p.name), ['Specific', 'Measurable', 'Achievable', 'Relevant', 'Time-bound']);
  assert.ok(ANDROID_PARTS.some((p) => p.name === 'Implement'), 'A.N.D.R.O.I.D. uses Implement');
  assert.equal(SUPERNOVA_PHASES.length, 8);
  assert.ok(SUPERNOVA_PHASES.some((p) => p.name === 'G.R.O.W.T.H. phase'));
  assert.equal(CONSULTING_LEVELS.length, 5);
});

test('the galaxy holds every WE framework once, with UBF at the core', () => {
  const ids = FRAMEWORK_SYSTEMS.map((f) => f.id);
  assert.equal(ids[0], 'ubf');
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['ubf', 'supernova', 'dream', 'startup', 'launch', 'growth', 'orbital', 'star', 'android', 'droid', 'shift', 'levels']) {
    assert.equal(frameworkById(id).id, id);
  }
  assert.equal(frameworkById('ubf').path, '/about/frameworks/ubf/');
});

test('the UBF route is launched under the absorbed WP-48 row, and has its page and content', () => {
  const row = getRoute('/about/frameworks/ubf/');
  assert.equal(row?.launch, true);
  assert.equal(row?.owner, 'WP-48', 'RouteOwner names no wave 9 package, so the absorbed row keeps its owner');
  assert.match(read('src/pages/about/frameworks/ubf/index.astro'), /<OrbitSystem[\s\S]*rings="nested"/);
  assert.match(read('src/content/pages/about/ubf.md'), /^title: Universal Business Framework$/m);
});

test('no file WP-55 rewrote uses a banned positioning word', () => {
  const problems: string[] = [];
  for (const file of REWRITTEN) {
    const text = read(file);
    for (const pattern of BANNED) if (pattern.test(text)) problems.push(`${file}: ${pattern}`);
  }
  assert.deepEqual(problems, []);
});

test('About tells the WE build worlds story and never calls WE an investor or accelerator', () => {
  const about = read('src/content/pages/about/index.md');
  assert.match(about, /^title: WE build worlds$/m);
  assert.match(about, /WE is a services firm, not an investor\./);
  assert.match(about, /WE makes no promise of funding\./);
  const page = read('src/pages/about/index.astro');
  for (const visual of ['<GalaxyScene', '<WorldsLadder', '<LaunchTrajectory', '<TeamConstellation']) assert.ok(page.includes(visual), visual);
  assert.match(page, /Droids, worlds, solar systems, galaxies\./);
});

test('the founders page names situations, not identities, and links a situation only when its page is live', () => {
  assert.equal(SITUATIONS.length, 7);
  const page = read('src/pages/founders/index.astro');
  assert.match(page, /state\.isLive\(s\.path\)/);
  assert.match(page, /founderStageRows\(\)/);
});

test('the pages use no inline style, inline script or raw internal link', () => {
  for (const file of REWRITTEN.filter((f) => f.endsWith('.astro'))) {
    const text = read(file);
    assert.doesNotMatch(text, /\sstyle="/, `${file} has an inline style`);
    assert.doesNotMatch(text, /is:inline/, `${file} has an inline script`);
    assert.doesNotMatch(text, /href="\/(?!\/)/, `${file} links a raw internal path; use href()`);
  }
});
