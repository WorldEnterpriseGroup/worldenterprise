import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// code-security P1-2 and P2: the GitHub workflow must verify what it deploys, with pinned actions and the least privilege each job needs.
// (P1-3, the mirror that must fail closed, moved with the mirror job: tests/unit/wp-30/release.test.ts.)

const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

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
