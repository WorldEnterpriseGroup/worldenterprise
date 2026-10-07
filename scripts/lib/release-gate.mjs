#!/usr/bin/env node
// verify:release. Runs the production build with PUBLIC_RELEASE=1, which makes src/lib/route-state.ts throw one error that lists
// every release problem (missing launched routes, draft content, disabled launched forms). Operator-gated or not-yet-built items
// may be tolerated on demo through RELEASE_ALLOW, a comma-separated list of regular expressions matched against each problem line.
// On gh-pages RELEASE_ALLOW is empty, so any problem fails. A build that fails without the assertion header is always a failure.
// Usage: node scripts/lib/release-gate.mjs [--json reports/release-gate.json]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './html.mjs';

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/** Extracts the "- ..." problem lines under "Release assertions failed". Returns null when the header is absent. */
export function parseProblems(output) {
  const clean = output.replace(ANSI, '');
  const at = clean.indexOf('Release assertions failed');
  if (at === -1) return null;
  const problems = [];
  for (const line of clean.slice(at).split('\n').slice(1)) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (problems.length > 0) break;
      continue;
    }
    if (!trimmed.startsWith('- ')) break;
    problems.push(trimmed.slice(2));
  }
  return problems;
}

/** Problems that no RELEASE_ALLOW pattern matches. */
export function unallowed(problems, allowList) {
  const patterns = allowList
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .map((p) => new RegExp(p));
  return problems.filter((problem) => !patterns.some((re) => re.test(problem)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { json: 'reports/release-gate.json' });
  const allow = process.env.RELEASE_ALLOW ?? '';
  const env = { ...process.env, PUBLIC_RELEASE: '1' };
  delete env.PUBLIC_STYLEGUIDE;
  delete env.PUBLIC_NAV_FIXTURE;
  const run = spawnSync('npm', ['run', 'build'], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  mkdirSync(dirname(args.json), { recursive: true });
  let verdict;
  if (run.error) {
    verdict = { ok: false, reason: `could not start the build: ${run.error.message}`, problems: [], blocking: [] };
  } else if (run.status === 0) {
    verdict = { ok: true, reason: 'release build passed with no problems', problems: [], blocking: [] };
  } else {
    const problems = parseProblems(output);
    if (problems === null) {
      verdict = { ok: false, reason: 'the build failed for a reason other than the release assertions', problems: [], blocking: [] };
      console.error(output.split('\n').slice(-40).join('\n'));
    } else {
      const blocking = unallowed(problems, allow);
      verdict = { ok: blocking.length === 0, reason: blocking.length === 0 ? `all ${problems.length} problems are covered by RELEASE_ALLOW` : `${blocking.length} of ${problems.length} problems are not covered by RELEASE_ALLOW`, problems, blocking };
    }
  }
  writeFileSync(args.json, `${JSON.stringify({ allow, ...verdict }, null, 2)}\n`);
  for (const b of verdict.blocking) console.error(`FAIL  ${b}`);
  for (const p of verdict.problems.filter((x) => !verdict.blocking.includes(x))) console.warn(`allowed  ${p}`);
  console.log(`verify:release: ${verdict.reason}`);
  process.exit(verdict.ok ? 0 : 1);
}
