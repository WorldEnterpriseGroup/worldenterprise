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

/** The `{ href, type }` pair a page passes as `preloadImage`, for an imported image. */
export function preloadOf(image: Pick<ImageMetadata, 'src' | 'format'>): { readonly href: string; readonly type: string } {
  return { href: image.src, type: imageMediaType(image.format) };
}
