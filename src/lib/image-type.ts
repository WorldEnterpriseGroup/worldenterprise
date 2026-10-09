import type { ImageMetadata } from 'astro';

/**
 * The media type of an imported image, taken from the format Astro read from the file rather than written out by hand, so a preload
 * hint cannot claim `image/svg+xml` for an AVIF (a browser ignores a preload whose `type` it cannot match, and the hero image is then
 * fetched twice, late). Kept free of Astro runtime imports so node --test can load it.
 */
const MEDIA_TYPES: Readonly<Record<string, string>> = {
  avif: 'image/avif',
  webp: 'image/webp',
  png: 'image/png',
  apng: 'image/apng',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
};

/** The media type for an image format name such as "avif". Throws for a format this site does not serve. */
export function imageMediaType(format: string): string {
  const type = MEDIA_TYPES[format.toLowerCase()];
  if (type === undefined) throw new Error(`No media type is known for the image format "${format}".`);
  return type;
}

/**
 * The LCP image hint a page passes as `preloadImage`. `srcset` and `sizes` are set together for a responsive image: the head then
 * writes them as `imagesrcset` and `imagesizes`, so the browser picks the same candidate for the preload as for the `<img>`.
 */
export interface PreloadImage {
  readonly href: string;
  readonly type: string;
  readonly srcset?: string | undefined;
  readonly sizes?: string | undefined;
}

/** The `{ href, type }` pair a page passes as `preloadImage`, for an imported image. */
export function preloadOf(image: Pick<ImageMetadata, 'src' | 'format'>): PreloadImage {
  return { href: image.src, type: imageMediaType(image.format) };
}

/**
 * The preload for a responsive photo (the result of `photoImage()`). `href` is the fallback for a browser that ignores
 * `imagesrcset`; `srcset` and `sizes` are the very strings the `<img>` carries, so the two requests are one.
 */
export function preloadOfPhoto(image: { readonly src: string; readonly format: string; readonly srcset: string | undefined; readonly sizes: string }): PreloadImage {
  const type = imageMediaType(image.format);
  return image.srcset === undefined ? { href: image.src, type } : { href: image.src, type, srcset: image.srcset, sizes: image.sizes };
}
