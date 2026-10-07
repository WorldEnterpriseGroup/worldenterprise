import type { ImageMetadata } from 'astro';
import hex43 from './placeholders/hex-4x3.svg';
import hex169 from './placeholders/hex-16x9.svg';
import hexOg from './placeholders/hex-og.svg';
import { SLOT_SPECS } from './slots.ts';
import type { SlotId, SlotProfile, SlotSpec } from './slots.ts';

export interface PhotoAsset {
  readonly spec: SlotSpec;
  readonly src: ImageMetadata;
  /** Alt text. Empty while the slot holds a decorative placeholder; WP-12 writes real alt text when it fills the slot. */
  readonly alt: string;
  /** True until WP-12 replaces the placeholder with the generated AVIF. */
  readonly placeholder: boolean;
}

const PLACEHOLDER: Record<SlotProfile, ImageMetadata> = {
  'card-4x3': hex43,
  'card-landscape': hex169,
  'hero-home': hex169,
  og: hexOg,
};

/** WP-12 replaces entries here with generated AVIF imports, keeping the slot id and the alt text. */
export const photo: Readonly<Record<SlotId, PhotoAsset>> = Object.fromEntries(
  SLOT_SPECS.map((spec) => [spec.id, { spec, src: PLACEHOLDER[spec.profile], alt: '', placeholder: true } satisfies PhotoAsset]),
) as Record<SlotId, PhotoAsset>;

export function getPhoto(id: SlotId): PhotoAsset {
  return photo[id];
}

export * from './slots.ts';
