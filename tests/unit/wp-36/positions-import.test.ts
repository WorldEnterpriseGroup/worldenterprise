import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// positionClasses() returns class names whose rules live in src/components/visuals/positions.css. A component that emits them must
// import that sheet itself: LongHorizonTimeline did not, and its milestones and survival gates lost their positions on any page that
// did not happen to render a Scene too (found by WP-24 on /journey/). Astro bundles the sheet once however many components import it.
const root = new URL('../../../src/', import.meta.url).pathname;

function astroFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return astroFiles(path);
    return path.endsWith('.astro') ? [path] : [];
  });
}

test('every component that emits position classes imports positions.css', () => {
  const users = astroFiles(root).filter((path) => /\bpositionClasses\s*\(/.test(readFileSync(path, 'utf8')));
  assert.ok(users.length > 0, 'at least one component uses positionClasses');
  const missing = users.filter((path) => !/^import ['"][./]*(?:[\w-]+\/)*positions\.css['"];?$/m.test(readFileSync(path, 'utf8')));
  assert.deepEqual(missing.map((path) => path.slice(root.length)), []);
});
