/** Geometry helpers for the hex diagrams. Flat-top hexagons, matching the brand cell. */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** SVG `points` attribute for a flat-top hexagon of circumradius `r`. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Centre cell followed by its six neighbours, `gap` as a fraction of the cell size. */
export function flower(cx: number, cy: number, r: number, gap = 0.08): readonly Point[] {
  const d = Math.sqrt(3) * r * (1 + gap);
  const out: Point[] = [{ x: cx, y: cy }];
  for (let k = 0; k < 6; k += 1) {
    const a = (Math.PI / 180) * (30 + 60 * k);
    out.push({ x: Number((cx + d * Math.cos(a)).toFixed(2)), y: Number((cy + d * Math.sin(a)).toFixed(2)) });
  }
  return out;
}
