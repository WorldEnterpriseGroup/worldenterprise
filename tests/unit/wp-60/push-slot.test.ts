import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// The push-slot protocol (plan 4.2, W8-21) keeps at most three branch pipelines running at once across every worktree (it was five until
// 2026-10-10: with five, the Playwright and Lighthouse jobs starved each other on the 100m job pods, FocusApiary/gitlab-k8s#16).
// The script is committed in .astro-magazine/plans/wave8/ and tests itself with a mocked push and a mocked pipeline status:
// four pushes through two slots never overlap more than two, a failed pipeline exits 1, a missing pipeline exits 3.

const script = new URL('../../../.astro-magazine/plans/wave8/push-slot-test.sh', import.meta.url).pathname;

function hasTool(name: string): boolean {
  return spawnSync('bash', ['-c', `command -v ${name}`], { encoding: 'utf8' }).status === 0;
}

const missing = ['flock', 'python3', 'bash'].filter((tool) => !hasTool(tool));
const skipReason = missing.length > 0 ? `${missing.join(' and ')} not available in this environment` : false;

test('the push-slot self-test passes', { skip: skipReason, timeout: 120_000 }, () => {
  const run = spawnSync('bash', [script], { encoding: 'utf8', timeout: 110_000 });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /four pushes through two slots: ok/);
  assert.match(run.stdout, /failed pipeline exits 1, missing pipeline exits 3: ok/);
  assert.match(run.stdout, /push-slot self-test passed/);
});

test('the default cap is three slots, and the script says why', () => {
  const text = readFileSync(new URL('../../../.astro-magazine/plans/wave8/push-slot.sh', import.meta.url), 'utf8');
  assert.match(text, /^slots=3$/m);
  assert.match(text, /default 3/);
  assert.match(text, /gitlab-k8s#16/, 'the reason and the issue that lifts it are named');
});

// The script reads the pipeline through `glab api`. A stand-in `glab` on PATH records the request and answers, so the real status_of runs.
const slotScript = new URL('../../../.astro-magazine/plans/wave8/push-slot.sh', import.meta.url).pathname;

interface WatchRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly requests: readonly string[];
}

/** What the stand-in `glab` answers while it is failing: a transport error, an HTML gateway page with exit 0, or a JSON error object. */
type Failure = 'exit' | 'html' | 'object';

const FAILURE_LINES: Readonly<Record<Failure, string>> = {
  exit: 'echo "connection reset" >&2; exit 1',
  html: 'echo "<html><body><h1>504 Gateway Time-out</h1></body></html>"; exit 0',
  object: 'echo \'{"message": "500 Internal Server Error"}\'; exit 0',
};

function runWatch(failFirstLookups: number, failure: Failure = 'exit', extraEnv: Readonly<Record<string, string>> = {}): WatchRun {
  const dir = mkdtempSync(join(tmpdir(), 'push-slot-'));
  try {
    const log = join(dir, 'requests.log');
    const counter = join(dir, 'calls');
    writeFileSync(counter, '0');
    // The stand-in fails its first `failFirstLookups` calls, then reports one successful push pipeline.
    writeFileSync(
      join(dir, 'glab'),
      [
        '#!/usr/bin/env bash',
        `echo "$2" >> "${log}"`,
        `n=$(( $(cat "${counter}") + 1 )); echo "$n" > "${counter}"`,
        `if [ "$n" -le ${failFirstLookups} ]; then ${FAILURE_LINES[failure]}; fi`,
        'echo \'[{"id": 4242, "status": "success", "created_at": "2999-01-01T00:00:00Z"}]\'',
      ].join('\n'),
      { mode: 0o755 },
    );
    const run = spawnSync('bash', [slotScript, 'watch', 'wp/test', '--slots', '1'], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ''}`, WAVE8_SLOT_DIR: join(dir, 'slots'), WAVE8_POLL_SECONDS: '1', ...extraEnv },
    });
    const requests = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
    return { status: run.status, stdout: run.stdout, stderr: run.stderr, requests };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the pipeline lookup asks for source=push, so a jobless merge request pipeline for the sha never hides the push pipeline', { skip: skipReason }, () => {
  const run = runWatch(0);
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /pipeline 4242: success/);
  assert.ok(run.requests.length > 0);
  for (const request of run.requests) {
    assert.match(request, /[?&]source=push(&|$)/, request);
    assert.match(request, /[?&]ref=wp\/test(&|$)/, request);
  }
});

test('a lookup that fails once while the script holds a slot is retried, not fatal', { skip: skipReason }, () => {
  const run = runWatch(1);
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /pipeline 4242: success/);
  assert.ok(run.requests.length >= 2, 'the first lookup failed and a second one succeeded');
});

test('a gateway page or an error object that is not a pipeline list (a 5xx on the API) is retried, not fatal', { skip: skipReason }, () => {
  for (const failure of ['html', 'object'] as const) {
    const run = runWatch(2, failure);
    assert.equal(run.status, 0, `${failure}: ${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /pipeline 4242: success/);
    assert.ok(run.requests.length >= 3, `${failure}: two lookups failed and a third succeeded`);
    assert.match(run.stderr, /retrying/, `${failure}: the retry is said`);
  }
});

