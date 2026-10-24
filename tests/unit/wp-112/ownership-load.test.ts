import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FRAGMENT_DIR, OWNERSHIP_FILE, OwnershipLoadError, fragmentPathFor, loadOwnership, ownerOfFragmentFile } from '../../../scripts/lib/ownership-load.mjs';

// #112: the loader merges ownership.json with ownership.d/*.json. Every failure names a file and nothing is defaulted silently.

interface Exception {
  wp: string;
  path: string;
  reason: string;
}
interface Merged {
  assignments: unknown[];
  exceptions: Exception[];
  handoffs: unknown[];
  active_leases: unknown[];
  [key: string]: unknown;
}
const load = loadOwnership as (opts: { root: string }) => Merged;
const ex = (wp: string, path: string, reason = 'because'): Exception => ({ wp, path, reason });

function fixture(files: Record<string, unknown>, base: unknown = { schema_version: '1.0.0', assignments: [], always_allowed: [] }): string {
  const root = mkdtempSync(join(tmpdir(), 'ownership-load-'));
  mkdirSync(join(root, FRAGMENT_DIR), { recursive: true });
  writeFileSync(join(root, OWNERSHIP_FILE), typeof base === 'string' ? base : JSON.stringify(base));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, FRAGMENT_DIR, name), typeof content === 'string' ? content : JSON.stringify(content));
  return root;
}
function withFixture<T>(files: Record<string, unknown>, fn: (root: string) => T, base?: unknown): T {
  const root = fixture(files, base);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
function loadError(root: string): OwnershipLoadError {
  try {
    load({ root });
  } catch (error) {
    assert.ok(error instanceof OwnershipLoadError, `expected an OwnershipLoadError, got ${String(error)}`);
    return error;
  }
  throw new assert.AssertionError({ message: 'expected the loader to throw' });
}

test('the merged view keeps the pre-split shape: shared keys from the registry, per-package arrays from the fragments', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-02', exceptions: [ex('WP-02', 'a')] } }, (root) => {
    const merged = load({ root });
    assert.equal(merged.schema_version, '1.0.0');
    assert.deepEqual(merged.assignments, []);
    assert.deepEqual(merged.exceptions, [ex('WP-02', 'a')]);
    assert.deepEqual(merged.handoffs, [], 'handoffs is always an array, as before the split');
    assert.deepEqual(merged.active_leases, [], 'active_leases is always an array, as before the split');
  });
});

test('fragments are read in sorted file order and entries keep their order within a file, whatever order they were written in', () => {
  const files = {
    'wp-62.json': { owner: 'WP-62', exceptions: [ex('WP-62', 'z2'), ex('WP-62', 'z1')] },
    'wp-12b.json': { owner: 'WP-12b', exceptions: [ex('WP-12b', 'b')] },
    'wp-108.json': { owner: 'WP-108', exceptions: [ex('WP-108', 'c')] },
    'wp-03.json': { owner: 'WP-03', exceptions: [ex('WP-03', 'a')] },
  };
  const reversed = Object.fromEntries(Object.entries(files).reverse());
  const a = withFixture(files, (root) => load({ root }).exceptions.map((e) => e.path));
  const b = withFixture(reversed, (root) => load({ root }).exceptions.map((e) => e.path));
  assert.deepEqual(a, ['a', 'c', 'b', 'z2', 'z1'], 'wp-03 < wp-108 < wp-12b < wp-62 by file name, z2 before z1 as written');
  assert.deepEqual(b, a);
});

test('handoffs and active_leases in a fragment are merged like exceptions', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-02', handoffs: [{ id: 1 }], active_leases: [{ id: 'l1' }] }, 'wp-03.json': { owner: 'WP-03', handoffs: [{ id: 2 }] } }, (root) => {
    const merged = load({ root });
    assert.deepEqual(merged.handoffs, [{ id: 1 }, { id: 2 }]);
    assert.deepEqual(merged.active_leases, [{ id: 'l1' }]);
    assert.deepEqual(merged.exceptions, []);
  });
});

test('a JSON parse error names the fragment file', () => {
  withFixture({ 'wp-02.json': '{ "owner": ' }, (root) => {
    const error = loadError(root);
    assert.match(error.message, /ownership\.d\/wp-02\.json: invalid JSON/);
    assert.match(error.file, /ownership\.d\/wp-02\.json$/);
  });
});

test('a JSON parse error in ownership.json names that file', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-02' } }, (root) => assert.match(loadError(root).message, /ownership\.json: invalid JSON/), '{ nope');
});

