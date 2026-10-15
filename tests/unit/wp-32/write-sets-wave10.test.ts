import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { overlaps } from '../../../.astro-magazine/plans/wave8/lib.mjs';
import { matches, ownerOf, violations } from '../../../scripts/check-ownership.mjs';

// Wave 10 (WP-32, issue #81): the packages WP-32 to WP-38 are registered once, ahead of the edits (W8-30 pattern, D-W10-1).
// The proof reuses the wave 8 glob comparison (`overlaps`). The wave 7, 8 and 9 tests filter other number ranges, so this test is scoped
// to /^WP-3[2-8]$/ and leaves them untouched.

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
interface Wave10Map {
  sharedExceptions: string[];
  workPackages: { id: string; stage: number; branch: string; title: string; writes: string[]; excludes: string[]; laneExceptions: string[]; exceptions: string[] }[];
}

const root = new URL('../../../', import.meta.url);
const ownership = JSON.parse(readFileSync(new URL('.astro-magazine/ownership.json', root), 'utf8')) as Ownership;
const committed = JSON.parse(readFileSync(new URL('.astro-magazine/plans/wave10/writesets.json', root), 'utf8')) as Wave10Map;
const wave10 = ownership.assignments.filter((a) => /^WP-3[2-8]$/.test(a.owner));

const exceptionPaths = (owner: string): string[] => ownership.exceptions.filter((e) => e.wp === owner).map((e) => e.path);
const lane = (name: 'photography' | 'release'): string[] => {
  const registered = ownership.assignments.filter((a) => (name === 'photography' ? /^WP-12/.test(a.owner) : a.owner === 'WP-30')).flatMap((a) => a.write_set);
  return [...new Set([...ownership.lanes[name], ...registered])];
};
const sample = (glob: string): string => glob.replace(/\*\*/g, 'sample/file.ts').replace(/\*/g, 'x');
/** Pairs of wave 10 patterns that can meet, unless one package excludes the other's pattern from its own set. */
function clashes(sets: readonly Assignment[]): string[] {
  const found: string[] = [];
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      const x = sets[i];
      const y = sets[j];
      if (x === undefined || y === undefined) continue;
      for (const px of x.write_set) {
        for (const py of y.write_set) {
          if (!overlaps(px, py)) continue;
          if ((x.exclude ?? []).includes(py) || (y.exclude ?? []).includes(px)) continue;
          found.push(`${x.owner} ${px} <-> ${y.owner} ${py}`);
        }
      }
    }
  }
  return found;
}

function unguarded(sets: readonly Assignment[], protectedList: readonly string[], label: string): string[] {
  return sets.flatMap((a) => {
    const named = exceptionPaths(a.owner);
    return a.write_set.flatMap((p) => protectedList.filter((f) => overlaps(p, f) && !named.some((e) => e === p || matches(sample(p), [e]))).map((f) => `${a.owner} ${p} <-> ${label} ${f}`));
  });
}

test('the seven wave 10 packages are registered in number order with stages and branches that map back to them', () => {
  assert.deepEqual(wave10.map((a) => a.owner), ['WP-32', 'WP-33', 'WP-34', 'WP-35', 'WP-36', 'WP-37', 'WP-38']);
  assert.deepEqual(wave10.map((a) => a.stage), [0, 1, 1, 1, 1, 2, 1]);
  for (const a of wave10) {
    assert.equal(ownerOf(a.branch), a.owner, `${a.owner} branch`);
    assert.equal(ownerOf(`${a.branch}-slug`), a.owner, `${a.owner} slugged branch`);
    assert.ok(a.write_set.length > 0, `${a.owner} has a write set`);
    assert.equal(new Set(a.write_set).size, a.write_set.length, `${a.owner} lists each pattern once`);
  }
  assert.equal(ownerOf('wp/32-governance'), 'WP-32');
  assert.equal(ownerOf('wp/36-html5'), 'WP-36');
});

test('every package owns its tests, e2e specs, handoff and sources file', () => {
  for (const a of wave10) {
    const n = a.owner.slice(3);
    for (const p of [`tests/unit/wp-${n}/**`, `tests/e2e/wp-${n}*.spec.ts`, `.astro-magazine/handoffs/wp-${n}*`, `.astro-magazine/sources/wp-${n}.json`]) assert.ok(a.write_set.includes(p), `${a.owner} holds ${p}`);
  }
});

