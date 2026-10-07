import type { ImageMetadata } from 'astro';
import hex43 from './placeholders/hex-4x3.svg';
import hex169 from './placeholders/hex-16x9.svg';
import hexOg from './placeholders/hex-og.svg';
import manifest from './manifest.json';
import { SLOT_SPECS } from './slots.ts';
import type { SlotId, SlotProfile, SlotSpec } from './slots.ts';

export interface PhotoAsset {
  readonly spec: SlotSpec;
  readonly src: ImageMetadata;
  /** Descriptive alt text from manifest.json. Empty only while a slot still holds a placeholder. */
  readonly alt: string;
  /** True only if a slot has no generated AVIF; every slot is filled, so consumers may treat this as false. */
  readonly placeholder: boolean;
}

interface ManifestSlot {
  readonly id: string;
  readonly path: string;
  readonly alt: string;
}

const PLACEHOLDER: Record<SlotProfile, ImageMetadata> = {
  'card-4x3': hex43,
  'card-landscape': hex169,
  'hero-home': hex169,
  og: hexOg,
};

const modules = {
  ...import.meta.glob<{ default: ImageMetadata }>('./*.avif', { eager: true }),
  ...import.meta.glob<{ default: ImageMetadata }>('../og/*.avif', { eager: true }),
};

const byId = new Map<string, ManifestSlot>((manifest.slots as ManifestSlot[]).map((slot) => [slot.id, slot]));

function resolve(spec: SlotSpec): PhotoAsset {
  const entry = byId.get(spec.id);
  const file = entry ? entry.path.replace(/^src\/assets\/(photo|og)\//, (_m, dir: string) => (dir === 'photo' ? './' : '../og/')) : undefined;
  const loaded = file ? modules[file] : undefined;
  if (!entry || !loaded) {
    return { spec, src: PLACEHOLDER[spec.profile], alt: '', placeholder: true };
  }
  return { spec, src: loaded.default, alt: entry.alt, placeholder: false };
}

/** Slot id to asset. Every slot is filled by WP-12; see manifest.json for seed, prompt, alt and bytes. */
export const photo: Readonly<Record<SlotId, PhotoAsset>> = Object.fromEntries(
  SLOT_SPECS.map((spec) => [spec.id, resolve(spec)]),
) as Record<SlotId, PhotoAsset>;

export function getPhoto(id: SlotId): PhotoAsset {
  return photo[id];
}

export * from './slots.ts';
