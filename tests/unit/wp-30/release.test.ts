import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// WP-30 (issue #20, decision R-1): the release path from GitLab gh-pages to GitHub. The mirror job is manual, blocked until the owner
// approves the exact commit, holds no GitHub credential and cannot push; it only confirms that the nightly weg-ghpages-mirror
// CronJob has delivered the commit. The pipeline on gh-pages never reports a release that did not land.

const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const APPROVAL = new URL('scripts/ci/require-release-approval.sh', root).pathname;
const CONFIRM = new URL('scripts/ci/confirm-mirror.sh', root).pathname;

interface Run {
  readonly status: number | null;
  readonly output: string;
}

/** Runs a script with only PATH plus the given variables, so nothing on the machine running the tests can leak into a case. */
function run(script: string, env: Record<string, string>, cwd?: string): Run {
  const result = spawnSync('sh', [script], {
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: tmpdir(), ...env },
    encoding: 'utf8',
    ...(cwd === undefined ? {} : { cwd }),
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const SHA = '0123456789abcdef0123456789abcdef01234567';

// ---- approval gate ---------------------------------------------------------------------------------------------------------------

test('the approval gate is blocked when RELEASE_APPROVED is not set or empty', () => {
  for (const env of [{ CI_COMMIT_SHA: SHA }, { CI_COMMIT_SHA: SHA, RELEASE_APPROVED: '' }]) {
    const result = run(APPROVAL, env);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /blocked\. RELEASE_APPROVED is not set/);
  }
});

test('the approval gate refuses "true" and anything that is not a lowercase hex SHA', () => {
  for (const value of ['true', 'yes', 'on', 'TRUE', '0123456789AB', '0123456789ab; rm', '0123456789ab ', 'g123456789ab']) {
    const result = run(APPROVAL, { CI_COMMIT_SHA: SHA, RELEASE_APPROVED: value });
    assert.equal(result.status, 1, `${JSON.stringify(value)}: ${result.output}`);
    assert.match(result.output, /must be a lowercase hex commit SHA/);
  }
});

test('the approval gate refuses a SHA shorter than 12 characters', () => {
  const result = run(APPROVAL, { CI_COMMIT_SHA: SHA, RELEASE_APPROVED: SHA.slice(0, 11) });
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /at least 12 characters/);
});

test('an approval for another commit does not carry over', () => {
  const other = `${SHA.slice(0, 12)}${'f'.repeat(28)}`;
  assert.equal(run(APPROVAL, { CI_COMMIT_SHA: other, RELEASE_APPROVED: SHA }).status, 1);
  const stale = run(APPROVAL, { CI_COMMIT_SHA: SHA, RELEASE_APPROVED: 'fedcba987654' });
  assert.equal(stale.status, 1, stale.output);
  assert.match(stale.output, /is not this commit/);
});

test('the approval gate passes for the full SHA and for a prefix of at least 12 characters', () => {
  for (const value of [SHA, SHA.slice(0, 12), SHA.slice(0, 20)]) {
    const result = run(APPROVAL, { CI_COMMIT_SHA: SHA, RELEASE_APPROVED: value });
    assert.equal(result.status, 0, `${value}: ${result.output}`);
    assert.match(result.output, /approved for/);
  }
});

test('the approval gate needs a commit to approve', () => {
  assert.equal(run(APPROVAL, { RELEASE_APPROVED: SHA }).status, 1);
});

// ---- mirror confirmation, against real local repositories ------------------------------------------------------------------------

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.org',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.org',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: tmpdir(), ...GIT_ENV }, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

interface Fixture {
  readonly work: string;
  readonly remote: string;
  readonly a: string;
  readonly b: string;
  readonly cleanup: () => void;
}

/** A work tree with commits a then b on gh-pages, and a bare "GitHub" repository that has not received anything yet. */
function fixture(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'wp30-'));
  const work = join(dir, 'work');
  const remote = join(dir, 'github.git');
  mkdirSync(work);
  git(dir, 'init', '--bare', '-q', remote);
  git(work, 'init', '-q', '-b', 'gh-pages');
  git(work, 'commit', '-q', '--allow-empty', '-m', 'a');
  const a = git(work, 'rev-parse', 'HEAD');
  git(work, 'commit', '-q', '--allow-empty', '-m', 'b');
  const b = git(work, 'rev-parse', 'HEAD');
  return { work, remote, a, b, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function confirm(f: Fixture, commit: string, extra: Record<string, string> = {}): Run {
  return run(CONFIRM, { GITHUB_REPO: 'WorldEnterpriseGroup/worldenterprise', CI_COMMIT_SHA: commit, MIRROR_REMOTE_URL: f.remote, ...GIT_ENV, ...extra }, f.work);
}

test('the confirmation passes only when GitHub gh-pages is at the pipeline commit', () => {
  const f = fixture();
  try {
    git(f.work, 'push', '-q', f.remote, 'gh-pages:gh-pages');
    const result = confirm(f, f.b);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /has been mirrored/);
  } finally {
    f.cleanup();
  }
});

test('the confirmation fails while the mirror has not delivered the commit yet, and says when it runs', () => {
  const f = fixture();
  try {
    git(f.work, 'push', '-q', f.remote, `${f.a}:refs/heads/gh-pages`);
    const result = confirm(f, f.b);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /not mirrored yet/);
    assert.match(result.output, /03:23 UTC/);
  } finally {
    f.cleanup();
  }
});

test('the confirmation fails when GitHub has no gh-pages branch', () => {
  const f = fixture();
  try {
    const result = confirm(f, f.b);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /no gh-pages branch/);
  } finally {
    f.cleanup();
  }
});

