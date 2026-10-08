import { buildAbsolute, buildAsset, buildHref, isExternal } from './url-core.ts';

const SITE_ORIGIN = 'https://worldenterprise.org';

/**
 * Link to a page or section of this site. Every internal link must go through this helper. One rule for components: a
 * component that renders a link calls href() itself, and callers may pass a site path or an already resolved link
 * because href() is idempotent.
 */
export function href(path: string): string {
  return buildHref(path, import.meta.env.BASE_URL);
}

/** URL of a file served from public/ (favicon, downloads). */
export function asset(path: string): string {
  return buildAsset(path, import.meta.env.BASE_URL);
}

/** Absolute production URL, used for canonicals, Open Graph and JSON-LD. Ignores the preview base. */
export function absoluteUrl(path: string): string {
  return buildAbsolute(path, SITE_ORIGIN);
}

export { isExternal };
