import type { SlotId } from '../../assets/photo/slots.ts';

/**
 * Maps a route path to the Open Graph card slot (SAGE-PLAN 6.7). Sections without their own card use `og-default`.
 * WP-09 passes the result to SeoHead as `ogSlot`.
 */
const SECTION_CARDS: ReadonlyArray<readonly [prefix: string, slot: SlotId]> = [
  ['/program', 'og-program'],
  ['/services', 'og-services'],
  ['/playbooks', 'og-playbooks'],
  ['/fundability', 'og-fundability'],
  ['/resources', 'og-resources'],
  ['/library', 'og-resources'],
  ['/glossary', 'og-resources'],
  ['/faq', 'og-resources'],
  ['/network', 'og-network'],
  ['/founders', 'og-network'],
  ['/investors', 'og-network'],
  ['/about', 'og-about'],
];

function normalise(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.split(/[?#]/, 1)[0] ?? '/';
}

export function ogSlotForPath(path: string): SlotId {
  const clean = normalise(path);
  if (clean === '/') return 'og-home';
  const match = SECTION_CARDS.find(([prefix]) => clean === prefix || clean.startsWith(`${prefix}/`));
  return match ? match[1] : 'og-default';
}

export const OG_MAP = SECTION_CARDS;
