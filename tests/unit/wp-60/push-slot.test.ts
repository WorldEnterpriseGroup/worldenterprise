import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// The push-slot protocol (plan 4.2, W8-21) keeps at most five branch pipelines running at once across every worktree.
// The script is committed in .astro-magazine/plans/wave8/ and tests itself with a mocked push and a mocked pipeline status:
// four pushes through two slots never overlap more than two, a failed pipeline exits 1, a missing pipeline exits 3.

const script = new URL('../../../.astro-magazine/plans/wave8/push-slot-test.sh', import.meta.url).pathname;

function hasTool(name: string): boolean {
  return spawnSync('bash', ['-c', `command -v ${name}`], { encoding: 'utf8' }).status === 0;
}

const missing = ['flock', 'python3', 'bash'].filter((tool) => !hasTool(tool));

test('the push-slot self-test passes', { skip: missing.length > 0 ? `${missing.join(' and ')} not available in this environment` : false, timeout: 120_000 }, () => {
  const run = spawnSync('bash', [script], { encoding: 'utf8', timeout: 110_000 });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /four pushes through two slots: ok/);
  assert.match(run.stdout, /failed pipeline exits 1, missing pipeline exits 3: ok/);
  assert.match(run.stdout, /push-slot self-test passed/);
});
