/**
 * Pure URL helpers. Kept free of Astro and Vite globals so node --test can import them.
 * Application code uses href() and asset() from ./url.ts, which bind these to BASE_URL.
 */

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Normalises a Vite BASE_URL ("/", "/worldenterprise" or "/worldenterprise/") to "" or "/segment". */
export function normalizeBase(base: string | undefined): string {
  const trimmed = (base ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '' : `/${trimmed}`;
}

function splitSuffix(input: string): { path: string; suffix: string } {
  const index = input.search(/[?#]/);
  if (index === -1) {
    return { path: input, suffix: '' };
  }
  return { path: input.slice(0, index), suffix: input.slice(index) };
}

/** True for http(s), mailto, tel, protocol-relative and other absolute references. */
export function isExternal(input: string): boolean {
  return EXTERNAL_SCHEME.test(input) || input.startsWith('//');
}

/**
 * Builds an internal link.
 * - external, mailto and pure fragment references pass through unchanged
 * - site paths get the base prefix
 * - paths without a file extension get a trailing slash (trailingSlash: 'always')
 */
export function buildHref(input: string, base: string | undefined): string {
  if (input === '' || input.startsWith('#') || isExternal(input)) {
    return input;
  }
  const { path, suffix } = splitSuffix(input);
  const rooted = path.startsWith('/') ? path : `/${path}`;
  const lastSegment = rooted.slice(rooted.lastIndexOf('/') + 1);
  const hasExtension = lastSegment.includes('.');
  const withSlash = hasExtension || rooted.endsWith('/') ? rooted : `${rooted}/`;
  return `${normalizeBase(base)}${withSlash}${suffix}`;
}

/** Builds a URL for a file in public/ (no trailing slash handling). */
export function buildAsset(input: string, base: string | undefined): string {
  if (isExternal(input)) {
    return input;
  }
  const rooted = input.startsWith('/') ? input : `/${input}`;
  return `${normalizeBase(base)}${rooted}`;
}

/** Absolute production URL for a site path. Never includes the preview base. */
export function buildAbsolute(input: string, site: string): string {
  if (isExternal(input)) {
    return input;
  }
  const origin = site.replace(/\/+$/, '');
  return `${origin}${buildHref(input, undefined)}`;
}
