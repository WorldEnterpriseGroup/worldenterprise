/**
 * Deterministic vector covers for articles (SAGE-PLAN 6.7): the same topic and slug always give the same art.
 * Pure functions so the geometry can be unit-tested without rendering.
 */
export type CoverTopic = 'dream' | 'build' | 'grow' | 'fundable';

export interface CoverCell {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly tone: 'blue' | 'tint' | 'deep' | 'amber' | 'none';
  readonly opacity: number;
}

export interface CoverModel {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly CoverCell[];
  readonly from: string;
  readonly to: string;
}

export const COVER_WIDTH = 640;
export const COVER_HEIGHT = 360;

/** Token names, resolved to colours by the component via CSS custom properties. */
const TOPIC_GROUND: Record<CoverTopic, { from: string; to: string }> = {
  dream: { from: 'var(--we-white)', to: 'var(--we-tint)' },
  build: { from: 'var(--we-mist)', to: 'var(--we-blue-hi)' },
  grow: { from: 'var(--we-tint)', to: 'var(--we-blue)' },
  fundable: { from: 'var(--we-blue-deep)', to: 'var(--we-blue-night)' },
};

/** FNV-1a 32-bit hash. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flat-top hexagon vertices as an SVG points string. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export function buildCover(topic: CoverTopic, slug: string): CoverModel {
  const rand = seededRandom(hashSeed(`${topic}:${slug}`));
  const radius = 34 + Math.floor(rand() * 3) * 8;
  const step = Math.sqrt(3) * radius;
  const cells: CoverCell[] = [];
  const amberTarget = 4 + Math.floor(rand() * 10);
  let index = 0;
  for (let q = -1; q * radius * 1.5 < COVER_WIDTH + radius; q += 1) {
    for (let r = -Math.ceil(q / 2) - 1; r * step < COVER_HEIGHT + step; r += 1) {
      const x = radius * 1.5 * q;
      const y = step * (r + q / 2);
      if (x < -radius || x > COVER_WIDTH + radius || y < -radius || y > COVER_HEIGHT + radius) continue;
      const roll = rand();
      const tone: CoverCell['tone'] =
        index === amberTarget ? 'amber' : roll < 0.16 ? 'deep' : roll < 0.38 ? 'blue' : roll < 0.58 ? 'tint' : 'none';
      cells.push({ x, y, r: radius - 2, tone, opacity: tone === 'none' ? 0 : 0.25 + rand() * 0.45 });
      index += 1;
    }
  }
  const ground = TOPIC_GROUND[topic];
  return { width: COVER_WIDTH, height: COVER_HEIGHT, cells, from: ground.from, to: ground.to };
}
