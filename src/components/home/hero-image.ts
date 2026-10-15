import type { PhotoImage } from '../media/photo-image.ts';
import { posterImage } from '../visuals/poster.ts';
import type { PosterKey } from '../visuals/poster.ts';

/**
 * The home hero image (decision W9-6): the still poster of the galaxy scene, which is the LCP element and what phones, reduced motion,
 * forced colors, no-JS visitors and Lighthouse see. It is returned in the shape of a responsive photo, so the page builds it once and
 * derives the head preload from the same srcset and sizes (wp-12c contract), and HomeHero passes the same `sizes` to the scene frame
 * laid over it, so the scene's own poster is the very file already fetched.
 */
export const HERO_POSTER: PosterKey = 'galaxy';

/** The media column: about 60% of the window beside the copy from 62rem, the full width on a phone. */
export const HERO_SIZES = '(min-width: 62rem) 60vw, 100vw';

export const HERO_ALT =
  'A spiral galaxy of blue stars. At its core a world of hexagonal tiles is still assembling, one tile glowing amber, while a trail of small hexagonal cells streams in to join it.';

export async function heroPoster(): Promise<PhotoImage> {
  const image = await posterImage(HERO_POSTER, HERO_SIZES);
  return { src: image.src, format: 'avif', srcset: image.srcset, sizes: image.sizes, width: image.width, height: image.height, alt: HERO_ALT };
}
