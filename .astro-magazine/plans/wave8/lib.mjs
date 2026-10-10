// Shared glob helpers for the wave 8 overlap checker, self-test and coverage check.
// Conservative: two globs overlap when one literal prefix (text before the first wildcard) starts with the other.

export const hasWildcard = (p) => p.includes('*');
export const prefixOf = (p) => (hasWildcard(p) ? p.slice(0, p.indexOf('*')) : p);

export function toRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const hasDeep = (p) => p.includes('**');

/** Two single-segment globs (a `*` never crosses a slash) can match a common segment: literal prefixes and suffixes must be compatible. */
function segmentOverlaps(a, b) {
  const aw = a.includes('*');
  const bw = b.includes('*');
  if (!aw && !bw) return a === b;
  if (!aw) return toRegex(b).test(a);
  if (!bw) return toRegex(a).test(b);
  const [pa, sa] = [a.slice(0, a.indexOf('*')), a.slice(a.lastIndexOf('*') + 1)];
  const [pb, sb] = [b.slice(0, b.indexOf('*')), b.slice(b.lastIndexOf('*') + 1)];
  return (pa.startsWith(pb) || pb.startsWith(pa)) && (sa.endsWith(sb) || sb.endsWith(sa));
}

/** A glob without `**` matches paths of one fixed depth; compare it with the literal prefix of a deeper glob segment by segment. */
function shallowVersusDeep(shallow, deep) {
  const prefix = prefixOf(deep);
  const shallowSegments = shallow.split('/');
  const prefixSegments = prefix.split('/');
  if (shallowSegments.length < prefixSegments.length) return false;
  for (let i = 0; i < prefixSegments.length - 1; i += 1) if (!segmentOverlaps(shallowSegments[i], prefixSegments[i])) return false;
  const last = prefixSegments.length - 1;
  return segmentOverlaps(shallowSegments[last], `${prefixSegments[last]}*`);
}

/** True when pattern a and pattern b can match a common path. Exact for globs without `**`; conservative (prefix test) when both contain `**`. */
export function overlaps(a, b) {
  const aw = hasWildcard(a);
  const bw = hasWildcard(b);
  if (!aw && !bw) return a === b;
  if (!aw && bw) return toRegex(b).test(a);
  if (aw && !bw) return toRegex(a).test(b);
  const ad = hasDeep(a);
  const bd = hasDeep(b);
  if (!ad && !bd) {
    const as = a.split('/');
    const bs = b.split('/');
    return as.length === bs.length && as.every((seg, i) => segmentOverlaps(seg, bs[i]));
  }
  if (!ad && bd) return shallowVersusDeep(a, b);
  if (ad && !bd) return shallowVersusDeep(b, a);
  const pa = prefixOf(a);
  const pb = prefixOf(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

export const matchesPath = (glob, path) => toRegex(glob).test(path);

/**
 * Runs every check. Returns { failures, serialize, sequential, stats }.
 *  failures   : overlaps that must be zero
 *  serialize  : release-lane hits a package declared (must be ordered by hand)
 *  sequential : overlaps between packages that never run at the same time (informational: the file is handed from one to the next)
 */
export function check(map) {
  const wps = map.workPackages;
  const failures = [];
  const serialize = [];
  const sequential = [];

  // 1. Pool pairs: packages that run at the same time must be disjoint.
  const pools = new Map();
  for (const wp of wps) for (const pool of wp.pools) pools.set(pool, [...(pools.get(pool) ?? []), wp]);
  const pairsChecked = new Set();
  for (const [pool, members] of pools) {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const x = members[i];
        const y = members[j];
        pairsChecked.add(`${x.id}|${y.id}`);
        for (const pa of x.writes) for (const pb of y.writes) if (overlaps(pa, pb)) failures.push(`[${pool}] ${x.id} ${pa}  <->  ${y.id} ${pb}`);
      }
    }
  }

  // 2. Everything else that is not in a shared pool is sequential: report overlaps for the record.
  for (let i = 0; i < wps.length; i += 1) {
    for (let j = i + 1; j < wps.length; j += 1) {
      const x = wps[i];
      const y = wps[j];
      if (pairsChecked.has(`${x.id}|${y.id}`)) continue;
      for (const pa of x.writes) for (const pb of y.writes) if (overlaps(pa, pb)) sequential.push(`${x.id} ${pa}  ->  ${y.id} ${pb}`);
    }
  }

  // 3. Frozen: only a declared frozen exception may touch a current frozen path.
  for (const wp of wps) {
    const named = wp.frozenExceptions ?? [];
    for (const p of wp.writes) {
      for (const f of map.frozen) if (overlaps(p, f) && !named.includes(p)) failures.push(`${wp.id} ${p}  <->  FROZEN ${f} (no frozen exception named)`);
    }
    for (const e of named) if (!wp.writes.includes(e)) failures.push(`${wp.id} frozen exception ${e} is not in its write set`);
  }

  // 4. Wave-8 frozen additions: only WP-60 (which creates them) and WP-99 (through registered exceptions) may touch them.
  for (const wp of wps) {
    if (wp.id === 'WP-60' || wp.id === 'WP-99') continue;
    for (const p of wp.writes) for (const f of map.frozenWave8) if (overlaps(p, f)) failures.push(`${wp.id} ${p}  <->  FROZEN-WAVE8 ${f}`);
  }

  // 5. Photography lane: nobody.
  for (const wp of wps) for (const p of wp.writes) for (const r of map.photographyLane) if (overlaps(p, r)) failures.push(`${wp.id} ${p}  <->  PHOTO-LANE ${r}`);

  // 6. Release lane: only a declared serialization.
  for (const wp of wps) {
    for (const p of wp.writes) {
      for (const r of map.releaseLane) {
        if (!overlaps(p, r)) continue;
        if ((wp.serializeWithRelease ?? []).includes(p)) serialize.push(`${wp.id} ${p}  <->  RELEASE-LANE ${r}`);
        else failures.push(`${wp.id} ${p}  <->  RELEASE-LANE ${r}`);
      }
    }
    for (const e of wp.exceptionsDeclared ?? []) {
      for (const r of map.releaseLane) {
        if (overlaps(e, r) && !(wp.serializeWithRelease ?? []).includes(e)) failures.push(`${wp.id} declared exception ${e}  <->  RELEASE-LANE ${r} (not marked serialize)`);
      }
      for (const r of map.photographyLane) if (overlaps(e, r)) failures.push(`${wp.id} declared exception ${e}  <->  PHOTO-LANE ${r}`);
    }
  }

  // 7. WP-99 declared exceptions must not sit in a stage-1 write set (it would collide with a package that is already merged only by luck).
  for (const wp of wps.filter((w) => w.exceptionsDeclared !== undefined)) {
    for (const e of wp.exceptionsDeclared) {
      for (const other of wps) {
        if (other.id === wp.id || other.stage === 0 || other.stage === 2) continue;
        for (const p of other.writes) if (overlaps(e, p)) failures.push(`${wp.id} declared exception ${e}  <->  ${other.id} ${p}`);
      }
    }
  }

  return {
    failures,
    serialize,
    sequential,
    stats: {
      pools: [...pools.entries()].map(([name, members]) => `${name}: ${members.map((m) => m.id).join(', ')} (${(members.length * (members.length - 1)) / 2} pairs)`),
      patterns: wps.reduce((n, w) => n + w.writes.length, 0),
      frozen: map.frozen.length,
      frozenWave8: map.frozenWave8.length,
      photo: map.photographyLane.length,
      release: map.releaseLane.length,
    },
  };
}
