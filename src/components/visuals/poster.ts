import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { PreloadImage } from '../../lib/image-type.ts';

/**
 * Scene posters: frames rendered from the scenes themselves at their `posterTime` (so the live canvas crossfades in without a jump),
 * stored as 3840-wide AVIF masters in src/assets/visuals/posters/. This is what phones, reduced motion, forced colors, no-JS visitors
 * and Lighthouse see. Regenerate them with src/assets/visuals/tools/render-posters.mjs after changing a scene.
 */
const FILES = import.meta.glob<{ default: ImageMetadata }>('../../assets/visuals/posters/*.avif', { eager: true });

export const POSTER_KEYS = ['galaxy', 'galaxy-end', 'launch', 'orbit-7-single', 'orbit-10-nested', 'orbit-base', 'worldforge', 'starfield', 'accretion', 'accretion-end'] as const;
export type PosterKey = (typeof POSTER_KEYS)[number];

/** The accretion poster for an alignment (AccretionScene `align`). */
export function accretionPosterKey(align: 'center' | 'end'): PosterKey {
  return align === 'end' ? 'accretion-end' : 'accretion';
}

/** The galaxy poster for an alignment (GalaxyScene `align`). */
export function galaxyPosterKey(align: 'center' | 'end'): PosterKey {
  return align === 'end' ? 'galaxy-end' : 'galaxy';
}

/** Display width of a poster `<img>`: the 1024 px raster cap of audit:images. Wider screens pick a larger srcset candidate. */
export const POSTER_DISPLAY_WIDTH = 1024;
/** 2560 and 3840 are for 1440p and 4K screens (a 3840 master); a smaller master simply drops the candidates it cannot fill. */
const WIDTHS = [640, 1024, 1440, 1920, 2560, 3840] as const;

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

/** A poster key, or an imported image (a page's own poster for a scene, rendered over the same frame color). */
export type PosterSource = PosterKey | ImageMetadata;

/**
 * The responsive `<img>` attributes of a poster: the 1024 px display size, a 640 to 3840 srcset and the given `sizes`. Scene uses it for
 * its own poster; a hero that makes the poster its LCP image uses it to render that `<img>` itself (see `posterPreload`).
 */
export async function posterImage(poster: PosterSource, sizes = '100vw'): Promise<PosterImage> {
  const src = typeof poster === 'string' ? posterAsset(poster) : poster;
  const width = Math.min(POSTER_DISPLAY_WIDTH, src.width);
  const height = Math.round((width * src.height) / src.width);
  const image = await getImage({ src, format: 'avif', width, height, widths: WIDTHS.filter((w) => w <= src.width), sizes });
  return { src: image.src, srcset: image.srcSet.values.length > 0 ? image.srcSet.attribute : undefined, sizes, width, height };
}

/**
 * The `preloadImage` hint for a hero whose LCP image is a scene poster (W9-6): the same src, srcset and sizes as the `<img>` that
 * `posterImage` describes, so the head preload and the hero image name one candidate. The hero renders that `<img>` itself, with
 * `class="scene__poster"` and high fetch priority, in the scene's `poster` slot: the image rules (tests/unit/wp-12b/markup.test.ts)
 * keep eager loading and high priority inside the hero components.
 */
export async function posterPreload(poster: PosterSource, sizes = '100vw'): Promise<PreloadImage> {
  const image = await posterImage(poster, sizes);
  return { href: image.src, type: 'image/avif', srcset: image.srcset, sizes: image.srcset === undefined ? undefined : image.sizes };
}
