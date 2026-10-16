/**
 * Types of the ecosystem directory (WP-33, issue #82). Every entry is an independent third-party program that WE encourages founders
 * to consider. No affiliation is implied unless an entry says so (none does). Each entry carries its own source and retrieval date.
 */

export const CATEGORY_IDS = [
  'launch-programs',
  'incubators',
  'university',
  'coworking',
  'angels',
  'sba',
  'government',
  'communities',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Where a company is in its life. WE's reading of each program's public description, not a claim by the program. */
export const STAGE_IDS = ['idea', 'build', 'launch', 'grow', 'scale'] as const;
export type StageId = (typeof STAGE_IDS)[number];

/** Who a program says it is for, only where the program's own page says so. `any` means no group is named. */
export const AUDIENCE_IDS = [
  'any',
  'women',
  'veterans',
  'immigrants',
  'latino',
  'underserved',
  'rural',
  'university',
  'researchers',
] as const;
export type AudienceId = (typeof AUDIENCE_IDS)[number];

/** How the program is delivered, from its own page. `varies` when the page does not say or offers several formats. */
export const FORMAT_IDS = ['online', 'hybrid', 'in-person', 'varies'] as const;
export type DeliveryId = (typeof FORMAT_IDS)[number];

/** How the entry was checked. `official-page`: the program's own page was read in October 2026. `official-listing`: the program's own listing was found by search but the page itself could not be read automatically. */
export type Verification = 'official-page' | 'official-listing';

export interface EcosystemEntry {
  /** Stable kebab-case id; the anchor of the entry on the hub and its category page. */
  readonly id: string;
  /** Official name as the program writes it. */
  readonly name: string;
  readonly category: CategoryId;
  /** Other categories the entry also fits. Listed under the primary category only. */
  readonly also?: readonly CategoryId[];
  /** Official URL (https). */
  readonly url: string;
  /** One or two sentences on what it offers, in WE's words, from the source. */
  readonly offers: string;
  /** Who it is for, as the program states it. */
  readonly whoFor: string;
  /** Typical format (batch length, residency, membership, gatherings), only what the source says. */
  readonly format: string;
  /** Where: city, country, network, or online. */
  readonly where: string;
  readonly delivery: DeliveryId;
  readonly stages: readonly StageId[];
  readonly audiences: readonly AudienceId[];
  /** Publicly stated terms (equity, funding), only if the source states them. Absent otherwise. */
  readonly terms?: string;
  /** URL of the page the facts come from (the official page, or the listing that confirmed it). */
  readonly sourceUrl: string;
  /** Retrieval month, always `2026-10` for this wave. */
  readonly retrieved: string;
  readonly verification: Verification;
}

export interface CategoryInfo {
  readonly id: CategoryId;
  readonly name: string;
  readonly short: string;
  /** One sentence that says what the category is. */
  readonly what: string;
  /** Who it suits best. */
  readonly bestFor: string;
  /** What to ask before joining. */
  readonly askFirst: readonly string[];
  /** Typical place in the years of a company (for the timeline). */
  readonly window: { readonly from: number; readonly to: number };
}
