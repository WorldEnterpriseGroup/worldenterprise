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

export interface FlowNodeInput {
  readonly id: string;
  readonly label: string;
  /** Column index from 0 (left); every link must run to a higher column. */
  readonly column: number;
}

export interface FlowLinkInput {
  readonly from: string;
  readonly to: string;
  /** The exact quantity that moves along the link, in data units. */
  readonly value: number;
}

export interface FlowNodeBox {
  readonly id: string;
  readonly label: string;
  readonly column: number;
  /** Data units the node stands for: what flows in, or what flows out when nothing flows in. */
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FlowLinkShape {
  readonly from: string;
  readonly to: string;
  readonly value: number;
  /** Share of the source node's value, 0 to 100. */
  readonly percentOfSource: number;
  /** Ribbon thickness in SVG units. */
  readonly thickness: number;
  /** A closed path: a filled ribbon between the two nodes. */
  readonly path: string;
}

export interface FlowGeometry {
  readonly nodes: readonly FlowNodeBox[];
  readonly links: readonly FlowLinkShape[];
  /** SVG units per data unit. */
  readonly k: number;
}

/**
 * Lays out a flow (Sankey) diagram. Node height is proportional to the value that passes through it, one scale for every column, and
 * each ribbon is exactly as thick as its value, so areas can be compared. A node that has links on both sides must pass on exactly what
 * it receives (flow is conserved); the check fails the build otherwise. Columns are centred vertically; ribbons leave and enter each
 * node in the order of the node they connect to, so they do not cross within a node.
 */
export function flowLayout(
  nodes: readonly FlowNodeInput[],
  links: readonly FlowLinkInput[],
  box: { readonly width: number; readonly height: number; readonly nodeWidth: number; readonly gap: number },
): FlowGeometry {
  const C = 'flowLayout';
  if (nodes.length < 2) throw new VisualContractError(C, 'needs at least two nodes');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) throw new VisualContractError(C, 'node ids must be unique');
  if (links.length === 0) throw new VisualContractError(C, 'needs at least one link');
  const out = new Map<string, number>();
  const into = new Map<string, number>();
  for (const l of links) {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (a === undefined || b === undefined) throw new VisualContractError(C, `link ${l.from} to ${l.to} names an unknown node`);
    if (!(b.column > a.column)) throw new VisualContractError(C, `link ${l.from} to ${l.to} must run to a later column`);
    if (!Number.isFinite(l.value) || !(l.value > 0)) throw new VisualContractError(C, `link ${l.from} to ${l.to} needs a positive value`);
    out.set(l.from, (out.get(l.from) ?? 0) + l.value);
    into.set(l.to, (into.get(l.to) ?? 0) + l.value);
  }
  const value = new Map<string, number>();
  for (const n of nodes) {
    const i = into.get(n.id);
    const o = out.get(n.id);
    if (i === undefined && o === undefined) throw new VisualContractError(C, `node "${n.id}" has no link`);
    if (i !== undefined && o !== undefined && Math.abs(i - o) > 1e-6 * Math.max(i, o)) throw new VisualContractError(C, `node "${n.id}" receives ${i} but passes on ${o}`);
    value.set(n.id, i ?? o ?? 0);
  }
  const columns = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
  const members = (c: number): readonly FlowNodeInput[] => nodes.filter((n) => n.column === c);
  const total = (c: number): number => members(c).reduce((a, n) => a + (value.get(n.id) ?? 0), 0);
  const k = Math.min(...columns.map((c) => (box.height - box.gap * (members(c).length - 1)) / total(c)));
  const x = scale([0, Math.max(1, columns.length - 1)], [0, box.width - box.nodeWidth]);
  const boxes = new Map<string, FlowNodeBox>();
  columns.forEach((c, ci) => {
    const list = members(c);
    const used = total(c) * k + box.gap * (list.length - 1);
    let y = (box.height - used) / 2;
    for (const n of list) {
      const v = value.get(n.id) ?? 0;
      boxes.set(n.id, { id: n.id, label: n.label, column: c, value: v, x: x(ci), y, width: box.nodeWidth, height: v * k });
      y += v * k + box.gap;
    }
  });
  const outCursor = new Map<string, number>();
  const inCursor = new Map<string, number>();
  const topOf = (id: string): number => boxes.get(id)?.y ?? 0;
  const ordered = [...links].sort((a, b) => topOf(a.to) - topOf(b.to) || topOf(a.from) - topOf(b.from));
  const inOrder = [...links].sort((a, b) => topOf(a.from) - topOf(b.from) || topOf(a.to) - topOf(b.to));
  const sourceY = new Map<FlowLinkInput, number>();
  for (const l of ordered) {
    const cursor = outCursor.get(l.from) ?? topOf(l.from);
    sourceY.set(l, cursor);
    outCursor.set(l.from, cursor + l.value * k);
  }
  const targetY = new Map<FlowLinkInput, number>();
  for (const l of inOrder) {
    const cursor = inCursor.get(l.to) ?? topOf(l.to);
    targetY.set(l, cursor);
    inCursor.set(l.to, cursor + l.value * k);
  }
  const shapes = links.map((l): FlowLinkShape => {
    const a = boxes.get(l.from) as FlowNodeBox;
    const b = boxes.get(l.to) as FlowNodeBox;
    const t = l.value * k;
    const x0 = a.x + a.width;
    const x1 = b.x;
    const xm = (x0 + x1) / 2;
    const y0 = sourceY.get(l) ?? 0;
    const y1 = targetY.get(l) ?? 0;
    const path = `M${fmt(x0)} ${fmt(y0)} C${fmt(xm)} ${fmt(y0)} ${fmt(xm)} ${fmt(y1)} ${fmt(x1)} ${fmt(y1)} L${fmt(x1)} ${fmt(y1 + t)} C${fmt(xm)} ${fmt(y1 + t)} ${fmt(xm)} ${fmt(y0 + t)} ${fmt(x0)} ${fmt(y0 + t)} Z`;
    return { from: l.from, to: l.to, value: l.value, percentOfSource: (l.value / a.value) * 100, thickness: t, path };
  });
  return { nodes: nodes.map((n) => boxes.get(n.id) as FlowNodeBox), links: shapes, k };
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
