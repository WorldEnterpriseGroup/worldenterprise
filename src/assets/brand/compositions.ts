import type { CompositionId } from '../../components/brand/types.ts';

/**
 * The eight hero compositions, one per page family. Each is an abstract scene drawn only with the Hive Atlas hex cell: no people, no
 * logo, no product, no chart and no text. The markup is a plain string (classes only, so the CSP needs no allowance; colour comes from
 * rules in Compositions.astro). The accessible name is supplied by the caller; `name` is a plain description a caller may use as the label.
 * Pure TypeScript with no Astro imports, so a unit test can measure and scan every composition under node.
 */

export const VIEWBOX_WIDTH = 400;
export const VIEWBOX_HEIGHT = 300;

/** Largest size of one composition, in bytes of markup. */
export const COMPOSITION_MAX_BYTES = 12288;

export type CellRole = 'core' | 'lead' | 'tone' | 'soft' | 'sand' | 'ghost' | 'dash';

export interface Composition {
  readonly name: string;
  readonly svg: string;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const SQRT3 = Math.sqrt(3);
const CX = VIEWBOX_WIDTH / 2;
const CY = VIEWBOX_HEIGHT / 2;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** A flat-top hexagon of circumradius `r`, the brand cell. */
function hexagon(cx: number, cy: number, r: number, role: CellRole): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    pts.push(`${round1(cx + r * Math.cos(a))},${round1(cy + r * Math.sin(a))}`);
  }
  return `<polygon class="c-${role}" points="${pts.join(' ')}"/>`;
}

function line(x1: number, y1: number, x2: number, y2: number, role: 'line' | 'hair'): string {
  return `<line class="c-${role}" x1="${round1(x1)}" y1="${round1(y1)}" x2="${round1(x2)}" y2="${round1(y2)}"/>`;
}

/** Axial lattice of flat-top cells: `a` steps along the 30 degree axis, `b` straight down. `gap` is a fraction of the cell size. */
function lattice(cx: number, cy: number, r: number, gap: number): (a: number, b: number) => Point {
  const d = SQRT3 * r * (1 + gap);
  return (a, b) => ({ x: cx + a * d * Math.cos(Math.PI / 6), y: cy + a * d * 0.5 + b * d });
}

/** The axial coordinates of every cell exactly `n` steps from the centre, in clockwise order from the right. */
function ring(n: number): ReadonlyArray<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let a = -n; a <= n; a += 1) {
    for (let b = -n; b <= n; b += 1) {
      if (Math.max(Math.abs(a), Math.abs(b), Math.abs(a + b)) === n) out.push([a, b]);
    }
  }
  const angle = ([a, b]: readonly [number, number]): number => Math.atan2(a * 0.5 + b, a * Math.cos(Math.PI / 6));
  return out.sort((p, q) => angle(p) - angle(q));
}

/** Honeycomb of flat-top cells: columns every 1.5 radii, odd columns dropped half a cell. */
function honeycomb(x0: number, y0: number, r: number, gap: number): (col: number, row: number) => Point {
  const dx = 1.5 * r * (1 + gap);
  const dy = SQRT3 * r * (1 + gap);
  return (col, row) => ({ x: x0 + col * dx, y: y0 + row * dy + (col % 2 === 1 ? dy / 2 : 0) });
}

function scene(id: CompositionId, parts: readonly string[]): string {
  return `<svg class="comp comp--${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" preserveAspectRatio="xMidYMid meet" focusable="false">${parts.join('')}</svg>`;
}

