import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The route smoke attaches a full-page screenshot per route and project. Playwright's HTML report copies every attachment into
// playwright-report/data/, so the loose copies under test-results/screenshots/ stored each image twice and pushed the e2e:routes archive past
// the coordinator's upload limit (413). The job excludes the loose copies, keeps its artifact short-lived and runs as three shards, each with
// an archive of its own.

const ci = readFileSync(new URL('../../../.gitlab-ci.yml', import.meta.url), 'utf8');
const spec = readFileSync(new URL('../../e2e/routes.spec.ts', import.meta.url), 'utf8');

function block(name: string): string {
  const start = ci.search(new RegExp(`^${name.replace(/[.:]/g, '\\$&')}:`, 'm'));
  assert.ok(start >= 0, `${name} is defined in .gitlab-ci.yml`);
  const rest = ci.slice(start + 1);
  const next = rest.search(/\n[^\s#]/);
  return next < 0 ? ci.slice(start) : ci.slice(start, start + 1 + next);
}

/** The lines of the job's own `artifacts:` mapping (two-space indent), comments dropped. */
function artifactLines(job: string): string[] {
  const lines = block(job).split('\n');
  const from = lines.findIndex((l) => /^ {2}artifacts:\s*$/.test(l));
  assert.ok(from >= 0, `${job} sets its own artifacts`);
  const out: string[] = [];
  for (const line of lines.slice(from + 1)) {
    if (/^ {2}\S/.test(line)) break;
    if (line.trim() !== '' && !line.trim().startsWith('#')) out.push(line);
  }
  return out;
}

test('e2e:routes excludes the loose screenshots, which the HTML report already holds', () => {
  const lines = artifactLines('e2e:routes');
  assert.ok(lines.some((l) => /^ {4}exclude:\s*$/.test(l)), 'e2e:routes lists artifact excludes');
  assert.ok(lines.some((l) => /^ {6}- test-results\/screenshots\/\*\*\s*$/.test(l)), 'the screenshots directory is excluded');
});

test('e2e:routes also excludes the attachment copies Playwright makes under each test directory', () => {
  const lines = artifactLines('e2e:routes');
  assert.ok(lines.some((l) => /^ {6}- test-results\/\*\*\/attachments\/\*\*\s*$/.test(l)), 'test-results/**/attachments/** is excluded');
  assert.ok(!lines.some((l) => /playwright-report/.test(l) && /exclude|^ {6}-/.test(l)), 'the report copy, which is the one kept, is not excluded');
});

test('the exclude names the directory the route smoke actually writes to', () => {
  assert.match(spec, /`test-results\/screenshots\//, 'routes.spec.ts still writes under test-results/screenshots/');
  assert.match(spec, /info\.attach\(/, 'the screenshots are attached, so the report keeps a copy');
});

test('e2e:routes keeps its archive 3 days and does not narrow what uploads', () => {
  const lines = artifactLines('e2e:routes');
  assert.ok(lines.some((l) => /^ {4}expire_in: 3 days\s*$/.test(l)), 'e2e:routes expires after 3 days');
  assert.ok(!lines.some((l) => /^ {4}(paths|when):/.test(l)), 'when and paths come from .e2e, so traces still upload on failure');
  const shared = block('.e2e');
  assert.match(shared, /when: always/, '.e2e uploads on failure');
  for (const path of ['test-results/', 'playwright-report/', 'reports/']) {
    assert.ok(shared.includes(`- ${path}`), `.e2e still uploads ${path}`);
  }
});

test('no other e2e job drops artifacts', () => {
  for (const match of ci.matchAll(/^(e2e:[\w-]+):/gm)) {
    const job = match[1] ?? '';
    if (job === 'e2e:routes') continue;
    assert.ok(!/^ {2}artifacts:/m.test(block(job)) || !/exclude:/.test(block(job)), `${job} keeps its default artifacts`);
  }
});

test('e2e:routes runs as three shards that together run every test once', () => {
  const job = block('e2e:routes');
  assert.match(job, /^ {2}parallel: 3\s*$/m, 'e2e:routes is split over three jobs');
  const commands = job.split('\n').filter((l) => /^ {4}- npx playwright test /.test(l));
  assert.equal(commands.length, 1, 'one playwright command');
  assert.match(
    commands[0] ?? '',
    /^ {4}- npx playwright test routes layout\.spec folds shell --shard=\$CI_NODE_INDEX\/\$CI_NODE_TOTAL\s*$/,
    'the spec filter is unchanged and the shard comes from the job index and total, so changing parallel: re-splits the suite',
  );
});

test('the jobs that wait for e2e:routes name it once and so wait for every shard', () => {
  const waits = [...ci.matchAll(/^ {4}- job: e2e:routes\s*$/gm)];
  assert.ok(waits.length >= 1, 'a needs list still names e2e:routes');
  assert.ok(!/e2e:routes [0-9]\/[0-9]/.test(ci), 'no needs entry names a single shard');
});
