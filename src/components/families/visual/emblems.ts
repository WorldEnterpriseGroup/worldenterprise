/**
 * The emblems of the content families (WP-56, wave 9): one small, static SVG picture per family, drawn from the galaxy and hex
 * vocabulary of the brand (BRIEF.md section 5). Playbooks are mission patches, briefs star charts, industries hex-faceted planets,
 * the glossary a constellation map, research a supernova, and so on. Each emblem is a pure function of its family and a seed, so a
 * card gets its own variant (a different constellation, a different ring tilt) and the same card draws the same picture on every
 * build. No colour lives here: every shape names a tone, and the component paints the tone with a token class. Exactly one shape per
 * emblem carries the amber accent (the brand's one-accent rule).
 */

export const EMBLEM_KINDS = [
  'insights',
  'research',
  'library',
  'playbooks',
  'fundability',
  'resources',
  'briefs',
  'industries',
  'compare',
  'journey',
  'glossary',
  'faq',
  'search',
  'sitemap',
  'lost',
] as const;

export type EmblemKind = (typeof EMBLEM_KINDS)[number];

/** How a shape is painted. The component maps each tone to a token class (`wv-t-<tone>`). */
export type Tone = 'star' | 'faint' | 'line' | 'dash' | 'soft' | 'glass' | 'body' | 'void' | 'accent' | 'accent-line';

export type Shape =
  | { readonly tag: 'circle'; readonly tone: Tone; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly tag: 'ellipse'; readonly tone: Tone; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number; readonly rotate: number }
  | { readonly tag: 'path'; readonly tone: Tone; readonly d: string }
  | { readonly tag: 'polygon'; readonly tone: Tone; readonly points: string }
  | { readonly tag: 'line'; readonly tone: Tone; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

export interface Emblem {
  readonly kind: EmblemKind;
  /** Always `0 0 320 200`: a 16:10 picture that fills a card head or a hero panel. */
  readonly viewBox: string;
  readonly shapes: readonly Shape[];
}

export const VIEW_W = 320;
export const VIEW_H = 200;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

/** Tones that carry the amber accent. An emblem has exactly one shape in one of them. */
export const ACCENT_TONES: readonly Tone[] = ['accent', 'accent-line'];

// -------------------------------------------------------------------------------------------------------------------------------
// Deterministic randomness
// -------------------------------------------------------------------------------------------------------------------------------

/** FNV-1a hash of a string, for seeding an emblem from a slug. */
export function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: a small, fast PRNG. The same seed gives the same sequence on every build. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number): number => Math.round(n * 10) / 10;
const between = (random: () => number, min: number, max: number): number => min + (max - min) * random();

// -------------------------------------------------------------------------------------------------------------------------------
// Primitives
// -------------------------------------------------------------------------------------------------------------------------------

/** The six corners of a flat-topped hexagon, as an SVG points list. */
export function hexPoints(cx: number, cy: number, r: number, rotateDeg = 0): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = ((60 * i + rotateDeg) * Math.PI) / 180;
    points.push(`${round(cx + r * Math.cos(a))},${round(cy + r * Math.sin(a))}`);
  }
  return points.join(' ');
}

const circle = (tone: Tone, cx: number, cy: number, r: number): Shape => ({ tag: 'circle', tone, cx: round(cx), cy: round(cy), r: round(r) });
const line = (tone: Tone, x1: number, y1: number, x2: number, y2: number): Shape => ({ tag: 'line', tone, x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2) });
const path = (tone: Tone, d: string): Shape => ({ tag: 'path', tone, d });
const hex = (tone: Tone, cx: number, cy: number, r: number, rotateDeg = 0): Shape => ({ tag: 'polygon', tone, points: hexPoints(cx, cy, r, rotateDeg) });
const ellipse = (tone: Tone, cx: number, cy: number, rx: number, ry: number, rotate = 0): Shape => ({
  tag: 'ellipse',
  tone,
  cx: round(cx),
  cy: round(cy),
  rx: round(rx),
  ry: round(ry),
  rotate: round(rotate),
});

/** A polar point around the picture centre (or a given centre). */
const polar = (r: number, deg: number, cx = CX, cy = CY): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

