/**
 * The headings WP-62 put over the lists of the home page and the founders hub. They live in a data module, not in the components, so the
 * sentence ledger (.astro-magazine/sources/wp-62.json) can read and check them like any other copy. Plain data with no imports.
 */
export const HUB_HEADINGS = {
  /** Over the four audience doors under the home hero. */
  audience: 'Choose where to start',
  /** Over the list of founder segment pages on the founders hub. */
  segments: 'Find the path that fits you',
} as const;
