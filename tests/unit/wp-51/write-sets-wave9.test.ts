import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { overlaps } from '../../../.astro-magazine/plans/wave8/lib.mjs';
import { matches, ownerOf, violations } from '../../../scripts/check-ownership.mjs';

// Wave 9 (WP-51, issue #72): the redesign packages WP-51 to WP-58 are registered once, ahead of the edits (W8-30 pattern, W9-1;
// WP-58 joined stage 2 with the positioning change, W9-12).
// The proof reuses the wave 8 glob comparison (`overlaps` from .astro-magazine/plans/wave8/lib.mjs). It does not reuse wave 8's
// `check()`, because that function hard-codes the wave 8 roles (WP-60 alone on the wave 8 frozen files, nobody in the photography
// lane), while wave 9 deliberately reaches both through registered exceptions. The wave 7 and wave 8 tests filter WP-4x/WP-50 and
// WP-6x..9x, so this test is scoped to /^WP-5[1-9]$/ and leaves them untouched.

interface Assignment {
  owner: string;
  branch: string;
  stage?: number;
  write_set: string[];
  exclude?: string[];
  lane_exceptions?: string[];
}
interface Exception {
  wp: string;
  path: string;
  reason: string;
}
interface Ownership {
  assignments: Assignment[];
  exceptions: Exception[];
  always_allowed: string[];
  frozen_paths: string[];
  frozen_paths_wave8: string[];
  frozen_paths_wave8_owners: string[];
  lanes: { photography: string[]; release: string[] };
}
interface Wave9Map {
  handoffs: { path: string; from: string; to: string }[];
  superseded: Record<string, string[]>;
  workPackages: { id: string; stage: number; branch: string; title: string; writes: string[]; laneExceptions: string[]; exceptions: string[] }[];
}

const root = new URL('../../../', import.meta.url);
const ownership = JSON.parse(readFileSync(new URL('.astro-magazine/ownership.json', root), 'utf8')) as Ownership;
const committed = JSON.parse(readFileSync(new URL('.astro-magazine/plans/wave9/writesets.json', root), 'utf8')) as Wave9Map;
const wave9 = ownership.assignments.filter((a) => /^WP-5[1-8]$/.test(a.owner));

const exceptionPaths = (owner: string): string[] => ownership.exceptions.filter((e) => e.wp === owner).map((e) => e.path);
const lane = (name: 'photography' | 'release'): string[] => {
  const registered = ownership.assignments.filter((a) => (name === 'photography' ? /^WP-12/.test(a.owner) : a.owner === 'WP-30')).flatMap((a) => a.write_set);
  return [...new Set([...ownership.lanes[name], ...registered])];
};
const isHandoff = (x: string, px: string, y: string, py: string): boolean =>
  committed.handoffs.some((h) => {
    const pair = (h.from === x && h.to === y) || (h.from === y && h.to === x);
    return pair && px === h.path && py === h.path;
  });

/** A concrete path that the glob matches, for the ownership checks. */
const sample = (glob: string): string => glob.replace(/\*\*/g, 'sample/file.ts').replace(/\*/g, 'x');

/** Pairs of wave 9 patterns that can meet, minus the declared hand-offs. */
function clashes(sets: readonly Assignment[]): string[] {
  const found: string[] = [];
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      const x = sets[i];
      const y = sets[j];
      if (x === undefined || y === undefined) continue;
      for (const px of x.write_set) {
        for (const py of y.write_set) {
          if (overlaps(px, py) && !isHandoff(x.owner, px, y.owner, py)) found.push(`${x.owner} ${px} <-> ${y.owner} ${py}`);
        }
      }
    }
  }
  return found;
}

/** Write-set patterns that reach a protected list without an exception that names that exact pattern. */
function unguarded(sets: readonly Assignment[], protectedList: readonly string[], label: string): string[] {
  return sets.flatMap((a) => {
    const named = exceptionPaths(a.owner);
    return a.write_set.flatMap((p) => protectedList.filter((f) => overlaps(p, f) && !named.some((e) => e === p || matches(sample(p), [e]))).map((f) => `${a.owner} ${p} <-> ${label} ${f}`));
  });
}