/** A sparse starfield behind every emblem. */
function starfield(random: () => number, count: number): Shape[] {
  const stars: Shape[] = [];
  for (let i = 0; i < count; i += 1) stars.push(circle('star', between(random, 6, VIEW_W - 6), between(random, 6, VIEW_H - 6), between(random, 0.5, 1.3)));
  return stars;
}

/** An arc path from angle a to angle b (degrees, clockwise) on a circle. */
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const [x1, y1] = polar(r, fromDeg, cx, cy);
  const [x2, y2] = polar(r, toDeg, cx, cy);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${round(x1)} ${round(y1)} A ${round(r)} ${round(r)} 0 ${large} 1 ${round(x2)} ${round(y2)}`;
}

// -------------------------------------------------------------------------------------------------------------------------------
// The emblems
// -------------------------------------------------------------------------------------------------------------------------------

/** Insights: a spiral galaxy, two arms of stars around a bright core. */
function insights(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 14)];
  const tilt = between(random, 0.5, 0.7);
  const twist = between(random, 0, 360);
  shapes.push(ellipse('faint', CX, CY, 118, 118 * tilt, -12));
  for (let arm = 0; arm < 2; arm += 1) {
    for (let t = 0; t < 22; t += 1) {
      const r = 10 * Math.exp(0.105 * t);
      if (r > 112) break;
      const deg = twist + arm * 180 + t * 21;
      const a = (deg * Math.PI) / 180;
      shapes.push(circle(t % 4 === 0 ? 'line' : 'star', CX + r * Math.cos(a), CY + r * Math.sin(a) * tilt, Math.max(0.7, 2.6 - t * 0.09)));
    }
  }
  shapes.push(circle('glass', CX, CY, 20));
  shapes.push(circle('accent', CX, CY, 7));
  return shapes;
}

/** Research: a supernova, uneven rays and two expanding shells around an amber core. */
function research(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 16)];
  shapes.push(circle('faint', CX, CY, 34), circle('faint', CX, CY, 58), circle('dash', CX, CY, 84));
  const rays = 18;
  for (let i = 0; i < rays; i += 1) {
    const deg = (360 / rays) * i + between(random, -5, 5);
    const [x1, y1] = polar(18, deg);
    const [x2, y2] = polar(between(random, 42, 92), deg);
    shapes.push(line(i % 3 === 0 ? 'line' : 'faint', x1, y1, x2, y2));
  }
  shapes.push(circle('glass', CX, CY, 16));
  shapes.push(circle('accent', CX, CY, 9));
  return shapes;
}

/** Library: a stack of working pages under a crescent moon, sealed with a hex. */
function library(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 12)];
  const mx = between(random, 222, 250);
  shapes.push(path('soft', `M ${round(mx)} 38 A 34 34 0 1 0 ${round(mx + 4)} 98 A 27 27 0 1 1 ${round(mx)} 38 Z`));
  const turns = [-9, -3, 4];
  turns.forEach((turn, i) => {
    const x = 104 + i * 8;
    const y = 52 + i * 6;
    const corners = [
      [x, y],
      [x + 86, y],
      [x + 86, y + 112],
      [x, y + 112],
    ].map(([px = 0, py = 0]) => {
      const a = (turn * Math.PI) / 180;
      const ox = px - (x + 43);
      const oy = py - (y + 56);
      return `${round(x + 43 + ox * Math.cos(a) - oy * Math.sin(a))},${round(y + 56 + ox * Math.sin(a) + oy * Math.cos(a))}`;
    });
    shapes.push({ tag: 'polygon', tone: i === turns.length - 1 ? 'soft' : 'glass', points: corners.join(' ') });
  });
  for (let row = 0; row < 6; row += 1) {
    const y = 84 + row * 13;
    shapes.push(line('faint', 134, y, 134 + between(random, 40, 62), y + 1.5));
  }
  shapes.push(hex('accent', 200, 160, 9, 30));
  return shapes;
}

/** Playbooks: a mission patch. A hex badge over a planet's limb, a comet on its trajectory, one pip per step in the sequence. */
function playbooks(random: () => number, index: number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 12)];
  shapes.push(hex('soft', CX, CY, 84, 30), hex('faint', CX, CY, 70, 30));
  shapes.push(path('line', arc(CX, CY + 118, 92, 214, 326)));
  const lift = between(random, -10, 10);
  shapes.push(path('dash', `M 104 ${round(138 + lift)} C 128 ${round(110 + lift)} 160 78 ${round(204)} ${round(60 - lift / 2)}`));
  shapes.push(path('line', `M 198 ${round(66 - lift / 2)} L 182 ${round(68 - lift / 2)} M 199 ${round(68 - lift / 2)} L 186 ${round(78 - lift / 2)}`));
  shapes.push(circle('accent', 204, 60 - lift / 2, 6));
  const pips = Math.min(Math.max(index + 1, 1), 10);
  const span = (pips - 1) * 9;
  for (let i = 0; i < pips; i += 1) shapes.push(circle('star', CX - span / 2 + i * 9, 152, 2.2));
  return shapes;
}

/** Fundability: a readiness gauge. Segments on an arc, a needle and a row of hex checks; no number and no threshold on it. */
function fundability(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 12)];
  const gx = CX;
  const gy = 142;
  const segments = 6;
  for (let i = 0; i < segments; i += 1) {
    const from = 180 + i * (180 / segments) + 2;
    const to = 180 + (i + 1) * (180 / segments) - 2;
    shapes.push(path(i < 4 ? 'line' : 'faint', arc(gx, gy, 96, from, to)));
    shapes.push(path('faint', arc(gx, gy, 80, from, to)));
  }
  const deg = between(random, 210, 330);
  const [nx, ny] = polar(74, deg, gx, gy);
  shapes.push(line('line', gx, gy, nx, ny));
  shapes.push(circle('accent', gx, gy, 7));
  for (let i = 0; i < 5; i += 1) shapes.push(hex(i < 3 ? 'glass' : 'faint', gx - 48 + i * 24, gy + 34, 8, 30));
  return shapes;
}

/** Resources: a solar system, planets on tilted orbits around one star. */
function resources(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 14)];
  const tilt = 0.42;
  [40, 70, 100, 132].forEach((r, i) => {
    shapes.push(ellipse(i === 3 ? 'dash' : 'faint', CX, CY, r, r * tilt, -8));
    const deg = between(random, 0, 360);
    const a = (deg * Math.PI) / 180;
    const rot = (-8 * Math.PI) / 180;
    const ex = r * Math.cos(a);
    const ey = r * tilt * Math.sin(a);
    const px = CX + ex * Math.cos(rot) - ey * Math.sin(rot);
    const py = CY + ex * Math.sin(rot) + ey * Math.cos(rot);
    shapes.push(circle(i % 2 === 0 ? 'body' : 'soft', px, py, 4 + i * 1.6));
  });
  shapes.push(circle('glass', CX, CY, 20));
  shapes.push(circle('accent', CX, CY, 12));
  return shapes;
}

/** Briefs: a star chart. Declination rings and hour lines, one constellation and its brightest star. */
function briefs(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 18)];
  shapes.push(circle('faint', CX, CY, 32), circle('faint', CX, CY, 62), circle('dash', CX, CY, 92));
  for (let i = 0; i < 6; i += 1) {
    const [x1, y1] = polar(20, i * 30);
    const [x2, y2] = polar(96, i * 30);
    const [x3, y3] = polar(20, i * 30 + 180);
    const [x4, y4] = polar(96, i * 30 + 180);
    shapes.push(line('faint', x1, y1, x2, y2), line('faint', x3, y3, x4, y4));
  }
  const count = 5 + Math.floor(random() * 3);
  const stars: [number, number][] = [];
  let deg = between(random, 0, 360);
  for (let i = 0; i < count; i += 1) {
    deg += between(random, 30, 70);
    stars.push(polar(between(random, 24, 84), deg));
  }
  shapes.push(path('line', stars.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`).join(' ')));
  const bright = Math.floor(random() * stars.length);
  stars.forEach(([x, y], i) => shapes.push(i === bright ? circle('accent', x, y, 4.5) : circle('star', x, y, 2.4)));
  return shapes;
}

