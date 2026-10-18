import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

// Issue #110: qa went red across MRs because CI job pods are CPU-starved. Two patterns in tests/e2e turn that into failures,
// so this gate keeps them out. networkidle can hang with nothing in flight (use quiet(page).settled() from support/page-guards.ts),
// and a full-page axe scan with the flat 45 s budget outruns a big page (use analyzePage from support/budgets.ts).

const E2E = join(import.meta.dirname, '..', '..', 'e2e');
const HELPER = join(E2E, 'support', 'budgets.ts');

function specFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return specFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** The code of a file with comments blanked out (newlines kept), so prose that names a pattern is not a use of it. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;
const files = specFiles(E2E);

test('the e2e directory is found and holds specs', () => {
  assert.ok(files.length > 30, `only ${files.length} files under ${E2E}`);
  assert.ok(files.includes(HELPER), 'tests/e2e/support/budgets.ts exists');
});

test('no e2e file waits for networkidle', () => {
  const found: string[] = [];
  for (const path of files) {
    const text = code(path);
    for (const match of text.matchAll(/networkidle/g)) found.push(`${relative(E2E, path)}:${lineOf(text, match.index ?? 0)}`);
  }
  assert.deepEqual(found, [], 'use quiet(page).settled(), attached before goto');
});

test('every full-page AxeBuilder scan goes through analyzePage', () => {
  const found: string[] = [];
  for (const path of files) {
    if (path === HELPER) continue;
    const text = code(path);
    for (const match of text.matchAll(/new\s+AxeBuilder\b[\s\S]*?(?:\.analyze\s*\(|;)/g)) {
      if (!/\.include\s*\(/.test(match[0])) found.push(`${relative(E2E, path)}:${lineOf(text, match.index ?? 0)}`);
    }
  }
  assert.deepEqual(found, [], 'use analyzePage(page) so the budget follows the page; scans scoped with .include() may stay direct');
});

test('the helper sets the budget from the element count and caps it', () => {
  const text = code(HELPER);
  assert.match(text, /BASE_BUDGET_MS\s*=\s*45_000/);
  assert.match(text, /MAX_BUDGET_MS\s*=\s*180_000/);
  assert.match(text, /AXE_MS_PER_1000_ELEMENTS\s*=\s*10_000/);
  assert.match(text, /locator\('\*'\)\.count\(\)/);
});
