import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { check, matchesPath, overlaps } from '../../../.astro-magazine/plans/wave8/lib.mjs';
import { matches, violations } from '../../../scripts/check-ownership.mjs';

// Wave 8 runs up to ten authoring agents and five pipelines at once (plan 4.2). Their write sets are proved pairwise disjoint within each
// pool (P0b, P1, P2) and clear of the frozen, wave 8 frozen, photography and release lists (W8-1). The wave 7 test in tests/unit/wp-40
// filters WP-4x and WP-50, so this test is scoped to WP-60 to WP-99 and leaves it untouched.

interface Assignment {
  owner: string;
  stage?: number;
  pools?: string[];
  write_set: string[];
  exclude?: string[];
  exceptions_declared?: string[];
  serialize_with_release?: string[];
}
interface Ownership {
  assignments: Assignment[];
  exceptions: { wp: string; path: string; reason: string }[];
  always_allowed: string[];
  frozen_paths: string[];
  frozen_paths_wave8: string[];
  frozen_paths_wave8_owners: string[];
  lanes: { photography: string[]; release: string[] };
}
interface WriteSetMap {
  frozen: string[];
  frozenWave8: string[];
  photographyLane: string[];
  releaseLane: string[];
  workPackages: {
    id: string;
    stage: number;
    pools: string[];
    writes: string[];
    exclude?: string[];
    exceptionsDeclared?: string[];
    serializeWithRelease?: string[];
    frozenExceptions?: string[];
  }[];
}

const root = new URL('../../../', import.meta.url);
const ownership = JSON.parse(readFileSync(new URL('.astro-magazine/ownership.json', root), 'utf8')) as Ownership;
const committed = JSON.parse(readFileSync(new URL('.astro-magazine/plans/wave8/writesets.json', root), 'utf8')) as WriteSetMap;
const wave8 = ownership.assignments.filter((a) => /^WP-(?:6\d|7\d|8\d|9\d)$/.test(a.owner));

const exceptionPaths = (owner: string): string[] => ownership.exceptions.filter((e) => e.wp === owner).map((e) => e.path);
const lane = (name: 'photography' | 'release'): string[] => {
  const registered = ownership.assignments.filter((a) => (name === 'photography' ? /^WP-12/.test(a.owner) : a.owner === 'WP-30')).flatMap((a) => a.write_set);
  return [...new Set([...ownership.lanes[name], ...registered])];
};

function buildMap(assignments: readonly Assignment[]): WriteSetMap {
  return {
    frozen: ownership.frozen_paths,
    frozenWave8: ownership.frozen_paths_wave8,
    photographyLane: lane('photography'),
    releaseLane: lane('release'),
    workPackages: assignments.map((a) => ({
      id: a.owner,
      stage: a.stage ?? 1,
      pools: a.pools ?? [],
      writes: a.write_set,
      exclude: a.exclude ?? [],
      exceptionsDeclared: a.exceptions_declared ?? [],
      serializeWithRelease: a.serialize_with_release ?? [],
      // Only an exception that names a pattern of the write set counts as a registered frozen exception (a declared one waits for its owner).
      frozenExceptions: exceptionPaths(a.owner).filter((p) => a.write_set.includes(p)),
    })),
  };
}

/** A concrete path that the glob matches, for the scratch-branch checks. */
const sample = (glob: string): string => glob.replace(/\*\*/g, 'sample/file.ts').replace(/\*/g, 'x');

test('all thirty-two wave 8 packages are registered with a stage, pools and a write set', () => {
  assert.equal(wave8.length, 32);
  assert.deepEqual(wave8.map((a) => a.owner), committed.workPackages.map((w) => w.id));
  assert.deepEqual(wave8.filter((a) => a.stage === 0).map((a) => a.owner), ['WP-60', 'WP-61', 'WP-71']);
  assert.deepEqual(wave8.filter((a) => a.stage === 2).map((a) => a.owner), ['WP-90', 'WP-99']);
  for (const a of wave8) {
    assert.ok((a.pools ?? []).length > 0, `${a.owner} names its pools`);
    assert.ok(a.write_set.length > 0, `${a.owner} has a write set`);
  }
});

test('the registered assignments equal the committed checker input, so the proof and the policy cannot drift', () => {
  for (const w of committed.workPackages) {
    const a = wave8.find((x) => x.owner === w.id);
    assert.ok(a !== undefined, `${w.id} is registered`);
    assert.deepEqual(a.write_set, w.writes, `${w.id} write set`);
    assert.deepEqual(a.pools, w.pools, `${w.id} pools`);
    assert.deepEqual(a.exclude ?? [], w.exclude ?? [], `${w.id} exclude`);
    assert.deepEqual(a.exceptions_declared ?? [], w.exceptionsDeclared ?? [], `${w.id} declared exceptions`);
  }
  assert.deepEqual(ownership.frozen_paths_wave8, committed.frozenWave8);
  assert.equal(ownership.frozen_paths_wave8.length, 15);
});

test('pool members are pairwise disjoint and avoid the frozen, wave 8 frozen, photography and release lists (W8-1)', () => {
  const { failures } = check(buildMap(wave8));
  assert.deepEqual(failures, []);
});