/** Industries: a hex-faceted planet with a tilted ring and a moon. One amber facet marks the vertical. */
function industries(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 14)];
  const px = CX - 8;
  const py = CY + 4;
  const pr = 62;
  shapes.push(circle('soft', px, py, pr));
  const hr = 10;
  const facets: [number, number][] = [];
  for (let q = -6; q <= 6; q += 1) {
    for (let r = -6; r <= 6; r += 1) {
      const x = px + hr * 1.5 * q;
      const y = py + hr * Math.sqrt(3) * (r + q / 2);
      if (Math.hypot(x - px, y - py) + hr <= pr - 2) facets.push([x, y]);
    }
  }
  const lit = Math.floor(random() * facets.length);
  facets.forEach(([x, y], i) => {
    if (i !== lit) shapes.push(hex(random() < 0.3 ? 'glass' : 'faint', x, y, hr - 1.5));
  });
  const [ax, ay] = facets[lit] ?? [px, py];
  shapes.push(hex('accent', ax, ay, hr - 1.5));
  shapes.push(ellipse('line', px, py, 104, 22, between(random, -24, -10)));
  const [mx, my] = polar(between(random, 96, 112), between(random, -60, 20), px, py);
  shapes.push(circle('body', mx, my, 7));
  return shapes;
}

