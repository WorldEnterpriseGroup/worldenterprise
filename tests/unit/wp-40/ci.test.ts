import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { unallowed } from '../../../scripts/lib/release-gate.mjs';
import { getRoute, MACHINE_ROUTES } from '../../../src/data/routes.ts';

// WP-40 (issue #29, decisions W7-6 and W7-9): the two wave 7 QA jobs are inert until their files exist, follow the blocking policy of
// every other qa job, and the release allowance covers exactly the pending wave 7 rows on a branch and nothing on a release.

const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const ci = read('.gitlab-ci.yml');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

/** The text of one top-level key: from its line to the next top-level line. */
function block(name: string): string {
  const start = ci.search(new RegExp(`^${name.replace(/[.:]/g, '\\$&')}:`, 'm'));
  assert.ok(start >= 0, `${name} is defined in .gitlab-ci.yml`);
  const rest = ci.slice(start + 1);
  const next = rest.search(/\n[^\s#]/);
  return next < 0 ? ci.slice(start) : ci.slice(start, start + 1 + next);
}

/** The rule list of a block as [if condition, allow_failure, exists patterns]. */
function rules(text: string): { when: string; allowFailure: string; exists: string[] }[] {
  const list = text.slice(text.indexOf('  rules:'));
  return list
    .split(/\n    - if: /)
    .slice(1)
    .map((chunk) => {
      const [when = ''] = chunk.split('\n');
      const exists = [...chunk.matchAll(/^ {8}- (\S+)$/gm)].map((m) => m[1] as string);
      return { when: when.trim(), allowFailure: /allow_failure: (\w+)/.exec(chunk)?.[1] ?? '', exists };
    });
}

const WAVE7_SPECS = 'tests/e2e/wave7/**/*.spec.ts';
const GEO_SCRIPT = 'scripts/audit-geo.mjs';

for (const [job, guard] of [['e2e:wave7', WAVE7_SPECS], ['audit:geo', GEO_SCRIPT]] as const) {
  test(`${job} has the .qa-rules policy on every branch and tag, and exists only once ${guard} does`, () => {
    const base = rules(block('.qa-rules'));
    const mine = rules(block(job));
    assert.ok(base.length >= 3, 'the shared policy has the tag, strict and branch rules');
    assert.deepEqual(mine.map((r) => [r.when, r.allowFailure]), base.map((r) => [r.when, r.allowFailure]), 'same conditions, same allow_failure');
    for (const rule of mine) assert.deepEqual(rule.exists, [guard], `every rule of ${job} is guarded by exists: ${guard}`);
    assert.ok(mine.some((r) => r.allowFailure === 'true'), 'the allowed-to-fail rule is kept, so QA_STRICT can be lifted for every qa job at once');
  });
}

test('e2e:wave7 runs the two wave 7 projects only, and audit:geo runs the npm script', () => {
  const e2e = block('e2e:wave7');
  assert.match(e2e, /extends: \[\.e2e\]/);
  assert.match(e2e, /E2E_WAVE7: "1"/);
  assert.match(e2e, /npx playwright test --project=wave7-desktop-1440x900 --project=wave7-mobile-390x844/);
  const geo = block('audit:geo');
  assert.match(geo, /extends: \[\.audit\]/);
  assert.match(geo, /npm run audit:geo/);
  assert.equal(pkg.scripts['audit:geo'], 'node scripts/audit-geo.mjs --dist dist');
});

test('the mirror confirmation waits for both wave 7 jobs when they exist and skips them when they do not', () => {
  const mirror = block('mirror');
  for (const job of ['e2e:wave7', 'audit:geo']) {
    assert.match(mirror, new RegExp(`- job: ${job}\\n\\s+artifacts: false\\n\\s+optional: true`), `${job} is an optional need of mirror`);
  }
});

test('no other job can pick up a wave 7 spec: the wave 7 projects exist only with E2E_WAVE7 and the common projects ignore the directory', async () => {
  const config = read('playwright.config.ts');
  assert.match(config, /process\.env\.E2E_WAVE7/);
  const names = async (env: string | undefined): Promise<{ name: string; testIgnore?: RegExp; testMatch: RegExp | RegExp[] }[]> => {
    if (env === undefined) delete process.env.E2E_WAVE7;
    else process.env.E2E_WAVE7 = env;
    const mod = (await import(`../../../playwright.config.ts?e2e-wave7=${env ?? 'off'}`)) as { default: { projects: { name: string; testIgnore?: RegExp; testMatch: RegExp | RegExp[] }[] } };
    return mod.default.projects;
  };
  const before = process.env.E2E_WAVE7;
  try {
    const off = await names(undefined);
    assert.deepEqual(off.map((p) => p.name), ['desktop-1440x900', 'mobile-390x844', 'mobile-320x568', 'no-js', 'forced-colors', 'zoom-200']);
    const on = await names('1');
    assert.deepEqual(on.slice(-2).map((p) => p.name), ['wave7-desktop-1440x900', 'wave7-mobile-390x844']);
    const spec = '/work/tests/e2e/wave7/wp-42/composer.spec.ts';
    const axeNamed = '/work/tests/e2e/wave7/wp-50/axe.spec.ts';
    for (const p of on.filter((x) => x.name.startsWith('wave7-'))) {
      assert.ok((p.testMatch as RegExp).test(spec), `${p.name} runs a wave 7 spec`);
      assert.equal((p.testMatch as RegExp).test('/work/tests/e2e/routes.spec.ts'), false, `${p.name} does not run the common specs`);
    }
    for (const p of on.filter((x) => x.name === 'desktop-1440x900' || x.name === 'mobile-390x844')) {
      assert.ok(p.testIgnore?.test(spec) && p.testIgnore.test(axeNamed), `${p.name} ignores tests/e2e/wave7/**, even a spec named like a common one`);
      assert.equal(p.testIgnore?.test('/work/tests/e2e/axe.spec.ts'), false);
    }
  } finally {
    if (before === undefined) delete process.env.E2E_WAVE7;
    else process.env.E2E_WAVE7 = before;
  }
});

/** The RELEASE_ALLOW a branch pipeline gets. */
function branchAllow(): string {
  const match = /^ {2}RELEASE_ALLOW:\n {4}value: '([^']+)'\n {4}expand: false$/m.exec(ci);
  assert.ok(match, 'RELEASE_ALLOW is a literal (expand: false) variable, so the trailing $ of each pattern survives GitLab variable expansion');
  return match[1] as string;
}

