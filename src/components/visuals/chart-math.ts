/**
 * Geometry for the SVG charts and the long-horizon timeline. Pure, deterministic and unit-tested; the components only render what these
 * return. Coordinates are SVG user units in a fixed viewBox, so charts scale with their container and never need a style attribute.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Maps `domain` linearly onto `range`. */
export function linear(domain: readonly [number, number], range: readonly [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Round tick values covering 0..max: steps of 1, 2, 2.5 or 5 times a power of ten, at most `count` + 1 ticks. */
export function ticks(max: number, count = 5): readonly number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power);
  const out: number[] = [];
  for (let v = 0; v <= max + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

/** An SVG path through points (straight segments). */
export function polyline(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`).join(' ');
}

/**
 * A survival curve drawn as steps (the share of a starting year's firms only changes at the yearly measurements, so a stepped line is the honest shape),
 * plus the closed area under it.
 */
export function survivalPaths(points: readonly { readonly year: number; readonly percent: number }[], box: Box, maxYear: number): { readonly line: string; readonly area: string; readonly dots: readonly (readonly [number, number])[] } {
  const x = linear([0, maxYear], [box.x, box.x + box.width]);
  const y = linear([0, 100], [box.y + box.height, box.y]);
  const coords: [number, number][] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev !== undefined) coords.push([x(p.year), y(prev.percent)]);
    coords.push([x(p.year), y(p.percent)]);
  });
  const line = polyline(coords);
  const first = coords[0];
  const last = coords[coords.length - 1];
  const area = first === undefined || last === undefined ? '' : `${line} L${fmt(last[0])} ${fmt(box.y + box.height)} L${fmt(first[0])} ${fmt(box.y + box.height)} Z`;
  return { line, area, dots: points.map((p) => [x(p.year), y(p.percent)] as const) };
}

export interface BarLayout {
  readonly y: number;
  readonly width: number;
  readonly labelY: number;
}

/** Horizontal bars: one row per value, widths relative to `max` (default: the largest value). */
export function bars(values: readonly number[], box: Box, max?: number): readonly BarLayout[] {
  const top = max ?? Math.max(...values, 0);
  const row = box.height / Math.max(1, values.length);
  const scale = linear([0, top || 1], [0, box.width]);
  return values.map((v, i) => ({ y: box.y + row * i + row * 0.42, width: Math.max(0, scale(v)), labelY: box.y + row * i + row * 0.3 }));
}

export interface Arc {
  readonly d: string;
  readonly start: number;
  readonly end: number;
  /** Mid-angle point just outside the ring, for a leader label. */
  readonly label: readonly [number, number];
}

/**
 * Donut segments as SVG paths (annular sectors), clockwise from 12 o'clock, with a small gap between segments so each reads on its own.
 * A single segment of the whole draws as a full ring.
 */
export function donut(values: readonly number[], cx: number, cy: number, outer: number, inner: number, gap = 0.012): readonly Arc[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return [];
  const point = (r: number, a: number): string => `${fmt(cx + r * Math.sin(a))} ${fmt(cy - r * Math.cos(a))}`;
  const arcs: Arc[] = [];
  let angle = 0;
  const nonZero = values.filter((v) => v > 0).length;
  for (const v of values) {
    const sweep = (v / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    if (v <= 0) {
      arcs.push({ d: '', start, end, label: [cx, cy] });
      continue;
    }
    const mid = (start + end) / 2;
    const label = [cx + (outer + 14) * Math.sin(mid), cy - (outer + 14) * Math.cos(mid)] as const;
    if (nonZero === 1) {
      // Two half-rings: an SVG arc cannot start and end on the same point.
      const d = `M${point(outer, 0)} A${outer} ${outer} 0 1 1 ${point(outer, Math.PI)} A${outer} ${outer} 0 1 1 ${point(outer, 0)} Z M${point(inner, 0)} A${inner} ${inner} 0 1 0 ${point(inner, Math.PI)} A${inner} ${inner} 0 1 0 ${point(inner, 0)} Z`;
      arcs.push({ d, start, end, label });
      continue;
    }
    const g = Math.min(gap, sweep / 4);
    const s = start + g;
    const e = end - g;
    const large = e - s > Math.PI ? 1 : 0;
    const d = `M${point(outer, s)} A${outer} ${outer} 0 ${large} 1 ${point(outer, e)} L${point(inner, e)} A${inner} ${inner} 0 ${large} 0 ${point(inner, s)} Z`;
    arcs.push({ d, start, end, label });
  }
  return arcs;
}

/**
 * Position on a multi-year timeline. Early months matter as much as late years (first revenue lands in months, ten-year survival at
 * year ten), so the track uses a gentle log scale: x = log(1 + k t) / log(1 + k H). `k` = 1.5 keeps year one at about a third.
 */
export function timelineX(years: number, horizon: number, width: number, k = 1.5): number {
  const t = Math.min(horizon, Math.max(0, years));
  return (Math.log1p(k * t) / Math.log1p(k * horizon)) * width;
}

/** Year marks for the timeline axis: 0, 1, 2, 3, 5, 10, 15, 20 within the horizon. */
export function timelineYears(horizon: number): readonly number[] {
  return [0, 1, 2, 3, 5, 10, 15, 20].filter((y) => y <= horizon);
}

/**
 * Staggers labels that would collide: returns a lane (0, 1, 2) per x so neighbours closer than `minGap` alternate above and below.
 * Lanes are assigned greedily left to right.
 */
export function lanes(xs: readonly number[], minGap: number, laneCount = 3): readonly number[] {
  const lastX: number[] = Array.from({ length: laneCount }, () => -Infinity);
  return xs.map((x) => {
    let lane = lastX.findIndex((lx) => x - lx >= minGap);
    if (lane === -1) lane = lastX.indexOf(Math.min(...lastX));
    lastX[lane] = x;
    return lane;
  });
}

/** Points of a flat-top hexagon of radius r centered at (cx, cy), as an SVG `points` string. */
export function hexagon(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${fmt(cx + r * Math.cos(a))},${fmt(cy + r * Math.sin(a))}`;
  }).join(' ');
}
