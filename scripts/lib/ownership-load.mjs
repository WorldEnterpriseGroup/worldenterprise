// Loads the ownership registry: the shared file .astro-magazine/ownership.json merged with the per-package fragments in
// .astro-magazine/ownership.d/<owner-id-lowercase>.json (issue #112).
//
// The merged view has exactly the shape JSON.parse(ownership.json) returned before the split, so a reader changes only its load line.
// Per-package keys (PER_PACKAGE_KEYS) live in the fragments, never in ownership.json: a package edits its own fragment and no two
// branches touch the same lines. Every failure throws an OwnershipLoadError that names the file; nothing is skipped or defaulted.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OWNERSHIP_FILE = '.astro-magazine/ownership.json';
export const FRAGMENT_DIR = '.astro-magazine/ownership.d';
// Keys that belong to one work package. They are merged by concatenation, fragment by fragment in sorted filename order.
export const PER_PACKAGE_KEYS = ['exceptions', 'handoffs', 'active_leases'];
const FRAGMENT_KEYS = new Set(['owner', ...PER_PACKAGE_KEYS]);
const OWNER_ID = /^WP-\d{2,3}[a-z]?$/;
const EXCEPTION_FIELDS = ['wp', 'path', 'reason'];

export class OwnershipLoadError extends Error {
  constructor(message, file) {
    super(`${file}: ${message}`);
    this.name = 'OwnershipLoadError';
    this.file = file;
  }
}

/** The fragment path for an owner id: WP-62 -> .astro-magazine/ownership.d/wp-62.json (WP-12b -> wp-12b.json). */
export function fragmentPathFor(owner) {
  return `${FRAGMENT_DIR}/${owner.toLowerCase()}.json`;
}

/** The owner id a fragment filename stands for, or null when it is not `wp-<digits><letter?>.json`. */
export function ownerOfFragmentFile(fileName) {
  const m = /^wp-(\d{2,3}[a-z]?)\.json$/.exec(fileName);
  return m ? `WP-${m[1]}` : null;
}

function parseJson(path, label) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new OwnershipLoadError(`cannot read ${label}: ${error instanceof Error ? error.message : String(error)}`, path);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new OwnershipLoadError(`invalid JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`, path);
  }
}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const identity = (e) => JSON.stringify([e.wp, e.path, e.reason]);

function readFragment(path, fileName) {
  const expectedOwner = ownerOfFragmentFile(fileName);
  if (!expectedOwner) {
    throw new OwnershipLoadError(`file name ${fileName} is not wp-<id>.json in lower case (for example wp-62.json, wp-12b.json); ${FRAGMENT_DIR}/ holds fragments and nothing else`, path);
  }
  const fragment = parseJson(path, 'fragment');
  if (!isPlainObject(fragment)) throw new OwnershipLoadError('a fragment is a JSON object', path);
  for (const key of Object.keys(fragment)) {
    if (!FRAGMENT_KEYS.has(key)) {
      throw new OwnershipLoadError(`unknown top-level key "${key}" (a fragment holds owner and ${PER_PACKAGE_KEYS.join(', ')}; shared keys belong in ${OWNERSHIP_FILE})`, path);
    }
  }
  if (typeof fragment.owner !== 'string' || !OWNER_ID.test(fragment.owner)) {
    throw new OwnershipLoadError(`"owner" must be a work package id such as WP-62, got ${JSON.stringify(fragment.owner)}`, path);
  }
  if (fragment.owner !== expectedOwner) {
    throw new OwnershipLoadError(`"owner" is ${fragment.owner} but the file name says ${expectedOwner}`, path);
  }
  for (const key of PER_PACKAGE_KEYS) {
    if (fragment[key] !== undefined && !Array.isArray(fragment[key])) throw new OwnershipLoadError(`"${key}" must be an array`, path);
  }
  (fragment.exceptions ?? []).forEach((e, i) => {
    if (!isPlainObject(e)) throw new OwnershipLoadError(`exceptions[${i}] must be an object`, path);
    for (const field of EXCEPTION_FIELDS) {
      if (typeof e[field] !== 'string' || e[field].trim() === '') throw new OwnershipLoadError(`exceptions[${i}] needs a non-empty string "${field}"`, path);
    }
    if (e.wp !== fragment.owner) {
      throw new OwnershipLoadError(`exceptions[${i}] (${e.path}) belongs to ${e.wp} but this fragment is ${fragment.owner}'s; a package registers exceptions only in its own fragment`, path);
    }
  });
  return fragment;
}

/**
 * Returns the merged registry. Deterministic: fragments are read in sorted filename order and entries keep their order within a file.
 * `root` is the repository root (default: the checkout this module sits in).
 */
export function loadOwnership({ root = fileURLToPath(new URL('../../', import.meta.url)) } = {}) {
  const basePath = join(root, OWNERSHIP_FILE);
  const base = parseJson(basePath, 'ownership registry');
  if (!isPlainObject(base)) throw new OwnershipLoadError('the registry is a JSON object', basePath);
  const regained = PER_PACKAGE_KEYS.filter((k) => k in base);
  if (regained.length > 0) {
    throw new OwnershipLoadError(`holds per-package key(s) ${regained.map((k) => `"${k}"`).join(', ')}; move them to your own fragment ${FRAGMENT_DIR}/<owner-id-lowercase>.json (for example ${fragmentPathFor('WP-62')})`, basePath);
  }

  const dir = join(root, FRAGMENT_DIR);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new OwnershipLoadError('the fragment directory is missing', dir);
  const names = readdirSync(dir).sort();
  if (names.length === 0) throw new OwnershipLoadError('the fragment directory is empty', dir);

  const merged = { ...base };
  for (const key of PER_PACKAGE_KEYS) merged[key] = [];
  const seen = new Map();
  for (const name of names) {
    const path = join(dir, name);
    const fragment = readFragment(path, name);
    for (const key of PER_PACKAGE_KEYS) merged[key].push(...(fragment[key] ?? []));
    for (const e of fragment.exceptions ?? []) {
      const id = identity(e);
      const first = seen.get(id);
      if (first) throw new OwnershipLoadError(`duplicate exception ${e.wp} ${e.path} (same owner, path and reason), first registered in ${first}`, path);
      seen.set(id, path);
    }
  }
  return merged;
}