test('the lists the proof compares against are not empty, so it cannot pass by comparing against nothing', () => {
  assert.ok(ownership.frozen_paths.length >= 20);
  assert.equal(ownership.frozen_paths_wave8.length, 15);
  assert.ok(lane('photography').length >= 19);
  assert.ok(lane('photography').includes('src/assets/photo/**'));
  assert.ok(lane('release').includes('scripts/release-preflight.mjs'));
  assert.ok(lane('release').includes('.gitlab-ci.yml'), 'the CI file is in the release lane, serialized with WP-60 (W8-11)');
});

test('the checker has teeth: an injected conflict of each kind is reported', () => {
  const inject = (owner: string, pattern: string): string[] => {
    const set = wave8.map((a) => (a.owner === owner ? { ...a, write_set: [...a.write_set, pattern] } : a));
    return check(buildMap(set)).failures;
  };
  assert.ok(inject('WP-65', 'src/content/pages/investors/**').some((f) => f.includes('WP-64')), 'pool pair');
  assert.ok(inject('WP-66', 'src/content/insights/legal/**').some((f) => f.includes('WP-67')), 'two article packages on one desk folder');
  assert.ok(inject('WP-63', 'src/content.config.ts').some((f) => f.includes('FROZEN ')), 'frozen file');
  assert.ok(inject('WP-62', 'src/layouts/ArticleLayout.astro').some((f) => f.includes('FROZEN-WAVE8')), 'wave 8 frozen file');
  assert.ok(inject('WP-65', 'src/components/forms/PartnerEnquiryForm.astro').some((f) => f.includes('FROZEN-WAVE8')), 'forms components');
  assert.ok(inject('WP-64', 'src/components/cards/**').some((f) => f.includes('PHOTO-LANE')), 'photography lane');
  assert.ok(inject('WP-68', '.gitlab-ci.yml').some((f) => f.includes('RELEASE-LANE')), 'release lane');
  assert.ok(inject('WP-68', '.astro-magazine/release/RELEASE.md').some((f) => f.includes('RELEASE-LANE')), 'counsel register');
  assert.ok(inject('WP-62', 'src/data/nav.ts').some((f) => f.includes('declared exception')), 'a declared exception inside a stage-1 write set');
  assert.ok(inject('WP-90', 'tests/e2e/wave8/wp-62/**').some((f) => f.includes('WP-62')), 'journey suite on a page package suite');
});

test('the committed self-test of the checker passes', () => {
  const selftest = new URL('.astro-magazine/plans/wave8/selftest.mjs', root).pathname;
  const sets = new URL('.astro-magazine/plans/wave8/writesets.json', root).pathname;
  const run = spawnSync(process.execPath, [selftest, sets], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.doesNotMatch(run.stdout, /^FAIL/m);
  assert.match(run.stdout, /baseline map has zero failures/);
});

test('ownership has teeth: each assignment may touch one file per glob of its own set and nothing else', () => {
  for (const a of wave8) {
    const own = a.write_set.map(sample);
    assert.deepEqual(violations(own, a.owner, ownership), [], `${a.owner} touching its own files`);
    // Another package's file is outside this package's write set.
    const foreign = wave8
      .filter((other) => other.owner !== a.owner)
      .flatMap((other) => other.write_set.map(sample))
      .find((file) => !matches(file, [...a.write_set, ...exceptionPaths(a.owner)]));
    assert.ok(foreign !== undefined, `${a.owner}: a foreign file exists`);
    assert.equal(violations([foreign], a.owner, ownership).length, 1, `${a.owner} touching ${foreign}`);
  }
});

test('a wave 8 frozen file with no exception fails for every package but WP-60, and a frozen file with no exception fails for everyone', () => {
  for (const a of wave8) {
    for (const glob of ownership.frozen_paths_wave8) {
      const file = sample(glob);
      const named = matches(file, exceptionPaths(a.owner));
      const found = violations([file], a.owner, ownership);
      if (ownership.frozen_paths_wave8_owners.includes(a.owner)) {
        assert.deepEqual(found, [], `${a.owner} owns the wave 8 frozen file ${file}`);
      } else if (!named) {
        assert.equal(found.length, 1, `${a.owner} touching ${file}`);
        assert.equal(found[0]?.reason, 'wave 8 frozen path');
      }
    }
    for (const glob of ownership.frozen_paths) {
      if (matchesPath(glob, 'CNAME') || glob.startsWith('.claude')) continue;
      const file = sample(glob);
      if (matches(file, exceptionPaths(a.owner))) continue;
      assert.equal(violations([file], a.owner, ownership)[0]?.reason, 'frozen path', `${a.owner} touching ${file}`);
    }
  }
});

test('WP-60 holds the registered exception for every frozen file it edits, one entry each', () => {
  const wp60 = wave8.find((a) => a.owner === 'WP-60');
  assert.ok(wp60 !== undefined);
  const registered = exceptionPaths('WP-60');
  const frozenInSet = wp60.write_set.filter((p) => ownership.frozen_paths.some((f) => overlaps(p, f)));
  assert.equal(frozenInSet.length, 14);
  for (const p of frozenInSet) assert.ok(registered.includes(p), `exception for ${p}`);
  assert.equal(new Set(registered).size, registered.length, 'no duplicate exception');
});
