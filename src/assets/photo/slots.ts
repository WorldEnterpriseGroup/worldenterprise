/**
 * Canonical photo slot ids (SAGE-PLAN 6.7). WP-00 defines them; WP-12 fills them; every consumer imports by id
 * and never by filename. Raster output is AVIF only. No raster displays wider than 1024 CSS px.
 */
export type SlotProfile = 'card-4x3' | 'card-landscape' | 'hero-home' | 'og';

export interface SlotSpec {
  readonly id: string;
  readonly group: SlotGroup;
  readonly profile: SlotProfile;
  /** Pixel size of the generated asset. */
  readonly width: number;
  readonly height: number;
  /** Largest CSS display size (width x height) the slot may ever render at. */
  readonly displayMax: readonly [number, number];
}

export type SlotGroup = 'inset' | 'service' | 'stage' | 'playbook' | 'topic' | 'research' | 'band' | 'og';

const PROFILE_SIZE: Record<SlotProfile, readonly [number, number]> = {
  'card-4x3': [1024, 768],
  'card-landscape': [1024, 576],
  'hero-home': [1024, 576],
  og: [1200, 630],
};

const DISPLAY_MAX: Record<SlotProfile, readonly [number, number]> = {
  'card-4x3': [512, 384],
  'card-landscape': [512, 288],
  'hero-home': [1024, 576],
  og: [1200, 630],
};

function slots(group: SlotGroup, profile: SlotProfile, ids: readonly string[]): SlotSpec[] {
  const [width, height] = PROFILE_SIZE[profile];
  return ids.map((id) => ({ id, group, profile, width, height, displayMax: DISPLAY_MAX[profile] }));
}

export const INSET_IDS = [
  'inset-program', 'inset-services', 'inset-playbooks', 'inset-fundability', 'inset-trust', 'inset-resources',
  'inset-network', 'inset-about', 'inset-pricing', 'inset-apply', 'inset-contact',
] as const;
export const SERVICE_IDS = ['svc-a', 'svc-b', 'svc-c', 'svc-d', 'svc-e', 'svc-f', 'svc-g'] as const;
export const STAGE_IDS = ['stage-dream', 'stage-build', 'stage-grow'] as const;
export const PLAYBOOK_IDS = ['pb-1', 'pb-2', 'pb-3', 'pb-4', 'pb-5'] as const;
export const TOPIC_IDS = ['topic-dream', 'topic-build', 'topic-grow', 'topic-fundable'] as const;
export const RESEARCH_IDS = ['research-1', 'research-2', 'research-3', 'research-4'] as const;
export const BAND_IDS = ['band-1', 'band-2', 'band-3', 'band-4'] as const;
export const OG_IDS = [
  'og-home', 'og-program', 'og-services', 'og-playbooks', 'og-fundability', 'og-resources', 'og-network', 'og-about', 'og-default',
] as const;

export type SlotId =
  | (typeof INSET_IDS)[number]
  | (typeof SERVICE_IDS)[number]
  | (typeof STAGE_IDS)[number]
  | (typeof PLAYBOOK_IDS)[number]
  | (typeof TOPIC_IDS)[number]
  | (typeof RESEARCH_IDS)[number]
  | (typeof BAND_IDS)[number]
  | (typeof OG_IDS)[number];

export const SLOT_SPECS: readonly SlotSpec[] = [
  ...slots('inset', 'card-4x3', INSET_IDS),
  ...slots('service', 'card-4x3', SERVICE_IDS),
  ...slots('stage', 'card-4x3', STAGE_IDS),
  ...slots('playbook', 'card-4x3', PLAYBOOK_IDS),
  ...slots('topic', 'card-landscape', TOPIC_IDS),
  ...slots('research', 'card-4x3', RESEARCH_IDS),
  ...slots('band', 'hero-home', BAND_IDS),
  ...slots('og', 'og', OG_IDS),
];

export const ALL_SLOT_IDS: readonly SlotId[] = SLOT_SPECS.map((s) => s.id as SlotId);

export function isSlotId(value: string): value is SlotId {
  return SLOT_SPECS.some((s) => s.id === value);
}
