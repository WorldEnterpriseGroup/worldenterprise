import type { EmblemKind } from './emblems.ts';

/** The first path segment of each content family, and the emblem that pictures it. */
const BY_SEGMENT: Readonly<Record<string, EmblemKind>> = {
  insights: 'insights',
  research: 'research',
  library: 'library',
  playbooks: 'playbooks',
  fundability: 'fundability',
  resources: 'resources',
  briefs: 'briefs',
  industries: 'industries',
  compare: 'compare',
  journey: 'journey',
  glossary: 'glossary',
  faq: 'faq',
  search: 'search',
  sitemap: 'sitemap',
};

/**
 * The emblem for a site path, so a related link or a mixed list shows the family it leads to. A path outside the content families
 * (a service, a program page) is pictured as part of the resources system.
 */
export function kindForPath(path: string): EmblemKind {
  const segment = path.split('/').find((part) => part !== '') ?? '';
  return BY_SEGMENT[segment] ?? 'resources';
}
