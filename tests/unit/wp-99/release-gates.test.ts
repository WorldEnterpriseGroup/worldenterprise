import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// #124: GitHub Pages rebuilt the release and failed a gate (the styleguide route in a release dist) that the GitLab tag pipeline never ran.
// Both now run one script, and the styleguide is emitted only when asked for, never in a release build.

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const SCRIPT = 'scripts/ci/release-gates.sh';
const script = read(SCRIPT);
const ci = read('.gitlab-ci.yml');
const pages = read('.github/workflows/pages.yml');
/** The command lines of the script, in order. */
const commands = script.split('\n').filter((line) => line !== '' && !line.startsWith('#') && line !== 'set -eu');

test('GitLab verify:release and the GitHub pages build both run the shared gate script', () => {
  const job = ci.slice(ci.indexOf('\nverify:release:'), ci.indexOf('\n# The shared Pages job'));
  assert.match(job, /^ {4}- sh scripts\/ci\/release-gates\.sh$/m);
  assert.doesNotMatch(job, /^ {4}- npm run verify:release$/m, 'the job does not run a shorter sequence of its own');
  assert.match(pages, /^ {8}run: sh scripts\/ci\/release-gates\.sh$/m);
  for (const line of pages.split('\n')) {
    assert.doesNotMatch(line, /audit-route-ledger|audit-dist|audit-csp|npm run verify:release/, 'pages.yml carries no gate of its own');
  }
});

test('the gate script builds the release, copies CNAME in before audit-dist, and runs every strict audit', () => {
  assert.equal(commands[0], 'npm run verify:release');
  assert.equal(commands[1], 'if [ -n "${RELEASE_ALLOW:-}" ]; then', 'only an allowance skips the audits, never a branch or tag name');
  assert.ok(commands.indexOf('exit 0') < commands.indexOf('cp CNAME dist/CNAME'), 'the skip comes before every audit of the dist');
  const at = (needle: string): number => commands.findIndex((c) => c.startsWith(needle));
  for (const needle of ['npm run audit:contrast', 'npm run audit:claims', 'node scripts/lib/export-ledger.mjs', 'cp CNAME dist/CNAME', 'node scripts/audit-csp.mjs', 'node scripts/audit-images.mjs']) {
    assert.notEqual(at(needle), -1, `${needle} runs`);
  }
  assert.ok(at('node scripts/lib/export-ledger.mjs') < at('node scripts/audit-route-ledger.mjs'), 'the ledger is exported before it is audited');
  assert.ok(at('cp CNAME dist/CNAME') < at('node scripts/lib/audit-dist.mjs'), 'CNAME is in dist before audit-dist');
  assert.ok(commands.includes('node scripts/lib/audit-dist.mjs --dist dist --cname CNAME --cname-in-dist'));
  assert.ok(commands.includes('node scripts/audit-route-ledger.mjs --dist dist --ledger reports/ledger.json --strict'));
  assert.ok(commands.includes('node scripts/audit-links.mjs --dist dist --ledger reports/ledger.json --strict'));
});

test('the styleguide route emits nothing without PUBLIC_STYLEGUIDE=1 and nothing in a release build', async () => {
  const paths = async (env: Record<string, string>): Promise<unknown[]> => {
    const before = { ...process.env };
    delete process.env.PUBLIC_STYLEGUIDE;
    delete process.env.PUBLIC_RELEASE;
    Object.assign(process.env, env);
    try {
      const { readFlag } = await import('../../../src/lib/env.ts');
      const source = read('src/pages/styleguide/[...slug].astro');
      const expression = /export const getStaticPaths = \((\(\) => .*)\) satisfies GetStaticPaths;/.exec(source)?.[1];
      assert.ok(expression, 'the route declares getStaticPaths on one line');
      return (new Function('readFlag', `return (${expression})();`)(readFlag) as unknown[]);
    } finally {
      process.env = before;
    }
  };
  assert.deepEqual(await paths({}), []);
  assert.deepEqual(await paths({ PUBLIC_STYLEGUIDE: '0' }), []);
  assert.deepEqual(await paths({ PUBLIC_STYLEGUIDE: '1', PUBLIC_RELEASE: '1' }), []);
  assert.deepEqual(await paths({ PUBLIC_STYLEGUIDE: '1' }), [{ params: { slug: undefined } }]);
  assert.throws(() => read('src/pages/styleguide.astro'), 'the always-built static page is gone');
});
