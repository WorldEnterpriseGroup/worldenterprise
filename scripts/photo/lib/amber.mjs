// Amber accent pre-filter, ported from the phase-A amber_qa.py. The brief wants exactly one amber object per frame, so a blob count
// other than one, or a large amber area, flags the candidate for the human (vision) QA. It is a pre-filter, not a verdict: brown wood
// can false-positive, and it cannot see text, anatomy or planted props.
import sharp from 'sharp';

export const AMBER = Object.freeze({
  width: 256,
  minBlobFraction: 0.0006, // smaller blobs are specular noise
  maxAreaFraction: 0.06, // one accent stays small
  hueLo: 25,
  hueHi: 48,
  saturationMin: 0.45,
  valueMin: 0.45,
});

/** Hue in degrees, saturation and value of one RGB pixel (0-255 channels). */
export function hsv(r, g, b) {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const d = max - Math.min(rf, gf, bf);
  const s = max > 0 ? d / max : 0;
  let h = 0;
  if (d > 1e-6) {
    if (max === rf) h = (60 * ((gf - bf) / d) + 360) % 360;
    else if (max === gf) h = 60 * ((bf - rf) / d) + 120;
    else h = 60 * ((rf - gf) / d) + 240;
  }
  return { h, s, v: max };
}

export function isAmber(r, g, b) {
  const { h, s, v } = hsv(r, g, b);
  return h >= AMBER.hueLo && h <= AMBER.hueHi && s >= AMBER.saturationMin && v >= AMBER.valueMin;
}

/** Areas of the 4-connected blobs of a boolean mask (row-major, `width` wide). Iterative flood fill. */
export function blobAreas(mask, width) {
  const height = mask.length / width;
  const seen = new Uint8Array(mask.length);
  const areas = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let area = 0;
    while (stack.length > 0) {
      const at = stack.pop();
      area += 1;
      const x = at % width;
      const y = (at - x) / width;
      const neighbours = [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y > 0 ? at - width : -1, y < height - 1 ? at + width : -1];
      for (const next of neighbours) {
        if (next >= 0 && mask[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    areas.push(area);
  }
  return areas;
}

/** Pure part: classify a raw RGB buffer. Returns `{ blobs, areaFraction, flags }`; flags empty means "ok". */
export function analyseRgb(data, width, height) {
  const total = width * height;
  const mask = new Uint8Array(total);
  let amberPixels = 0;
  for (let i = 0; i < total; i += 1) {
    if (isAmber(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])) {
      mask[i] = 1;
      amberPixels += 1;
    }
  }
  const blobs = blobAreas(mask, width).filter((area) => area / total >= AMBER.minBlobFraction).length;
  const areaFraction = amberPixels / total;
  const flags = [];
  if (blobs !== 1) flags.push(`amber-blobs=${blobs}`);
  if (areaFraction > AMBER.maxAreaFraction) flags.push(`amber-area=${(areaFraction * 100).toFixed(1)}%`);
  return { blobs, areaFraction, flags };
}

/** Analyse an image file or buffer, downsampled to 256 px wide. */
export async function amberCheck(input) {
  const { data, info } = await sharp(input)
    .resize({ width: AMBER.width })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return analyseRgb(data, info.width, info.height);
}
