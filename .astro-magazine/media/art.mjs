/**
 * Vector art primitives for the WP-12 fallback imagery and the OG cards.
 * Palette is SAGE-PLAN 4.1; geometry is the brand hexagon cell (flat-top, rounded joins).
 * Everything is deterministic: the same slot seed always yields the same SVG.
 */

export const C = Object.freeze({
  charcoal: '#231F20',
  blue: '#1C75BC',
  blueHi: '#2484C6',
  blueDeep: '#0F4C81',
  night: '#0A3459',
  grey: '#939598',
  mist: '#EAF2F9',
  tint: '#C3DDF0',
  hairline: '#D5D9DE',
  amber: '#E8A33D',
  white: '#FFFFFF',
  sky: '#8FBDE3',
});

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Number(n.toFixed(2));

/** Flat-top regular hexagon polygon points around (cx, cy) with circumradius r. */
export function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
  }
  return pts.join(' ');
}

/** One hexagon cell. `o` is {fill, stroke, sw, fo, so}. */
export function hex(cx, cy, r, o = {}) {
  const { fill = 'none', stroke = C.blue, sw = 2, fo = 1, so = 1 } = o;
  return `<polygon points="${hexPoints(cx, cy, r)}" fill="${fill}" fill-opacity="${fo}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

/** Centre of cell (q, r) in a flat-top axial grid of circumradius s. */
export function axial(q, r, s) {
  return [s * 1.5 * q, s * Math.sqrt(3) * (r + q / 2)];
}

export function line(x1, y1, x2, y2, stroke = C.blue, sw = 1.5, so = 1, dash = '') {
  const d = dash ? ` stroke-dasharray="${dash}"` : '';
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="${sw}" stroke-linecap="round"${d}/>`;
}

export function svgDoc(w, h, body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
}

export function gradient(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  const s = stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
}

/** Axial cells whose centres fall inside the canvas (with a half-cell margin). */
function cellsOf(w, h, s) {
  const out = [];
  const cols = Math.ceil(w / (s * 1.5)) + 3;
  const rows = Math.ceil(h / (s * Math.sqrt(3))) + 3;
  for (let q = -2; q < cols; q += 1) {
    for (let r = -Math.ceil(q / 2) - 2; r < rows; r += 1) {
      const [x, y] = axial(q, r, s);
      if (x < -s || x > w + s || y < -s || y > h + s) continue;
      out.push([x, y]);
    }
  }
  return out;
}

/**
 * A hexagonal field over the whole canvas. `amberPos` is a fractional [x, y]; the cell nearest to it is amber, so the
 * accent is always fully visible. Random tints use `rand`.
 */
export function field(w, h, s, rand, opts = {}) {
  const { density = 0.28, stroke = C.blue, so = 0.4, tintOpacity = 0.7, amberPos = null, dark = false } = opts;
  const cells = cellsOf(w, h, s);
  let amberIdx = -1;
  if (amberPos) {
    let best = Infinity;
    cells.forEach(([x, y], i) => {
      const d = (x - w * amberPos[0]) ** 2 + (y - h * amberPos[1]) ** 2;
      if (d < best) { best = d; amberIdx = i; }
    });
  }
  return cells.map(([x, y], i) => {
    const roll = rand();
    if (i === amberIdx) return hex(x, y, s - 1.5, { fill: C.amber, stroke: C.amber, sw: 2.5 });
    let fill = 'none';
    let fo = 1;
    if (roll < density) {
      fill = dark ? C.blue : roll < density / 2 ? C.tint : C.sky;
      fo = dark ? 0.35 + roll : tintOpacity;
    } else if (roll < density * 1.5) {
      fill = dark ? C.blueDeep : C.mist;
    }
    return hex(x, y, s - 1.5, { fill, fo, stroke, so, sw: 1.5 });
  }).join('');
}