test('the registered assignments equal the committed wave 10 map, so the proof and the policy cannot drift', () => {
  assert.deepEqual(committed.workPackages.map((w) => w.id), wave10.map((a) => a.owner));
  for (const w of committed.workPackages) {
    const a = wave10.find((x) => x.owner === w.id);
    assert.ok(a !== undefined, `${w.id} is registered`);
    assert.deepEqual(a.write_set, w.writes, `${w.id} write set`);
    assert.deepEqual(a.exclude ?? [], w.excludes, `${w.id} excludes`);
    assert.equal(a.stage, w.stage, `${w.id} stage`);
    assert.equal(a.branch, w.branch, `${w.id} branch`);
    assert.deepEqual(a.lane_exceptions ?? [], w.laneExceptions, `${w.id} lane exceptions`);
    assert.deepEqual(exceptionPaths(w.id), w.exceptions, `${w.id} exceptions`);
  }
});

test('the write sets named in the orchestration brief are registered exactly', () => {
  const set = (id: string): string[] => wave10.find((a) => a.owner === id)?.write_set ?? [];
  assert.deepEqual(set('WP-33').slice(0, 5), ['src/pages/ecosystem/**', 'src/content/pages/ecosystem/**', 'src/data/ecosystem/**', 'src/components/ecosystem/**', 'src/scripts/ecosystem*.ts']);
  assert.deepEqual(set('WP-34').slice(0, 5), ['src/pages/sbir-sttr/**', 'src/content/pages/sbir-sttr/**', 'src/data/sbir/**', 'src/components/sbir/**', 'src/scripts/sbir*.ts']);
  assert.deepEqual(set('WP-35').slice(0, 5), ['src/pages/data/**', 'src/content/pages/data/**', 'src/data/datasets/**', 'src/components/visuals/charts/**', 'src/scripts/charts*.ts']);
  assert.deepEqual(set('WP-36').slice(0, 4), ['src/components/visuals/**', 'src/assets/visuals/**', 'src/scripts/scene*/**', 'src/scripts/motion*.ts']);
  assert.deepEqual(set('WP-38').slice(0, 4), ['src/content/insights/**', 'src/content/guides/**', 'src/content/playbooks/**', 'src/assets/insights/**']);
  assert.ok(set('WP-37').includes('src/pages/index.astro') && set('WP-37').includes('src/content/pages/who-we-work-with/**'));
  assert.deepEqual(wave10.find((a) => a.owner === 'WP-36')?.exclude, ['src/components/visuals/charts/**']);
});

test('wave 10 write sets are pairwise disjoint (WP-36 excludes the chart folder WP-35 owns)', () => {
  assert.deepEqual(clashes(wave10), []);
});

test('frozen, wave 8 frozen and release-lane paths are reached only through a registered exception', () => {
  assert.deepEqual(unguarded(wave10, ownership.frozen_paths, 'FROZEN'), []);
  assert.deepEqual(unguarded(wave10, ownership.frozen_paths_wave8, 'FROZEN-WAVE8'), []);
  assert.deepEqual(unguarded(wave10, lane('release'), 'RELEASE-LANE'), []);
});

test('photography-lane files inside a wave 10 glob are named by an exception and listed as a lane exception (W7-9 pattern)', () => {
  for (const a of wave10) {
    for (const file of lane('photography').filter((f) => !f.includes('*'))) {
      if (!matches(file, [...a.write_set, ...exceptionPaths(a.owner)])) continue;
      assert.ok(exceptionPaths(a.owner).includes(file), `${a.owner} reaches the photography-lane file ${file} through an exception`);
      assert.ok((a.lane_exceptions ?? []).includes(file), `${a.owner} lists ${file} as a lane exception`);
    }
    for (const p of a.write_set) for (const r of lane('photography').filter((f) => f.includes('*'))) assert.equal(overlaps(p, r), false, `${a.owner} ${p} <-> PHOTO-LANE ${r}`);
  }
});

test('the exceptions other packages need are registered: head and package files for WP-36, home and program for WP-37, routes blocks for WP-33, 34 and 35', () => {
  for (const p of ['package.json', 'package-lock.json', 'src/layouts/BaseLayout.astro', 'src/styles/motion.css', 'src/components/seo/SpeculationRules.astro', 'src/lib/seo.ts']) {
    assert.ok(exceptionPaths('WP-36').includes(p), `WP-36 ${p}`);
  }
  for (const p of ['src/components/home/**', 'src/components/program/**', 'src/pages/program/who-its-for.astro', 'src/components/home/HomeHero.astro']) assert.ok(exceptionPaths('WP-37').includes(p), `WP-37 ${p}`);
  for (const wp of ['WP-33', 'WP-34', 'WP-35']) {
    const e = ownership.exceptions.find((x) => x.wp === wp && x.path === 'src/data/routes.ts');
    assert.ok(e !== undefined, `${wp} holds a routes.ts exception`);
    assert.match(e.reason, /BEGIN WP-3\d [a-z-]+ block/, `${wp} exception is limited to its marked block`);
  }
  const routes = readFileSync(new URL('src/data/routes.ts', root), 'utf8');
  for (const block of ['WP-33 ecosystem', 'WP-34 sbir-sttr', 'WP-35 data']) {
    assert.ok(routes.includes(`// BEGIN ${block} block`) && routes.includes(`// END ${block} block`), `${block} block markers in routes.ts`);
  }
});

