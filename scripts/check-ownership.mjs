#!/usr/bin/env node
// Fails when a work-package branch changes a path outside its write_set or inside frozen_paths.
// Branch wp/NN or wp/NN-suffix maps to WP-NN. Other branches (demo, main) are not policed here.
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
  const m = /^wp\/(\d{2})(?:-[\w-]+)?$/.exec(branch) ?? /^wp\/\d{2}-(\d{2})$/.exec(branch);
  return m ? `WP-${m[1]}` : null;
}

export function violations(files, owner, ownership) {
  const assignment = ownership.assignments.find((a) => a.owner === owner);
  if (!assignment) return [{ path: '*', reason: `no assignment for ${owner}` }];
  const extra = ownership.exceptions.filter((e) => e.wp === owner).map((e) => e.path);
  const allowed = [...assignment.write_set, ...ownership.always_allowed, ...extra];
  const found = [];
  for (const path of files) {
    if (matches(path, ownership.frozen_paths) && !matches(path, extra)) found.push({ path, reason: 'frozen path' });
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