/** Segments: a core cell, a ring of six soft cells and a second ring where eight of twelve places are taken. */
function segments(): string {
  const r = 28;
  const at = lattice(CX, CY, r, 0.1);
  const parts: string[] = [];
  const outer = ring(2);
  let filled = 0;
  outer.forEach(([a, b], i) => {
    const p = at(a, b);
    if (i % 3 === 2) {
      parts.push(hexagon(p.x, p.y, r, 'ghost'));
    } else {
      parts.push(hexagon(p.x, p.y, r, filled % 2 === 0 ? 'tone' : 'sand'));
      filled += 1;
    }
  });
  for (const [a, b] of ring(1)) {
    const p = at(a, b);
    parts.push(hexagon(p.x, p.y, r, 'soft'));
  }
  parts.push(hexagon(CX, CY, r, 'core'));
  return scene('segments', parts);
}

/** Industries: seven identical clusters on a perimeter ring around one centre cell. No cluster outranks another. */
function industries(): string {
  const ringR = 100;
  const r = 15;
  const at = lattice(0, 0, r, 0.1);
  const local = [at(0, 0), at(1, 0), at(0, 1)];
  const mx = local.reduce((s, p) => s + p.x, 0) / local.length;
  const my = local.reduce((s, p) => s + p.y, 0) / local.length;
  const roles: readonly CellRole[] = ['tone', 'soft', 'soft'];
  const parts: string[] = [`<circle class="c-hair" cx="${CX}" cy="${CY}" r="${ringR}"/>`];
  for (let i = 0; i < 7; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
    const ox = CX + ringR * Math.cos(angle);
    const oy = CY + ringR * Math.sin(angle);
    local.forEach((p, k) => parts.push(hexagon(ox + p.x - mx, oy + p.y - my, r, roles[k] ?? 'soft')));
  }
  parts.push(hexagon(CX, CY, 24, 'core'));
  return scene('industries', parts);
}

/** The cells of one side of the comparison, relative to the side's anchor, in axial coordinates. The right side is the exact mirror. */
export const COMPARE_GROUP: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [1, -1],
  [0, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
];

export const COMPARE_ANCHOR_X = 100;

/** Compare: two equal groups, the right the mirror image of the left, and one shared cell between them. Nothing is larger or brighter on one side. */
function compare(): string {
  const r = 24;
  const at = lattice(COMPARE_ANCHOR_X, CY, r, 0.1);
  const left = COMPARE_GROUP.map(([a, b]) => at(a, b));
  const parts: string[] = [line(CX, 24, CX, 276, 'hair'), line(164, CY, 180, CY, 'line'), line(220, CY, 236, CY, 'line')];
  for (const p of left) parts.push(hexagon(p.x, p.y, r, 'tone'));
  for (const p of left) parts.push(hexagon(VIEWBOX_WIDTH - p.x, p.y, r, 'tone'));
  parts.push(hexagon(CX, CY, 20, 'soft'));
  return scene('compare', parts);
}

/** Journey: five cells climbing in order. Cells behind are solid, the current one is lit, the ones ahead are pale. */
function journey(): string {
  const r = 30;
  const centres: Point[] = [];
  for (let i = 0; i < 5; i += 1) centres.push({ x: 70 + i * 65, y: 225 - i * 37 });
  const parts: string[] = [];
  centres.forEach((p) => parts.push(hexagon(p.x + 32, p.y + 52, 18, 'ghost')));
  centres.slice(0, -1).forEach((p, i) => {
    const q = centres[i + 1];
    if (q !== undefined) parts.push(line(p.x, p.y, q.x, q.y, 'line'));
  });
  const roles: readonly CellRole[] = ['core', 'core', 'lead', 'soft', 'soft'];
  centres.forEach((p, i) => parts.push(hexagon(p.x, p.y, r, roles[i] ?? 'soft')));
  return scene('journey', parts);
}

