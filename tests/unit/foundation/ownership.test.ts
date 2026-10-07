import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as mod from '../../../scripts/check-ownership.mjs';

interface Ownership {
  assignments: { owner: string; write_set: string[] }[];
  exceptions: { wp: string; path: string }[];
  always_allowed: string[];
  frozen_paths: string[];
}
const api = mod as unknown as {
  ownerOf(branch: string): string | null;
  matches(path: string, globs: string[]): boolean;
  violations(files: string[], owner: string, o: Ownership): { path: string; reason: string }[];
};
const ownership = JSON.parse(readFileSync(new URL('../../../.astro-magazine/ownership.json', import.meta.url), 'utf8')) as Ownership;

test('branch names map to work packages', () => {
  assert.equal(api.ownerOf('wp/01'), 'WP-01');
  assert.equal(api.ownerOf('wp/02-hub'), 'WP-02');
  assert.equal(api.ownerOf('demo'), null);
});

test('in-scope paths pass and out-of-scope or frozen paths fail', () => {
  assert.deepEqual(api.violations(['src/pages/program/index.astro'], 'WP-01', ownership), []);
  assert.equal(api.violations(['src/pages/services/index.astro'], 'WP-01', ownership).length, 1);
  assert.equal(api.violations(['src/data/nav.ts'], 'WP-01', ownership)[0]?.reason, 'frozen path');
});
