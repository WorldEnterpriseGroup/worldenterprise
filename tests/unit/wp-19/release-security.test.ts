import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// code-security P1-2 and P1-3 and P2: the release path from GitLab to GitHub Pages. The mirror must fail closed, and the GitHub
// workflow must verify what it deploys, with pinned actions and the least privilege each job needs.

const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

const GUARD = new URL('scripts/ci/require-mirror-secrets.sh', root).pathname;

interface Run {
  readonly status: number | null;
  readonly output: string;
}

function guard(env: Record<string, string>): Run {
  // A clean environment: only PATH, so a token on the machine running the tests can never leak into a case.
  const result = spawnSync('sh', [GUARD], { env: { PATH: process.env.PATH ?? '/usr/bin:/bin', ...env }, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test('the mirror guard passes when the repository and token are set', () => {
  const run = guard({ GITHUB_REPO: 'WorldEnterpriseGroup/worldenterprise', GITHUB_TOKEN: 'token-value-1' });
  assert.equal(run.status, 0, run.output);
});

test('the mirror guard fails, naming the variable, when the token is missing or empty', () => {
  const cases: Record<string, string>[] = [{ GITHUB_REPO: 'a/b' }, { GITHUB_REPO: 'a/b', GITHUB_TOKEN: '' }];
  for (const env of cases) {
    const run = guard(env);
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /Not set: GITHUB_TOKEN\./);
  }
});

test('the mirror guard fails when the repository is missing, and names both when both are', () => {
  assert.match(guard({ GITHUB_TOKEN: 'x1' }).output, /Not set: GITHUB_REPO\./);
  const both = guard({});
  assert.equal(both.status, 1);
  assert.match(both.output, /Not set: GITHUB_REPO GITHUB_TOKEN\./);
});

test('the mirror guard rejects a repository that is not owner/name', () => {
  for (const repo of ['justone', 'a/b/c', '/b', 'a/', 'a/b c', 'a/b;rm', 'a/b$(x)', 'a/b@host']) {
    const run = guard({ GITHUB_REPO: repo, GITHUB_TOKEN: 'x1' });
    assert.equal(run.status, 1, `${repo}: ${run.output}`);
    assert.match(run.output, /GITHUB_REPO must look like owner\/name/, repo);
  }
});

test('the mirror guard rejects a token with whitespace and never prints the token', () => {
  const secret = 'ghp_SECRETVALUEabc123';
  const spaced = guard({ GITHUB_REPO: 'a/b', GITHUB_TOKEN: `${secret}\nextra` });
  assert.equal(spaced.status, 1);
  assert.match(spaced.output, /GITHUB_TOKEN contains whitespace/);
  const cases = [spaced, guard({ GITHUB_REPO: 'a/b', GITHUB_TOKEN: secret }), guard({ GITHUB_REPO: 'bad', GITHUB_TOKEN: secret }), guard({ GITHUB_TOKEN: secret })];
  for (const result of cases) assert.doesNotMatch(result.output, /SECRETVALUE/);
});

test('the mirror job replaces the template script, runs the guard before the push, and has no way to skip', () => {
  const ci = read('.gitlab-ci.yml');
  const start = ci.indexOf('\nmirror:\n');
  assert.ok(start > 0, 'mirror job not found');
  const after = ci.slice(start + 1).split('\n');
  const end = after.findIndex((line, index) => index > 0 && /^\S/.test(line));
  const job = after.slice(0, end === -1 ? undefined : end).join('\n');
  assert.match(job, /^ {2}extends: \.mirror:github$/m);
  const script = job.slice(job.indexOf('  script:'), job.indexOf('  needs:'));
  const lines = script.split('\n').filter((line) => line.startsWith('    - '));
  const guardAt = lines.findIndex((line) => line.includes('scripts/ci/require-mirror-secrets.sh'));
  const remoteAt = lines.findIndex((line) => line.includes('git remote add github'));
  const pushAt = lines.findIndex((line) => line.includes('git push github gh-pages --force'));
  assert.ok(guardAt >= 0 && remoteAt > guardAt && pushAt > remoteAt, `order is guard, remote, push: ${[guardAt, remoteAt, pushAt].join(',')}`);
  assert.doesNotMatch(script, /exit 0|skipping/, 'the job must not skip silently');
  assert.doesNotMatch(script, /echo[^\n]*GITHUB_TOKEN/, 'the token is never echoed');
  const code = readFileSync(GUARD, 'utf8').split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /exit 0|skipping/);
});

// ---- .github/workflows/pages.yml -----------------------------------------------------------------------------------------------

const pages = read('.github/workflows/pages.yml');

/** Job bodies from the top-level `jobs:` map, keyed by job id (text based: the repository has no YAML parser). */
function jobs(source: string): Map<string, string> {
  const block = source.slice(source.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const result = new Map<string, string>();
  const parts = block.split(/^ {2}([a-z][a-z0-9_-]*):\s*$/m);
  for (let i = 1; i < parts.length; i += 2) result.set(parts[i] as string, parts[i + 1] as string);
  return result;
}

test('every action in the deploy workflow is pinned to a full commit SHA', () => {
  const uses = [...pages.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)];
  assert.ok(uses.length >= 4, 'expected checkout, setup-node, upload and deploy actions');
  for (const [, ref, rest] of uses) {
    assert.match(ref as string, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${ref} is not pinned to a 40 character SHA`);
    assert.match(rest as string, /#\s*v\d/, `${ref} needs a trailing version comment`);
  }
});

test('the workflow grants no token scopes by default, and each job grants only what it uses', () => {
  assert.match(pages, /^permissions: \{\}$/m);
  const all = jobs(pages);
  assert.deepEqual([...all.keys()].sort(), ['build', 'deploy']);
  const permissions = (name: string): string[] => {
    const body = all.get(name) as string;
    const block = body.match(/^ {4}permissions:\n((?: {6}[a-z-]+: (?:read|write|none)\n)+)/m);
    assert.ok(block, `${name} declares its own permissions`);
    return (block[1] as string).trim().split('\n').map((line) => line.trim());
  };
  assert.deepEqual(permissions('build'), ['contents: read']);
  assert.deepEqual(permissions('deploy').sort(), ['id-token: write', 'pages: write']);
});

test('the build job runs the release gate with no allowances before it uploads anything', () => {
  const build = jobs(pages).get('build') as string;
  assert.match(build, /RELEASE_ALLOW: ''/);
  const verify = build.indexOf('npm run verify:release');
  const dist = build.indexOf('scripts/lib/audit-dist.mjs --dist dist --cname CNAME --cname-in-dist');
  const upload = build.indexOf('actions/upload-pages-artifact@');
  assert.ok(verify > 0 && dist > verify && upload > dist, 'verify:release, then the dist audit, then the upload');
  const csp = build.indexOf('node scripts/audit-csp.mjs --dist dist');
  assert.ok(csp > dist && csp < upload, 'the CSP coverage audit runs on the final dist, before the upload');
  const copy = build.indexOf('cp CNAME dist/CNAME');
  assert.ok(copy > verify && copy < dist, 'CNAME is copied in before the dist audit, so the audit checks the final dist');
  assert.match(build, /persist-credentials: false/);
});

test('every job is guarded to gh-pages, so a manual dispatch from another branch does nothing', () => {
  for (const [name, body] of jobs(pages)) assert.match(body, /^ {4}if: github\.ref == 'refs\/heads\/gh-pages'$/m, `${name} is not guarded`);
  assert.match(pages, /^ {2}workflow_dispatch:/m);
});

test('runners are a fixed image and every job has a timeout', () => {
  for (const [name, body] of jobs(pages)) {
    assert.doesNotMatch(body, /runs-on:\s*\S*latest/, `${name} uses a floating runner`);
    assert.match(body, /^ {4}timeout-minutes: \d+$/m, `${name} has no timeout`);
  }
});
