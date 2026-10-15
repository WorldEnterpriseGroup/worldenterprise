/**
 * Seeded randomness for the scenes and the SVG illustrations. Every visual is deterministic for a seed, so the poster rendered from a scene
 * and the live scene draw the same sky, and a server-rendered SVG never changes between builds.
 */

export type Random = () => number;

/** mulberry32: a small, fast 32-bit generator. Returns numbers in [0, 1). */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal sample (Box-Muller), from two draws of `rand`. */
export function gaussian(rand: Random): number {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A stable integer hash of a string, for seeding a visual from its props (for example a label list). */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