test('the eight wave 9 packages are registered in number order with their stages and branches that map back to them', () => {
  assert.deepEqual(wave9.map((a) => a.owner), ['WP-51', 'WP-52', 'WP-53', 'WP-54', 'WP-55', 'WP-56', 'WP-57', 'WP-58']);
  assert.deepEqual(wave9.map((a) => a.stage), [0, 1, 2, 2, 2, 2, 3, 2]);
  for (const a of wave9) {
    assert.equal(ownerOf(a.branch), a.owner, `${a.owner} branch`);
    assert.equal(ownerOf(`${a.branch}-redesign`), a.owner, `${a.owner} slugged branch`);
    assert.ok(a.write_set.length > 0, `${a.owner} has a write set`);
    assert.equal(new Set(a.write_set).size, a.write_set.length, `${a.owner} lists each pattern once`);
  }
});

test('the registered assignments equal the committed wave 9 map, so the proof and the policy cannot drift', () => {
  assert.deepEqual(committed.workPackages.map((w) => w.id), wave9.map((a) => a.owner));
  for (const w of committed.workPackages) {
    const a = wave9.find((x) => x.owner === w.id);
    assert.ok(a !== undefined, `${w.id} is registered`);
    assert.deepEqual(a.write_set, w.writes, `${w.id} write set`);
    assert.equal(a.stage, w.stage, `${w.id} stage`);
    assert.equal(a.branch, w.branch, `${w.id} branch`);
    assert.deepEqual(a.lane_exceptions ?? [], w.laneExceptions, `${w.id} lane exceptions`);
    assert.deepEqual(exceptionPaths(w.id), w.exceptions, `${w.id} exceptions`);
  }
});

test('wave 9 write sets are pairwise disjoint apart from the declared stage-ordered hand-offs', () => {
  assert.deepEqual(clashes(wave9), []);
});

test('every hand-off runs from an earlier stage to a later one and names a pattern both sides really hold', () => {
  const stage = (owner: string): number => wave9.find((a) => a.owner === owner)?.stage ?? -1;
  for (const h of committed.handoffs) {
    assert.ok(stage(h.from) < stage(h.to), `${h.path}: ${h.from} finishes before ${h.to} starts`);
    assert.ok(wave9.find((a) => a.owner === h.from)?.write_set.includes(h.path), `${h.from} holds ${h.path}`);
    const to = wave9.find((a) => a.owner === h.to);
    assert.ok(to?.write_set.includes(h.path) || exceptionPaths(h.to).includes(h.path), `${h.to} holds ${h.path}`);
  }
});

test('the stage-2 page packages share nothing at all, hand-offs included', () => {
  const stage2 = wave9.filter((a) => a.stage === 2);
  assert.deepEqual(stage2.map((a) => a.owner), ['WP-53', 'WP-54', 'WP-55', 'WP-56', 'WP-58']);
  for (const x of stage2) for (const y of stage2) {
    if (x.owner >= y.owner) continue;
    for (const px of x.write_set) for (const py of y.write_set) assert.equal(overlaps(px, py), false, `${x.owner} ${px} <-> ${y.owner} ${py}`);
  }
});

test('frozen, wave 8 frozen, photography-lane and release-lane paths are reached only through a registered exception', () => {
  assert.deepEqual(unguarded(wave9, ownership.frozen_paths, 'FROZEN'), []);
  assert.deepEqual(unguarded(wave9, ownership.frozen_paths_wave8, 'FROZEN-WAVE8'), []);
  assert.deepEqual(unguarded(wave9, lane('release'), 'RELEASE-LANE'), []);
  // A photography-lane file inside a broad glob is named by an exception and listed as a lane exception (W7-9 pattern).
  for (const a of wave9) {
    for (const file of lane('photography').filter((f) => !f.includes('*'))) {
      if (!matches(file, a.write_set)) continue;
      assert.ok(exceptionPaths(a.owner).includes(file), `${a.owner} reaches the photography-lane file ${file} through an exception`);
      assert.ok((a.lane_exceptions ?? []).includes(file), `${a.owner} lists ${file} as a lane exception`);
    }
    for (const p of a.write_set) for (const r of lane('photography').filter((f) => f.includes('*'))) assert.equal(overlaps(p, r), false, `${a.owner} ${p} <-> PHOTO-LANE ${r}`);
  }
});

