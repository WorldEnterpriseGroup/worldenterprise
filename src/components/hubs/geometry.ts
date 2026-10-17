/**
 * Deterministic geometry for the hub drawings (WP-24). Every drawing is authored SVG computed at build time from the site's own content
 * and a seed string, so the same build always draws the same sky and a hub never ships a script to draw it. Pure functions, no Astro
 * imports, unit-tested in tests/unit/wp-24/geometry.test.ts. Coordinates are SVG user units in a fixed viewBox.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Star extends Point {
  /** Radius in user units. */
  readonly r: number;
}

/** Rounds to one decimal so the markup stays short and stable. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;

/** FNV-1a, 32 bit: a stable unsigned hash of a seed string. */
export function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 seeded by `hash(seed)`: a deterministic stream of numbers in [0, 1). */
export function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/**
 * One star per item, packed on a jittered sunflower spiral around `center` so a cluster of n stars covers an area proportional to n.
 * The first star is the brightest (the cluster's anchor); the rest shrink a little toward the rim.
 */
export function cluster(seed: string, count: number, center: Point, spacing: number): readonly Star[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`cluster: count ${count} is not a whole number of stars`);
  const next = rng(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    const radius = i === 0 ? 0 : spacing * Math.sqrt(i + 0.5);
    const angle = i * GOLDEN + next() * 0.6;
    const jitter = spacing * 0.25 * (next() - 0.5);
    stars.push({
      x: r1(center.x + Math.cos(angle) * (radius + jitter)),
      y: r1(center.y + Math.sin(angle) * (radius + jitter) * 0.8),
      r: i === 0 ? 6 : r1(2.2 + next() * 2.2 * (1 - i / (count + 4))),
    });
  }
  return stars;
}

/**
 * Centers for `count` clusters along one spiral arm drawn across a wide frame: left to right, rising and falling twice, so a row of
 * fourteen desks reads as a galaxy arm rather than a grid. `margin` keeps the outermost clusters clear of the frame.
 */
export function armCenters(count: number, width: number, height: number, margin: number): readonly Point[] {
  if (count < 1) return [];
  if (count === 1) return [{ x: r1(width / 2), y: r1(height / 2) }];
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return { x: r1(margin + t * (width - 2 * margin)), y: r1(height / 2 + Math.sin(t * Math.PI * 2.5) * (height / 2 - margin)) };
  });
}

/** A smooth path through the points (Catmull-Rom converted to cubic Béziers), for the faint arm behind the clusters. */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  const first = points[0] as Point;
  if (points.length === 1) return `M${first.x} ${first.y}`;
  let d = `M${first.x} ${first.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i] ?? first;
    const p1 = points[i] ?? first;
    const p2 = points[i + 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: r1(p1.x + (p2.x - p0.x) / 6), y: r1(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: r1(p2.x - (p3.x - p1.x) / 6), y: r1(p2.y - (p3.y - p1.y) / 6) };
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** A field of `count` faint background stars, seeded, inside the frame. */
export function field(seed: string, count: number, width: number, height: number): readonly Star[] {
  const next = rng(`${seed}:field`);
  return Array.from({ length: count }, () => ({ x: r1(next() * width), y: r1(next() * height), r: r1(0.6 + next() * 1.2) }));
}

/** Linear map of `value` in [min, max] onto [from, to], clamped to the range. */
export function lerp(value: number, min: number, max: number, from: number, to: number): number {
  const span = max - min || 1;
  const t = Math.min(1, Math.max(0, (value - min) / span));
  return r1(from + t * (to - from));
}

/**
 * Stacks equal values: the k-th repeat of a value is lifted by k steps, alternating above and below the line, so dots that share a
 * value stay visible side by side (a beeswarm for whole-number data). Returns one vertical offset, in steps, per value.
 */
export function stackOffsets(values: readonly number[]): readonly number[] {
  const seen = new Map<number, number>();
  return values.map((v) => {
    const k = seen.get(v) ?? 0;
    seen.set(v, k + 1);
    return k === 0 ? 0 : (k % 2 === 1 ? -1 : 1) * Math.ceil(k / 2);
  });
}
