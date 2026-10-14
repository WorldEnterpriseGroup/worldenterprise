import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/**
 * Scene posters: frames rendered from the scenes themselves at their `posterTime` (so the live canvas crossfades in without a jump),
 * stored as 1920-wide AVIF masters in src/assets/visuals/posters/. This is what phones, reduced motion, forced colors, no-JS visitors
 * and Lighthouse see. Regenerate them with src/assets/visuals/tools/render-posters.mjs after changing a scene.
 */
const FILES = import.meta.glob<{ default: ImageMetadata }>('../../assets/visuals/posters/*.avif', { eager: true });

export const POSTER_KEYS = ['galaxy', 'galaxy-end', 'launch', 'orbit-7-single', 'orbit-10-nested', 'orbit-base', 'worldforge', 'starfield'] as const;
export type PosterKey = (typeof POSTER_KEYS)[number];

/** Display width of a poster `<img>`: the 1024 px raster cap of audit:images. Wider screens pick a larger srcset candidate. */
export const POSTER_DISPLAY_WIDTH = 1024;
const WIDTHS = [640, 1024, 1440, 1920] as const;

export interface PosterImage {
  readonly src: string;
  readonly srcset: string | undefined;
  readonly sizes: string;
  readonly width: number;
  readonly height: number;
}

export function posterAsset(key: PosterKey): ImageMetadata {
  const file = FILES[`../../assets/visuals/posters/${key}.avif`];
  if (file === undefined) throw new Error(`visuals: the poster "${key}" is missing from src/assets/visuals/posters/`);
  return file.default;
}

export async function posterImage(key: PosterKey, sizes = '100vw'): Promise<PosterImage> {
  const src = posterAsset(key);
  const width = Math.min(POSTER_DISPLAY_WIDTH, src.width);
  const height = Math.round((width * src.height) / src.width);
  const image = await getImage({ src, format: 'avif', width, height, widths: WIDTHS.filter((w) => w <= src.width), sizes });
  return { src: image.src, srcset: image.srcSet.values.length > 0 ? image.srcSet.attribute : undefined, sizes, width, height };
}