test('the stale wp/62 and WP-48 claims are superseded: their narrowed sets meet no wave 9 write set (W9-3)', () => {
  for (const [owner, keep] of Object.entries(committed.superseded)) {
    const a = ownership.assignments.find((x) => x.owner === owner);
    assert.deepEqual(a?.write_set, keep, `${owner} is narrowed in ownership.json`);
    for (const w of wave9) for (const p of w.write_set) for (const k of keep) assert.equal(overlaps(p, k), false, `${w.owner} ${p} <-> superseded ${owner} ${k}`);
  }
  // The superseded branches lose the paths in the checker itself, not only on paper.
  assert.equal(violations(['src/pages/index.astro'], 'WP-62', ownership).length, 1);
  assert.equal(violations(['src/pages/about/frameworks/ubf.astro'], 'WP-48', ownership).length, 1);
  assert.deepEqual(violations(['src/pages/index.astro'], 'WP-53', ownership), []);
  assert.deepEqual(violations(['src/pages/about/frameworks/ubf.astro'], 'WP-55', ownership), []);
  assert.deepEqual(violations(['src/pages/who-we-work-with/index.astro', 'src/data/sales/cta.ts'], 'WP-58', ownership), []);
});

test('ownership has teeth: each package may touch one file per pattern of its own set and is refused another package file', () => {
  for (const a of wave9) {
    assert.deepEqual(violations(a.write_set.map(sample), a.owner, ownership), [], `${a.owner} touching its own files`);
    const foreign = wave9
      .filter((other) => other.owner !== a.owner)
      .flatMap((other) => other.write_set.map(sample))
      .find((file) => !matches(file, [...a.write_set, ...exceptionPaths(a.owner)]));
    assert.ok(foreign !== undefined, `${a.owner}: a foreign file exists`);
    assert.equal(violations([foreign], a.owner, ownership).length, 1, `${a.owner} touching ${foreign}`);
  }
});

test('the checker has teeth: an injected collision, a missing exception and a lane intrusion are each reported', () => {
  const inject = (owner: string, pattern: string): Assignment[] => wave9.map((a) => (a.owner === owner ? { ...a, write_set: [...a.write_set, pattern] } : a));
  assert.ok(clashes(inject('WP-54', 'src/pages/about/**')).some((c) => c.includes('WP-55')), 'two page packages on one family');
  assert.ok(clashes(inject('WP-56', 'src/styles/layout.css')).some((c) => c.includes('WP-51')), 'a family package on a shared stylesheet');
  assert.ok(clashes(inject('WP-53', 'src/components/visuals/Band.astro')).some((c) => c.includes('WP-52')), 'a family package in the visuals library');
  assert.ok(clashes(inject('WP-52', '.astro-magazine/plans/wave9/writesets.json')).length > 0, 'a hand-off is only valid between its named packages');
  assert.ok(unguarded(inject('WP-56', 'src/data/nav.ts'), ownership.frozen_paths, 'FROZEN').length > 0, 'frozen file with no exception');
  assert.ok(unguarded(inject('WP-53', 'src/components/forms/**'), ownership.frozen_paths_wave8, 'FROZEN-WAVE8').length > 0, 'wave 8 frozen with no exception');
  assert.ok(unguarded(inject('WP-54', '.gitlab-ci.yml'), lane('release'), 'RELEASE-LANE').length > 0, 'release lane with no exception');
  assert.equal(violations(['src/data/nav.ts'], 'WP-55', ownership)[0]?.reason, 'frozen path');
  assert.equal(violations(['src/components/forms/ContactForm.astro'], 'WP-55', ownership)[0]?.reason, 'wave 8 frozen path');
});

test('the lists the proof compares against are not empty, so it cannot pass by comparing against nothing', () => {
  assert.ok(ownership.frozen_paths.length >= 20);
  assert.ok(ownership.frozen_paths_wave8.includes('src/layouts/**'));
  assert.ok(lane('photography').includes('src/components/home/HomeHero.astro'));
  assert.ok(lane('release').includes('.gitlab-ci.yml'));
  assert.ok(committed.handoffs.length >= 1);
});

test('WP-51 holds a registered exception for every frozen and wave 8 frozen pattern in its set, one entry each', () => {
  const wp51 = wave9.find((a) => a.owner === 'WP-51');
  assert.ok(wp51 !== undefined);
  const registered = exceptionPaths('WP-51');
  const frozenInSet = wp51.write_set.filter((p) => [...ownership.frozen_paths, ...ownership.frozen_paths_wave8].some((f) => overlaps(p, f)));
  for (const p of frozenInSet) assert.ok(registered.includes(p), `exception for ${p}`);
  assert.equal(new Set(registered).size, registered.length, 'no duplicate exception');
  for (const e of ownership.exceptions.filter((x) => /^WP-5[1-8]$/.test(x.wp))) assert.match(e.reason, /\S{3,}/, `${e.wp} ${e.path} carries a reason`);
});
