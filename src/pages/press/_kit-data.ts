/**
 * Data for the brand kit page, read from the design tokens (src/styles/tokens.css) so the kit can never drift from the site.
 * Pure functions over the stylesheet text: the page passes the file in (`?raw` import), tests read it from disk.
 */

/** The brand kit's route and its slug in src/pages/press/[kit].astro. */
export const KIT_PATH = '/press/brand-kit/';
export const KIT_SLUG = 'brand-kit';

/**
 * The static paths of the brand kit: the kit is built only when the live route ledger holds a launched row for it. The row waits in
 * L2_RESERVED with launch false until the brand-owner usage sign-off (OP-BRAND), and a page that is not built reaches no sitemap,
 * navigation, search index or llms file. Releasing the kit means moving that row into the live ledger with launch true.
 */
export function kitStaticPaths(rows: readonly { readonly path: string; readonly launch: boolean }[]): { params: { kit: string } }[] {
  return rows.some((row) => row.path === KIT_PATH && row.launch) ? [{ params: { kit: KIT_SLUG } }] : [];
}

export interface Swatch {
  /** The custom property, for example `--we-blue`. */
  readonly token: string;
  /** The sRGB value kept in the stylesheet comment, for example `#1C75BC`. */
  readonly hex: string;
  /** The semantic aliases (`--color-*`) that point at this brand color. */
  readonly usedAs: readonly string[];
}

export interface FontRole {
  /** `display`, `serif`, `sans` or `mono`. */
  readonly role: string;
  /** The first named family in the stack, for example `Titillium Web`. */
  readonly family: string;
  /** The custom property, for example `--ff-display`. */
  readonly token: string;
}

const BRAND_LINE = /^\s*(--we-[a-z-]+):\s*oklch\([^)]*\);\s*\/\*\s*(#[0-9A-Fa-f]{6})/;
const ALIAS_LINE = /^\s*(--color-[a-z-]+):\s*var\((--we-[a-z-]+)\)\s*;/;
const FONT_LINE = /^\s*(--ff-(display|serif|sans|mono)):\s*var\([^)]*\),\s*'([^']+)'/;

/** The brand palette in stylesheet order, each color with the semantic aliases that use it. */
export function parseBrandPalette(css: string): readonly Swatch[] {
  const lines = css.split('\n');
  const aliases = new Map<string, string[]>();
  for (const line of lines) {
    const alias = ALIAS_LINE.exec(line);
    if (alias === null) continue;
    const [, name, target] = alias;
    if (name === undefined || target === undefined) continue;
    aliases.set(target, [...(aliases.get(target) ?? []), name]);
  }
  const swatches: Swatch[] = [];
  for (const line of lines) {
    const brand = BRAND_LINE.exec(line);
    if (brand === null) continue;
    const [, token, hex] = brand;
    if (token === undefined || hex === undefined) continue;
    swatches.push({ token, hex: hex.toUpperCase(), usedAs: aliases.get(token) ?? [] });
  }
  if (swatches.length === 0) throw new Error('parseBrandPalette: no brand colors found; the token file format changed.');
  return swatches;
}

/** The four type roles with the first family of each stack. */
export function parseFontRoles(css: string): readonly FontRole[] {
  const roles: FontRole[] = [];
  for (const line of css.split('\n')) {
    const match = FONT_LINE.exec(line);
    if (match === null) continue;
    const [, token, role, family] = match;
    if (token === undefined || role === undefined || family === undefined) continue;
    roles.push({ role, family, token });
  }
  if (roles.length !== 4) throw new Error(`parseFontRoles: expected four type roles, found ${roles.length}; the token file format changed.`);
  return roles;
}

/** One line per color for the copy block: the token, then its hex value. */
export function paletteCopyText(swatches: readonly Swatch[]): string {
  return swatches.map((s) => `${s.token} ${s.hex}`).join('\n');
}
