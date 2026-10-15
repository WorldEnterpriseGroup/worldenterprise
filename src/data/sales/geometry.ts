/**
 * Pure chart geometry for the sales charts: scales, paths and ticks in SVG user units. No Astro imports, unit-tested in
 * tests/unit/wp-58. Numbers are rounded to two decimals so the markup stays small and stable between builds.
 */

export interface Domain {
  readonly min: number;
  readonly max: number;
}

export interface Box {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const round = (n: number): number => Math.round(n * 100) / 100;

/** A linear scale from a domain to a range. Throws on an empty domain, which would divide by zero. */
export function linear(domain: Domain, from: number, to: number): (value: number) => number {
  const span = domain.max - domain.min;
  if (!(span > 0)) throw new RangeError(`Empty domain ${domain.min} to ${domain.max}`);
  return (value: number) => round(from + ((value - domain.min) / span) * (to - from));
}

/** Plot area of a box: x grows right, y grows up (SVG y is flipped here). */
export function plot(box: Box, x: Domain, y: Domain): { readonly sx: (v: number) => number; readonly sy: (v: number) => number } {
  return {
    sx: linear(x, box.left, box.width - box.right),
    sy: linear(y, box.height - box.bottom, box.top),
  };
}

export interface XY {
  readonly x: number;
  readonly y: number;
}

/** An SVG polyline path through the points, in order. */
export function linePath(points: readonly XY[], sx: (v: number) => number, sy: (v: number) => number): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x)} ${sy(p.y)}`).join(' ');
}

/** The closed area under a line down to `base` (a y value). */
export function areaPath(points: readonly XY[], sx: (v: number) => number, sy: (v: number) => number, base: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return '';
  return `${linePath(points, sx, sy)} L${sx(last.x)} ${sy(base)} L${sx(first.x)} ${sy(base)} Z`;
}

/** Evenly spaced tick values from min to max inclusive. */
export function ticks(domain: Domain, step: number): number[] {
  if (!(step > 0)) throw new RangeError(`Tick step must be positive, got ${step}`);
  const out: number[] = [];
  for (let v = domain.min; v <= domain.max + step / 1000; v += step) out.push(round(v));
  return out;
}

/** A value as a share of the largest, for bar lengths: 0 to 100. */
export function share(value: number, max: number): number {
  if (!(max > 0)) throw new RangeError(`Bar maximum must be positive, got ${max}`);
  return round(Math.max(0, Math.min(1, value / max)) * 100);
}

/** Thousands with commas, US style: 5671836 -> "5,671,836". */
export const thousands = (n: number): string => new Intl.NumberFormat('en-US').format(n);

/** A compact axis label: 5671836 -> "5.7M", 250000 -> "250K". */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${round(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Points on a circle, for orbit drawings: `count` bodies starting at `start` degrees, clockwise. */
export function orbitPoints(cx: number, cy: number, r: number, count: number, start = -90): XY[] {
  if (count < 1) return [];
  return Array.from({ length: count }, (_, i) => {
    const a = ((start + (360 / count) * i) * Math.PI) / 180;
    return { x: round(cx + r * Math.cos(a)), y: round(cy + r * Math.sin(a)) };
  });
}
