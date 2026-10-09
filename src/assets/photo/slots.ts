/**
 * Canonical photo slot ids (SAGE-PLAN 6.7). WP-00 defines them; WP-12 fills them; every consumer imports by id
 * and never by filename. Raster output is AVIF only. No raster displays wider than 1024 CSS px.
 *
 * The photography pass (WP-12b) adds, per slot: the exact master size and aspect, the srcset widths, the `sizes` attribute for the
 * layout the slot sits in, and the people class from the people policy. Everything here is plain TypeScript with no Astro imports, so
 * `node --test` can load it; tests/unit/wp-12b checks it against the manifest and the shotlist extract.
 */
export type SlotProfile = 'card-4x3' | 'card-landscape' | 'hero-home' | 'og';

/** Aspect of the master, as the shotlist writes it. */
export type SlotAspect = '4:3' | '16:9' | '1.91:1';

/**
 * People policy class (.plan/photo/people-policy.json). `forbidden` slots never carry a person; `optional` slots default to an object
 * and take a figure only if the owner opts in; `recommended` slots carry one chest-down figure (decision F-6).
 */
export type PeopleClass = 'forbidden' | 'optional' | 'recommended';

/**
 * Long edge of the largest master the image model renders. Boogu-Image-0.1-Turbo is 1K-native, so 16:9 bands and heroes ship at
 * 1024x576 at 1x instead of the 2048x1152 the shotlist asked for (decision P-1). Cards are 1024x768 and already within it.
 */
export const MODEL_MAX_EDGE = 1024;

export interface SlotSpec {
  readonly id: string;
  readonly group: SlotGroup;
  readonly profile: SlotProfile;
  /** Pixel size of the master asset. */
  readonly width: number;
  readonly height: number;
  readonly aspect: SlotAspect;
  /** Largest CSS display size (width x height) the slot may ever render at. */
  readonly displayMax: readonly [number, number];
  /** srcset widths, ascending. The last equals the master width; none is wider than the master. */
  readonly widths: readonly number[];
  /** `sizes` attribute for the layout the slot sits in. */
  readonly sizes: string;
  readonly people: PeopleClass;
}

export type SlotGroup = 'inset' | 'service' | 'stage' | 'playbook' | 'topic' | 'research' | 'band' | 'og';

/** Master size per profile. `hero-home` is the 2048x1152 band of the shotlist scaled to the model's 1K edge (MODEL_MAX_EDGE, decision P-1). */
const PROFILE_SIZE: Record<SlotProfile, readonly [number, number]> = {
  'card-4x3': [1024, 768],
  'card-landscape': [1024, 576],
  'hero-home': [1024, 576],
  og: [1200, 630],
};

const PROFILE_ASPECT: Record<SlotProfile, SlotAspect> = {
  'card-4x3': '4:3',
  'card-landscape': '16:9',
  'hero-home': '16:9',
  og: '1.91:1',
};

/** Ship narrower variants through srcset; the committed master is the widest (astro:assets only scales down). */
const PROFILE_WIDTHS: Record<SlotProfile, readonly number[]> = {
  'card-4x3': [512, 768, 1024],
  'card-landscape': [512, 1024],
  'hero-home': [640, 1024],
  og: [1200],
};

const DISPLAY_MAX: Record<SlotProfile, readonly [number, number]> = {
  'card-4x3': [512, 384],
  'card-landscape': [512, 288],
  'hero-home': [1024, 576],
  og: [1200, 630],
};

/** Slots that may carry a figure, by class (people-policy.json: 5 recommended, 8 optional; the other 34 are forbidden). */
const RECOMMENDED_FIGURE_IDS: readonly string[] = ['inset-playbooks', 'svc-b', 'stage-dream', 'stage-build', 'stage-grow'];
const OPTIONAL_FIGURE_IDS: readonly string[] = ['inset-program', 'svc-a', 'svc-d', 'pb-1', 'pb-2', 'pb-3', 'pb-5', 'research-4'];

function peopleClass(id: string): PeopleClass {
  if (RECOMMENDED_FIGURE_IDS.includes(id)) return 'recommended';
  if (OPTIONAL_FIGURE_IDS.includes(id)) return 'optional';
  return 'forbidden';
}

/**
 * `sizes` per layout. Cards sit in a grid that is one column below 36rem and shows the card at its display width above it. A page
 * inset fills the hero frame, which is a column of about 32rem beside the copy from 62rem and the full width below. A stage image
 * is capped at 26rem. The home hero and the home band use the 16:9 masters at 32rem and 1024px.
 */
const SIZES = {
  card: (displayWidth: number): string => `(min-width: 36rem) ${displayWidth}px, 100vw`,
  frame: '(min-width: 62rem) 32rem, 100vw',
  stage: '(min-width: 36rem) 26rem, 100vw',
  band: '(min-width: 64rem) 1024px, 100vw',
  og: '1200px',
} as const;

function sizesFor(id: string, group: SlotGroup, displayWidth: number): string {
  if (id === 'band-1') return SIZES.frame;
  if (group === 'inset') return SIZES.frame;
  if (group === 'stage') return SIZES.stage;
  if (group === 'band') return SIZES.band;
  if (group === 'og') return SIZES.og;
  return SIZES.card(displayWidth);
}

function slots(group: SlotGroup, profile: SlotProfile, ids: readonly string[]): SlotSpec[] {
  const [width, height] = PROFILE_SIZE[profile];
  const displayMax = DISPLAY_MAX[profile];
  return ids.map((id) => ({
    id,
    group,
    profile,
    width,
    height,
    aspect: PROFILE_ASPECT[profile],
    displayMax,
    widths: PROFILE_WIDTHS[profile],
    sizes: sizesFor(id, group, displayMax[0]),
    people: peopleClass(id),
  }));
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
