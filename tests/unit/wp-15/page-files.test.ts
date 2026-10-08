import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { listPageFiles, walkFiles } from '../../../src/lib/page-files.ts';
import { fileToRoute } from '../../../src/lib/route-core.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

test('listPageFiles returns glob-shaped keys that fileToRoute understands', () => {
  const files = listPageFiles(ROOT);
  assert.ok(files.includes('/src/pages/index.astro'));
  assert.ok(files.includes('/src/pages/insights/[slug].astro'));
  assert.ok(files.every((file) => file.startsWith('/src/pages/')));
  assert.deepEqual(files, [...files].sort(), 'the list is sorted, so the route state is stable between builds');
  assert.deepEqual(fileToRoute('/src/pages/insights/[slug].astro'), { pattern: '/insights/[slug]/', dynamic: true });
  const patterns = files.map((file) => fileToRoute(file)?.pattern).filter((pattern) => pattern !== undefined);
  assert.ok(patterns.includes('/'));
  assert.ok(patterns.includes('/trust/'));
});

test('listPageFiles fails loudly when run outside the repository root', () => {
  assert.throws(() => listPageFiles(join(ROOT, 'tests')), /No page files found/);
});

test('walkFiles treats a missing directory as empty', () => {
  assert.deepEqual(walkFiles(join(ROOT, 'does-not-exist')), []);
});

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(astro|ts|mjs)$/.test(entry.name) ? [full] : [];
  });
}

test('no module globs over src/pages: that links every page stylesheet on every page', () => {
  const offenders = sources(join(ROOT, 'src'))
    .filter((file) => /import\.meta\.glob\(\s*\[?\s*['"`][^'"`]*src\/pages/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(ROOT.length));
  assert.deepEqual(offenders, []);
});
