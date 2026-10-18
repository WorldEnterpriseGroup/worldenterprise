import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ownerOf, violations } from '../../../scripts/check-ownership.mjs';

// WP-108 (#108) registers its write set once, as recent packages did (WP-59 pattern): its own tests and handoffs in write_set, every other
// path as a named exception. It is the first three-digit package registered, so ownerOf maps a three-digit branch; wp/101 and wp/106
// were never registered and stay unpoliced.

interface Assignment {
  owner: string;
  branch: string;
  write_set: string[];
}
interface Ownership {
  assignments: Assignment[];
  exceptions: { wp: string; path: string; reason: string }[];
}

const root = new URL('../../../', import.meta.url);
const ownership = JSON.parse(readFileSync(new URL('.astro-magazine/ownership.json', root), 'utf8')) as Ownership;
const check = violations as (files: string[], owner: string, ownership: Ownership) => { path: string; reason: string }[];
const owner = ownerOf as (branch: string) => string | null;

const TOUCHED = [
  '.astro-magazine/ownership.json',
  '.gitlab-ci.yml',
  'claims-denylist.json',
  'package.json',
  'scripts/audit-claims.mjs',
  'scripts/audit-images.mjs',
  'scripts/check-ownership.mjs',
  'scripts/lib/audit-dist.mjs',
  'scripts/lib/image-metadata.mjs',
  'tests/unit/shared/fixture-dist.ts',
  'tests/unit/wp-19/audit-dist.test.ts',
  'tests/unit/wp-108/privacy-dist.test.ts',
  'tests/unit/wp-108/image-metadata.test.ts',
  'tests/unit/wp-108/people.test.ts',
];

test('branch names of two and three digits map to their work package', () => {
  assert.equal(owner('wp/108'), 'WP-108');
  assert.equal(owner('wp/108-privacy-gate'), 'WP-108');
  assert.equal(owner('wp/12b-srcset'), 'WP-12b');
  assert.equal(owner('wp/12'), 'WP-12');
  assert.equal(owner('wp/21-12'), 'WP-21');
  assert.equal(owner('wp/1'), null);
  assert.equal(owner('wp/1080'), null);
  assert.equal(owner('demo'), null);
});

test('WP-108 is registered, and its branch maps back to it', () => {
  const assignment = ownership.assignments.find((a) => a.owner === 'WP-108');
  assert.ok(assignment, 'WP-108 has an assignment');
  assert.equal(owner(assignment.branch), 'WP-108');
  assert.deepEqual(assignment.write_set, ['tests/unit/wp-108/**', '.astro-magazine/handoffs/wp-108*']);
});

test('every path the package changes is allowed, and a path outside the set is not', () => {
  assert.deepEqual(check(TOUCHED, 'WP-108', ownership), []);
  assert.deepEqual(check(['src/pages/index.astro', 'CNAME'], 'WP-108', ownership).map((v) => v.path), ['src/pages/index.astro', 'CNAME']);
});

test('every exception names the issue and gives a reason', () => {
  const mine = ownership.exceptions.filter((e) => e.wp === 'WP-108');
  assert.ok(mine.length >= 10);
  for (const e of mine) assert.match(e.reason, /^Issue #108 \(wp\/108-privacy-gate\): .{20,}/, e.path);
  assert.equal(new Set(mine.map((e) => e.path)).size, mine.length, 'no path is registered twice');
});

test('cli: an unregistered three-digit package is left alone, as before', () => {
  const result = spawnSync(process.execPath, [new URL('scripts/check-ownership.mjs', root).pathname, '--branch', 'wp/106-release-prep'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /WP-106 has no assignment/);
});
