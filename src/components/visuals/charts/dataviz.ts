/**
 * Pure geometry and contract helpers for the /data/ chart components (WP-35). Everything here is deterministic and unit-tested
 * (tests/unit/wp-35); the Astro components only render what these return. Coordinates are SVG user units in a fixed viewBox, so charts
 * scale with their container and never need a style attribute.
 */
import { VisualContractError, cleanText, statSource } from '../contracts.ts';
import type { StatSource } from '../contracts.ts';

export { VisualContractError, cleanText, statSource };
export type { StatSource };

export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

/** 1234567 -> "1,234,567". */
export function thousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Linear map of `domain` onto `range`. */
export function scale(domain: readonly [number, number], range: readonly [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Round tick values from `min` to `max`: steps of 1, 2, 2.5 or 5 times a power of ten, at most about `count` + 1 ticks. */
export function niceTicks(min: number, max: number, count = 5): readonly number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6 + 0);
  return out;
}

/**
 * Splits `total` units between groups in proportion to `values`, by the largest-remainder method, so the counts add to exactly `total`
 * (a waffle chart cannot draw a fraction of a square). Returns integer counts in the order given.
 */
export function apportion(values: readonly number[], total: number): readonly number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  if (!(sum > 0) || !Number.isInteger(total) || total < 0) throw new VisualContractError('apportion', 'needs positive values and an integer total');
  const exact = values.map((v) => (v / sum) * total);
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

export type StackMode = 'stack' | 'stream' | 'percent';

export interface Layer {
  readonly label: string;
  /** Lower edge at each x, in data units (percent when mode is 'percent'). */
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}

/**
 * Stacks series on top of each other. 'stack' starts at zero; 'percent' normalises every column to 100; 'stream' centres the stack on
 * a symmetric baseline (a streamgraph: the silhouette offset), which keeps every layer's thickness equal to its value.
 */
export function stackLayers(series: readonly { readonly label: string; readonly values: readonly number[] }[], mode: StackMode): { readonly layers: readonly Layer[]; readonly min: number; readonly max: number } {
  const n = series[0]?.values.length ?? 0;
  for (const s of series) if (s.values.length !== n) throw new VisualContractError('stackLayers', `series "${s.label}" has ${s.values.length} values, expected ${n}`);
  const totals = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const base = Array.from({ length: n }, (_, i) => (mode === 'stream' ? -(totals[i] ?? 0) / 2 : 0));
  const running = [...base];
  const layers: Layer[] = series.map((s) => {
    const lower = [...running];
    const upper = s.values.map((v, i) => {
      const value = mode === 'percent' ? ((v ?? 0) / (totals[i] || 1)) * 100 : (v ?? 0);
      const next = (running[i] ?? 0) + value;
      running[i] = next;
      return next;
    });
    return { label: s.label, lower, upper };
  });
  const min = Math.min(...layers.flatMap((l) => l.lower));
  const max = Math.max(...layers.flatMap((l) => l.upper));
  return { layers, min, max };
}

/** A closed SVG path between two edges across the same x positions. */
export function bandPath(xs: readonly number[], lower: readonly number[], upper: readonly number[]): string {
  if (xs.length < 2) return '';
  const up = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(upper[i] ?? 0)}`);
  const down = xs.map((x, i) => `L${fmt(x)} ${fmt(lower[i] ?? 0)}`).reverse();
  return `${up.join(' ')} ${down.join(' ')} Z`;
}

/** An open polyline through x/y arrays. */
export function linePath(xs: readonly number[], ys: readonly number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(ys[i] ?? 0)}`).join(' ');
}

/**
 * Moves labels apart so none is closer than `gap` to its neighbour, keeping their order and staying inside [lo, hi]. Used for the
 * end labels of a slope chart and the direct labels of an area chart. Input order is free; the output keeps it.
 */
