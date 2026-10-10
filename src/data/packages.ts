/**
 * The four packages, in one place (wave 7, WP-40).
 *
 * Consumers: WP-41 (llms.txt and the Offer catalog), WP-42 (pricing cards and the picker), WP-43 (the package field on the apply form)
 * and WP-44 (the home teaser). The names, stage fit and depth are the published facts of claim C-10, transcribed verbatim from the table in
 * src/content/pages/pricing/pricing.mdx. Nothing else about a package is published: no amount, no seat count, no term (F-4, C-06, C-10).
 * Do not add either to this module; tests/unit/wp-40/packages.test.ts fails on a digit or a currency sign in any field.
 *
 * Pure data, free of Astro globals, so node scripts and `node --test` import it as well as pages.
 */

export const PACKAGE_IDS = ['spark', 'launch', 'accelerate', 'studio'] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

/** One slug per stage-fit sentence, for a picker or a query string that must not depend on prose. */
export type StageKey = 'idea-or-prototype' | 'first-product' | 'early-customer-evidence' | 'several-products-or-regulated';

export type PackageDepth = 'Core' | 'Standard' | 'Extended' | 'Embedded';

export interface WePackage {
  readonly id: PackageId;
  readonly name: string;
  readonly stageKey: StageKey;
  /** The company stage the package is sized for, verbatim from the pricing page table. */
  readonly stageFit: string;
  /** The depth in every service line, verbatim from the pricing page table. */
  readonly depth: PackageDepth;
}

export const packages: readonly WePackage[] = [
  {
    id: 'spark',
    name: 'Spark',
    stageKey: 'idea-or-prototype',
    stageFit: 'An idea or a prototype before revenue, with one or two founders and no institutional capital yet.',
    depth: 'Core',
  },
  {
    id: 'launch',
    name: 'Launch',
    stageKey: 'first-product',
    stageFit: 'A first product in build or first pilots under way, at the pre-seed stage.',
    depth: 'Standard',
  },
  {
    id: 'accelerate',
    name: 'Accelerate',
    stageKey: 'early-customer-evidence',
    stageFit: 'A working product with early customer evidence, preparing a seed round or an equivalent.',
    depth: 'Extended',
  },
  {
    id: 'studio',
    name: 'Studio',
    stageKey: 'several-products-or-regulated',
    stageFit: 'A company with several products, or in a regulated or capital-intensive field, that needs an embedded WE team.',
    depth: 'Embedded',
  },
];

/** The query and form field name that carries a package id (docs/wave7-contracts.md, section 1). */
export const PACKAGE_PARAM = 'package';

/** The form value for a founder who has not chosen. It is never a package id and never appears in a package list. */
export const PACKAGE_NOT_SURE = 'not-sure';

const BY_ID: ReadonlyMap<string, WePackage> = new Map(packages.map((p) => [p.id, p]));

export function isPackageId(value: unknown): value is PackageId {
  return typeof value === 'string' && BY_ID.has(value);
}

export function getPackage(id: PackageId): WePackage {
  const found = BY_ID.get(id);
  if (found === undefined) throw new Error(`Unknown package id: ${id}`);
  return found;
}

/**
 * Reads the package from a query value. An unknown, empty or repeated value is ignored (null), never an error, because a query string
 * is user input and a stale link must still open the page. Matching is case-insensitive after trimming.
 */
export function parsePackageParam(value: string | null | undefined): PackageId | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  return isPackageId(id) ? id : null;
}

/** The package sized for a stage, or null when the key is not one of the four published stages. */
export function packageForStage(stageKey: string): WePackage | null {
  return packages.find((p) => p.stageKey === stageKey) ?? null;
}
