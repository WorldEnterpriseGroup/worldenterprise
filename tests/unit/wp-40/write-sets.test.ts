import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { matches, violations } from '../../../scripts/check-ownership.mjs';

// Wave 7 stage-1 packages run in parallel. This test is the proof that their write sets cannot collide with each other, with the frozen
// files WP-40 owns, with the photography lane (WP-12, WP-12b, WP-12c, WP-12d) or with the release lane (WP-30). The lanes are read from
// .astro-magazine/ownership.json (the static `lanes` floor plus the write sets of the registered WP-12* and WP-30 assignments), so a lane
// registered later extends the check without an edit here.

interface Assignment {
  owner: string;
  stage?: number;
  write_set: string[];
  exclude?: string[];
  gated?: string[];
}
interface Ownership {
  assignments: Assignment[];
  exceptions: { wp: string; path: string }[];
  always_allowed: string[];
  frozen_paths: string[];
  lanes: { photography: string[]; release: string[] };
}

const ownership = JSON.parse(readFileSync(new URL('../../../.astro-magazine/ownership.json', import.meta.url), 'utf8')) as Ownership;
const wave7 = ownership.assignments.filter((a) => /^WP-(?:4\d|50)$/.test(a.owner));
const stage1 = wave7.filter((a) => a.stage === 1);

const hasWildcard = (pattern: string): boolean => pattern.includes('*');
const prefixOf = (pattern: string): string => (hasWildcard(pattern) ? pattern.slice(0, pattern.indexOf('*')) : pattern);

function toRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|\\[\]]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** True when two patterns can match a common path. Conservative for two wildcards: one literal prefix starts with the other. */
function overlaps(a: string, b: string, excludeA: readonly string[] = [], excludeB: readonly string[] = []): boolean {
  const aw = hasWildcard(a);
  const bw = hasWildcard(b);
  if (!aw && !bw) return a === b;
  if (!aw) return !excludeB.includes(a) && toRegex(b).test(a);
  if (!bw) return !excludeA.includes(b) && toRegex(a).test(b);
  const pa = prefixOf(a);
  const pb = prefixOf(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

function lane(name: 'photography' | 'release'): string[] {
  const registered = ownership.assignments.filter((a) => (name === 'photography' ? /^WP-12/.test(a.owner) : a.owner === 'WP-30')).flatMap((a) => a.write_set);
  return [...new Set([...ownership.lanes[name], ...registered])];
}

const exceptionPaths = (owner: string): string[] => ownership.exceptions.filter((e) => e.wp === owner).map((e) => e.path);

test('all eleven wave 7 packages are registered, nine of them in stage 1', () => {
  assert.deepEqual(wave7.map((a) => a.owner), ['WP-40', 'WP-41', 'WP-42', 'WP-43', 'WP-44', 'WP-45', 'WP-46', 'WP-47', 'WP-48', 'WP-49', 'WP-50']);
  assert.deepEqual(stage1.map((a) => a.owner), ['WP-41', 'WP-42', 'WP-43', 'WP-44', 'WP-45', 'WP-46', 'WP-47', 'WP-48', 'WP-49']);
  assert.equal(wave7.find((a) => a.owner === 'WP-40')?.stage, 0);
  assert.equal(wave7.find((a) => a.owner === 'WP-50')?.stage, 2);
});

function pairClashes(sets: readonly Assignment[]): string[] {
  const clashes: string[] = [];
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      const x = sets[i];
      const y = sets[j];
      if (x === undefined || y === undefined) continue;
      for (const pa of x.write_set) {
        for (const pb of y.write_set) {
          if (overlaps(pa, pb, x.exclude, y.exclude)) clashes.push(`${x.owner} ${pa} <-> ${y.owner} ${pb}`);
        }
      }
    }
  }
  return clashes;
}

function laneClashes(sets: readonly Assignment[], patterns: readonly string[]): string[] {
  return sets.flatMap((a) => a.write_set.flatMap((p) => patterns.filter((r) => overlaps(p, r, a.exclude)).map((r) => `${a.owner} ${p} <-> ${r}`)));
}

test('stage-1 write sets are pairwise disjoint', () => {
  assert.deepEqual(pairClashes(stage1), []);
});

