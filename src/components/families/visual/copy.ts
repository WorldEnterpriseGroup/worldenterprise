import type { EmblemKind } from './emblems.ts';

/**
 * The words of the WP-56 visual layer: the caption each family's emblem carries in a hero panel, and the labels of the reading frame.
 * Every string here is scanned against the claims denylist and the wave 9 banned words by tests/unit/wp-56/visual-copy.test.ts and is
 * traced in `.astro-magazine/sources/wp-56.json`. No statistic lives here (statistics live in stats.ts with their source lines).
 */

/** The visual identity of each family: what its emblem pictures, said once under the picture in the hub's hero panel. */
export const IDENTITY: Readonly<Record<EmblemKind, { readonly name: string; readonly caption: string }>> = {
  insights: { name: 'Desks as galaxies', caption: 'Each desk is a galaxy of sourced articles on one part of building a company.' },
  research: { name: 'Research as a supernova', caption: 'Each research brief gathers the public evidence on one question into one bright point.' },
  library: { name: 'The library under the moon', caption: 'Working documents to copy, print or download, kept in one stack.' },
  playbooks: { name: 'Playbooks as mission patches', caption: 'Each playbook is one mission in the sequence. The pips on a patch count its place in the order.' },
  fundability: { name: 'Fundability as a gauge', caption: 'Readiness is evidence you can show. The gauge has no score, and WE makes no promise of funding.' },
  resources: { name: 'Resources as a solar system', caption: 'Guides, templates, briefs and reference pages, each on its own orbit around the work.' },
  briefs: { name: 'Briefs as star charts', caption: 'Each brief charts one decision: the questions, the sources and the order to take them in.' },
  industries: { name: 'Industries as planets', caption: 'Each industry is its own world, with its own buyers, rules and sales cycle.' },
  compare: { name: 'Navigating giants', caption: 'Categories of support compared side by side. No company is named or ranked.' },
  journey: { name: 'The journey as a launch', caption: 'Dust, then a star, then a world in orbit: the sequence after you start, in order.' },
  glossary: { name: 'The glossary as a constellation map', caption: 'Every term is a star, grouped into figures by subject.' },
  faq: { name: 'Questions answered by relay', caption: 'Plain answers to the questions founders ask first.' },
  search: { name: 'Search as a scan', caption: 'Search every page of the site by what it says.' },
  sitemap: { name: 'The site as a hex atlas', caption: 'Every page of the site on one map.' },
  lost: { name: 'Off course', caption: 'This page is not on the map.' },
};

/** Labels of the wide reading frame (articles and briefs). */
export const READING = {
  aside: 'About this article',
  contents: 'Contents',
  progress: 'Reading progress',
  related: 'Keep reading',
  context: 'The real timeline',
} as const;
