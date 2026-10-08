/**
 * Site-wide disclosure for generated images (claims audit P0-3).
 *
 * The line is accurate only once an image model has produced a shipped image, so it renders only when a slot in
 * src/assets/photo/manifest.json declares source "generated". Until then every slot is a flat illustration or an SVG
 * card and the line would overstate. scripts/audit-claims.mjs applies the same rule in its required-text check, so the
 * footer and the audit cannot disagree.
 */

/** The exact disclosure line. Do not reword it without updating the editorial policy and the accessibility statement. */
export const PHOTO_DISCLOSURE =
  'Illustrative images, some AI-generated. Figures shown are not real people, founders, clients or WE staff.';

/** Where the disclosure links: the "Use of AI tools" section of the editorial policy. */
export const PHOTO_DISCLOSURE_HREF = '/about/editorial-policy/';

/** The manifest value written for an image produced by the image model. */
export const GENERATED_SOURCE = 'generated';

export interface ManifestSlotSource {
  readonly source?: string;
}

/** True when any manifest slot is image-model output. Pass `manifest.slots`. */
export function hasGeneratedImages(slots: readonly ManifestSlotSource[]): boolean {
  return slots.some((slot) => slot.source === GENERATED_SOURCE);
}
