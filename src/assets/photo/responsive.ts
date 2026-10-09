import type { SlotSpec } from './slots.ts';

/**
 * Pure helpers for exact-size responsive photos. Kept free of Astro imports so node --test can load them; the component side is
 * src/components/media/photo-image.ts.
 */

/**
 * The widths a slot ships: the slot's profile widths that fit inside the file, and the file's own width as the last candidate.
 * astro:assets can only scale down, so a width above the file is never offered.
 */
export function srcsetWidths(spec: Pick<SlotSpec, 'widths'>, nativeWidth: number): number[] {
  const fitting = spec.widths.filter((w) => w < nativeWidth);
  return [...new Set([...fitting, nativeWidth])].sort((a, b) => a - b);
}

/**
 * The width and height attributes: the largest CSS display size of the slot, never the master size. audit:images picks the card
 * (60 KB) or band (120 KB) budget from the width attribute, and the browser reserves exactly this box before the file arrives.
 */
export function displayAttributes(spec: Pick<SlotSpec, 'displayMax'>, nativeWidth: number, nativeHeight: number): { width: number; height: number } {
  const [maxWidth] = spec.displayMax;
  if (nativeWidth <= maxWidth) return { width: nativeWidth, height: nativeHeight };
  return { width: maxWidth, height: Math.round((maxWidth * nativeHeight) / nativeWidth) };
}