test('the confirmation fails when GitHub is ahead of this pipeline', () => {
  const f = fixture();
  try {
    git(f.work, 'push', '-q', f.remote, 'gh-pages:gh-pages');
    const result = confirm(f, f.a);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /ahead of this pipeline/);
  } finally {
    f.cleanup();
  }
});

test('the confirmation fails and says DIVERGED when GitHub holds a commit GitLab does not', () => {
  const f = fixture();
  try {
    const other = join(f.work, '..', 'other');
    mkdirSync(other);
    git(other, 'init', '-q', '-b', 'gh-pages');
    git(other, 'commit', '-q', '--allow-empty', '-m', 'edited on GitHub');
    git(other, 'push', '-q', f.remote, 'gh-pages:gh-pages');
    const result = confirm(f, f.b);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /DIVERGED/);
    assert.match(result.output, /Never force-push/);
  } finally {
    f.cleanup();
  }
});

test('the confirmation fails when the remote cannot be read, and never waits for credentials', () => {
  const f = fixture();
  try {
    const result = confirm(f, f.b, { MIRROR_REMOTE_URL: join(f.remote, 'missing') });
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /could not read gh-pages/);
  } finally {
    f.cleanup();
  }
});

test('the confirmation rejects a repository that is not owner/name, and a missing one', () => {
  const f = fixture();
  try {
    for (const repo of ['justone', 'a/b/c', '/b', 'a/', 'a/b c', 'a/b;rm', 'a/b$(x)', 'a/b@host']) {
      const result = confirm(f, f.b, { GITHUB_REPO: repo });
      assert.equal(result.status, 1, `${repo}: ${result.output}`);
      assert.match(result.output, /GITHUB_REPO must look like owner\/name/, repo);
    }
    const missing = run(CONFIRM, { CI_COMMIT_SHA: f.b, MIRROR_REMOTE_URL: f.remote, ...GIT_ENV }, f.work);
    assert.equal(missing.status, 1);
    assert.match(missing.output, /GITHUB_REPO is not set/);
  } finally {
    f.cleanup();
  }
});

test('neither script has a path that exits 0 without a decision, and neither handles a credential', () => {
  for (const path of ['scripts/ci/require-release-approval.sh', 'scripts/ci/confirm-mirror.sh']) {
    const code = read(path)
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    assert.doesNotMatch(code, /skipping/, path);
    assert.doesNotMatch(code, /GITHUB_TOKEN|x-access-token|git push|--force/, path);
  }
});

// ---- the job in .gitlab-ci.yml ---------------------------------------------------------------------------------------------------

const ci = read('.gitlab-ci.yml');

/** The text of one top-level job. */
function job(name: string): string {
  const start = ci.indexOf(`\n${name}:\n`);
  assert.ok(start > 0, `${name} job not found`);
  const lines = ci.slice(start + 1).split('\n');
  const end = lines.findIndex((line, index) => index > 0 && /^\S/.test(line));
  return lines.slice(0, end === -1 ? undefined : end).join('\n');
}

test('the mirror job is manual on gh-pages only, and a failed or unapproved run blocks the pipeline', () => {
  const body = job('mirror');
  assert.match(body, /^ {2}extends: \.mirror:github$/m);
  const rules = body.slice(body.indexOf('  rules:'), body.indexOf('  script:'));
  assert.match(rules, /if: '\$CI_COMMIT_BRANCH == "gh-pages"'/);
  assert.match(rules, /when: manual/);
  assert.match(rules, /allow_failure: false/);
  assert.equal([...rules.matchAll(/- if:/g)].length, 1, 'one rule, gh-pages only');
});

test('the mirror job runs the approval gate before the confirmation, holds no credential and cannot push', () => {
  const body = job('mirror');
  const script = body.slice(body.indexOf('  script:'), body.indexOf('  needs:'));
  const lines = script.split('\n').filter((line) => line.startsWith('    - '));
  const approvalAt = lines.findIndex((line) => line.includes('scripts/ci/require-release-approval.sh'));
  const confirmAt = lines.findIndex((line) => line.includes('scripts/ci/confirm-mirror.sh'));
  assert.ok(approvalAt >= 0 && confirmAt > approvalAt, `order is approval then confirmation: ${[approvalAt, confirmAt].join(',')}`);
  assert.doesNotMatch(body, /GITHUB_TOKEN|x-access-token|git push|git remote|--force|exit 0|skipping/);
  assert.doesNotMatch(ci.replace(/^\s*#.*$/gm, ''), /GITHUB_TOKEN|x-access-token/, 'no GitHub credential anywhere in the pipeline');
});

test('the mirror job needs every qa job, so it cannot be run past a red one', () => {
  const body = job('mirror');
  const needed = new Set([...body.matchAll(/- job: (\S+)/g)].map((m) => m[1]));
  const qa = [...ci.matchAll(/^((?:audit|e2e|qa|verify):[\w:-]+):$/gm)].map((m) => m[1] as string);
  assert.ok(qa.length >= 15, `found ${qa.length} qa jobs`);
  for (const name of qa) assert.ok(needed.has(name), `mirror does not need ${name}`);
});

test('the counsel extract is produced by a qa job that keeps reports/ as an artifact', () => {
  const claims = job('audit:claims');
  assert.match(claims, /node scripts\/ci\/counsel-extract\.mjs --dist dist --out reports\/counsel-review\.md/);
  assert.match(ci, /\.audit:[\s\S]*?paths:\n\s+- reports\//);
});
