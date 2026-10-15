import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  frontMatterList,
  frontMatterScalar,
  MIN_PROBE_WORDS,
  normalize,
  pickProbes,
  readBrief,
  searchTree,
  selfTest,
  sharedRun,
} from '../../../scripts/lib/gated-briefs.mjs';
import { BRIEF_IDS } from '../../../src/data/families.ts';

// WP-60 60b item 12 (docs/wave8-contracts.md section 5.3): the gated-brief audit proves itself on every pipeline, finds a sentinel in a page, a
// Markdown twin, llms-full.txt and a real Pagefind fragment, and is wired into CI so that it exists only once a brief does.

const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const ci = read('.gitlab-ci.yml');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

const SENTENCE = 'The quiet ledger of a small workshop records every lantern that was lit before the first frost arrived.';

function briefText(extra = ''): string {
  const lines: string[] = [];
  for (let i = 1; i <= 40; i += 1) lines.push(i === 20 ? SENTENCE : `Paragraph ${i} describes one plain subject in short words and ties to no other text${extra} of this fixture.`, '');
  return ['---', 'id: sample', 'title: "A sample"', 'audience: [startup, corporate]', `sentinel: "${SENTENCE}"`, '---', '', '## Section', '', ...lines].join('\n');
}

test('the audit proves itself: every check of its self-test passes', () => {
  const results = selfTest() as { label: string; ok: boolean }[];
  assert.ok(results.length >= 12, `the self-test has ${results.length} checks`);
  for (const r of results) assert.equal(r.ok, true, r.label);
});

test('normalize folds case, curly quotes, dashes and spacing, and nothing else', () => {
  assert.equal(normalize('  It’s  “Odd” — really…\n'), 'it\'s "odd" - really...');
});

test('front matter scalars and lists are read, quoted or not, and a missing key is null', () => {
  const raw = ['id: sample', 'sentinel: "It said \\"yes\\" once."', "title: 'It''s fine'", 'version: "1.0" # a comment', 'audience: [startup, "investor"]'].join('\n');
  assert.equal(frontMatterScalar(raw, 'id'), 'sample');
  assert.equal(frontMatterScalar(raw, 'sentinel'), 'It said "yes" once.');
  assert.equal(frontMatterScalar(raw, 'title'), "It's fine");
  assert.equal(frontMatterScalar(raw, 'version'), '1.0');
  assert.equal(frontMatterScalar(raw, 'missing'), null);
  assert.deepEqual(frontMatterList(raw, 'audience'), ['startup', 'investor']);
  assert.equal(frontMatterList(raw, 'id'), null);
});

test('probes are chosen by a fixed rule: three sentences of at least twelve words, one per position, the same on every run', () => {
  const body = briefText().split('\n---\n')[1] as string;
  const first = pickProbes(body) as { position: number; text: string }[];
  const second = pickProbes(body) as { position: number; text: string }[];
  assert.deepEqual(first, second, 'deterministic');
  assert.equal(first.length, 3);
  assert.deepEqual(first.map((p) => p.position), [25, 50, 75]);
  for (const probe of first) assert.ok(probe.text.split(/\s+/).length >= MIN_PROBE_WORDS, `"${probe.position}" probe has ${MIN_PROBE_WORDS} words`);
});

test('a brief with a bad id, a short sentinel or a sentinel that is not in the body is reported, a good one is not', () => {
  assert.deepEqual(readBrief('/x/sample.md', briefText()).errors, []);
  assert.ok(readBrief('/x/other.md', briefText()).errors.some((e: string) => e.includes('is not the file name')));
  assert.ok(readBrief('/x/sample.md', briefText().replace(/^sentinel: .*$/m, 'sentinel: "Too short."')).errors.some((e: string) => e.includes('fewer than')));
  assert.ok(readBrief('/x/sample.md', briefText().replace(/^sentinel: .*$/m, 'sentinel: "A long enough sentence that the body of this fixture does not contain at all."')).errors.some((e: string) => e.includes('does not appear verbatim')));
  assert.ok(readBrief('/x/sample.md', briefText().replace(/^sentinel: .*\n/m, '')).errors.some((e: string) => e.includes('no sentinel')));
});