const PENDING = [
  '/program/how-we-decide/',
  '/about/facts/',
  '/tools/',
  '/tools/metrics-calculator/',
  '/tools/evidence-room/',
  '/about/frameworks/ubf/',
  '/star/',
  '/shift/',
  '/android/',
  '/llms.txt',
  '/llms-full.txt',
];

test('RELEASE_ALLOW covers the nine pending wave 7 rows, the two machine routes and the form routes, and nothing else (W7-6)', () => {
  const allow = branchAllow();
  for (const path of PENDING) {
    const isMachine = MACHINE_ROUTES.some((m) => m.path === path);
    assert.ok(isMachine || getRoute(path)?.launch === true, `${path} is a launched row or a machine route`);
    assert.deepEqual(unallowed([`launch:true route does not exist: ${path}`], allow), [], `${path} is tolerated while pending`);
  }
  assert.equal(PENDING.filter((p) => MACHINE_ROUTES.some((m) => m.path === p)).length, 2);
  assert.deepEqual(unallowed(['launched form route /apply/ has form "intake" in disabled mode'], allow), [], 'the form routes stay tolerated');
  for (const problem of [
    'launch:true route does not exist: /pricing/',
    'launch:true route does not exist: /tools/team-composer/',
    'launch:true route does not exist: /tools/evidence-room/extra/',
    'launch:true route does not exist: /about/facts',
    'launch:true route does not exist: /llms.txt.bak',
    'launch:true route does not exist: /robots.txt',
    'draft content remains: src/content/insights/x.mdx',
  ]) {
    assert.deepEqual(unallowed([problem], allow), [problem], `${problem} still fails`);
  }
});

test('a release tag and gh-pages still allow nothing: the wave 7 allowance cannot reach a release', () => {
  const release = block('verify:release');
  const rule = release.slice(release.indexOf('  rules:'));
  assert.match(rule, /CI_COMMIT_TAG =~ \/\^release-\/ \|\| \$CI_COMMIT_BRANCH == "gh-pages"'\n\s+variables:\n\s+RELEASE_ALLOW: ""/);
});
