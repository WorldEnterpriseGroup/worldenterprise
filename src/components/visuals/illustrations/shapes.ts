/**
 * Geometry for the SVG illustrations (radar scorecard, hex field). Pure and deterministic for a seed, unit-tested.
 */
import { seeded } from '../../../scripts/visuals/rng.ts';

const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

/** Point at `fraction` (0 to 1) of radius `r` on axis `i` of `n`, axis 0 straight up, clockwise. */
export function radarPoint(cx: number, cy: number, r: number, i: number, n: number, fraction: number): readonly [number, number] {
  const a = (Math.PI * 2 * i) / n - Math.PI / 2;
  return [cx + Math.cos(a) * r * fraction, cy + Math.sin(a) * r * fraction];
}

/** SVG `points` of a radar polygon; `values` are fractions 0 to 1, one per axis. */
export function radarPolygon(cx: number, cy: number, r: number, values: readonly number[]): string {
  return values
    .map((v, i) => radarPoint(cx, cy, r, i, values.length, Math.min(1, Math.max(0, v))))
    .map(([x, y]) => `${fmt(x)},${fmt(y)}`)
    .join(' ');
}

export interface FieldCell {
  readonly x: number;
  readonly y: number;
  /** 0 (faint) to 1 (solid). */
  readonly weight: number;
  readonly amber: boolean;
}

export type FieldEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * A field of flat-top hex cells across a `width` x `height` box, dense at `edge` and thinning out towards the opposite side (the brand's
 * hex texture). Exactly one cell is amber when `amber` is true: the densest-region cell the seed picks. Deterministic for a seed.
 */
export function hexField(width: number, height: number, r: number, edge: FieldEdge, density: number, seed: number, amber = true): readonly FieldCell[] {
  const rand = seeded(seed);
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  const cells: FieldCell[] = [];
  for (let col = 0; col * dx <= width + r; col += 1) {
    for (let row = 0; row * dy <= height + dy; row += 1) {
      const x = col * dx;
      const y = row * dy + (col % 2 === 1 ? dy / 2 : 0);
      const along = edge === 'left' ? x / width : edge === 'right' ? 1 - x / width : edge === 'top' ? y / height : 1 - y / height;
      const keep = Math.max(0, 1 - Math.max(0, Math.min(1, along)) * (1.15 - density * 0.5));
      if (rand() > keep * keep) continue;
      cells.push({ x, y, weight: Math.max(0.12, keep * (0.55 + rand() * 0.45)), amber: false });
    }
  }
  if (amber && cells.length > 0) {
    const strong = cells.map((c, i) => [c.weight, i] as const).filter(([w]) => w > 0.6);
    const pool = strong.length > 0 ? strong : cells.map((c, i) => [c.weight, i] as const);
    const pick = pool[Math.floor(rand() * pool.length)];
    if (pick !== undefined) {
      const cell = cells[pick[1]];
      if (cell !== undefined) cells[pick[1]] = { ...cell, weight: 1, amber: true };
    }
  }
  return cells;
}

/** The weight band a cell falls in (1 to 4), for class-based fills without style attributes. */
export const weightBand = (weight: number): 1 | 2 | 3 | 4 => (weight > 0.8 ? 4 : weight > 0.55 ? 3 : weight > 0.3 ? 2 : 1);
