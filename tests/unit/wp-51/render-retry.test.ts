import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runBrowser, timeoutFromEnv } from '../../../infra/intake/render/render.mjs';
import type { BrowserRun } from '../../../infra/intake/render/render.mjs';

// The brief renderer's browser launch (intake:render): a print that times out on a small runner is tried once more, and every
// other failure still fails loudly.

function timedOut(): BrowserRun {
  return { error: Object.assign(new Error('spawnSync chrome-headless-shell ETIMEDOUT'), { code: 'ETIMEDOUT' }), status: null };
}

test('a timed-out print is retried once, with a log line, and the second run is used', () => {
  const runs: BrowserRun[] = [timedOut(), { status: 0, stderr: '' }];
  const lines: string[] = [];
  const result = runBrowser(() => runs.shift() ?? assert.fail('ran too often'), { timeoutMs: 1000, log: (line) => lines.push(line) });
  assert.equal(result.status, 0);
  assert.equal(runs.length, 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0] ?? '', /did not finish within 1000 ms \(attempt 1 of 2\); retrying once/);
});

test('two timeouts in a row fail, naming the attempts', () => {
  let calls = 0;
  assert.throws(
    () => runBrowser(() => { calls += 1; return timedOut(); }, { timeoutMs: 1000 }),
    /the browser did not run after 2 attempt\(s\) of 1000 ms: .*ETIMEDOUT/,
  );
  assert.equal(calls, 2);
});

test('any other spawn error fails at once, without a retry', () => {
  let calls = 0;
  const missing = (): BrowserRun => { calls += 1; return { error: Object.assign(new Error('spawnSync chrome ENOENT'), { code: 'ENOENT' }), status: null }; };
  assert.throws(() => runBrowser(missing), /^Error: the browser did not run: spawnSync chrome ENOENT$/);
  assert.equal(calls, 1);
});

test('a non-zero exit fails at once with the end of stderr', () => {
  let calls = 0;
  assert.throws(
    () => runBrowser(() => { calls += 1; return { status: 21, stderr: 'one\ntwo\nthree\nfour' }; }),
    /exited with status 21: two three four/,
  );
  assert.equal(calls, 1);
});

test('the timeout comes from RENDER_PDF_TIMEOUT_MS when it is a positive whole number', () => {
  assert.equal(timeoutFromEnv(undefined, 180_000), 180_000);
  assert.equal(timeoutFromEnv('', 180_000), 180_000);
  assert.equal(timeoutFromEnv('240000', 180_000), 240_000);
  for (const bad of ['0', '-5', '1.5', 'soon']) assert.throws(() => timeoutFromEnv(bad, 180_000), /RENDER_PDF_TIMEOUT_MS/);
});
