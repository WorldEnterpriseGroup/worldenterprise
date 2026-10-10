// How each slot is cropped on the page, so QA can see what a visitor sees. Pure geometry; qa-sheet.mjs draws it.
// Sources: shotlist subjectBriefs (card and detail share a centred crop that keeps the outer 15 percent quiet; the stage image sits in a
// hexagon clip that loses the four corners and 5 percent top and bottom; the hero band crops to about 1.9:1, 3.2:1 and 5:1 and
// keeps elements out of the outer 12 percent left and right).

export const BAND_CROP_ASPECTS = Object.freeze([1.9, 3.2, 5]);
export const CARD_SAFE_FRACTION = 0.7;
export const BAND_SIDE_MARGIN = 0.12;
export const STAGE_VERTICAL_LOSS = 0.05;

/** Hexagon clip polygon as fractions of the frame: pointed left and right, flat top and bottom. */
export const STAGE_HEXAGON = Object.freeze([
  [0, 0.5],
  [0.25, STAGE_VERTICAL_LOSS],
  [0.75, STAGE_VERTICAL_LOSS],
  [1, 0.5],
  [0.75, 1 - STAGE_VERTICAL_LOSS],
  [0.25, 1 - STAGE_VERTICAL_LOSS],
]);

function centredRect(master, width, height) {
  const [w, h] = master;
  return { left: Math.round((w - width) / 2), top: Math.round((h - height) / 2), width: Math.round(width), height: Math.round(height) };
}

/**
 * The views QA inspects for a slot of `group` rendered from a `[w, h]` master:
 * `{ name, rect, safe? }[]`. `rect` is what the page shows; `safe` is the sub-rectangle every key element must stay inside.
 */
export function cropViews(group, master) {
  const [w, h] = master;
  if (group === 'band') {
    return BAND_CROP_ASPECTS.map((aspect) => {
      const rect = centredRect(master, w, Math.min(h, w / aspect));
      const safe = { left: Math.round(rect.left + w * BAND_SIDE_MARGIN), top: rect.top, width: Math.round(w * (1 - 2 * BAND_SIDE_MARGIN)), height: rect.height };
      return { name: `${aspect}:1 crop`, rect, safe };
    });
  }
  if (group === 'stage') {
    return [{ name: 'hexagon clip', rect: { left: 0, top: 0, width: w, height: h }, safe: centredRect(master, w * 0.5, h * 0.9) }];
  }
  if (group === 'topic') {
    return [{ name: 'cover', rect: { left: 0, top: 0, width: w, height: h }, safe: centredRect(master, w * CARD_SAFE_FRACTION, h * CARD_SAFE_FRACTION) }];
  }
  const safe = centredRect(master, w * CARD_SAFE_FRACTION, h * CARD_SAFE_FRACTION);
  return [{ name: 'card and detail crop (middle 70 percent)', rect: safe, safe }];
}

/** SVG polygon points of the stage hexagon for a `[w, h]` frame. */
export function hexagonPoints([w, h]) {
  return STAGE_HEXAGON.map(([x, y]) => `${Math.round(x * w)},${Math.round(y * h)}`).join(' ');
}

/** Widths QA must check: every srcset width of the row, narrowest first (the widest is the master itself). */
export function qaWidths(widths) {
  return [...widths].sort((a, b) => a - b);
}