/** Compare: navigating giants. A black hole with its accretion disk, and a small craft's path bending around it. */
function compare(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 16)];
  const tilt = between(random, -14, -6);
  shapes.push(ellipse('faint', CX, CY, 126, 30, tilt), ellipse('line', CX, CY, 96, 22, tilt), ellipse('faint', CX, CY, 70, 15, tilt));
  shapes.push(circle('glass', CX, CY, 36));
  shapes.push(circle('void', CX, CY, 28));
  const lift = between(random, -8, 8);
  shapes.push(path('dash', `M 18 ${round(170 + lift)} C 90 ${round(150 + lift)} 120 ${round(34)} ${round(CX)} 38 S 262 ${round(120 - lift)} 304 ${round(150 - lift)}`));
  shapes.push(hex('accent', 304, 150 - lift, 6, 30));
  return shapes;
}

/** Journey: a launch trajectory. Dust, a star, then a world in orbit, along one curved path above a planet's limb. */
function journey(random: () => number, index: number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 14)];
  shapes.push(path('soft', `M 0 200 L 0 184 Q ${CX} 146 ${VIEW_W} 184 L ${VIEW_W} 200 Z`));
  shapes.push(path('dash', 'M 40 168 C 100 150 150 120 182 92 S 246 44 284 40'));
  for (let i = 0; i < 9; i += 1) shapes.push(circle('star', 40 + between(random, -14, 14), 164 + between(random, -10, 8), between(random, 0.6, 1.4)));
  const stops: [number, number, number][] = [
    [40, 166, 5],
    [118, 132, 7],
    [182, 92, 9],
    [284, 40, 12],
  ];
  const current = Math.min(Math.max(index, 0), stops.length - 1);
  stops.forEach(([x, y, r], i) => {
    if (i === current) shapes.push(circle('accent', x, y, r));
    else shapes.push(i === stops.length - 1 ? hex('soft', x, y, r + 2) : circle(i < current ? 'body' : 'glass', x, y, r));
  });
  shapes.push(ellipse('faint', 284, 40, 26, 9, -12));
  return shapes;
}