export function spreadLabels(positions: readonly number[], gap: number, lo: number, hi: number): readonly number[] {
  const order = positions.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p || a.i - b.i);
  const placed = order.map((o) => o.p);
  for (let i = 0; i < placed.length; i++) {
    const prev = placed[i - 1];
    const current = placed[i] ?? lo;
    placed[i] = Math.max(i === 0 ? lo : (prev ?? lo) + gap, current);
  }
  const last = placed.length - 1;
  if (last >= 0 && (placed[last] ?? 0) > hi) {
    placed[last] = hi;
    for (let i = last - 1; i >= 0; i--) placed[i] = Math.min(placed[i] ?? hi, (placed[i + 1] ?? hi) - gap);
  }
  const out = new Array<number>(positions.length).fill(0);
  order.forEach((o, k) => {
    out[o.i] = placed[k] ?? o.p;
  });
  return out;
}

/**
 * Beeswarm layout along one axis: each value keeps its exact position on the value axis (`pos`, already scaled) and is pushed across the
 * strip just far enough that no two circles of radius `r` overlap. Deterministic: sorted by value, ties by index, alternating sides.
 */
export function beeswarm(positions: readonly number[], r: number): readonly number[] {
  const order = positions.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p || a.i - b.i);
  const placed: { p: number; o: number }[] = [];
  const offsets = new Array<number>(positions.length).fill(0);
  for (const item of order) {
    const near = placed.filter((q) => Math.abs(q.p - item.p) < 2 * r);
    let chosen = 0;
    const candidates = [0];
    for (let k = 1; k <= positions.length; k++) candidates.push(k * r * 0.5, -k * r * 0.5);
    for (const c of candidates) {
      if (near.every((q) => Math.hypot(q.p - item.p, q.o - c) >= 2 * r - 1e-6)) {
        chosen = c;
        break;
      }
    }
    placed.push({ p: item.p, o: chosen });
    offsets[item.i] = chosen;
  }
  return offsets;
}

/** Breaks a label into lines of at most `max` characters at spaces. A single word longer than `max` stays whole. */
export function wrapText(text: string, max: number): readonly string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line !== '' && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** An SVG path of unit squares: one subpath per cell, filled column by column from the bottom left, `cols` squares across. */
export function cellsPath(start: number, count: number, cols: number, rows: number, cell: number, gap: number): string {
  const parts: string[] = [];
  const side = cell - gap;
  for (let k = start; k < start + count; k++) {
    const col = Math.floor(k / rows);
    const row = k % rows;
    if (col >= cols) break;
    const x = col * cell;
    const y = (rows - 1 - row) * cell;
    parts.push(`M${x} ${y}h${side}v${side}h${-side}Z`);
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------------------------------------------------------------

export interface TableData {
  readonly caption: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Every new chart carries a title, a text description, at least one source, the retrieval date, and its data as a table. */
export interface FigureMeta {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly sources: readonly StatSource[];
  /** When the figures were retrieved, YYYY-MM-DD. */
  readonly retrieved: string;
  /** How WE derived what is drawn from what the source prints. */
  readonly derived?: string | undefined;
  readonly note?: string | undefined;
}

export function figureMeta(component: string, meta: FigureMeta): FigureMeta {
  if (!/^[a-z][a-z0-9-]*$/.test(meta.id)) throw new VisualContractError(component, `id "${meta.id}" must be lower-case letters, digits and hyphens`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.retrieved)) throw new VisualContractError(component, `retrieved "${meta.retrieved}" must be YYYY-MM-DD`);
  if (meta.sources.length === 0) throw new VisualContractError(component, 'a chart needs at least one source');
  return {
    id: meta.id,
    title: cleanText(component, 'title', meta.title),
    description: cleanText(component, 'description', meta.description),
    sources: meta.sources.map((s) => statSource(component, s)),
    retrieved: meta.retrieved,
    derived: meta.derived === undefined ? undefined : cleanText(component, 'derived', meta.derived),
    note: meta.note === undefined ? undefined : cleanText(component, 'note', meta.note),
  };
}

/** A series of equal-length numeric values over shared x positions. */
export function sameLength(component: string, label: string, values: readonly number[], expected: number): void {
  if (values.length !== expected) throw new VisualContractError(component, `"${label}" has ${values.length} values, expected ${expected}`);
  if (values.some((v) => !Number.isFinite(v))) throw new VisualContractError(component, `"${label}" has a value that is not a number`);
}
