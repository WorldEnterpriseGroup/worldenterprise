#!/usr/bin/env node
// verify:release. Runs the production build with PUBLIC_RELEASE=1, which makes src/lib/route-state.ts throw one error that lists
// every release problem (missing launched routes, draft content, disabled launched forms). Operator-gated or not-yet-built items
// may be tolerated on demo through RELEASE_ALLOW, a comma-separated list of regular expressions matched against each problem line.
// On gh-pages RELEASE_ALLOW is empty, so any problem fails. A build that fails without the assertion header is always a failure.
// Since #49 the open human items (counsel sign-off in RELEASE.md section 8) are problem lines too, "human item open: ...", so an empty
// RELEASE_ALLOW fails them as well, and the gate explains each failing cause (scripts/lib/wave8/release-open-items.mjs).
// Usage: node scripts/lib/release-gate.mjs [--json reports/release-gate.json]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './html.mjs';
import { composeVerdict, operatorNotes } from './wave8/release-open-items.mjs';
import { flags } from '../../src/data/flags.ts';
import { site } from '../../src/data/site.ts';

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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { json: 'reports/release-gate.json' });
  const allow = process.env.RELEASE_ALLOW ?? '';
  const env = { ...process.env, PUBLIC_RELEASE: '1' };
  delete env.PUBLIC_STYLEGUIDE;
  const run = spawnSync('npm', ['run', 'build'], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  mkdirSync(dirname(args.json), { recursive: true });
  // The open human items (counsel sign-off) are problems like the build's own: they fail unless RELEASE_ALLOW names them (#49).
  let markdown;
  try {
    markdown = readFileSync(new URL('../../.astro-magazine/release/RELEASE.md', import.meta.url), 'utf8');
  } catch (error) {
    markdown = error instanceof Error ? error : new Error(String(error));
  }
  const verdict = composeVerdict({ run: { ...(run.error ? { error: run.error } : {}), status: run.status, output }, allow, markdown, notes: operatorNotes({ site, flags, env: process.env }) });
  if (verdict.reason.startsWith('the build failed')) console.error(output.split('\n').slice(-40).join('\n'));
  writeFileSync(args.json, `${JSON.stringify({ allow, ...verdict }, null, 2)}\n`);
  for (const b of verdict.blocking) console.error(`FAIL  ${b}`);
  for (const p of verdict.problems.filter((x) => !verdict.blocking.includes(x))) console.warn(`allowed  ${p}`);
  if (verdict.explanation.length > 0) {
    console.error('\nWhy this gate is red, and what clears it:');
    for (const line of verdict.explanation) console.error(`  - ${line}`);
  }
  if (verdict.notes.length > 0) {
    console.log('\nOpen operator items that do not stop the build by themselves:');
    for (const note of verdict.notes) console.log(`  - ${note}`);
  }
  console.log(`verify:release: ${verdict.reason}`);
  process.exit(verdict.ok ? 0 : 1);
}
