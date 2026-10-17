import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { overlaps } from '../../../.astro-magazine/plans/wave8/lib.mjs';
import { matches, ownerOf, violations } from '../../../scripts/check-ownership.mjs';

// Wave 10 (WP-32, issue #81): the packages WP-22 to WP-26 are registered once, ahead of the edits (W8-30 pattern, D-W10-1).
// The proof reuses the wave 8 glob comparison (`overlaps`). The wave 7, 8 and 9 tests filter other number ranges, so this test is scoped
// to /^WP-2[2-6]$/ and leaves them untouched.

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
interface Wave11Map {
  sharedExceptions: string[];
  workPackages: { id: string; stage: number; branch: string; title: string; writes: string[]; excludes: string[]; laneExceptions: string[]; exceptions: string[] }[];
}

const root = new URL('../../../', import.meta.url);
const ownership = JSON.parse(readFileSync(new URL('.astro-magazine/ownership.json', root), 'utf8')) as Ownership;
const committed = JSON.parse(readFileSync(new URL('.astro-magazine/plans/wave11/writesets.json', root), 'utf8')) as Wave11Map;
const wave11 = ownership.assignments.filter((a) => /^WP-2[2-6]$/.test(a.owner));

const exceptionPaths = (owner: string): string[] => ownership.exceptions.filter((e) => e.wp === owner).map((e) => e.path);
const lane = (name: 'photography' | 'release'): string[] => {
  const registered = ownership.assignments.filter((a) => (name === 'photography' ? /^WP-12/.test(a.owner) : a.owner === 'WP-30')).flatMap((a) => a.write_set);
  return [...new Set([...ownership.lanes[name], ...registered])];
};
const sample = (glob: string): string => glob.replace(/\*\*/g, 'sample/file.ts').replace(/\*/g, 'x');
/** Pairs of wave 11 patterns that can meet, unless one package excludes the other's pattern from its own set. */
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

test('the five wave 11 packages are registered in number order with stages and branches that map back to them', () => {
  assert.deepEqual(wave11.map((a) => a.owner), ['WP-22', 'WP-23', 'WP-24', 'WP-25', 'WP-26']);
  assert.deepEqual(wave11.map((a) => a.stage), [1, 1, 1, 1, 2]);
  for (const a of wave11) {
    assert.equal(ownerOf(a.branch), a.owner, `${a.owner} branch`);
    assert.equal(ownerOf(`${a.branch}-slug`), a.owner, `${a.owner} slugged branch`);
    assert.ok(a.write_set.length > 0, `${a.owner} has a write set`);
    assert.equal(new Set(a.write_set).size, a.write_set.length, `${a.owner} lists each pattern once`);
  }
  assert.equal(ownerOf('wp/22-media'), 'WP-22');
  assert.equal(ownerOf('wp/26-figures'), 'WP-26');
});

test('every package owns its tests, e2e specs, handoff and sources file', () => {
  for (const a of wave11) {
    const n = a.owner.slice(3);
    for (const p of [`tests/unit/wp-${n}/**`, `tests/e2e/wp-${n}*.spec.ts`, `.astro-magazine/handoffs/wp-${n}*`, `.astro-magazine/sources/wp-${n}.json`]) assert.ok(a.write_set.includes(p), `${a.owner} holds ${p}`);
  }
});

test('the registered assignments equal the committed wave 11 map, so the proof and the policy cannot drift', () => {
  assert.deepEqual(committed.workPackages.map((w) => w.id), wave11.map((a) => a.owner));
  for (const w of committed.workPackages) {
    const a = wave11.find((x) => x.owner === w.id);
    assert.ok(a !== undefined, `${w.id} is registered`);
    assert.deepEqual(a.write_set, w.writes, `${w.id} write set`);
    assert.deepEqual(a.exclude ?? [], w.excludes, `${w.id} excludes`);
    assert.equal(a.stage, w.stage, `${w.id} stage`);
    assert.equal(a.branch, w.branch, `${w.id} branch`);
    assert.deepEqual(a.lane_exceptions ?? [], w.laneExceptions, `${w.id} lane exceptions`);
    assert.deepEqual(exceptionPaths(w.id), w.exceptions, `${w.id} exceptions`);
  }
});

test('wave 11 write sets are pairwise disjoint', () => {
  assert.deepEqual(clashes(wave11), []);
});

test('frozen, wave 8 frozen and release-lane paths are reached only through a registered exception', () => {
  assert.deepEqual(unguarded(wave11, ownership.frozen_paths, 'FROZEN'), []);
  assert.deepEqual(unguarded(wave11, ownership.frozen_paths_wave8, 'FROZEN-WAVE8'), []);
  assert.deepEqual(unguarded(wave11, lane('release'), 'RELEASE-LANE'), []);
});

