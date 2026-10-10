// Triage of prose-check misses: classify each path named in a package section but outside its write set.
// usage: node triage.mjs <wave8.md> <writesets.json> <tracked.txt>
// Classes: own-basename (the package's write set holds the full path), other-package (a read of another package's file),
// read-only (tracked on the base, no package owns it), generated-or-external (not a repo path), unresolved (look by hand).
import { readFileSync } from 'node:fs';
import { matchesPath } from './lib.mjs';

const [planPath, setsPath, trackedPath] = process.argv.slice(2);
if (!planPath || !setsPath || !trackedPath) {
  console.error('usage: triage.mjs <wave8.md> <writesets.json> <tracked.txt>');
  process.exit(2);
}
const plan = readFileSync(planPath, 'utf8');
const sets = JSON.parse(readFileSync(setsPath, 'utf8'));
const tracked = readFileSync(trackedPath, 'utf8').split('\n').filter(Boolean);

const sections = new Map();
for (const part of plan.split(/^(?=#{2,3} )/m)) {
  const m = /^### (WP-\d+)\b/.exec(part);
  if (m) sections.set(m[1], part);
}

const EXT = /\.(ts|mjs|md|mdx|json|yml|yaml|astro|css|avif|txt|sh)$/;
const isPath = (t) => !t.startsWith('/') && !t.startsWith('http') && !/\s/.test(t) && (t.includes('/') || EXT.test(t)) && !/^\w+@/.test(t);
const base = (p) => p.split('/').pop();
const EXTERNAL = [/^wave8-/, /^wp\/NN$/, /^pagefind\//, /^FocusApiary\//, /^briefs(\.json|\/)/, /^docs\/$/, /^tests\/$/, /^\.md$/, /^\.mdx$/, /^llms(-full)?\.txt$/, /^robots\.txt$/];

const owners = (path) => sets.workPackages.filter((w) => w.writes.some((g) => matchesPath(g, path))).map((w) => w.id);
const counts = new Map();
const unresolved = [];
for (const wp of sets.workPackages) {
  const section = sections.get(wp.id);
  if (!section) continue;
  const allowed = [...wp.writes, ...(wp.frozenExceptions ?? []), ...(wp.exceptionsDeclared ?? [])];
  const prose = section
    .split('\n')
    .filter((l) => !/^\*\*(Write set|Excluded|Registered frozen|Declared exceptions|Serialize with)/.test(l))
    .join('\n');
  const seen = new Set();
  for (const [, token] of prose.matchAll(/`([^`\n]+)`/g)) {
    const norm = token.replace(/<[^>]+>/g, 'x').replace(/\{[^}]*\}/g, 'x').replace(/\(.*$/, '');
    if (!isPath(norm) || seen.has(norm)) continue;
    seen.add(norm);
    if (allowed.some((g) => matchesPath(g, norm) || (norm.includes('*') && g === norm))) continue;
    let cls;
    const b = base(norm.replace(/^'|'$/g, ''));
    if (EXTERNAL.some((r) => r.test(norm))) cls = 'generated-or-external';
    else if (allowed.some((g) => (b !== '**' && b !== '*' && base(g) === b) || g.endsWith('/' + norm.replace(/^'|'$/g, '')))) cls = 'own-basename';
    else {
      const other = owners(norm).filter((id) => id !== wp.id);
      if (other.length) cls = `other-package ${other.join(',')}`;
      else if (tracked.includes(norm) || tracked.some((t) => t.startsWith(norm) && norm.endsWith('/'))) cls = 'read-only';
      else if (tracked.some((t) => base(t) === b)) cls = 'read-only (by basename)';
      else if (sets.workPackages.some((w) => w.writes.some((g) => base(g) === b))) cls = 'other-package (by basename)';
      else if (norm.includes('*') && sets.workPackages.some((w) => w.id !== wp.id && w.writes.some((g) => g === norm))) cls = 'other-package (same pattern)';
      else cls = 'unresolved';
    }
    counts.set(cls.split(' ')[0], (counts.get(cls.split(' ')[0]) ?? 0) + 1);
    if (cls === 'unresolved') unresolved.push(`${wp.id} ${token}`);
    else console.log(`${wp.id.padEnd(6)} ${cls.padEnd(36)} ${token}`);
  }
}
console.log('---');
for (const [k, v] of counts) console.log(`${k}: ${v}`);
console.log(`unresolved: ${unresolved.length}`);
for (const u of unresolved) console.log(`  ${u}`);
