import assert from 'node:assert/strict';
import test from 'node:test';
import * as mod from '../../../scripts/check-ownership.mjs';
import { loadOwnership } from '../../../scripts/lib/ownership-load.mjs';

interface Ownership {
  assignments: { owner: string; branch: string; write_set: string[] }[];
  exceptions: { wp: string; path: string; reason: string }[];
  always_allowed: string[];
  frozen_paths: string[];
}
const api = mod as unknown as {
  ownerOf(branch: string): string | null;
  violations(files: string[], owner: string, o: Ownership): { path: string; reason: string }[];
};
const ownership = loadOwnership() as unknown as Ownership;

test('wp/12b is its own work package, and the numeric branches keep their owners', () => {
  assert.equal(api.ownerOf('wp/12b'), 'WP-12b');
  assert.equal(api.ownerOf('wp/12b-srcset'), 'WP-12b');
  assert.equal(api.ownerOf('wp/12'), 'WP-12');
  assert.equal(api.ownerOf('wp/12-fix'), 'WP-12');
  assert.equal(api.ownerOf('wp/15'), 'WP-15');
  assert.equal(api.ownerOf('wp/b12'), null);
});

test('every assignment names the branch that maps back to its owner', () => {
  for (const a of ownership.assignments) {
    assert.equal(api.ownerOf(a.branch), a.owner, `${a.branch} maps to ${a.owner}`);
  }
});

test('WP-12b may change photos, the photo manifest and slot ids, the OG builder and the img markup, and nothing else', () => {
  const allowed = ['src/assets/photo/band-1.avif', 'src/assets/photo/manifest.json', 'src/assets/photo/index.ts', 'src/assets/photo/slots.ts', 'scripts/build-og.mjs', 'src/components/cards/ServiceCard.astro', 'src/components/ui/Card.astro', 'src/components/media/AvifPicture.astro'];
  assert.deepEqual(api.violations(allowed, 'WP-12b', ownership), []);
  const blocked = ['src/data/flags.ts', 'src/pages/index.astro', 'src/styles/components.css', 'CNAME', '.gitlab-ci.yml'];
  assert.deepEqual(api.violations(blocked, 'WP-12b', ownership).map((v) => v.path), blocked);
});
