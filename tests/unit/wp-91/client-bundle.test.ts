import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';

/**
 * The palette and the search script run in the browser. A module that reads the file system or `process` (the route ledger, the content
 * files) must not be in their import graph: it lands in the page bundle and throws "process is not defined" on every page. The first
 * palette build did exactly that through src/components/nav/commands.ts, so the browser reads src/components/islands/we-palette/model.ts.
 */
const root = new URL('../../../', import.meta.url).pathname;
const CLIENT_SCRIPTS = ['src/scripts/palette.ts', 'src/scripts/search.ts'];
const NODE_ONLY = [/from\s+['"]node:/, /\bprocess\.(env|argv|cwd|platform)\b/, /\brequire\(/];
const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;'"]*?from\s+['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s+['"](\.[^'"]+)['"]/g;

/** Every module reachable through relative value imports (type-only imports are erased and do not count). */
function closure(entry: string): readonly string[] {
  const seen = new Set<string>();
  const queue = [join(root, entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const target = match[1] ?? match[2];
      if (target !== undefined && /\.(ts|mjs|js)$/.test(target)) queue.push(join(dirname(file), target));
    }
  }
  return [...seen].map((file) => relative(root, file));
}

test('the client scripts import no module that needs Node: no file system, no process', () => {
  for (const script of CLIENT_SCRIPTS) {
    const modules = closure(script);
    assert.ok(modules.length > 1, `${script} imports modules`);
    for (const module of modules) {
      const source = readFileSync(join(root, module), 'utf8');
      for (const pattern of NODE_ONLY) assert.ok(!pattern.test(source), `${script} reaches ${module}, which uses ${pattern}`);
    }
  }
});

test('the palette script reads its list through the model module, not the build-time builder', () => {
  const modules = closure('src/scripts/palette.ts');
  assert.ok(modules.includes('src/components/islands/we-palette/model.ts'));
  assert.ok(!modules.includes('src/components/nav/commands.ts'));
  assert.ok(!modules.includes('src/data/routes.ts'));
});
