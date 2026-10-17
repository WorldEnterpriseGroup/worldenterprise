/**
 * Brief covers (WP-23, #89): one generated cover per brief or research report, in the galaxy and world-building language of the site. A
 * starfield, a faint spiral arm, a world whose surface is a field of hexagonal tiles, an optional ring and moon, and one amber tile: the
 * same slug always draws the same cover, so builds are reproducible and no stock photo is needed. Pure geometry, unit-tested in
 * tests/unit/wp-23. Colors are not chosen here: the component maps each palette and tone to tokens through scoped CSS classes.
 */
import { hashString, seeded } from '../../scripts/visuals/rng.ts';

export const COVER_W = 640;
export const COVER_H = 400;

export const PALETTES = ['dawn', 'deep', 'tide', 'dusk'] as const;
export type Palette = (typeof PALETTES)[number];

export interface Star {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** 1 (faint) to 3 (bright): picks a class. */
  readonly level: 1 | 2 | 3;
}

export interface Tile {
  readonly points: string;
  /** land, high (lighter land) or amber (exactly one tile). */
  readonly tone: 'land' | 'high' | 'amber';
}

export interface CoverModel {
  readonly seed: number;
  readonly palette: Palette;
  readonly stars: readonly Star[];
  /** The spiral arm, as an SVG path. */
  readonly arm: string;
  readonly world: { readonly cx: number; readonly cy: number; readonly r: number };
  readonly tiles: readonly Tile[];
  /** Tilted ring around the world, or null. */
  readonly ring: { readonly rx: number; readonly ry: number; readonly angle: number } | null;
  readonly moon: { readonly cx: number; readonly cy: number; readonly r: number } | null;
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** Flat-topped hexagon points around (cx, cy). */
export function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${round(cx + r * Math.cos(a))},${round(cy + r * Math.sin(a))}`;
  }).join(' ');
}

/** The cover for a slug. Throws on an empty slug, since an unseeded cover would repeat across briefs. */
export function coverModel(slug: string): CoverModel {
  const key = slug.trim();
  if (key === '') throw new Error('coverModel: a cover needs a slug to seed it');
  const seed = hashString(key);
  const rand = seeded(seed);
  const palette = PALETTES[seed % PALETTES.length] ?? 'deep';

  const stars: Star[] = Array.from({ length: 70 }, () => {
    const roll = rand();
    const level: 1 | 2 | 3 = roll > 0.93 ? 3 : roll > 0.7 ? 2 : 1;
    return { x: round(rand() * COVER_W), y: round(rand() * COVER_H), r: round(level === 3 ? 1.8 : level === 2 ? 1.2 : 0.7), level };
  });

  // A logarithmic spiral arm sweeping from one corner, behind the world.
  const turn = rand() * Math.PI * 2;
  const arm = Array.from({ length: 28 }, (_, i) => {
    const t = i / 27;
    const a = turn + t * Math.PI * 1.6;
    const rad = 40 + t * 360;
    const x = COVER_W * 0.5 + rad * Math.cos(a);
    const y = COVER_H * 0.5 + rad * Math.sin(a) * 0.55;
    return `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
  }).join(' ');

  // The world sits right of center so a title overlay never needs to cover it.
  const r = 92 + Math.floor(rand() * 40);
  const world = { cx: round(COVER_W * (0.6 + rand() * 0.14)), cy: round(COVER_H * (0.46 + rand() * 0.12)), r };

  // Hex tiles on a grid over the world; the clip path keeps them on the disc. Land forms a continent around a seeded center.
  const size = 13;
  const dx = size * 1.5;
  const dy = size * Math.sqrt(3);
  const land = { x: world.cx + (rand() - 0.5) * r, y: world.cy + (rand() - 0.5) * r };
  const spread = r * (0.55 + rand() * 0.35);
  const tiles: Tile[] = [];
  for (let col = -Math.ceil(r / dx) - 1; col <= Math.ceil(r / dx) + 1; col += 1) {
    for (let row = -Math.ceil(r / dy) - 1; row <= Math.ceil(r / dy) + 1; row += 1) {
      const x = world.cx + col * dx;
      const y = world.cy + row * dy + (col % 2 === 0 ? 0 : dy / 2);
      if (Math.hypot(x - world.cx, y - world.cy) > r + size) continue;
      const d = Math.hypot(x - land.x, y - land.y) / spread;
      const noise = rand() * 0.45;
      if (d + noise > 1.05) continue;
      tiles.push({ points: hexPoints(x, y, size - 1.2), tone: d + noise < 0.55 ? 'high' : 'land' });
    }
  }
  // Exactly one amber tile: the company the brief is for, if there is land, else a tile at the center.
  if (tiles.length === 0) tiles.push({ points: hexPoints(world.cx, world.cy, size - 1.2), tone: 'amber' });
  else {
    const at = Math.floor(rand() * tiles.length);
    const chosen = tiles[at];
    if (chosen !== undefined) tiles[at] = { points: chosen.points, tone: 'amber' };
  }

  const ring = rand() > 0.4 ? { rx: round(r * 1.55), ry: round(r * 0.32), angle: round(-24 + rand() * 18) } : null;
  const moonAngle = rand() * Math.PI * 2;
  const moon =
    rand() > 0.3
      ? { cx: round(Math.min(COVER_W - 24, Math.max(24, world.cx + Math.cos(moonAngle) * r * 1.75))), cy: round(Math.min(COVER_H - 24, Math.max(24, world.cy + Math.sin(moonAngle) * r * 1.2))), r: round(10 + rand() * 9) }
      : null;

  return { seed, palette, stars, arm, world, tiles, ring, moon };
}
