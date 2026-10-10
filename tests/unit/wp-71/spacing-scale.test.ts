import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

// The rendered audit (tests/e2e/wave8/wp-71/brand-audit.spec.ts) accepts only the --sp-1 to --sp-10 steps for a gap or a vertical padding in
// the family and brand components. The fluid --space-* tokens are clamps and land between the steps, so they fail it on the page; this test
// catches the same mistake without a build.

const ROOT = new URL('../../../', import.meta.url).pathname;
const FOLDERS = ['src/components/families', 'src/components/brand'];
const FLUID = /(?:^|[;{\s])(?:gap|row-gap|column-gap|padding(?:-block|-top|-bottom)?(?:-start|-end)?)\s*:[^;}]*var\(--space-/;

const styleBlocks = (source: string): string[] => [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '');

test('a gap or a vertical padding in the family and brand components is a --sp-* step, never a fluid --space-* token', () => {
  const offenders: string[] = [];
  for (const folder of FOLDERS) {
    for (const name of readdirSync(`${ROOT}${folder}`)) {
      if (!name.endsWith('.astro') && !name.endsWith('.css')) continue;
      const source = readFileSync(`${ROOT}${folder}/${name}`, 'utf8');
      const css = name.endsWith('.css') ? [source] : styleBlocks(source);
      for (const block of css) {
        for (const line of block.split('\n')) {
          if (FLUID.test(line)) offenders.push(`${folder}/${name}: ${line.trim()}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('the check sees the mistake it guards against', () => {
  assert.match('    gap: var(--space-group);', FLUID);
  assert.match('  padding-block: var(--space-block);', FLUID);
  assert.doesNotMatch('    gap: var(--sp-6);', FLUID);
  assert.doesNotMatch('    margin-block: var(--space-block);', FLUID);
});
