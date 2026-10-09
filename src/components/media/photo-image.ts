import { getImage } from 'astro:assets';
import { getPhoto } from '../../assets/photo/index.ts';
import { displayAttributes, srcsetWidths } from '../../assets/photo/responsive.ts';
import type { SlotId } from '../../assets/photo/slots.ts';

/** The attributes of one responsive `<img>` for a photo slot. */
export interface PhotoImage {
  readonly src: string;
  readonly srcset: string | undefined;
  readonly sizes: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

/**
 * Exact-size AVIF output for a slot: `src` is the file at the slot's display width, `srcset` adds the narrower and wider variants the
 * slot's profile lists (up to the master), and `width` and `height` are the display size, so the card budget applies to cards and the
 * band budget to bands. A slot that still holds a vector placeholder is returned as it is.
 */
export async function photoImage(slot: SlotId, overrides: { readonly sizes?: string | undefined } = {}): Promise<PhotoImage> {
  const asset = getPhoto(slot);
  const { spec, src } = asset;
  const sizes = overrides.sizes ?? spec.sizes;
  if (src.format === 'svg') return { src: src.src, srcset: undefined, sizes, width: src.width, height: src.height, alt: asset.alt };
  const { width, height } = displayAttributes(spec, src.width, src.height);
  const image = await getImage({ src, format: 'avif', width, height, widths: srcsetWidths(spec, src.width), sizes });
  const srcset = image.srcSet.values.length > 0 ? image.srcSet.attribute : undefined;
  return { src: image.src, srcset, sizes, width, height, alt: asset.alt };
}
