// Test-pin scan: finds existing tests (on origin/demo) that read files another wave 8 package rewrites.
// A test is an ORPHAN PIN when it references a file in package P's write set and the test itself is owned by neither P nor WP-60,
// is not owned by a lane, and is not acknowledged in writesets.legacyPins.acknowledged (directory scans, lane tests, string-list mentions).
// Kind: "specific" = the test names a concrete file; "wide" = it only names directories (a corpus invariant that new files must satisfy).
// Usage: node pins.mjs <writesets.json> <tests-root-containing-tests/> [--all]
// Exit code 1 when a specific orphan pin remains.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { matchesPath, overlaps } from './lib.mjs';

const map = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const root = process.argv[3];
const showAll = process.argv.includes('--all');
const acknowledged = map.legacyPins?.acknowledged ?? {};
const lanePatterns = [...map.photographyLane, ...map.releaseLane];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|mjs|js)$/.test(name)) files.push(relative(root, full));
  }
})(join(root, 'tests'));

const REF = /['"`]((?:\.\.\/)*)((?:src|scripts|docs|public|infra)\/[^'"`\s$]*|claims-denylist\.json|package\.json|astro\.config\.mjs|\.gitlab-ci\.yml|\.astro-magazine\/[^'"`\s$]*)['"`]/g;
const isFileRef = (ref) => /\.[a-z0-9]+$/i.test(ref.split('/').pop() ?? '');

const ownedBy = (testPath) => map.workPackages.filter((w) => w.writes.some((p) => matchesPath(p, testPath))).map((w) => w.id);

const rows = [];
let ackUsed = 0;
let laneOwned = 0;
for (const file of files) {
  const text = readFileSync(join(root, file), 'utf8');
  const refs = new Set();
  for (const m of text.matchAll(REF)) refs.add(m[2].replace(/\/$/, ''));
  if (refs.size === 0) continue;
  const owners = ownedBy(file);
  const hits = new Map();
  for (const ref of refs) {
    const asDir = `${ref}/**`;
    for (const wp of map.workPackages) {
      if (wp.id === 'WP-60') continue;
      for (const p of wp.writes) {
        if (p.startsWith('tests/')) continue;
        if (matchesPath(p, ref) || overlaps(asDir, p)) hits.set(wp.id, [...(hits.get(wp.id) ?? []), ref]);
      }
    }
  }
  for (const [id, list] of hits) {
    if (owners.includes(id) || owners.includes('WP-60')) continue;
    if (lanePatterns.some((p) => matchesPath(p, file))) {
      laneOwned += 1;
      continue;
    }
    if (acknowledged[file] !== undefined) {
      ackUsed += 1;
      continue;
    }
    const specific = list.some(isFileRef);
    rows.push({ file, id, owners, kind: specific ? 'specific' : 'wide', refs: [...new Set(list)] });
  }
}

rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || a.file.localeCompare(b.file));
const specific = rows.filter((r) => r.kind === 'specific');
const wide = rows.filter((r) => r.kind === 'wide');
const staleAck = Object.keys(acknowledged).filter((f) => !files.includes(f));
console.log(`scanned ${files.length} test files`);
console.log(`lane-owned pins (read-only constraints): ${laneOwned}; acknowledged pins: ${ackUsed}; acknowledged entries naming a missing test: ${staleAck.length}`);
console.log(`orphan pins, specific file: ${specific.length}; wide directory scans (invariants): ${wide.length}`);
for (const r of specific) console.log(`SPECIFIC ${r.id}  ${r.file}  [owner: ${r.owners.join(',') || 'none'}]  reads: ${r.refs.slice(0, showAll ? 99 : 4).join(', ')}`);
for (const r of wide) console.log(`wide     ${r.id}  ${r.file}  [owner: ${r.owners.join(',') || 'none'}]  reads: ${r.refs.slice(0, showAll ? 99 : 3).join(', ')}`);
for (const f of staleAck) console.log(`STALE acknowledgement: ${f}`);
process.exit(specific.length === 0 && staleAck.length === 0 ? 0 : 1);
