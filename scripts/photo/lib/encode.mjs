// Encode a chosen candidate to the slot master (AVIF at the exact size) and the srcset variants used for crop-safety QA.
// Astro builds the shipped srcset from the master, so only the master is committed; variants go to staging.
import sharp from 'sharp';

export const DEFAULT_QUALITY = 80;

/**
 * Plan how a source of `src` pixels becomes a `[w, h]` master: a centred cover crop to the target aspect, then a resize to the
 * target. Upscaling is refused because it fakes detail and the model's output is meant to be the exact size.
 */
export function planMaster([srcW, srcH], [w, h], { allowUpscale = false } = {}) {
  const targetAspect = w / h;
  const srcAspect = srcW / srcH;
  // Largest centred crop of the source with the target aspect.
  const cropW = srcAspect > targetAspect ? Math.round(srcH * targetAspect) : srcW;
  const cropH = srcAspect > targetAspect ? srcH : Math.round(srcW / targetAspect);
  const left = Math.floor((srcW - cropW) / 2);
  const top = Math.floor((srcH - cropH) / 2);
  const upscale = cropW < w || cropH < h;
  if (upscale && !allowUpscale) {
    throw new Error(`The source (${srcW}x${srcH}) is too small for a ${w}x${h} master after cropping to ${cropW}x${cropH}; regenerate it larger or pass --allow-upscale.`);
  }
  return { crop: { left, top, width: cropW, height: cropH }, resize: { width: w, height: h }, cropped: cropW !== srcW || cropH !== srcH, upscale };
}

/** Height of a srcset variant: the master aspect at the given width. */
export function variantHeight(master, width) {
  return Math.round((master[1] * width) / master[0]);
}

/** Encode the master AVIF. Returns `{ buffer, width, height, plan }`. */
export async function encodeMaster(input, master, { quality = DEFAULT_QUALITY, allowUpscale = false, effort = 6 } = {}) {
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) throw new Error('The candidate has no readable dimensions.');
  const plan = planMaster([meta.width, meta.height], master, { allowUpscale });
  const buffer = await sharp(input)
    .rotate()
    .extract(plan.crop)
    .resize({ ...plan.resize, fit: 'fill', kernel: 'lanczos3' })
    .avif({ quality, effort })
    .toBuffer();
  const out = await sharp(buffer).metadata();
  if (out.width !== master[0] || out.height !== master[1]) throw new Error(`Encoded ${out.width}x${out.height}, expected ${master[0]}x${master[1]}.`);
  return { buffer, width: out.width, height: out.height, plan };
}

/** Variants narrower than the master, as AVIF buffers keyed by width. For QA only. */
export async function encodeVariants(masterBuffer, master, widths, { quality = DEFAULT_QUALITY, effort = 6 } = {}) {
  const variants = new Map();
  for (const width of widths.filter((candidate) => candidate < master[0])) {
    const height = variantHeight(master, width);
    variants.set(width, await sharp(masterBuffer).resize({ width, height, fit: 'fill', kernel: 'lanczos3' }).avif({ quality, effort }).toBuffer());
  }
  return variants;
}
