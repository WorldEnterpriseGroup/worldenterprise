// Lists write-set patterns that match no file in the repo (new files are expected) and repo files under the tracked roots that no wave 7 package, frozen entry or photography-lane entry claims.
// Usage: node wave7-coverage.mjs <writesets.json> <repo-root>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [file, root] = process.argv.slice(2);
if (file === undefined || root === undefined) {
  console.error('usage: wave7-coverage.mjs <writesets.json> <repo-root>');
  process.exit(2);
}
const map = JSON.parse(readFileSync(file, 'utf8'));

function toRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const files = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const tracked = files.filter((f) => /^(src|scripts|tests\/e2e|tests\/unit\/foundation|docs|public)\//.test(f) || !f.includes('/'));

console.log('Patterns that match no tracked file (expected for new files):');
for (const wp of map.workPackages) {
  for (const p of wp.writes) {
    const re = toRegex(p);
    if (!files.some((f) => re.test(f))) console.log(`  ${wp.id}  ${p}`);
  }
}

const claims = [];
for (const wp of map.workPackages) for (const p of wp.writes) claims.push({ re: toRegex(p), by: wp.id, exclude: wp.exclude });
for (const p of map.frozen) claims.push({ re: toRegex(p), by: 'FROZEN', exclude: [] });
for (const p of map.photographyLane) claims.push({ re: toRegex(p), by: 'PHOTO', exclude: [] });
for (const p of map.releaseLane ?? []) claims.push({ re: toRegex(p), by: 'RELEASE', exclude: [] });

const unclaimed = tracked.filter((f) => !claims.some((c) => c.re.test(f) && !c.exclude.includes(f)));
console.log(`\nTracked files under src/scripts/tests-e2e/docs/public not claimed by any entry: ${unclaimed.length}`);
const byDir = new Map();
for (const f of unclaimed) {
  const dir = f.split('/').slice(0, f.startsWith('src/components/') || f.startsWith('src/pages/') ? 3 : 2).join('/');
  byDir.set(dir, (byDir.get(dir) ?? 0) + 1);
}
for (const [dir, n] of [...byDir].sort()) console.log(`  ${String(n).padStart(4)}  ${dir}`);