test('an unknown top-level key in a fragment is refused with the fragment path', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-02', exceptoins: [] } }, (root) => {
    assert.match(loadError(root).message, /ownership\.d\/wp-02\.json: unknown top-level key "exceptoins"/);
  });
  withFixture({ 'wp-02.json': { owner: 'WP-02', assignments: [] } }, (root) => {
    assert.match(loadError(root).message, /unknown top-level key "assignments".*shared keys belong in .*ownership\.json/);
  });
});

test('a duplicate exception (same owner, path and reason) is refused and the message names the file that registered it first', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-02', exceptions: [ex('WP-02', 'a', 'r'), ex('WP-02', 'b', 'r'), ex('WP-02', 'a', 'r')] } }, (root) => {
    const error = loadError(root);
    assert.match(error.message, /ownership\.d\/wp-02\.json: duplicate exception WP-02 a/);
    assert.match(error.message, /first registered in .*ownership\.d\/wp-02\.json/);
  });
});

test('the same path with a different reason is not a duplicate', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-02', exceptions: [ex('WP-02', 'a', 'one'), ex('WP-02', 'a', 'two')] } }, (root) => {
    assert.equal(load({ root }).exceptions.length, 2);
  });
});

test('a fragment may only hold its own package: file name, owner and every exception owner must agree', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-03', exceptions: [] } }, (root) => assert.match(loadError(root).message, /wp-02\.json: "owner" is WP-03 but the file name says WP-02/));
  withFixture({ 'wp-02.json': { owner: 'WP-02', exceptions: [ex('WP-03', 'a')] } }, (root) => assert.match(loadError(root).message, /wp-02\.json: exceptions\[0\] \(a\) belongs to WP-03 but this fragment is WP-02's/));
  withFixture({ 'WP-02.json': { owner: 'WP-02' } }, (root) => assert.match(loadError(root).message, /WP-02\.json: file name WP-02\.json is not wp-<id>\.json in lower case/));
  withFixture({ 'notes.md': 'hello' }, (root) => assert.match(loadError(root).message, /notes\.md: file name notes\.md is not wp-<id>\.json/));
  withFixture({ 'wp-02.json': { owner: 'wp-02' } }, (root) => assert.match(loadError(root).message, /wp-02\.json: "owner" must be a work package id/));
});

test('a malformed exception entry is refused with its index', () => {
  withFixture({ 'wp-02.json': { owner: 'WP-02', exceptions: [{ wp: 'WP-02', path: 'a' }] } }, (root) => assert.match(loadError(root).message, /wp-02\.json: exceptions\[0\] needs a non-empty string "reason"/));
  withFixture({ 'wp-02.json': { owner: 'WP-02', exceptions: 'a' } }, (root) => assert.match(loadError(root).message, /wp-02\.json: "exceptions" must be an array/));
});

test('ownership.json holding a per-package key is a hard error that points to ownership.d/', () => {
  for (const key of ['exceptions', 'handoffs', 'active_leases']) {
    withFixture({ 'wp-02.json': { owner: 'WP-02' } }, (root) => {
      const message = loadError(root).message;
      assert.match(message, new RegExp(`ownership\\.json: holds per-package key\\(s\\) "${key}"`));
      assert.match(message, /ownership\.d\/<owner-id-lowercase>\.json/);
    }, { assignments: [], [key]: [] });
  }
});

test('a missing or empty fragment directory is a hard error, never an empty registry', () => {
  const root = mkdtempSync(join(tmpdir(), 'ownership-load-'));
  try {
    mkdirSync(join(root, '.astro-magazine'));
    writeFileSync(join(root, OWNERSHIP_FILE), '{"assignments":[]}');
    assert.match(loadError(root).message, /ownership\.d: the fragment directory is missing/);
    mkdirSync(join(root, FRAGMENT_DIR));
    assert.match(loadError(root).message, /ownership\.d: the fragment directory is empty/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a missing ownership.json names the file', () => {
  const root = mkdtempSync(join(tmpdir(), 'ownership-load-'));
  try {
    assert.match(loadError(root).message, /ownership\.json: cannot read ownership registry/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fragment file names map to owners and back', () => {
  assert.equal(fragmentPathFor('WP-62'), '.astro-magazine/ownership.d/wp-62.json');
  assert.equal(fragmentPathFor('WP-12b'), '.astro-magazine/ownership.d/wp-12b.json');
  assert.equal(fragmentPathFor('WP-108'), '.astro-magazine/ownership.d/wp-108.json');
  assert.equal(ownerOfFragmentFile('wp-12b.json'), 'WP-12b');
  assert.equal(ownerOfFragmentFile('wp-108.json'), 'WP-108');
  assert.equal(ownerOfFragmentFile('wp-6.json'), null);
  assert.equal(ownerOfFragmentFile('README.md'), null);
});
