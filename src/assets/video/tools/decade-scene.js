/**
 * The frame renderer of "A company's first decade, in one minute" (WP-22, #88). Runs inside headless Chromium, loaded by
 * render-decade.mjs; it is not part of the site bundle. `drawDecade(ctx, t, opts)` paints the frame at time `t` (seconds) and is a pure
 * function of `t` and the storyboard: every random value comes from a seeded generator, so the same commit renders the same film.
 *
 * Coordinates are authored on a 1920 x 1080 stage and scaled to the canvas, so the 3840 poster and 2560 stills share one drawing.
 * Palette: the brand night blue sky, the blue tint ramp, one amber object (src/scripts/visuals/palette.ts).
 */
(() => {
  const SKY = '#0a3459';
  const SKY_DEEP = '#061f38';
  const AMBER = '#e8a33d';
  const RAMP = ['#0f4c81', '#1c75bc', '#2484c6', '#4fa0d6', '#8fbde3', '#c3ddf0', '#dceaf6'];
  const STAGE_W = 1920;
  const STAGE_H = 1080;
  const FONT = 'Titillium Web';

  /** mulberry32: a small seeded generator. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = (a, b, v) => {
    const k = clamp((v - a) / (b - a));
    return k * k * (3 - 2 * k);
  };
  const mix = (a, b, k) => a + (b - a) * k;

  // ---- fixed scene data, seeded ------------------------------------------------------------------------------------------------
  const r1 = rng(20261015);
  const STARS = Array.from({ length: 520 }, () => ({
    x: r1() * STAGE_W,
    y: r1() * STAGE_H,
    s: 0.4 + r1() * r1() * 1.8,
    a: 0.25 + r1() * 0.6,
    p: r1() * Math.PI * 2,
  }));
  const r2 = rng(88);
  const DUST = Array.from({ length: 2200 }, () => {
    const arm = Math.floor(r2() * 3);
    const r0 = 70 + Math.pow(r2(), 0.8) * 360;
    return {
      r0,
      a0: arm * ((Math.PI * 2) / 3) + r0 * 0.012 + (r2() - 0.5) * 0.9,
      rc: 8 + r2() * 46,
      s: 0.6 + r2() * 1.6,
      c: Math.floor(r2() * 5) + 1,
      keep: r2() < 0.16,
    };
  });
  // Hex tiles of the world (pointy-top axial grid within radius 4).
  const TILES = [];
  {
    const r3 = rng(7);
    const n = 4;
    for (let q = -n; q <= n; q += 1) {
      for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r += 1) {
        const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
        TILES.push({ q, r, d, order: d + r3() * 1.6, shade: r3() });
      }
    }
    TILES.sort((a, b) => a.order - b.order);
  }
  // Ring of 100 lights: the order in which they dim.
  const RANK = (() => {
    const r4 = rng(1001);
    const idx = Array.from({ length: 100 }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r4() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const rank = new Array(100);
    idx.forEach((light, order) => (rank[light] = order));
    return rank;
  })();
  const MOONS = [
    { orbit: 230, speed: 0.32, phase: 0.4, size: 15, born: 33.2 },
    { orbit: 290, speed: -0.22, phase: 2.6, size: 11, born: 34.4 },
    { orbit: 200, speed: 0.41, phase: 4.4, size: 9, born: 35.6 },
  ];
  const NEIGHBORS = [
    { dx: -560, dy: 300, n: 2, amber: false },
    { dx: 520, dy: -330, n: 3, amber: true },
    { dx: 600, dy: 330, n: 2, amber: false },
  ];

  // ---- helpers --------------------------------------------------------------------------------------------------------------------
  function hexPath(ctx, x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const px = x + size * Math.cos(a);
      const py = y + size * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function wrap(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line === '' ? word : `${line} ${word}`;
      if (ctx.measureText(next).width > maxWidth && line !== '') {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line !== '') lines.push(line);
    return lines;
  }

  function chapterAt(chapters, t) {
    return chapters.find((c) => t >= c.start && t < c.end) ?? chapters[chapters.length - 1];
  }

  /** The point on the company's clock at time t: eases from the previous chapter's year to this one over 2.5 s. */
  function yearAt(chapters, t) {
    const i = chapters.indexOf(chapterAt(chapters, t));
    const c = chapters[i];
    const prev = i > 0 ? chapters[i - 1].year : 0;
    return mix(prev, c.year, smooth(c.start, c.start + 2.5, t));
  }

  function litFloat(points, year) {
    const all = [{ year: 0, percent: 100 }, ...points];
    for (let i = 1; i < all.length; i += 1) {
      if (year <= all[i].year) {
        const k = (year - all[i - 1].year) / (all[i].year - all[i - 1].year);
        return mix(all[i - 1].percent, all[i].percent, k);
      }
    }
    return all[all.length - 1].percent;
  }

  // ---- layers ---------------------------------------------------------------------------------------------------------------------
  function drawSky(ctx, t) {
    const g = ctx.createRadialGradient(1180, 480, 60, 960, 540, 1250);
    g.addColorStop(0, '#0f4272');
    g.addColorStop(0.45, SKY);
    g.addColorStop(1, SKY_DEEP);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    for (const s of STARS) {
      const tw = 0.75 + 0.25 * Math.sin(t * 0.9 + s.p);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = RAMP[6];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawDust(ctx, t, cx, cy) {
    const appear = smooth(4.5, 7.5, t);
    if (appear <= 0) return;
    const condense = smooth(11, 18.5, t);
    const leftover = 1 - smooth(24, 36, t);
    for (const d of DUST) {
      const k = d.keep ? condense * 0.25 : condense;
      if (!d.keep && condense >= 0.995) continue;
      const r = mix(d.r0, d.rc, k);
      const a = d.a0 + t * (36 / (r + 30));
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.62;
      let alpha = appear * (d.keep ? 0.7 * leftover : 0.85 * (1 - smooth(0.7, 1, condense)));
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = RAMP[d.c];
      ctx.fillRect(x - d.s / 2, y - d.s / 2, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(ctx, t, cx, cy, scale, opts = {}) {
    const form = opts.form ?? 1;
    const lit = opts.lit ?? 1;
    const size = (opts.size ?? 15) * scale;
    const spin = t * 0.04;
    const shown = Math.floor(TILES.length * form);
    if (shown <= 0) return;
    // Halo.
    const haloR = size * 9 * (0.6 + 0.4 * lit);
    const halo = ctx.createRadialGradient(cx, cy, size * 2, cx, cy, haloR);
    halo.addColorStop(0, opts.amber ? 'rgba(232,163,61,0.35)' : `rgba(143,189,227,${0.12 + 0.3 * lit})`);
    halo.addColorStop(1, 'rgba(143,189,227,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fill();
    const n = opts.n ?? 4;
    const w = Math.sqrt(3) * size;
    for (let i = 0; i < shown; i += 1) {
      const tile = TILES[i];
      if (tile.d > n) continue;
      const lx = w * (tile.q + tile.r / 2);
      const ly = size * 1.5 * tile.r;
      const x = cx + lx * Math.cos(spin) - ly * Math.sin(spin);
      const y = cy + lx * Math.sin(spin) + ly * Math.cos(spin);
      // Light from the upper left.
      const light = clamp(0.55 - (lx + ly) / (size * 14) + tile.shade * 0.25);
      let color;
      if (opts.amber) color = light > 0.6 ? '#f2c27a' : AMBER;
      else color = RAMP[Math.round(mix(1, 2, 1 - lit) + light * mix(1.5, 4, lit))] ?? RAMP[6];
      ctx.fillStyle = color;
      hexPath(ctx, x, y, size * 0.92);
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,31,56,0.55)';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.stroke();
    }
  }

  function drawRings(ctx, t, cx, cy, scale) {
    const a = smooth(26, 29.5, t);
    if (a <= 0) return;
    for (const [rx, alpha] of [
      [205, 0.5],
      [270, 0.35],
    ]) {
      ctx.globalAlpha = a * alpha;
      ctx.strokeStyle = RAMP[4];
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      const grow = mix(1.25, 1, a);
      ctx.ellipse(cx, cy, rx * scale * grow, rx * 0.34 * scale * grow, -0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMoons(ctx, t, cx, cy, scale) {
    for (const m of MOONS) {
      const grow = smooth(m.born, m.born + 3, t);
      if (grow <= 0) continue;
      const ang = m.phase + t * m.speed;
      const x = cx + Math.cos(ang) * m.orbit * scale;
      const y = cy + Math.sin(ang) * m.orbit * 0.34 * scale;
      // The dust that condenses into the moon.
      const r6 = rng(Math.floor(m.orbit));
      for (let i = 0; i < 46; i += 1) {
        const pa = r6() * Math.PI * 2 + t * 0.8;
        const pr = (14 + r6() * 46) * (1 - grow) * scale;
        ctx.globalAlpha = 0.6 * (1 - grow);
        ctx.fillStyle = RAMP[4];
        ctx.fillRect(x + Math.cos(pa) * pr, y + Math.sin(pa) * pr, 2, 2);
      }
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(x - m.size * 0.3 * scale, y - m.size * 0.3 * scale, 1, x, y, m.size * scale * grow);
      g.addColorStop(0, RAMP[6]);
      g.addColorStop(1, RAMP[3]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, m.size * scale * grow, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLights(ctx, t, cx, cy, scale, year, points) {
    const a = smooth(19.2, 21.5, t);
    if (a <= 0) return;
    const litF = litFloat(points, year);
    const R = 395 * scale;
    for (let i = 0; i < 100; i += 1) {
      const ang = -Math.PI / 2 + (i / 100) * Math.PI * 2;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      const on = clamp(litF - RANK[i]);
      // A lit light is a filled dot; a closed one leaves a faint hollow ring, so the reader can still count to 100.
      ctx.beginPath();
      ctx.arc(x, y, 5.5 * scale, 0, Math.PI * 2);
      ctx.globalAlpha = a * 0.55 * (1 - on);
      ctx.strokeStyle = RAMP[3];
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
      ctx.globalAlpha = a * on;
      ctx.fillStyle = RAMP[5];
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawNeighbors(ctx, t, cx, cy, scale) {
    const a = smooth(46.5, 50, t);
    if (a <= 0) return;
    ctx.globalAlpha = a * 0.25;
    ctx.strokeStyle = RAMP[4];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 640 * scale, 380 * scale, -0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a;
    for (const nb of NEIGHBORS) {
      drawWorld(ctx, t, cx + nb.dx * scale, cy + nb.dy * scale, scale, { n: nb.n, size: 11, lit: 1, amber: nb.amber });
    }
    ctx.globalAlpha = 1;
  }

  function drawTimeline(ctx, t, year) {
    const a = smooth(5, 6.5, t);
    if (a <= 0) return;
    const x0 = 120;
    const x1 = 1800;
    const y = 1004;
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(195,221,240,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const xm = mix(x0, x1, year / 10);
    ctx.strokeStyle = RAMP[4];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(xm, y);
    ctx.stroke();
    ctx.font = `600 19px "${FONT}"`;
    ctx.textAlign = 'center';
    for (let yr = 0; yr <= 10; yr += 1) {
      const x = mix(x0, x1, yr / 10);
      ctx.fillStyle = yr <= year + 0.01 ? RAMP[5] : 'rgba(195,221,240,0.55)';
      ctx.fillRect(x - 1, y - 7, 2, 14);
      ctx.fillText(`Year ${yr}`, x, y + 36);
    }
    ctx.fillStyle = '#ffffff';
    hexPath(ctx, xm, y, 11);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  function drawText(ctx, t, chapter, data) {
    const fade = smooth(chapter.start + 0.2, chapter.start + 1.1, t) * (chapter.stage === 'close' ? 1 : 1 - smooth(chapter.end - 0.6, chapter.end, t));
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    ctx.textBaseline = 'alphabetic';
    if (chapter.stage === 'title' && data.posterLeft !== true) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 76px "${FONT}"`;
      const lines = wrap(ctx, chapter.title, 1300);
      lines.forEach((l, i) => ctx.fillText(l, 960, 470 + i * 88));
      ctx.font = `600 34px "${FONT}"`;
      ctx.fillStyle = RAMP[5];
      ctx.fillText(chapter.line, 960, 490 + lines.length * 88);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
      return;
    }
    const x = 120;
    let y = 210;
    if (chapter.when !== '') {
      ctx.font = `700 26px "${FONT}"`;
      ctx.fillStyle = AMBER;
      ctx.fillText(chapter.when.toUpperCase(), x, y);
      y += 66;
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 58px "${FONT}"`;
    for (const l of wrap(ctx, chapter.title, 660)) {
      ctx.fillText(l, x, y);
      y += 66;
    }
    y += 10;
    ctx.font = `600 30px "${FONT}"`;
    ctx.fillStyle = RAMP[5];
    for (const l of wrap(ctx, chapter.line, 640)) {
      ctx.fillText(l, x, y);
      y += 40;
    }
    const st = data.stats[chapter.id];
    if (st !== undefined) {
      y += 46;
      ctx.fillStyle = 'rgba(195,221,240,0.5)';
      ctx.fillRect(x, y - 30, 4, 140);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 64px "${FONT}"`;
      ctx.fillText(st.value, x + 28, y + 30);
      ctx.font = `600 25px "${FONT}"`;
      ctx.fillStyle = RAMP[6];
      let yy = y + 72;
      for (const l of wrap(ctx, st.text, 600)) {
        ctx.fillText(l, x + 28, yy);
        yy += 33;
      }
      ctx.font = `600 18px "${FONT}"`;
      ctx.fillStyle = RAMP[4];
      yy += 14;
      for (const l of wrap(ctx, `Source: ${st.source}`, 600)) {
        ctx.fillText(l, x + 28, yy);
        yy += 24;
      }
    }
    if (chapter.stage === 'close') {
      ctx.font = `600 18px "${FONT}"`;
      ctx.fillStyle = RAMP[4];
      let yy = 820;
      for (const l of wrap(ctx, `Sources: ${data.sources.join('; ')}.`, 700)) {
        ctx.fillText(l, x, yy);
        yy += 24;
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Paints one frame. `opts.text` (default true) draws the headline, figures and timeline; the gallery stills set it to false and center
   * the world. `opts.chapterOverride` draws another chapter's text over this frame (the poster: the title over the year 5 world).
   */
  window.drawDecade = (ctx, t, data, opts = {}) => {
    const text = opts.text !== false;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.save();
    ctx.setTransform(w / STAGE_W, 0, 0, h / STAGE_H, 0, 0);
    drawSky(ctx, t);
    const chapters = data.chapters;
    const year = yearAt(chapters, t);
    const zoom = mix(1, 0.62, smooth(46, 50.5, t));
    const baseX = text ? 1290 : 960;
    const cx = mix(baseX, text ? 1240 : 960, smooth(46, 50.5, t));
    const cy = text ? 470 : 540;
    drawDust(ctx, t, cx, cy);
    drawLights(ctx, t, cx, cy, zoom, year, data.survival);
    drawNeighbors(ctx, t, cx, cy, zoom);
    drawRings(ctx, t, cx, cy, zoom);
    const form = smooth(12.5, 18.5, t);
    const lit = smooth(19, 21, t);
    drawWorld(ctx, t, cx, cy, zoom, { form, lit });
    drawMoons(ctx, t, cx, cy, zoom);
    if (text) {
      const chapter = opts.chapterOverride !== undefined ? chapters.find((c) => c.id === opts.chapterOverride) : chapterAt(chapters, t);
      // A poster holds its text at full strength, independent of the frame's own chapter timing.
      const tt = opts.chapterOverride !== undefined ? chapter.start + 2 : t;
      if (opts.chapterOverride === undefined) drawTimeline(ctx, t, year);
      drawText(ctx, tt, chapter, opts.chapterOverride !== undefined ? { ...data, posterLeft: true } : data);
    }
    ctx.restore();
  };
})();