test('lookups that fail for longer than the appear window do not end in "no pipeline appeared", because a failed lookup is not a missing pipeline', { skip: skipReason }, () => {
  for (const failure of ['exit', 'html'] as const) {
    const run = runWatch(5, failure, { WAVE8_APPEAR_SECONDS: '2' });
    assert.equal(run.status, 0, `${failure}: ${run.stdout}\n${run.stderr}`);
    assert.doesNotMatch(run.stderr, /no pipeline appeared/);
    assert.match(run.stdout, /pipeline 4242: success/);
  }
});

test('a lookup that hangs is cut off at the lookup timeout and retried', { skip: skipReason }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'push-slot-hang-'));
  try {
    const counter = join(dir, 'calls');
    writeFileSync(counter, '0');
    writeFileSync(
      join(dir, 'glab'),
      [
        '#!/usr/bin/env bash',
        `n=$(( $(cat "${counter}") + 1 )); echo "$n" > "${counter}"`,
        'if [ "$n" -le 1 ]; then sleep 30; fi',
        'echo \'[{"id": 4242, "status": "success", "created_at": "2999-01-01T00:00:00Z"}]\'',
      ].join('\n'),
      { mode: 0o755 },
    );
    const run = spawnSync('bash', [slotScript, 'watch', 'wp/test', '--slots', '1'], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ''}`, WAVE8_SLOT_DIR: join(dir, 'slots'), WAVE8_POLL_SECONDS: '1', WAVE8_LOOKUP_SECONDS: '2' },
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /pipeline 4242: success/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Merge mode (#111): `push-slot.sh merge <iid> <sha>` serializes merges to demo. The status lookup and the merge call are stand-ins
// (WAVE8_STATUS_CMD, WAVE8_MERGE_CMD). Before the merge the stand-in demo pipeline is "running" for `runningLookups` lookups and then
// success; once the merge stand-in has run, the newest demo pipeline is the merge commit's, with the result in the `result` file.

interface MergeSandbox {
  readonly dir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly events: () => readonly string[];
}

function mergeSandbox(options: { readonly runningLookups?: number; readonly result?: string; readonly mergeFails?: boolean; readonly mergeSeconds?: number }): MergeSandbox {
  const dir = mkdtempSync(join(tmpdir(), 'push-slot-merge-'));
  const events = join(dir, 'events.log');
  writeFileSync(events, '');
  writeFileSync(join(dir, 'lookups'), '0');
  writeFileSync(join(dir, 'result'), options.result ?? 'success');
  writeFileSync(
    join(dir, 'status.sh'),
    [
      '#!/usr/bin/env bash',
      `now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"`,
      `n=$(( $(cat "${join(dir, 'lookups')}") + 1 )); echo "$n" > "${join(dir, 'lookups')}"`,
      `if [ -e "${join(dir, 'merged')}" ]; then echo "10 $(cat "${join(dir, 'result')}") $now"; exit 0; fi`,
      `if [ "$n" -le ${options.runningLookups ?? 0} ]; then echo "9 running 2000-01-01T00:00:00Z"; else echo "9 success 2000-01-01T00:00:00Z"; fi`,
    ].join('\n'),
    { mode: 0o755 },
  );
  writeFileSync(
    join(dir, 'merge.sh'),
    [
      '#!/usr/bin/env bash',
      `echo "+ $1 lookups=$(cat "${join(dir, 'lookups')}")" >> "${events}"`,
      options.mergeFails ? 'echo \'{"message":"405 Method Not Allowed"}\'; echo "- $1" >> "' + events + '"; exit 1' : '',
      `sleep ${options.mergeSeconds ?? 0}`,
      `touch "${join(dir, 'merged')}"`,
      `echo "- $1" >> "${events}"`,
      'echo \'{"state":"merged"}\'',
    ].join('\n'),
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    WAVE8_SLOT_DIR: join(dir, 'slots'),
    WAVE8_STATUS_CMD: join(dir, 'status.sh'),
    WAVE8_MERGE_CMD: join(dir, 'merge.sh'),
    WAVE8_POLL_SECONDS: '1',
    WAVE8_APPEAR_SECONDS: '5',
  };
  return { dir, env, events: () => readFileSync(events, 'utf8').split('\n').filter(Boolean) };
}

