/**
 * Vector motifs for the fallback imagery. Each motif is (w, h, rand) => { body, defs }.
 * Palette and geometry follow SAGE-PLAN 4.1 and 4.4. No text, no people, no logos.
 */
import { C, axial, field, gradient, hex, line } from './art.mjs';

const f = (n) => Number(n.toFixed(2));
const lightBg = (w, h, id = 'bg') => ({
  defs: gradient(id, [[0, C.white], [1, C.mist]]),
  body: `<rect width="${w}" height="${h}" fill="url(#${id})"/>`,
});
const darkBg = (w, h, id = 'bg', a = C.blueDeep, b = C.night) => ({
  defs: gradient(id, [[0, a], [1, b]]),
  body: `<rect width="${w}" height="${h}" fill="url(#${id})"/>`,
});
const wrap = (...parts) => ({ defs: parts.map((p) => p.defs ?? '').join(''), body: parts.map((p) => p.body ?? p).join('') });
const amberDot = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${C.amber}"/>`;

export const motifs = {
  atlas(w, h, rand) {
    const bg = lightBg(w, h);
    const s = Math.round(h / 11);
    const cluster = [];
    const cx = w * (0.4 + rand() * 0.2);
    const cy = h * (0.4 + rand() * 0.2);
    const cs = s * 1.6;
    for (const [q, r] of [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]) {
      const [x, y] = axial(q, r, cs);
      const mid = q === 0 && r === 0;
      cluster.push(hex(cx + x, cy + y, cs - 3, { fill: mid ? C.blueDeep : C.white, fo: mid ? 0.9 : 0.85, stroke: C.blue, sw: 2.5, so: 0.9 }));
    }
    return wrap(bg, field(w, h, s, rand, { density: 0.32, amberPos: [0.12 + rand() * 0.15, 0.2 + rand() * 0.6] }), cluster.join(''));
  },
  ring(w, h, rand) {
    const bg = lightBg(w, h);
    const s = h / 6.2;
    const cx = w / 2;
    const cy = h / 2;
    const tones = [C.tint, C.sky, C.white, C.tint, C.mist, C.sky, C.white];
    const parts = [];
    const amberIdx = Math.floor(rand() * 6);
    const rot = rand() < 0.5 ? 0 : Math.PI / 6;
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i + Math.PI / 6 + rot;
      const d = s * 1.78;
      const x = cx + d * Math.cos(a);
      const y = cy + d * Math.sin(a);
      parts.push(line(cx, cy, x, y, C.blue, 1.5, 0.5));
      parts.push(hex(x, y, s - 4, { fill: tones[i], fo: 0.9, stroke: i === amberIdx ? C.amber : C.blue, sw: i === amberIdx ? 6 : 2.5, so: 1 }));
    }
    parts.push(hex(cx, cy, s - 4, { fill: C.blueDeep, stroke: C.blueDeep, sw: 2.5 }));
    parts.push(hex(cx, cy, s * 0.45, { fill: C.white, fo: 0.9, stroke: C.white, sw: 1 }));
    return wrap(bg, field(w, h, h / 9, rand, { density: 0.1, so: 0.12 }), parts.join(''));
  },
  lattice(w, h, rand) {
    const bg = darkBg(w, h, 'bg', C.blueDeep, C.night);
    const s = h / 14;
    const parts = [];
    const nodes = [];
    const cols = Math.ceil(w / (s * 1.5)) + 2;
    const rows = Math.ceil(h / (s * 1.732)) + 2;
    for (let q = -1; q < cols; q += 1) {
      for (let r = -Math.ceil(q / 2) - 1; r < rows; r += 1) {
        const [x, y] = axial(q, r, s);
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const roll = rand();
        parts.push(hex(x, y, s - 1.2, { fill: roll < 0.18 ? C.blueHi : 'none', fo: 0.4, stroke: C.sky, sw: 1.4, so: 0.55 }));
        if (roll > 0.8) nodes.push([x, y]);
      }
    }
    for (let i = 0; i < nodes.length - 1; i += 2) {
      const [x1, y1] = nodes[i];
      const [x2, y2] = nodes[i + 1];
      parts.push(line(x1, y1, x2, y1, C.sky, 2, 0.85));
      parts.push(line(x2, y1, x2, y2, C.sky, 2, 0.85));
      parts.push(`<circle cx="${f(x1)}" cy="${f(y1)}" r="5" fill="${C.sky}"/>`);
    }
    const [ax, ay] = nodes[Math.floor(nodes.length / 2)] ?? [w / 2, h / 2];
    parts.push(hex(ax, ay, s - 1.2, { fill: C.amber, stroke: C.amber, sw: 2 }));
    return wrap(bg, parts.join(''));
  },
  facing(w, h, rand) {
    const bg = lightBg(w, h);
    const s = h / 4.4;
    const y = h * 0.5;
    const table = h * 0.72;
    return wrap(
      bg,
      field(w, h, h / 9, rand, { density: 0.08, so: 0.1 }),
      line(w * 0.12, table, w * 0.88, table, C.blueDeep, 4, 0.9),
      line(w * 0.2, table, w * 0.2, table + h * 0.12, C.blueDeep, 4, 0.7),
      line(w * 0.8, table, w * 0.8, table + h * 0.12, C.blueDeep, 4, 0.7),
      hex(w * 0.27, y, s, { fill: C.blueDeep, fo: 0.92, stroke: C.blueDeep, sw: 3 }),
      hex(w * 0.73, y, s, { fill: C.tint, fo: 0.95, stroke: C.blue, sw: 4 }),
      line(w * 0.27 + s + 10, y, w * 0.73 - s - 10, y, C.blue, 2, 0.7, '2 12'),
      hex(w * 0.5, y, s * 0.28, { fill: C.amber, stroke: C.amber, sw: 2 }),
    );
  },
  wall(w, h, rand) {
    const bg = lightBg(w, h);
    const parts = [];
    const cols = 4;
    const rows = 3;
    const cw = w / (cols + 1);
    const ch = h / (rows + 1);
    const tones = [C.tint, C.sky, C.white, C.mist, C.blue];
    const amberAt = Math.floor(rand() * cols * rows);
    let i = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = cw * (c + 0.6) + (rand() - 0.5) * cw * 0.16;
        const y = ch * (r + 0.6) + (rand() - 0.5) * ch * 0.16;
        const rot = (rand() - 0.5) * 7;
        const tone = i === amberAt ? C.amber : tones[Math.floor(rand() * tones.length)];
        parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(cw * 0.78)}" height="${f(ch * 0.78)}" rx="10" fill="${tone}" fill-opacity="${tone === C.blue ? 0.5 : 0.95}" stroke="${C.blueDeep}" stroke-opacity="0.4" stroke-width="2" transform="rotate(${f(rot)} ${f(x + cw * 0.39)} ${f(y + ch * 0.39)})"/>`);
        i += 1;
      }
    }
    for (let c = 1; c < 3; c += 1) parts.push(line((w / 3) * c, 0, (w / 3) * c, h, C.grey, 3, 0.35));
    return wrap(bg, parts.join(''));
  },
  globe(w, h, rand) {
    const bg = wrap({ defs: gradient('bg', [[0, C.night], [0.62, C.blueDeep], [1, C.blue]]), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const r = Math.min(w, h) * 0.46;
    const cx = w * (0.5 + (rand() - 0.5) * 0.1);
    const cy = h * 0.82;
    const glow = `<circle cx="${f(cx + r * 0.5)}" cy="${f(cy - r * 0.95)}" r="${f(r * 0.5)}" fill="${C.amber}" fill-opacity="0.22"/><circle cx="${f(cx + r * 0.5)}" cy="${f(cy - r * 0.95)}" r="${f(r * 0.2)}" fill="${C.amber}"/>`;
    const lat = [-0.55, -0.2, 0.15].map((k) => `<ellipse cx="${f(cx)}" cy="${f(cy + r * k * 0.0)}" rx="${f(r * Math.sqrt(1 - k * k))}" ry="${f(r * 0.16)}" transform="translate(0 ${f(r * k)})" fill="none" stroke="${C.sky}" stroke-opacity="0.55" stroke-width="2"/>`).join('');
    const mer = [0.35, 0.7, 1].map((k) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * k)}" ry="${f(r)}" fill="none" stroke="${C.sky}" stroke-opacity="0.45" stroke-width="2"/>`).join('');
    const facets = [];
    for (let i = 0; i < 9; i += 1) {
      const a = -Math.PI * (0.15 + 0.7 * rand());
      const d = r * (0.2 + 0.7 * rand());
      facets.push(hex(cx + d * Math.cos(a), cy + d * Math.sin(a), r * 0.1, { fill: C.sky, fo: 0.35, stroke: C.sky, sw: 1.5, so: 0.8 }));
    }
    return wrap(bg, glow, `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${C.blueDeep}" stroke="${C.sky}" stroke-width="3"/>`, `<clipPath id="gc"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/></clipPath><g clip-path="url(#gc)">${lat}${mer}${facets.join('')}</g>`);
  },
  stairs(w, h, rand) {
    const bg = lightBg(w, h);
    const n = 6;
    const parts = [];
    for (let i = 0; i < n; i += 1) {
      const s = h * (0.1 + i * 0.026);
      const x = w * (0.12 + (i / (n - 1)) * 0.76);
      const y = h * (0.84 - (i / (n - 1)) * 0.66);
      const last = i === n - 1;
      if (i > 0) {
        const px = w * (0.12 + ((i - 1) / (n - 1)) * 0.76);
        const py = h * (0.84 - ((i - 1) / (n - 1)) * 0.66);
        parts.push(line(px, py, x, y, C.blue, 1.5, 0.5, '2 10'));
      }
      parts.push(hex(x, y, s, { fill: last ? C.amber : i % 2 ? C.tint : C.blueDeep, fo: last ? 1 : 0.9, stroke: last ? C.amber : C.blue, sw: 3 }));
    }
    return wrap(bg, field(w, h, h / 8, rand, { density: 0.1, so: 0.12 }), parts.join(''));
  },
  folders(w, h, rand) {
    const bg = lightBg(w, h);
    const tones = [C.blueDeep, C.blue, C.sky, C.tint];
    const parts = [];
    const fw = w * 0.34;
    const fh = h * 0.5;
    const amberAt = Math.floor(rand() * 4);
    tones.forEach((t, i) => {
      const x = w * 0.1 + i * w * 0.15;
      const y = h * 0.16 + (i % 2) * h * 0.1 + i * h * 0.02;
      const tone = i === amberAt ? C.amber : t;
      parts.push(`<path d="M${f(x)} ${f(y + 20)} q0 -20 20 -20 h${f(fw * 0.32)} l22 22 h${f(fw * 0.68 - 42)} q20 0 20 20 v${f(fh)} q0 20 -20 20 h${f(-fw + 20)} q-20 0 -20 -20 z" fill="${tone}" fill-opacity="0.94" stroke="${C.night}" stroke-opacity="0.35" stroke-width="2.5" stroke-linejoin="round"/>`);
    });
    return wrap(bg, field(w, h, h / 9, rand, { density: 0.08, so: 0.12 }), parts.join(''));
  },
  coast(w, h, rand) {
    const bg = wrap({ defs: gradient('bg', [[0, C.mist], [0.5, C.tint], [1, C.sky]]), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const parts = [];
    parts.push(amberDot(w * (0.3 + rand() * 0.4), h * 0.42, h * 0.07));
    const layers = [[0.5, C.sky, 0.55], [0.6, C.blue, 0.6], [0.72, C.blueDeep, 0.8], [0.86, C.night, 0.95]];
    layers.forEach(([y0, col, op], i) => {
      let d = `M0 ${f(h)} L0 ${f(h * y0)}`;
      const steps = 8;
      for (let k = 1; k <= steps; k += 1) d += ` Q${f((w / steps) * (k - 0.5))} ${f(h * y0 + (rand() - 0.5) * h * 0.1)} ${f((w / steps) * k)} ${f(h * y0 + (rand() - 0.5) * h * 0.05)}`;
      d += ` L${w} ${h} Z`;
      parts.push(`<path d="${d}" fill="${col}" fill-opacity="${op}"/>`);
      if (i < 3) for (let k = 0; k < 3; k += 1) parts.push(hex(w * (0.1 + rand() * 0.8), h * (y0 + 0.05 + rand() * 0.06), 8, { stroke: C.white, so: 0.6, sw: 1.5 }));
    });
    return wrap(bg, parts.join(''));
  },
  frame(w, h, rand) {
    const bg = darkBg(w, h, 'bg', C.blueDeep, C.night);
    const parts = [];
    for (let x = 0; x <= w; x += w / 16) parts.push(line(x, 0, x, h, C.sky, 1, 0.18));
    for (let y = 0; y <= h; y += h / 12) parts.push(line(0, y, w, y, C.sky, 1, 0.18));
    const fx = w * 0.3;
    const fy = h * 0.2;
    const fw = w * 0.4;
    const fh = h * 0.6;
    parts.push(`<rect x="${f(fx)}" y="${f(fy)}" width="${f(fw)}" height="${f(fh)}" fill="none" stroke="${C.sky}" stroke-width="5"/>`);
    parts.push(line(fx, fy, fx + fw, fy + fh, C.sky, 2.5, 0.8), line(fx + fw, fy, fx, fy + fh, C.sky, 2.5, 0.8), line(fx, fy + fh / 2, fx + fw, fy + fh / 2, C.sky, 2.5, 0.8));
    parts.push(hex(fx + fw / 2, fy + fh / 2, h * 0.09, { fill: C.amber, stroke: C.amber, sw: 2 }));
    parts.push(line(fx, h * 0.9, fx + fw, h * 0.9, C.amber, 2.5, 1), line(fx, h * 0.87, fx, h * 0.93, C.amber, 2.5, 1), line(fx + fw, h * 0.87, fx + fw, h * 0.93, C.amber, 2.5, 1));
    for (const [cx, cy] of [[w * 0.14, h * 0.7], [w * 0.86, h * 0.3]]) parts.push(`<rect x="${f(cx - w * 0.06)}" y="${f(cy - h * 0.05)}" width="${f(w * 0.12)}" height="${f(h * 0.1)}" rx="${f(h * 0.05)}" fill="${C.sky}" fill-opacity="${f(0.5 + rand() * 0.2)}"/>`);
    return wrap(bg, parts.join(''));
  },
  terrace(w, h, rand) {
    const bg = wrap({ defs: gradient('bg', [[0, C.white], [1, C.tint]]), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const parts = [amberDot(w * 0.8, h * 0.18, h * 0.06)];
    const cols = [C.sky, C.blue, C.blueDeep, C.night];
    for (let i = 0; i < 4; i += 1) {
      const y = h * (0.38 + i * 0.15);
      parts.push(`<rect x="0" y="${f(y)}" width="${w}" height="${f(h - y)}" fill="${cols[i]}" fill-opacity="${f(0.55 + i * 0.12)}"/>`);
      const s = h * (0.035 + i * 0.012);
      for (let x = (i % 2) * s * 1.5; x < w + s; x += s * 3) parts.push(hex(x, y + s * 1.6, s - 1, { fill: C.white, fo: 0.1 + rand() * 0.18, stroke: C.white, so: 0.5, sw: 1.5 }));
    }
    return wrap(bg, parts.join(''));
  },
  trail(w, h, rand) {
    const bg = lightBg(w, h);
    const parts = [];
    const pts = [];
    const n = 6;
    for (let i = 0; i < n; i += 1) pts.push([w * (0.1 + (i / (n - 1)) * 0.8), h * (0.68 - (i / (n - 1)) * 0.38 + Math.sin(i * 1.4 + rand()) * 0.08)]);
    pts.forEach(([x, y], i) => {
      if (i > 0) parts.push(line(pts[i - 1][0], pts[i - 1][1], x, y, C.blue, 2, 0.6));
    });
    pts.forEach(([x, y], i) => {
      const last = i === n - 1;
      const s = h * (0.07 + i * 0.012);
      parts.push(hex(x, y, s, { fill: last ? C.amber : i % 2 ? C.tint : C.blueDeep, fo: 0.95, stroke: last ? C.amber : C.blue, sw: 3 }));
    });
    return wrap(bg, field(w, h, h / 8, rand, { density: 0.1, so: 0.12 }), parts.join(''));
  },
  gradient(w, h, rand, v = 0) {
    const sets = [[C.white, C.tint, C.blue], [C.tint, C.blue, C.blueDeep], [C.white, C.tint, C.sky], [C.blueDeep, C.night, C.blue]];
    const [a, b, c] = sets[v % sets.length];
    const bg = wrap({ defs: gradient('bg', [[0, a], [0.6, b], [1, c]], 0, 0, 1, 1), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const dark = v % sets.length === 3;
    const s = h / 4.2;
    return wrap(bg, field(w, h, s, rand, { density: 0.35, stroke: dark ? C.sky : C.white, so: 0.75, dark, tintOpacity: 0.35, amberPos: [0.3 + rand() * 0.4, 0.35 + rand() * 0.3] }));
  },
  shelf(w, h, rand) {
    const bg = lightBg(w, h);
    const parts = [];
    const tones = [C.blueDeep, C.white, C.blue, C.tint, C.night, C.sky];
    for (let row = 0; row < 3; row += 1) {
      const base = h * (0.3 + row * 0.3);
      let x = w * 0.06;
      while (x < w * 0.9) {
        const bw = w * (0.03 + rand() * 0.03);
        const bh = h * (0.14 + rand() * 0.1);
        const t = tones[Math.floor(rand() * tones.length)];
        parts.push(`<rect x="${f(x)}" y="${f(base - bh)}" width="${f(bw)}" height="${f(bh)}" fill="${t}" stroke="${C.blueDeep}" stroke-opacity="0.5" stroke-width="2"/>`);
        x += bw + 3;
      }
      parts.push(line(w * 0.04, base, w * 0.96, base, C.blueDeep, 5, 0.9));
    }
    parts.push(hex(w * 0.72, h * 0.3 - h * 0.1, h * 0.05, { fill: C.amber, stroke: C.amber, sw: 2 }));
    return wrap(bg, parts.join(''));
  },
  bridge(w, h, rand) {
    const bg = wrap({ defs: gradient('bg', [[0, C.mist], [0.55, C.tint], [0.56, C.sky], [1, C.blueDeep]]), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const parts = [amberDot(w * 0.22, h * 0.34, h * 0.06)];
    const nodes = [[0.12, 0.56], [0.36, 0.5], [0.62, 0.54], [0.88, 0.5]];
    nodes.forEach(([x, y], i) => {
      if (i === 0) return;
      const [px, py] = nodes[i - 1];
      parts.push(`<path d="M${f(w * px)} ${f(h * py)} Q${f(w * (px + x) / 2)} ${f(h * (py - 0.2))} ${f(w * x)} ${f(h * y)}" fill="none" stroke="${C.blueDeep}" stroke-width="5" stroke-linecap="round"/>`);
    });
    nodes.forEach(([x, y], i) => {
      parts.push(hex(w * x, h * y, h * 0.06, { fill: i === 2 ? C.amber : C.white, stroke: i === 2 ? C.amber : C.blueDeep, sw: 4 }));
    });
    for (let i = 0; i < 5; i += 1) parts.push(line(w * (0.08 + rand() * 0.3), h * (0.7 + i * 0.05), w * (0.5 + rand() * 0.4), h * (0.7 + i * 0.05), C.white, 2, 0.25));
    return wrap(bg, parts.join(''));
  },
  scale(w, h) {
    const bg = lightBg(w, h);
    const cx = w / 2;
    const top = h * 0.2;
    const beamY = h * 0.3;
    const reach = w * 0.3;
    const parts = [
      line(cx, beamY, cx, h * 0.84, C.blueDeep, 8, 1),
      line(cx - w * 0.14, h * 0.86, cx + w * 0.14, h * 0.86, C.blueDeep, 8, 1),
      line(cx - reach, beamY, cx + reach, beamY, C.blueDeep, 7, 1),
      hex(cx, top, h * 0.05, { fill: C.amber, stroke: C.amber, sw: 2 }),
      line(cx, top + h * 0.04, cx, beamY, C.blueDeep, 5, 1),
    ];
    for (const sign of [-1, 1]) {
      const x = cx + sign * reach;
      parts.push(line(x, beamY, x - h * 0.12, h * 0.55, C.blue, 2.5, 0.8), line(x, beamY, x + h * 0.12, h * 0.55, C.blue, 2.5, 0.8));
      parts.push(`<path d="M${f(x - h * 0.16)} ${f(h * 0.55)} h${f(h * 0.32)} q0 ${f(h * 0.13)} ${f(-h * 0.16)} ${f(h * 0.13)} q${f(-h * 0.16)} 0 ${f(-h * 0.16)} ${f(-h * 0.13)} z" fill="${sign < 0 ? C.tint : C.sky}" stroke="${C.blueDeep}" stroke-width="3.5" stroke-linejoin="round"/>`);
    }
    return wrap(bg, parts.join(''));
  },
  window(w, h, rand) {
    const bg = wrap({ defs: gradient('bg', [[0, C.mist], [1, C.tint]]), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const wx = w * 0.18;
    const wy = h * 0.1;
    const ww = w * 0.64;
    const wh = h * 0.55;
    const parts = [
      `<defs><linearGradient id="sky" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.amber}" stop-opacity="0.55"/><stop offset="0.45" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient></defs>`,
      `<rect x="${f(wx)}" y="${f(wy)}" width="${f(ww)}" height="${f(wh)}" fill="url(#sky)" stroke="${C.blueDeep}" stroke-width="8"/>`,
      line(wx + ww / 2, wy, wx + ww / 2, wy + wh, C.blueDeep, 6, 1),
      line(wx, wy + wh * 0.55, wx + ww, wy + wh * 0.55, C.blueDeep, 6, 1),
      amberDot(wx + ww * (0.22 + rand() * 0.1), wy + wh * 0.42, h * 0.05),
      `<rect x="${f(w * 0.08)}" y="${f(h * 0.7)}" width="${f(w * 0.84)}" height="${f(h * 0.06)}" rx="6" fill="${C.blueDeep}"/>`,
      line(w * 0.14, h * 0.76, w * 0.14, h * 0.96, C.blueDeep, 8, 1),
      line(w * 0.86, h * 0.76, w * 0.86, h * 0.96, C.blueDeep, 8, 1),
    ];
    return wrap(bg, parts.join(''));
  },
  plant(w, h, rand) {
    const bg = lightBg(w, h);
    const parts = [`<rect x="${f(w * 0.06)}" y="${f(h * 0.74)}" width="${f(w * 0.88)}" height="${f(h * 0.06)}" rx="6" fill="${C.blueDeep}"/>`];
    const px = w * 0.7;
    parts.push(`<path d="M${f(px - 36)} ${f(h * 0.74)} l8 -${f(h * 0.14)} h56 l8 ${f(h * 0.14)} z" fill="${C.blue}" stroke="${C.blueDeep}" stroke-width="3" stroke-linejoin="round"/>`);
    parts.push(line(px, h * 0.6, px, h * 0.3, C.blueDeep, 5, 1));
    [[0, 0.3, 0.07], [-0.07, 0.38, 0.055], [0.07, 0.4, 0.055], [-0.1, 0.5, 0.045], [0.1, 0.5, 0.045]].forEach(([dx, y, s], i) => {
      parts.push(hex(px + w * dx, h * y, h * s, { fill: i === 0 ? C.amber : i % 2 ? C.sky : C.tint, stroke: i === 0 ? C.amber : C.blue, sw: 3 }));
    });
    parts.push(`<rect x="${f(w * 0.12)}" y="${f(h * 0.6)}" width="${f(w * 0.3)}" height="${f(h * 0.14)}" rx="6" fill="${C.white}" stroke="${C.blueDeep}" stroke-width="3"/>`);
    return wrap(bg, field(w, h, h / 9, rand, { density: 0.08, so: 0.12 }), parts.join(''));
  },
  pen(w, h, rand) {
    const bg = lightBg(w, h);
    const parts = [
      `<rect x="${f(w * 0.24)}" y="${f(h * 0.14)}" width="${f(w * 0.46)}" height="${f(h * 0.66)}" fill="${C.white}" stroke="${C.hairline}" stroke-width="4" transform="rotate(-4 ${f(w * 0.47)} ${f(h * 0.47)})"/>`,
      hex(w * 0.47, h * 0.44, h * 0.12, { fill: 'none', stroke: C.blue, sw: 3, so: 0.7 }),
      `<g transform="rotate(${f(-32 + rand() * 4)} ${f(w * 0.7)} ${f(h * 0.62)})"><rect x="${f(w * 0.5)}" y="${f(h * 0.6)}" width="${f(w * 0.36)}" height="${f(h * 0.045)}" rx="6" fill="${C.blueDeep}"/><polygon points="${f(w * 0.5)},${f(h * 0.6)} ${f(w * 0.45)},${f(h * 0.6225)} ${f(w * 0.5)},${f(h * 0.645)}" fill="${C.amber}"/></g>`,
    ];
    return wrap(bg, field(w, h, h / 9, rand, { density: 0.08, so: 0.1 }), parts.join(''));
  },
  notebook(w, h, rand) {
    const bg = lightBg(w, h);
    const parts = [`<rect x="${f(w * 0.12)}" y="${f(h * 0.14)}" width="${f(w * 0.76)}" height="${f(h * 0.72)}" rx="12" fill="${C.white}" stroke="${C.blueDeep}" stroke-width="4"/>`, line(w * 0.5, h * 0.14, w * 0.5, h * 0.86, C.blueDeep, 4, 0.8)];
    for (let i = 1; i < 10; i += 1) parts.push(line(w * 0.14, h * (0.14 + i * 0.072), w * 0.86, h * (0.14 + i * 0.072), C.sky, 1.5, 0.7));
    for (let i = 1; i < 14; i += 1) parts.push(line(w * (0.12 + i * 0.054), h * 0.16, w * (0.12 + i * 0.054), h * 0.84, C.sky, 1.5, 0.5));
    parts.push(hex(w * 0.3, h * 0.45, h * 0.1, { fill: C.tint, fo: 0.8, stroke: C.blue, sw: 3 }), hex(w * 0.7, h * 0.55, h * 0.07, { fill: C.amber, stroke: C.amber, sw: 2 }));
    parts.push(`<rect x="${f(w * 0.2)}" y="${f(h * 0.9)}" width="${f(w * 0.6)}" height="${f(h * 0.03)}" rx="8" fill="${C.blue}" transform="rotate(${f(-1 + rand())} ${f(w * 0.5)} ${f(h * 0.9)})"/>`);
    return wrap(bg, parts.join(''));
  },
  shadow(w, h, rand) {
    const bg = wrap({ defs: gradient('bg', [[0, C.white], [1, C.tint]], 0, 0, 1, 1), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const parts = [];
    const step = (h / 7) * (0.8 + rand() * 0.8);
    const skew = h * (0.6 + rand() * 0.8);
    for (let i = -8; i < 20; i += 1) parts.push(line(i * step * 1.2, 0, i * step * 1.2 + skew, h, C.blueDeep, 6, 0.28));
    for (let i = -8; i < 20; i += 1) parts.push(line(i * step * 1.2 + skew, 0, i * step * 1.2, h, C.blueDeep, 6, 0.2));
    parts.push(hex(w * (0.4 + rand() * 0.2), h * 0.5, h * 0.12, { fill: C.amber, fo: 0.9, stroke: C.amber, sw: 2 }));
    return wrap(bg, parts.join(''));
  },
  honeycomb(w, h, rand) {
    const bg = darkBg(w, h, 'bg', C.blueDeep, C.night);
    const s = h / 5.4;
    return wrap(bg, field(w, h, s, rand, { density: 0.45, stroke: C.sky, so: 0.8, dark: true, amberPos: [0.3 + rand() * 0.4, 0.35 + rand() * 0.3] }));
  },
  planning(w, h, rand) {
    const bg = lightBg(w, h);
    const parts = [];
    const cols = 5;
    const rows = 3;
    const amberAt = Math.floor(rand() * cols * rows);
    let i = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = w * (0.07 + c * 0.18) + (rand() - 0.5) * 8;
        const y = h * (0.12 + r * 0.28) + (rand() - 0.5) * 8;
        const rot = (rand() - 0.5) * 8;
        const a = i === amberAt;
        parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w * 0.15)}" height="${f(h * 0.22)}" rx="8" fill="${a ? C.amber : C.white}" stroke="${a ? C.amber : C.blue}" stroke-width="3" transform="rotate(${f(rot)} ${f(x + w * 0.075)} ${f(y + h * 0.11)})"/>`);
        parts.push(hex(x + w * 0.075, y + h * 0.11, h * 0.04, { stroke: a ? C.charcoal : C.blue, sw: 2, so: 0.55 }));
        i += 1;
      }
    }
    return wrap(bg, parts.join(''));
  },
  desk(w, h, rand) {
    const bg = wrap({ defs: gradient('bg', [[0, C.amber, 0.28], [0.35, C.mist], [1, C.tint]]), body: `<rect width="${w}" height="${h}" fill="url(#bg)"/>` });
    const parts = [
      `<rect x="${f(w * 0.58)}" y="${f(h * 0.1)}" width="${f(w * 0.3)}" height="${f(h * 0.44)}" fill="${C.sky}" fill-opacity="0.6" stroke="${C.blueDeep}" stroke-width="6"/>`,
      line(w * 0.73, h * 0.1, w * 0.73, h * 0.54, C.blueDeep, 4, 1),
      amberDot(w * 0.66, h * 0.3, h * 0.05),
      `<rect x="0" y="${f(h * 0.62)}" width="${w}" height="${f(h * 0.06)}" fill="${C.blueDeep}"/>`,
      `<rect x="${f(w * 0.12)}" y="${f(h * 0.38)}" width="${f(w * 0.2)}" height="${f(h * 0.12)}" rx="14" fill="${C.white}" stroke="${C.blueDeep}" stroke-width="5"/>`,
      line(w * 0.14, h * 0.5, w * 0.14, h * 0.62, C.blueDeep, 6, 1),
      line(w * 0.3, h * 0.5, w * 0.3, h * 0.62, C.blueDeep, 6, 1),
      `<rect x="${f(w * 0.1)}" y="${f(h * 0.2)}" width="${f(w * 0.24)}" height="${f(h * 0.18)}" rx="18" fill="${C.tint}" stroke="${C.blueDeep}" stroke-width="5"/>`,
      line(w * 0.18, h * 0.68, w * 0.18, h * 0.95, C.blueDeep, 8, 1),
      line(w * 0.82, h * 0.68, w * 0.82, h * 0.95, C.blueDeep, 8, 1),
    ];
    return wrap(bg, field(w, h, h / 9, rand, { density: 0.06, so: 0.1 }), parts.join(''));
  },
};