test('photography-lane files inside a wave 11 glob are named by an exception and listed as a lane exception (W7-9 pattern)', () => {
  for (const a of wave11) {
    for (const file of lane('photography').filter((f) => !f.includes('*'))) {
      if (!matches(file, [...a.write_set, ...exceptionPaths(a.owner)])) continue;
      assert.ok(exceptionPaths(a.owner).includes(file), `${a.owner} reaches the photography-lane file ${file} through an exception`);
      assert.ok((a.lane_exceptions ?? []).includes(file), `${a.owner} lists ${file} as a lane exception`);
    }
    // D-W11-1: the wave 7 photography lane is closed; WP-22 and WP-25 take its media folders by the orchestration brief, and nothing else may.
    for (const p of a.write_set) for (const r of lane('photography').filter((f) => f.includes('*'))) {
      const released = ['src/components/media/**', '.astro-magazine/media/**'].includes(r) && ['WP-22', 'WP-25'].includes(a.owner);
      assert.equal(overlaps(p, r) && !released, false, `${a.owner} ${p} <-> PHOTO-LANE ${r}`);
    }
  }
});

test('an exception path is shared by several packages only when the committed map lists it as shared', () => {
  const seen = new Map<string, string[]>();
  for (const a of wave11) for (const p of exceptionPaths(a.owner)) seen.set(p, [...(seen.get(p) ?? []), a.owner]);
  const shared = [...seen].filter(([, owners]) => owners.length > 1).map(([p]) => p);
  for (const p of shared) assert.ok(committed.sharedExceptions.includes(p), `${p} is shared by ${(seen.get(p) ?? []).join(', ')} without being listed`);
  for (const a of wave11) assert.equal(new Set(exceptionPaths(a.owner)).size, exceptionPaths(a.owner).length, `${a.owner} has no duplicate exception`);
});

test('the lists the proof compares against are not empty, so it cannot pass by comparing against nothing', () => {
  assert.ok(ownership.frozen_paths.length >= 20);
  assert.ok(ownership.frozen_paths_wave8.includes('src/layouts/**'));
  assert.ok(lane('photography').includes('src/components/home/HomeHero.astro'));
  assert.ok(lane('release').includes('.gitlab-ci.yml'));
});

test('the layout, page and header exceptions named in the orchestration brief are registered, each with a reason', () => {
  const want: Record<string, string[]> = {
    'WP-22': ['src/pages/about/index.astro', 'src/pages/network/index.astro', 'scripts/lib/audit-dist.mjs', 'scripts/lib/serve.mjs'],
    // WP-23 (#89): the WP-87 guide spec's wave 8 image guard gives way to an image-quality check, the /who-we-work-with/ matrix table
    // moves into the shared table-wrap frame, and WP-23 registers both in the policy, the map and this list.
    'WP-23': [
      'src/layouts/BriefLayout.astro',
      'src/layouts/PlaybookLayout.astro',
      'src/layouts/ReferenceLayout.astro',
      'tests/e2e/wave8/wp-87/guides-templates.spec.ts',
      'src/components/program/longevity/SituationMatrix.astro',
      'tests/unit/wp-32b/write-sets-wave11.test.ts',
      '.astro-magazine/ownership.json',
      '.astro-magazine/plans/wave11/writesets.json',
    ],
    // WP-24 (#90): the WP-42 no-JS composer round trip runs with reduced motion (smooth scroll plus JavaScript off never lets
    // Playwright's actionability scroll settle once the tool schematic puts the button below the fold), registered in all three places.
    'WP-24': [
      'src/layouts/HubLayout.astro',
      'src/layouts/ToolLayout.astro',
      'src/layouts/TemplateLayout.astro',
      'tests/e2e/wave7/wp-42/composer-roundtrip.spec.ts',
      'tests/unit/wp-32b/write-sets-wave11.test.ts',
      '.astro-magazine/ownership.json',
      '.astro-magazine/plans/wave11/writesets.json',
    ],
    // WP-25 (#91): the studio checkpoint owns the event log and the snapshot directory, which the integrator owned before.
    'WP-25': [
      'src/components/layout/Header.astro',
      '.astro-magazine/events.ndjson',
      '.astro-magazine/checkpoints/**',
      '.astro-magazine/ownership.json',
      'tests/unit/wp-32b/write-sets-wave11.test.ts',
      '.astro-magazine/plans/wave11/writesets.json',
    ],
    'WP-26': ['src/layouts/ArticleLayout.astro', 'src/components/insights/**', 'src/components/geo/mdx-transform.ts', 'tests/unit/wp-91/mdx-transform.test.ts'],
  };
  for (const [wp, paths] of Object.entries(want)) {
    assert.deepEqual(exceptionPaths(wp), paths, `${wp} exceptions`);
    for (const p of paths) assert.deepEqual(violations([p], wp, ownership), [], `${wp} may edit ${p}`);
  }
  for (const p of ['src/components/geo/mdx-transform.ts', 'tests/unit/wp-91/mdx-transform.test.ts']) {
    assert.deepEqual(violations([p], 'WP-38', ownership), [], `WP-38 may edit ${p}`);
    assert.ok(violations([p], 'WP-23', ownership).length > 0, `WP-23 may not edit ${p}`);
  }
  assert.equal(violations(['src/layouts/HubLayout.astro'], 'WP-23', ownership).length, 1);
  assert.equal(violations(['src/content/playbooks/x.mdx'], 'WP-23', ownership).length, 1, 'playbook content is WP-38');
  assert.deepEqual(violations(['src/components/media/Lightbox.astro'], 'WP-22', ownership), []);
});
