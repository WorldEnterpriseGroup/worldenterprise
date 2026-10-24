import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { ownerOf, violations } from '../../../scripts/check-ownership.mjs';
import { FRAGMENT_DIR, OWNERSHIP_FILE, PER_PACKAGE_KEYS, fragmentPathFor, loadOwnership, ownerOfFragmentFile } from '../../../scripts/lib/ownership-load.mjs';

// #112: ownership.json keeps the shared keys; every per-package key lives in .astro-magazine/ownership.d/<owner>.json.

interface Exception {
  wp: string;
  path: string;
  reason: string;
}
interface Ownership {
  assignments: { owner: string; write_set: string[] }[];
  exceptions: Exception[];
  handoffs: unknown[];
  active_leases: unknown[];
}
const root = new URL('../../../', import.meta.url);
const merged = loadOwnership() as unknown as Ownership;
const preSplit = JSON.parse(readFileSync(new URL('pre-split-exceptions.json', import.meta.url), 'utf8')) as Exception[];
const check = violations as (files: string[], owner: string, o: Ownership) => { path: string; reason: string }[];
const branchOwner = ownerOf as (branch: string) => string | null;

// Pinned when the split landed (measured on demo 8fe090d6): 509 exceptions from 49 owners. Registering a new exception raises
// the merged count above this floor but never lowers it: the pre-split entries must all survive.
const PRE_SPLIT_COUNT = 509;
const PRE_SPLIT_OWNERS = 49;
const identity = (e: Exception): string => JSON.stringify([e.wp, e.path, e.reason]);
const canonical = (list: Exception[]): string[] => list.map((e) => JSON.stringify(e, Object.keys(e).sort())).sort();

test('the pre-split snapshot is pinned at 509 exceptions from 49 owners', () => {
  assert.equal(preSplit.length, PRE_SPLIT_COUNT);
  assert.equal(new Set(preSplit.map((e) => e.wp)).size, PRE_SPLIT_OWNERS);
});

test('the merged exceptions, sorted canonically, deep-equal the pre-split array sorted the same way', () => {
  assert.ok(merged.exceptions.length >= PRE_SPLIT_COUNT, `merged view lost exceptions: ${merged.exceptions.length} < ${PRE_SPLIT_COUNT}`);
  // Exceptions registered after the split live in fragments too, so the comparison is on the entries the snapshot names: each of them is
  // present, unchanged and exactly once, and nothing else about them moved.
  const pinned = new Set(preSplit.map(identity));
  const survivors = merged.exceptions.filter((e) => pinned.has(identity(e)));
  assert.deepEqual(canonical(survivors), canonical(preSplit));
  // Within one owner the entries keep their pre-split order.
  for (const owner of new Set(preSplit.map((e) => e.wp))) {
    const was = preSplit.filter((e) => e.wp === owner).map((e) => JSON.stringify(e));
    const is = survivors.filter((e) => e.wp === owner).map((e) => JSON.stringify(e));
    assert.deepEqual(is, was, `${owner} keeps its entries and their order`);
  }
});

test('ownership.json holds no per-package key; the message points to ownership.d/', () => {
  const base = JSON.parse(readFileSync(new URL(OWNERSHIP_FILE, root), 'utf8')) as Record<string, unknown>;
  const regained = (PER_PACKAGE_KEYS as string[]).filter((k) => k in base);
  assert.deepEqual(regained, [], `${OWNERSHIP_FILE} regained per-package key(s) ${regained.join(', ')}: add them to your own fragment ${FRAGMENT_DIR}/<owner-id-lowercase>.json (for example ${fragmentPathFor('WP-62')}), never to ownership.json`);
  assert.deepEqual(PER_PACKAGE_KEYS, ['exceptions', 'handoffs', 'active_leases']);
});

test('every fragment is wp-<id>.json for the owner it holds and every merged exception comes from its own owner file', () => {
  const names = readdirSync(new URL(`${FRAGMENT_DIR}/`, root)).sort();
  assert.ok(names.length >= PRE_SPLIT_OWNERS);
  for (const name of names) {
    const owner = ownerOfFragmentFile(name);
    assert.ok(owner, `${FRAGMENT_DIR}/${name} is a fragment file name`);
    const fragment = JSON.parse(readFileSync(new URL(`${FRAGMENT_DIR}/${name}`, root), 'utf8')) as { owner: string; exceptions?: Exception[] };
    assert.equal(fragment.owner, owner, `${FRAGMENT_DIR}/${name}`);
  }
  assert.deepEqual(merged.handoffs, []);
  assert.deepEqual(merged.active_leases, []);
});

test('a branch for WP-NN may write ownership.d/wp-NN.json and nothing else in ownership.d', () => {
  const own = fragmentPathFor('WP-62');
  assert.deepEqual(check([own], 'WP-62', merged), []);
  assert.equal(branchOwner('wp/62-cta-land'), 'WP-62');
  const other = check([fragmentPathFor('WP-63')], 'WP-62', merged);
  assert.deepEqual(other.map((v) => v.path), [fragmentPathFor('WP-63')]);
  assert.match(other[0]?.reason ?? '', /outside the WP-62 write set/);
  const stray = [`${FRAGMENT_DIR}/notes.json`, `${FRAGMENT_DIR}/wp-62.json.bak`, `${FRAGMENT_DIR}/sub/wp-62.json`, `${FRAGMENT_DIR}/WP-62.json`];
  assert.deepEqual(check(stray, 'WP-62', merged).map((v) => v.path), stray);
  // The letter suffix is part of the identity: WP-12b owns wp-12b.json, not wp-12.json.
  assert.deepEqual(check([fragmentPathFor('WP-12b')], 'WP-12b', merged), []);
  assert.equal(check([fragmentPathFor('WP-12')], 'WP-12b', merged).length, 1);
});

test('a package without an assignment is still refused its own fragment', () => {
  assert.deepEqual(check([fragmentPathFor('WP-97')], 'WP-97x', merged).map((v) => v.reason), ['no assignment for WP-97x']);
});
