import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// e2e:a11y outgrew the one-hour job timeout as a single job (demo pipeline 69466: 571 axe tests, all passing, cut off at 1h). It now runs
// as shards that together run every axe test once, and the jobs that wait for it name it once and so wait for every shard.
const ci = readFileSync(new URL('../../../.gitlab-ci.yml', import.meta.url), 'utf8');

function block(name: string): string {
  const start = ci.indexOf(`\n${name}:\n`);
  assert.ok(start >= 0, `${name} is defined in .gitlab-ci.yml`);
  const rest = ci.slice(start + 1);
  const end = rest.slice(1).search(/\n\S/);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

test('e2e:a11y runs as shards that together run every axe test once', () => {
  const job = block('e2e:a11y');
  assert.match(job, /^ {2}parallel: [2-9]\s*$/m, 'e2e:a11y is split over several jobs');
  const commands = job.split('\n').filter((l) => /^ {4}- npx playwright test /.test(l));
  assert.equal(commands.length, 1, 'one playwright command');
  assert.match(
    commands[0] ?? '',
    /^ {4}- npx playwright test axe --shard=\$CI_NODE_INDEX\/\$CI_NODE_TOTAL\s*$/,
    'the spec filter is unchanged and the shard comes from the job index and total',
  );
});

test('the jobs that wait for e2e:a11y name it once and so wait for every shard', () => {
  assert.ok([...ci.matchAll(/^ {4}- job: e2e:a11y\s*$/gm)].length >= 1, 'a needs list still names e2e:a11y');
  assert.ok(!/e2e:a11y [0-9]\/[0-9]/.test(ci), 'no needs entry names a single shard');
});
