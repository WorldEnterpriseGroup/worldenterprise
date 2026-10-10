import type { SlotId } from '../../assets/photo/slots.ts';

/**
 * Open Graph card per page family, drawn from the cards that already exist (`og-*` slots of the photography lane). The family pages
 * pass the slot as `ogSlot`; nothing in the photography lane is edited. The mapping follows the section cards of
 * src/components/media/OgMap.ts where that file already names a section, and names the new sections explicitly.
 */
export type OgFamily =
  | 'segments'
  | 'industries'
  | 'compare'
  | 'journey'
  | 'investors'
  | 'partners'
  | 'briefs'
  | 'resources'
  | 'brand-story'
  | 'press';

export const FAMILY_OG: Readonly<Record<OgFamily, SlotId>> = {
  segments: 'og-network',
  industries: 'og-resources',
  compare: 'og-resources',
  journey: 'og-program',
  investors: 'og-network',
  partners: 'og-network',
  briefs: 'og-resources',
  resources: 'og-resources',
  'brand-story': 'og-about',
  press: 'og-about',
};

export function ogSlotFor(family: OgFamily): SlotId {
  return FAMILY_OG[family];
}

/**
 * Request OP-OG (handoff): a dedicated card per family would need these files and these lane edits. WP-71 changes none of them.
 * Cards are 1200x630 AVIF (profile `og` in src/assets/photo/slots.ts), generated through the photography lane.
 */
export const OG_REQUEST = {
  cards: [
    { id: 'og-founders', file: 'src/assets/og/og-founders.avif', families: ['segments'] },
    { id: 'og-industries', file: 'src/assets/og/og-industries.avif', families: ['industries'] },
    { id: 'og-compare', file: 'src/assets/og/og-compare.avif', families: ['compare'] },
    { id: 'og-journey', file: 'src/assets/og/og-journey.avif', families: ['journey'] },
    { id: 'og-investors', file: 'src/assets/og/og-investors.avif', families: ['investors'] },
    { id: 'og-partners', file: 'src/assets/og/og-partners.avif', families: ['partners'] },
    { id: 'og-briefs', file: 'src/assets/og/og-briefs.avif', families: ['briefs'] },
    { id: 'og-press', file: 'src/assets/og/og-press.avif', families: ['brand-story', 'press'] },
  ],
  lanePaths: [
    'src/assets/og/** (the eight cards)',
    'src/assets/photo/slots.ts (OG_IDS)',
    'src/assets/photo/manifest.json (one slot entry with alt text per card)',
    'src/components/media/OgMap.ts (SECTION_CARDS prefixes for /industries, /compare, /journey, /briefs, /press)',
    'src/components/families/og.ts (this mapping, the only WP-71 change)',
  ],
} as const;
