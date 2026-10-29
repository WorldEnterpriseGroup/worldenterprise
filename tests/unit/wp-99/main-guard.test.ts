import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function scripts(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return scripts(path);
    return entry.name.endsWith('.mjs') ? [path] : [];
  });
}

// `node -e` leaves process.argv[1] undefined, so an unguarded main-module check throws on import and breaks every
// one-liner that imports the module, as the RELEASE.md step 2 open-items command did through release-gate.mjs (#20).
test('every main-module check tolerates a missing process.argv[1]', () => {
  const unguarded = scripts(join(ROOT, 'scripts')).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        line.includes('pathToFileURL(process.argv[1])') && !line.includes('process.argv[1] !== undefined &&')
          ? [`${relative(ROOT, file)}:${index + 1}`]
          : [],
      ),
  );
  assert.deepEqual(unguarded, []);
});

test('the RELEASE.md open-items one-liner runs under node -e', () => {
  const run = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { humanItemProblems } from './scripts/lib/wave8/release-open-items.mjs'; import { readFileSync } from 'node:fs'; console.log(humanItemProblems(readFileSync('.astro-magazine/release/RELEASE.md', 'utf8')).length)",
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout.trim(), /^\d+$/);
});
