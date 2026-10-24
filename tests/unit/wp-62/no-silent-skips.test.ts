import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * The WP-62 e2e specs may not skip. The pipeline builds the whole site, so a page that is missing is a defect, and a skip turns that
 * defect into a green run that verified nothing (the audit of !116). A page may be absent only for a reason the data states, and
 * tests/e2e/wave8/wp-62/presence.ts asserts that reason. This guard fails when a spec in that folder skips, marks a test as expected to
 * fail, reads `isBuilt` or the route lists (which drop a missing page without a word) directly, or when the helper stops asserting.
 */
const dir = new URL('../../e2e/wave8/wp-62/', import.meta.url).pathname;
const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('the folder holds the two specs and the presence helper', () => {
  assert.deepEqual(files.sort(), ['home-founders.spec.ts', 'presence.ts', 'surface-matrix.spec.ts']);
});

for (const name of files) {
  const code = stripComments(readFileSync(join(dir, name), 'utf8'));
  test(`${name} never skips, and never drops a missing page`, () => {
    assert.doesNotMatch(code, /\.(?:skip|fixme|fail)\s*\(/, 'no skip, fixme or fail call');
    assert.doesNotMatch(code, /\bskip\s*:/, 'no skip option');
    assert.doesNotMatch(code, /\b(?:liveRoutes|pendingRoutes|liveIndexable)\b/, 'no route list that drops an unbuilt page');
    if (name !== 'presence.ts') assert.doesNotMatch(code, /\bisBuilt\b/, 'a spec asks presence.ts, not isBuilt, whether a page is built');
  });
}

test('presence.ts fails a launched page that is not built, and asserts the reason for any other absence', () => {
  const code = stripComments(readFileSync(join(dir, 'presence.ts'), 'utf8'));
  assert.match(code, /expect\(isBuilt\(path\), `\$\{path\} must be built[^`]*`\)\.toBe\(true\)/);
  assert.match(code, /expect\(isLaunched\(path\)[\s\S]*?\.toBe\(false\)/);
  assert.match(code, /expect\(isBuilt\(path\)[\s\S]*?is a draft[\s\S]*?\.toBe\(false\)/);
});