test('a run of ten shared words is found and a run of nine is not', () => {
  const ten = 'one two three four five six seven eight nine ten';
  assert.ok(sharedRun(`before ${ten} after`, `x ${ten} y`) >= 0);
  assert.equal(sharedRun('one two three four five six seven eight nine then', `x ${ten} y`), -1);
});

test('a real Pagefind index of a page that holds the sentinel is searched through its gzip fragments', (t) => {
  const bin = new URL('node_modules/.bin/pagefind', root);
  if (!existsSync(bin)) {
    t.skip('pagefind is not installed');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'gated-pagefind-'));
  try {
    const site = join(dir, 'site');
    mkdirSync(site, { recursive: true });
    writeFileSync(join(site, 'index.html'), `<html lang="en"><body><main data-pagefind-body><h1>Probe</h1><p>${SENTENCE}</p></main></body></html>`);
    execFileSync(bin.pathname, ['--site', site, '--output-subdir', 'pagefind'], { stdio: 'pipe' });
    const found = searchTree(site, [{ briefId: 'sample', label: 'sentinel', text: SENTENCE }]) as { fragments: number; findings: { where: string }[] };
    assert.ok(found.fragments >= 1, 'the index has a fragment');
    assert.ok(found.findings.some((f) => f.where.endsWith('.pf_fragment')), 'the sentence is found inside a real fragment');
    const none = searchTree(site, [{ briefId: 'sample', label: 'sentinel', text: 'A sentence that no page of this tiny site contains anywhere at all.' }]) as { findings: unknown[] };
    assert.deepEqual(none.findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the eleven brief ids of the registry are the brief files the audit will read', () => {
  // Wave 9 (W9-13): WP-58 adds the timeline brief, real-timeline.
  assert.equal(BRIEF_IDS.length, 11);
  for (const id of BRIEF_IDS) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${id} is a file-name-safe id`);
});

// ---- CI wiring -------------------------------------------------------------------------------------------------------------------

function block(name: string): string {
  const start = ci.search(new RegExp(`^${name.replace(/[.:]/g, '\\$&')}:`, 'm'));
  assert.ok(start >= 0, `${name} is defined in .gitlab-ci.yml`);
  const rest = ci.slice(start + 1);
  const next = rest.search(/\n[^\s#]/);
  return next < 0 ? ci.slice(start) : ci.slice(start, start + 1 + next);
}

function rules(text: string): { when: string; allowFailure: string; exists: string[] }[] {
  return text
    .slice(text.indexOf('  rules:'))
    .split(/\n    - if: /)
    .slice(1)
    .map((chunk) => ({
      when: (chunk.split('\n')[0] ?? '').trim(),
      allowFailure: /allow_failure: (\w+)/.exec(chunk)?.[1] ?? '',
      exists: [...chunk.matchAll(/^ {8}- (\S+)$/gm)].map((m) => m[1] as string),
    }));
}

for (const [job, guard] of [['e2e:wave8', 'tests/e2e/wave8/**/*.spec.ts'], ['audit:gated', 'infra/intake/briefs/*.md']] as const) {
  test(`${job} has the .qa-rules policy and exists only once ${guard} does`, () => {
    const base = rules(block('.qa-rules'));
    const mine = rules(block(job));
    assert.deepEqual(mine.map((r) => [r.when, r.allowFailure]), base.map((r) => [r.when, r.allowFailure]));
    for (const rule of mine) assert.deepEqual(rule.exists, [guard]);
    assert.ok(mine.some((r) => r.allowFailure === 'true'));
  });
}

test('audit:gated runs the leak audit and the source claims scan, and the scripts say what the contract says', () => {
  const gated = block('audit:gated');
  assert.match(gated, /extends: \[\.audit\]/);
  assert.match(gated, /npm run audit:gated\n/);
  assert.match(gated, /npm run audit:claims:source/);
  assert.equal(pkg.scripts['audit:gated'], 'node scripts/audit-gated-briefs.mjs --dist dist --briefs infra/intake/briefs --also src --also docs --abstracts src/content/briefs');
  assert.equal(pkg.scripts['audit:gated:selftest'], 'node scripts/audit-gated-briefs.mjs --self-test');
  assert.equal(pkg.scripts['audit:claims:source'], 'node scripts/audit-claims.mjs --source infra/intake/briefs');
});

test('e2e:wave8 runs the two wave 8 projects only', () => {
  const e2e = block('e2e:wave8');
  assert.match(e2e, /extends: \[\.e2e\]/);
  assert.match(e2e, /E2E_WAVE8: "1"/);
  assert.match(e2e, /npx playwright test --project=wave8-desktop-1440x900 --project=wave8-mobile-390x844/);
});

test('the intake include is local, guarded by exists, and added once', () => {
  const includes = ci.slice(ci.indexOf('include:'), ci.indexOf('\n# The include declares'));
  assert.match(includes, /- local: \/infra\/intake\/ci\.yml\n\s+rules:\n\s+- exists:\n\s+- infra\/intake\/ci\.yml/);
  assert.equal([...ci.matchAll(/infra\/intake\/ci\.yml/g)].length >= 2, true);
  assert.equal([...ci.matchAll(/^\s+- local:/gm)].length, 1, 'exactly one local include');
});

test('the mirror confirmation waits for both new jobs when they exist and skips them when they do not', () => {
  const mirror = block('mirror');
  for (const job of ['e2e:wave8', 'audit:gated']) assert.match(mirror, new RegExp(`- job: ${job}\\n\\s+artifacts: false\\n\\s+optional: true`));
});

test('the wave 8 Playwright projects exist only with E2E_WAVE8, and the common projects ignore the directory', async () => {
  type Project = { name: string; testIgnore?: RegExp | RegExp[]; testMatch: RegExp | RegExp[] };
  const load = async (env: string | undefined): Promise<Project[]> => {
    if (env === undefined) delete process.env.E2E_WAVE8;
    else process.env.E2E_WAVE8 = env;
    const mod = (await import(`../../../playwright.config.ts?e2e-wave8=${env ?? 'off'}`)) as { default: { projects: Project[] } };
    return mod.default.projects;
  };
  const before = process.env.E2E_WAVE8;
  const beforeSeven = process.env.E2E_WAVE7;
  delete process.env.E2E_WAVE7;
  try {
    const off = await load(undefined);
    assert.equal(off.some((p) => p.name.startsWith('wave8-')), false);
    const on = await load('1');
    assert.deepEqual(on.slice(-2).map((p) => p.name), ['wave8-desktop-1440x900', 'wave8-mobile-390x844']);
    const spec = '/work/tests/e2e/wave8/wp-62/founders.spec.ts';
    for (const p of on.filter((x) => x.name.startsWith('wave8-'))) {
      assert.ok((p.testMatch as RegExp).test(spec));
      assert.equal((p.testMatch as RegExp).test('/work/tests/e2e/routes.spec.ts'), false);
    }
    for (const p of on.filter((x) => x.name === 'desktop-1440x900' || x.name === 'mobile-390x844')) {
      assert.ok([p.testIgnore ?? []].flat().some((re) => re.test(spec)), `${p.name} ignores tests/e2e/wave8/**`);
    }
  } finally {
    if (before === undefined) delete process.env.E2E_WAVE8;
    else process.env.E2E_WAVE8 = before;
    if (beforeSeven !== undefined) process.env.E2E_WAVE7 = beforeSeven;
  }
});
