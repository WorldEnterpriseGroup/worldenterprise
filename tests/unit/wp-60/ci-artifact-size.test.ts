import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The route smoke attaches a full-page screenshot per route and project. Playwright's HTML report copies every attachment into
// playwright-report/data/, so the loose copies under test-results/screenshots/ stored each image twice and pushed the e2e:routes archive past
// the coordinator's upload limit (413). The job excludes the loose copies and keeps its artifact short-lived.

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