/** Investors: a room made of small cells, walled on three sides and open to the right, one cell marked. */
function investors(): string {
  const r = 17;
  const at = honeycomb(90, 62, r, 0.08);
  const parts: string[] = [line(60, 36, 360, 36, 'hair'), line(60, 36, 60, 266, 'hair'), line(60, 266, 360, 266, 'hair')];
  for (let col = 0; col < 9; col += 1) {
    for (let row = 0; row < 6; row += 1) {
      const p = at(col, row);
      const role: CellRole = col === 2 && row === 3 ? 'lead' : col <= 3 ? 'soft' : col === 4 ? 'tone' : 'ghost';
      parts.push(hexagon(p.x, p.y, r, role));
    }
  }
  return scene('investors', parts);
}

/** Partners: two lattices that meet along one edge and interlock, cell by cell. */
function partners(): string {
  const r = 20;
  const at = honeycomb(87, 47, r, 0.08);
  const parts: string[] = [];
  for (let col = 0; col < 8; col += 1) {
    for (let row = 0; row < 6; row += 1) {
      const p = at(col, row);
      let role: CellRole;
      if (col < 3) role = 'tone';
      else if (col === 3) role = row % 2 === 0 ? 'tone' : 'sand';
      else if (col === 4) role = row % 2 === 0 ? 'sand' : 'tone';
      else role = 'sand';
      parts.push(hexagon(p.x, p.y, r, role));
    }
  }
  return scene('partners', parts);
}

/** Briefs: one sheet with a folded corner. The top three rows of cells are open; the rest is drawn as a hairline outline. */
function briefs(): string {
  const r = 15;
  const at = honeycomb(127, 60, r, 0.08);
  const parts: string[] = [
    '<path class="c-hair" d="M100 30H260L300 70V270H100Z"/>',
    '<path class="c-fold" d="M260 30V70H300Z"/>',
  ];
  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      if (row === 0 && col >= 5) continue;
      const p = at(col, row);
      let role: CellRole;
      if (row >= 3) role = 'dash';
      else role = col === 1 && row === 1 ? 'lead' : 'tone';
      parts.push(hexagon(p.x, p.y, r, role));
    }
  }
  return scene('briefs', parts);
}

/** Resources: three shelves, each holding a row of cells of one tone. */
function resources(): string {
  const r = 17;
  const bands: ReadonlyArray<{ readonly y: number; readonly role: CellRole }> = [
    { y: 70, role: 'tone' },
    { y: 150, role: 'soft' },
    { y: 230, role: 'sand' },
  ];
  const parts: string[] = [];
  bands.forEach(({ y, role }, bandIndex) => {
    parts.push(line(50, y + 30, 350, y + 30, 'hair'));
    for (let i = 0; i < 8; i += 1) {
      parts.push(hexagon(74 + i * 36, y, r, bandIndex === 1 && i === 3 ? 'lead' : role));
    }
  });
  return scene('resources', parts);
}

const BUILDERS: Readonly<Record<CompositionId, () => string>> = { segments, industries, compare, journey, investors, partners, briefs, resources };

const NAMES: Readonly<Record<CompositionId, string>> = {
  segments: 'A ring of hexagonal cells around one central cell',
  industries: 'Seven equal clusters of cells arranged in a ring',
  compare: 'Two matching groups of cells facing each other across a shared cell',
  journey: 'Five hexagonal cells climbing from left to right, the third one lit',
  investors: 'A room of small cells, walled on three sides and open on the right',
  partners: 'Two lattices of cells interlocking along one edge',
  briefs: 'A sheet with a folded corner, filled with cells above and outlined below',
  resources: 'Three shelves, each holding a row of cells',
};

const build = (id: CompositionId): Composition => ({ name: NAMES[id], svg: BUILDERS[id]() });

export const COMPOSITIONS: Readonly<Record<CompositionId, Composition>> = {
  segments: build('segments'),
  industries: build('industries'),
  compare: build('compare'),
  journey: build('journey'),
  investors: build('investors'),
  partners: build('partners'),
  briefs: build('briefs'),
  resources: build('resources'),
};

/** The inline SVG markup of one composition. */
export function renderComposition(id: CompositionId): string {
  return COMPOSITIONS[id].svg;
}