test('an exception path is shared by several packages only when the committed map lists it as shared', () => {
  const seen = new Map<string, string[]>();
  for (const a of wave10) for (const p of exceptionPaths(a.owner)) seen.set(p, [...(seen.get(p) ?? []), a.owner]);
  const shared = [...seen].filter(([, owners]) => owners.length > 1).map(([p]) => p);
  for (const p of shared) assert.ok(committed.sharedExceptions.includes(p), `${p} is shared by ${(seen.get(p) ?? []).join(', ')} without being listed`);
  for (const a of wave10) assert.equal(new Set(exceptionPaths(a.owner)).size, exceptionPaths(a.owner).length, `${a.owner} has no duplicate exception`);
});

test('every wave 10 exception carries a reason, and the WP-32 exceptions cover each frozen file in its set', () => {
  for (const e of ownership.exceptions.filter((x) => /^WP-3[2-8]$/.test(x.wp))) assert.match(e.reason, /\S{3,}/, `${e.wp} ${e.path} carries a reason`);
  const wp32 = wave10.find((a) => a.owner === 'WP-32');
  assert.ok(wp32 !== undefined);
  const frozenInSet = wp32.write_set.filter((p) => [...ownership.frozen_paths, ...ownership.frozen_paths_wave8].some((f) => overlaps(p, f)));
  assert.ok(frozenInSet.length >= 5);
  for (const p of frozenInSet) assert.ok(exceptionPaths('WP-32').includes(p), `exception for ${p}`);
});

test('ownership has teeth: each package may touch one file per pattern of its own set and is refused another package file', () => {
  for (const a of wave10) {
    const own = a.write_set.map(sample).filter((f) => !matches(f, a.exclude ?? []));
    assert.deepEqual(violations(own, a.owner, ownership), [], `${a.owner} touching its own files`);
    const foreign = wave10
      .filter((other) => other.owner !== a.owner)
      .flatMap((other) => other.write_set.map(sample))
      .find((file) => !matches(file, [...a.write_set, ...exceptionPaths(a.owner)]));
    assert.ok(foreign !== undefined, `${a.owner}: a foreign file exists`);
    assert.equal(violations([foreign], a.owner, ownership).length, 1, `${a.owner} touching ${foreign}`);
  }
  // WP-36 cannot edit a chart file and WP-35 cannot edit a scene file, although both sit under src/components/visuals/.
  assert.equal(violations(['src/components/visuals/charts/BarChart.astro'], 'WP-36', ownership).length, 1);
  assert.deepEqual(violations(['src/components/visuals/charts/MapChart.astro'], 'WP-35', ownership), []);
  assert.equal(violations(['src/components/visuals/Scene.astro'], 'WP-35', ownership).length, 1);
  assert.deepEqual(violations(['src/components/visuals/Scene.astro'], 'WP-36', ownership), []);
});

test('the checker has teeth: an injected collision and a missing frozen-file exception are reported', () => {
  const inject = (owner: string, pattern: string): Assignment[] => wave10.map((a) => (a.owner === owner ? { ...a, write_set: [...a.write_set, pattern] } : a));
  assert.ok(clashes(inject('WP-37', 'src/content/insights/**')).some((c) => c.includes('WP-38')), 'two packages on the insights');
  assert.ok(clashes(inject('WP-35', 'src/components/visuals/Scene.astro')).some((c) => c.includes('WP-36')), 'a chart package in the scene library');
  assert.ok(unguarded(inject('WP-33', 'src/data/nav.ts'), ownership.frozen_paths, 'FROZEN').length > 0, 'frozen file with no exception');
  assert.ok(unguarded(inject('WP-34', 'src/layouts/**'), ownership.frozen_paths_wave8, 'FROZEN-WAVE8').length > 0, 'wave 8 frozen with no exception');
  assert.equal(violations(['src/data/nav.ts'], 'WP-33', ownership)[0]?.reason, 'frozen path');
  assert.equal(violations(['package.json'], 'WP-35', ownership)[0]?.reason, 'frozen path');
  assert.deepEqual(violations(['package.json', 'package-lock.json', 'src/layouts/BaseLayout.astro'], 'WP-36', ownership), []);
});

test('the lists the proof compares against are not empty, so it cannot pass by comparing against nothing', () => {
  assert.ok(ownership.frozen_paths.length >= 20);
  assert.ok(ownership.frozen_paths_wave8.includes('src/layouts/**'));
  assert.ok(lane('photography').includes('src/components/home/HomeHero.astro'));
  assert.ok(lane('release').includes('.gitlab-ci.yml'));
});
