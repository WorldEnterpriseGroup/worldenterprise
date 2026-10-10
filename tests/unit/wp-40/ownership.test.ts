import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as checker from '../../../scripts/check-ownership.mjs';

// Wave 7 (WP-40): scripts/check-ownership.mjs learns `exclude`, a list of globs inside an assignment's write_set that the package must not
// edit unless an exception names the path. WP-45 owns a layout and component sweep that must stay clear of the photography lane.

interface Assignment {
  owner: string;
  branch: string;
  write_set: string[];
  exclude?: string[];
}
interface Ownership {
  assignments: Assignment[];
  exceptions: { wp: string; path: string }[];
  always_allowed: string[];
  frozen_paths: string[];
}
const api = checker as unknown as {
  ownerOf(branch: string): string | null;
  violations(files: string[], owner: string, o: Ownership): { path: string; reason: string }[];
};
const ownership = JSON.parse(readFileSync(new URL('../../../.astro-magazine/ownership.json', import.meta.url), 'utf8')) as Ownership;

test('wave 7 branches map to their packages', () => {
  for (let n = 40; n <= 50; n += 1) assert.equal(api.ownerOf(`wp/${n}`), `WP-${n}`);
  assert.equal(api.ownerOf('wp/45-visual'), 'WP-45');
  for (const a of ownership.assignments.filter((x) => /^WP-(?:4\d|50)$/.test(x.owner))) assert.equal(api.ownerOf(a.branch), a.owner);
});

test('WP-45 may edit its sweep but not the three photography-lane files it excludes', () => {
  assert.deepEqual(api.violations(['src/components/ui/Button.astro', 'src/components/hero/HeroSplit.astro', 'src/styles/global.css', 'src/layouts/BaseLayout.astro'], 'WP-45', ownership), []);
  const bad = api.violations(['src/components/ui/Card.astro', 'src/components/hero/HeroAtlas.astro', 'src/components/hero/HeroEditorial.astro'], 'WP-45', ownership);
  assert.deepEqual(bad.map((v) => v.path), ['src/components/ui/Card.astro', 'src/components/hero/HeroAtlas.astro', 'src/components/hero/HeroEditorial.astro']);
  for (const v of bad) assert.match(v.reason, /excluded from the WP-45 write set/);
});

test('an exception that names an excluded path wins over the exclusion', () => {
  const widened: Ownership = { ...ownership, exceptions: [...ownership.exceptions, { wp: 'WP-45', path: 'src/components/ui/Card.astro' }] };
  assert.deepEqual(api.violations(['src/components/ui/Card.astro'], 'WP-45', widened), []);
  assert.equal(api.violations(['src/components/hero/HeroAtlas.astro'], 'WP-45', widened).length, 1);
});

test('a package without an exclude behaves as before', () => {
  const wp41 = ownership.assignments.find((a) => a.owner === 'WP-41');
  assert.equal(wp41?.exclude, undefined);
  assert.deepEqual(api.violations(['src/lib/llms.ts', 'src/components/seo/SeoHead.astro'], 'WP-41', ownership), []);
  assert.equal(api.violations(['src/content/pages/home/hero.mdx'], 'WP-41', ownership)[0]?.reason, 'outside the WP-41 write set');
  assert.equal(api.violations(['src/lib/route-core.ts'], 'WP-41', ownership)[0]?.reason, 'frozen path');
});

test('no stage-1 package may edit a file WP-40 owns', () => {
  const wp40Only = ['src/data/routes.ts', 'src/data/nav.ts', 'src/data/packages.ts', 'claims-denylist.json', '.astro-magazine/ownership.json', '.gitlab-ci.yml', 'playwright.config.ts', 'package.json', 'scripts/audit-claims.mjs', 'scripts/lib/audit-dist.mjs', 'docs/wave7-contracts.md'];
  for (const owner of ['WP-41', 'WP-42', 'WP-43', 'WP-44', 'WP-45', 'WP-46', 'WP-47', 'WP-48', 'WP-49']) {
    const bad = api.violations(wp40Only, owner, ownership).map((v) => v.path);
    assert.deepEqual(bad, wp40Only, `${owner} must be refused every WP-40 file`);
  }
});

test('WP-40 owns its files and the plan, and is refused the photography lane and the other packages', () => {
  const own = ['src/data/packages.ts', 'src/data/routes.ts', 'src/data/nav.ts', 'claims-denylist.json', '.astro-magazine/plans/wave7.md', 'tests/unit/wp-40/packages.test.ts', 'docs/wave7-contracts.md', 'scripts/audit-claims.mjs', 'scripts/lib/audit-dist.mjs', 'scripts/check-ownership.mjs'];
  assert.deepEqual(api.violations(own, 'WP-40', ownership), []);
  const refused = ['src/assets/photo/manifest.json', 'scripts/photo/generate.mjs', 'src/pages/pricing/index.astro', 'src/components/pricing/PackageCard.astro', 'src/pages/llms.txt.ts'];
  assert.deepEqual(api.violations(refused, 'WP-40', ownership).map((v) => v.path), refused);
});