test('the overlap check has teeth: a seeded collision, lane intrusion or missing exclusion is reported', () => {
  const seed = (owner: string, pattern: string): Assignment[] => stage1.map((a) => (a.owner === owner ? { ...a, write_set: [...a.write_set, pattern] } : a));
  assert.equal(pairClashes(seed('WP-46', 'src/content/pages/pricing/**')).length > 0, true, 'WP-46 reaching the pricing copy (WP-42) is a pair clash');
  assert.equal(pairClashes(seed('WP-47', 'src/components/seo/SeoHead.astro')).length > 0, true, 'a file inside WP-41 src/components/seo/** is a pair clash');
  assert.equal(laneClashes(seed('WP-49', 'src/assets/photo/**'), lane('photography')).length > 0, true, 'the photography lane is protected');
  assert.equal(laneClashes(seed('WP-44', 'scripts/release-preflight.mjs'), lane('release')).length > 0, true, 'the release lane is protected');
  const withoutExclude = stage1.map((a) => (a.owner === 'WP-45' ? { ...a, exclude: [] } : a));
  assert.equal(laneClashes(withoutExclude, lane('photography')).length > 0, true, 'WP-45 without its exclude reaches Card.astro');
  assert.deepEqual(laneClashes(stage1, lane('photography')), [], 'with its exclude it does not');
  assert.equal(overlaps('src/a/**', 'src/b/**'), false);
  assert.equal(overlaps('src/a/**', 'src/a/b/*.ts'), true);
  assert.equal(overlaps('src/a/x.ts', 'src/a/*.ts'), true);
  assert.equal(overlaps('src/a/x.ts', 'src/a/*.ts', [], ['src/a/x.ts']), false);
});

test('no stage-1 write set reaches a frozen path unless an exception names it', () => {
  const clashes: string[] = [];
  for (const a of stage1) {
    const named = exceptionPaths(a.owner);
    for (const p of a.write_set) {
      for (const f of ownership.frozen_paths) {
        if (overlaps(p, f, a.exclude) && !named.includes(p)) clashes.push(`${a.owner} ${p} <-> frozen ${f}`);
      }
    }
  }
  assert.deepEqual(clashes, []);
});

test('no stage-1 write set reaches the photography lane (WP-12, 12b, 12c, 12d) or the release lane (WP-30)', () => {
  assert.deepEqual(laneClashes(stage1, lane('photography')), []);
  assert.deepEqual(laneClashes(stage1, lane('release')), []);
});

test('the lanes are not empty, so the checks above cannot pass by comparing against nothing', () => {
  assert.ok(lane('photography').length >= 20);
  assert.ok(lane('photography').includes('src/assets/photo/**'));
  assert.ok(lane('photography').includes('scripts/photo/**'));
  assert.ok(lane('release').includes('scripts/release-preflight.mjs'));
  assert.ok(ownership.frozen_paths.length >= 10);
});

test('a gated file is an exception for its package, reserved by the photography lane, and in no other write set', () => {
  const gated = wave7.filter((a) => (a.gated ?? []).length > 0);
  assert.deepEqual(gated.map((a) => a.owner), ['WP-42', 'WP-43']);
  for (const a of gated) {
    for (const file of a.gated ?? []) {
      assert.ok(exceptionPaths(a.owner).includes(file), `${a.owner} gated ${file} must also be an exception`);
      assert.ok(lane('photography').some((r) => overlaps(file, r)), `${file} is gated because the photography lane reserves it`);
      for (const other of wave7) {
        if (other.owner === a.owner) continue;
        for (const p of other.write_set) assert.equal(overlaps(file, p, [], other.exclude), false, `${other.owner} ${p} must not reach ${a.owner} gated ${file}`);
      }
    }
  }
});

test('a gated file is not in the owner write set glob by accident: it is edited only through its exception', () => {
  for (const a of wave7.filter((w) => (w.gated ?? []).length > 0)) {
    for (const file of a.gated ?? []) {
      const rest = violations([file], a.owner, ownership);
      assert.deepEqual(rest, [], `${a.owner} may edit its gated file ${file}`);
    }
  }
});

test('the package-owned exclusions are real: WP-45 reaches layouts and components but not the photography files', () => {
  const wp45 = wave7.find((a) => a.owner === 'WP-45');
  assert.ok(wp45 !== undefined);
  assert.deepEqual(wp45.exclude, ['src/components/ui/Card.astro', 'src/components/hero/HeroAtlas.astro', 'src/components/hero/HeroEditorial.astro']);
  // The glob that needs the carve-out must exist, or the exclusion is dead configuration.
  assert.ok(wp45.exclude?.every((file) => wp45.write_set.some((p) => matches(file, [p]))));
});
