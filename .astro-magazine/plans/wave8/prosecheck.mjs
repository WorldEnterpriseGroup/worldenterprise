// Prose-vs-write-set check: every file path named in backticks inside a package section must be matched by that package's write set or exceptions.
// Misses are not all errors (a path may be a read, not a write); each one is triaged by hand.
// usage: node prosecheck.mjs <wave8.md> <writesets.json>
import { readFileSync } from 'node:fs';
import { matchesPath } from './lib.mjs';

const [planPath, setsPath] = process.argv.slice(2);
if (!planPath || !setsPath) {
  console.error('usage: prosecheck.mjs <wave8.md> <writesets.json>');
  process.exit(2);
}
const plan = readFileSync(planPath, 'utf8');
const sets = JSON.parse(readFileSync(setsPath, 'utf8'));

const sections = new Map();
for (const part of plan.split(/^(?=#{2,3} )/m)) {
  const m = /^### (WP-\d+)\b/.exec(part);
  if (m) sections.set(m[1], part);
}

const EXT = /\.(ts|mjs|md|mdx|json|yml|yaml|astro|css|avif|txt|sh)$/;
const isPath = (t) => !t.startsWith('/') && !t.startsWith('http') && !/\s/.test(t) && (t.includes('/') || EXT.test(t)) && !/^\w+@/.test(t);

let misses = 0;
for (const wp of sets.workPackages) {
  const section = sections.get(wp.id);
  if (!section) {
    console.log(`${wp.id}: section not found`);
    misses += 1;
    continue;
  }
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
    const ok = allowed.some((g) => matchesPath(g, norm) || (norm.includes('*') && g === norm));
    if (!ok) {
      misses += 1;
      console.log(`${wp.id} MISS ${token}`);
    }
  }
}
console.log(`prose check: ${misses} path(s) named in a package section but outside its write set`);
