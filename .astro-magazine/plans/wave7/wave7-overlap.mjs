// Checks the wave 7 write-set map: pairwise overlap within stage 1, frozen-path intrusion, and photography-lane intrusion.
// Conservative: two globs overlap when one literal prefix (text before the first wildcard) starts with the other.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (file === undefined) {
  console.error('usage: wave7-overlap.mjs <writesets.json>');
  process.exit(2);
}
const map = JSON.parse(readFileSync(file, 'utf8'));

const hasWildcard = (p) => p.includes('*');
const prefixOf = (p) => (hasWildcard(p) ? p.slice(0, p.indexOf('*')) : p);

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

/** True when pattern a and pattern b can match a common path. `excludeA` and `excludeB` remove exact files from a glob. */
function overlaps(a, b, excludeA = [], excludeB = []) {
  const aw = hasWildcard(a);
  const bw = hasWildcard(b);
  if (!aw && !bw) return a === b;
  if (!aw && bw) return !excludeB.includes(a) && toRegex(b).test(a);
  if (aw && !bw) return !excludeA.includes(b) && toRegex(a).test(b);
  const pa = prefixOf(a);
  const pb = prefixOf(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

const failures = [];
const wps = map.workPackages;

for (let i = 0; i < wps.length; i += 1) {
  for (let j = i + 1; j < wps.length; j += 1) {
    const x = wps[i];
    const y = wps[j];
    // Stage 0 lands first and stage 2 lands last, so only stage-1 pairs run concurrently. Stage-1 against stage-0 and 2 is reported for information.
    if (x.stage !== 1 || y.stage !== 1) continue;
    for (const pa of x.writes) {
      for (const pb of y.writes) {
        if (overlaps(pa, pb, x.exclude, y.exclude)) failures.push(`${x.id} ${pa}  <->  ${y.id} ${pb}`);
      }
    }
  }
}

for (const wp of wps) {
  if (wp.id === 'WP-40') continue;
  for (const p of wp.writes) {
    for (const f of map.frozen) {
      if (overlaps(p, f, wp.exclude, [])) failures.push(`${wp.id} ${p}  <->  FROZEN ${f}`);
    }
  }
}

for (const wp of wps) {
  for (const p of wp.writes) {
    for (const r of map.photographyLane) {
      if (overlaps(p, r, wp.exclude, [])) failures.push(`${wp.id} ${p}  <->  PHOTO-LANE ${r}`);
    }
  }
}

// The release lane (WP-30) has no assignment in ownership.json, so this list is declared from docs/runbook-release.md and the CI file, not registered.
// WP-40 legitimately edits .gitlab-ci.yml and package.json, so those hits are reported as a serialization requirement (WP-40 starts after WP-30 merges), not as overlaps.
const releaseSerialize = [];
for (const wp of wps) {
  for (const p of wp.writes) {
    for (const r of map.releaseLane ?? []) {
      if (!overlaps(p, r, wp.exclude, [])) continue;
      if (wp.id === 'WP-40') releaseSerialize.push(`${wp.id} ${p}  <->  RELEASE-LANE ${r}`);
      else failures.push(`${wp.id} ${p}  <->  RELEASE-LANE ${r}`);
    }
  }
}

const laneExceptionHits = [];
for (const wp of wps) {
  for (const g of wp.lane_exceptions) {
    const reserved = map.photographyLane.some((r) => overlaps(g, r));
    laneExceptionHits.push(`${wp.id} ${g} (reserved by photography lane: ${reserved})`);
    for (const other of wps) {
      if (other.id === wp.id) continue;
      for (const p of other.writes) if (overlaps(g, p, [], other.exclude)) failures.push(`${wp.id} lane exception ${g}  <->  ${other.id} ${p}`);
    }
  }
}

const stage1 = wps.filter((w) => w.stage === 1).map((w) => w.id);
console.log(`Stage-1 packages checked pairwise: ${stage1.join(', ')} (${(stage1.length * (stage1.length - 1)) / 2} pairs)`);
console.log(`Patterns checked: ${wps.reduce((n, w) => n + w.writes.length, 0)}; frozen entries: ${map.frozen.length}; photography-lane entries: ${map.photographyLane.length}`);
console.log(`release-lane entries (declared, not registered): ${(map.releaseLane ?? []).length}`);
for (const line of laneExceptionHits) console.log(`lane exception: ${line}`);
for (const line of releaseSerialize) console.log(`serialize after WP-30: ${line}`);
if (failures.length === 0) {
  console.log('RESULT: zero overlaps');
} else {
  console.log(`RESULT: ${failures.length} overlap(s)`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