/** Glossary: a constellation map. Many stars, a few named figures joined by lines, tick marks on the frame. */
function glossary(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 26)];
  for (let x = 16; x < VIEW_W; x += 24) shapes.push(line('faint', x, 4, x, 10), line('faint', x, VIEW_H - 10, x, VIEW_H - 4));
  const centres: [number, number][] = [
    [74, 62],
    [214, 54],
    [118, 146],
    [254, 140],
  ];
  const accentFigure = Math.floor(random() * centres.length);
  centres.forEach(([fx, fy], f) => {
    const n = 3 + Math.floor(random() * 3);
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i += 1) pts.push([fx + between(random, -34, 34), fy + between(random, -24, 24)]);
    shapes.push(path('line', pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`).join(' ')));
    pts.forEach(([x, y], i) => shapes.push(f === accentFigure && i === 0 ? circle('accent', x, y, 4) : circle('star', x, y, 2.2)));
  });
  return shapes;
}

/** FAQ: a relay satellite answering a planet, with its signal rings. */
function faq(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 14)];
  shapes.push(path('soft', `M 0 200 L 0 150 Q 70 128 120 200 Z`));
  const sx = between(random, 196, 214);
  const sy = between(random, 70, 84);
  [26, 44, 62].forEach((r, i) => shapes.push(path(i === 2 ? 'faint' : 'line', arc(sx, sy, r, 120, 200))));
  shapes.push({ tag: 'polygon', tone: 'glass', points: `${round(sx - 40)},${round(sy - 8)} ${round(sx - 14)},${round(sy - 8)} ${round(sx - 14)},${round(sy + 8)} ${round(sx - 40)},${round(sy + 8)}` });
  shapes.push({ tag: 'polygon', tone: 'glass', points: `${round(sx + 14)},${round(sy - 8)} ${round(sx + 40)},${round(sy - 8)} ${round(sx + 40)},${round(sy + 8)} ${round(sx + 14)},${round(sy + 8)}` });
  shapes.push(hex('accent', sx, sy, 11, 30));
  return shapes;
}

/** Search: a scan. Range rings, a sweep and the one star it found. */
function search(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 20)];
  shapes.push(circle('faint', CX, CY, 30), circle('faint', CX, CY, 60), circle('line', CX, CY, 90));
  shapes.push(line('faint', CX - 96, CY, CX + 96, CY), line('faint', CX, CY - 96, CX, CY + 96));
  const deg = between(random, 200, 320);
  const [x1, y1] = polar(90, deg - 32);
  const [x2, y2] = polar(90, deg);
  shapes.push(path('glass', `M ${CX} ${CY} L ${round(x1)} ${round(y1)} A 90 90 0 0 1 ${round(x2)} ${round(y2)} Z`));
  const [fx, fy] = polar(between(random, 40, 76), deg - 12);
  shapes.push(circle('accent', fx, fy, 4.5));
  return shapes;
}

/** Sitemap: a hex atlas, the site as one field of cells with a "you are here" cell. */
function sitemap(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 10)];
  const r = 15;
  const cells: [number, number][] = [];
  for (let q = -6; q <= 6; q += 1) {
    for (let s = -4; s <= 4; s += 1) {
      const x = CX + r * 1.5 * q;
      const y = CY + r * Math.sqrt(3) * (s + q / 2);
      if (Math.abs(x - CX) < 140 && Math.abs(y - CY) < 80 && Math.hypot((x - CX) / 1.6, y - CY) < 84) cells.push([x, y]);
    }
  }
  const here = Math.floor(random() * cells.length);
  cells.forEach(([x, y], i) => {
    if (i === here) shapes.push(hex('accent', x, y, r - 2));
    else shapes.push(hex(random() < 0.35 ? 'glass' : 'faint', x, y, r - 2));
  });
  return shapes;
}

/** Not found: an orbit that breaks off, and a small world drifting beyond it. */
function lost(random: () => number): Shape[] {
  const shapes: Shape[] = [...starfield(random, 22)];
  shapes.push(path('line', arc(CX - 30, CY + 10, 70, 150, 330)));
  shapes.push(path('dash', arc(CX - 30, CY + 10, 70, 335, 400)));
  shapes.push(circle('soft', CX - 30, CY + 10, 26));
  shapes.push(circle('body', between(random, 250, 280), between(random, 40, 60), 9));
  shapes.push(hex('accent', between(random, 286, 300), between(random, 150, 170), 5, 30));
  return shapes;
}

const DRAW: Readonly<Record<EmblemKind, (random: () => number, index: number) => Shape[]>> = {
  insights,
  research,
  library,
  playbooks,
  fundability,
  resources,
  briefs,
  industries,
  compare,
  journey,
  glossary,
  faq,
  search,
  sitemap,
  lost,
};

/**
 * The emblem of a family. `seed` picks the variant (pass a slug through `seedOf`); `index` is a position the picture can show, such as
 * the step number of a playbook or the current stop of a journey page.
 */
export function emblem(kind: EmblemKind, seed = 1, index = 0): Emblem {
  const random = rng(seed ^ seedOf(kind));
  return { kind, viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, shapes: DRAW[kind](random, index) };
}