function runMerge(box: MergeSandbox, iid: string) {
  return spawnSync('bash', [slotScript, 'merge', iid, 'abc123', '--project', '228'], { encoding: 'utf8', timeout: 60_000, env: box.env });
}

test('merge waits while the newest demo pipeline is running, and merges only once it is final', { skip: skipReason }, () => {
  const box = mergeSandbox({ runningLookups: 3 });
  try {
    const run = runMerge(box, '7');
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /newest demo pipeline 9 is running, waiting/);
    assert.match(run.stdout, /newest demo pipeline 9 is final: success/);
    const merged = box.events().find((line) => line.startsWith('+ 7'));
    assert.ok(merged, 'the merge call happened');
    assert.match(merged, /lookups=4/, 'three lookups saw the pipeline running before the merge');
  } finally {
    rmSync(box.dir, { recursive: true, force: true });
  }
});

test('the demo merge lock is exclusive: two merges never overlap', { skip: skipReason, timeout: 60_000 }, async () => {
  const box = mergeSandbox({ mergeSeconds: 2 });
  try {
    const start = (iid: string) =>
      new Promise<number | null>((resolve) => {
        const child = spawn('bash', [slotScript, 'merge', iid, 'abc123'], { env: box.env, stdio: 'ignore' });
        child.on('close', resolve);
      });
    const codes = await Promise.all([start('1'), start('2')]);
    assert.deepEqual(codes, [0, 0]);
    const log = box.events().map((line) => line.split(' ').slice(0, 2).join(' '));
    assert.equal(log.length, 4);
    // Each merge ends before the other begins: the pairs are adjacent.
    assert.equal(log[0]?.slice(2), log[1]?.slice(2));
    assert.equal(log[2]?.slice(2), log[3]?.slice(2));
    assert.equal(log[0]?.[0], '+');
    assert.equal(log[1]?.[0], '-');
  } finally {
    rmSync(box.dir, { recursive: true, force: true });
  }
});

test('a merge the API refuses exits 2, shows the API message and does not wait for a pipeline', { skip: skipReason }, () => {
  const box = mergeSandbox({ mergeFails: true });
  try {
    const run = runMerge(box, '8');
    assert.equal(run.status, 2, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /405 Method Not Allowed/);
    assert.match(run.stderr, /merge refused \(405\)/);
    assert.doesNotMatch(run.stdout, /waiting for the demo pipeline of the merge commit/);
  } finally {
    rmSync(box.dir, { recursive: true, force: true });
  }
});

test('the demo pipeline of the merge commit becomes the exit code: success 0, failed 1, canceled 1', { skip: skipReason }, () => {
  for (const [result, code] of [['success', 0], ['failed', 1], ['canceled', 1]] as const) {
    const box = mergeSandbox({ result });
    try {
      const run = runMerge(box, '9');
      assert.equal(run.status, code, `${result}: ${run.stdout}\n${run.stderr}`);
      assert.match(run.stdout, new RegExp(`pipeline 10: ${result}`));
    } finally {
      rmSync(box.dir, { recursive: true, force: true });
    }
  }
});

test('merge needs a numeric merge request iid and a sha', { skip: skipReason }, () => {
  const run = spawnSync('bash', [slotScript, 'merge', 'abc'], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, WAVE8_SLOT_DIR: join(tmpdir(), 'push-slot-usage') } });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /usage: push-slot.sh merge <mr-iid> <sha>/);
});
