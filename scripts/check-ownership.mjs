#!/usr/bin/env node
// Fails when a work-package branch changes a path outside its write_set or inside frozen_paths.
// Branch wp/NN or wp/NN-suffix maps to WP-NN; wp/NNx (one letter) maps to WP-NNx. Other branches (demo, main) are not policed here.
// Diffs against origin/demo. Usage: node scripts/check-ownership.mjs [--branch wp/01] [--base origin/demo]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function expandBraces(pattern) {
  const m = /\{([^{}]+)\}/.exec(pattern);
  if (!m) return [pattern];
  return m[1].split(',').flatMap((alt) => expandBraces(pattern.slice(0, m.index) + alt + pattern.slice(m.index + m[0].length)));
}

function toRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      out += '.*';
      i += 1;
      if (glob[i + 1] === '/') i += 1;
    } else if (c === '*') out += '[^/]*';
    else out += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

export function matches(path, globs) {
  return globs.flatMap(expandBraces).some((g) => toRegExp(g).test(path));
}

export function ownerOf(branch) {
  // wp/12b is a follow-up work package of its own (WP-12b), not a suffix of WP-12. A three-digit package (WP-108) maps the same way.
  const m = /^wp\/(\d{2,3}[a-z]?)(?:-[\w-]+)?$/.exec(branch) ?? /^wp\/\d{2}-(\d{2})$/.exec(branch);
  return m ? `WP-${m[1]}` : null;
}

export function violations(files, owner, ownership) {
  const assignment = ownership.assignments.find((a) => a.owner === owner);
  if (!assignment) return [{ path: '*', reason: `no assignment for ${owner}` }];
  const extra = ownership.exceptions.filter((e) => e.wp === owner).map((e) => e.path);
  const allowed = [...assignment.write_set, ...ownership.always_allowed, ...extra];
  // `exclude` carves files out of a broad glob in write_set (wave 7: a layout glob that must not reach a photography-lane file).
  // An exception that names the path still wins.
  const excluded = assignment.exclude ?? [];
  // Wave 8 frozen additions: only the stage 0 owner (frozen_paths_wave8_owners, WP-60) edits them freely; any other package, WP-99
  // included, needs a registered exception that names the path.
  const wave8Frozen = ownership.frozen_paths_wave8 ?? [];
  const wave8Owners = ownership.frozen_paths_wave8_owners ?? [];
  const found = [];
  for (const path of files) {
    if (matches(path, ownership.frozen_paths) && !matches(path, extra)) found.push({ path, reason: 'frozen path' });
    else if (matches(path, wave8Frozen) && !wave8Owners.includes(owner) && !matches(path, extra)) found.push({ path, reason: 'wave 8 frozen path' });
    else if (matches(path, excluded) && !matches(path, extra)) found.push({ path, reason: `excluded from the ${owner} write set` });
    else if (!matches(path, allowed)) found.push({ path, reason: `outside the ${owner} write set` });
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const branch = arg('--branch', process.env.CI_COMMIT_BRANCH ?? execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim());
  const base = arg('--base', 'origin/demo');
  const owner = ownerOf(branch);
  if (!owner) {
    console.log(`check-ownership: branch ${branch} is not a work-package branch, nothing to check`);
    process.exit(0);
  }
  const ownership = JSON.parse(readFileSync(new URL('../.astro-magazine/ownership.json', import.meta.url), 'utf8'));
  // Three-digit packages (wp/101, wp/106) predate three-digit mapping and were never registered: they stay unpoliced until they are.
  if (/^WP-\d{3}/.test(owner) && !ownership.assignments.some((a) => a.owner === owner)) {
    console.log(`check-ownership: ${owner} has no assignment (three-digit packages are policed once registered), nothing to check`);
    process.exit(0);
  }
  let files;
  try {
    files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (error) {
    console.error(`check-ownership: cannot diff against ${base}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  const bad = violations(files, owner, ownership);
  for (const v of bad) console.error(`FAIL  ${v.path}: ${v.reason}`);
  console.log(`check-ownership: ${owner}, ${files.length} changed files, ${bad.length} violations`);
  process.exit(bad.length === 0 ? 0 : 1);
}
