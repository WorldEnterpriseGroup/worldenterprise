/**
 * The scene palette (BRIEF 5.1). Night blue is the sky; stars and particles use the blue tint ramp; each scene carries exactly one amber
 * object. Values mirror the brand tokens in src/styles/tokens.css (hex comments there). Plain numbers, so this module has no three import
 * and runs under `node --test`.
 */

export const SKY = 0x0a3459; // --we-blue-night
export const SKY_DEEP = 0x061f38; // night blue toward charcoal, the vignette edge of a deep frame
export const AMBER = 0xe8a33d; // --we-amber, one object per scene
export const WHITE = 0xffffff;

/** The blue tint ramp, darkest first: #0F4C81, #1C75BC, #2484C6, #4FA0D6, #8FBDE3, #C3DDF0, #DCEAF6. */
export const RAMP = [0x0f4c81, 0x1c75bc, 0x2484c6, 0x4fa0d6, 0x8fbde3, 0xc3ddf0, 0xdceaf6] as const;

/** Splits a 0xRRGGBB number into linear-ish 0..1 channels (sRGB values; three converts when a material asks for it). */
export function channels(hex: number): readonly [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255];
}

/** Linear blend of two 0xRRGGBB colors, `t` in 0..1, returned as channels. */
export function mix(a: number, b: number, t: number): readonly [number, number, number] {
  const ca = channels(a);
  const cb = channels(b);
  const k = Math.min(1, Math.max(0, t));
  return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
}

/** A color from the ramp at position `t` in 0..1, interpolated between neighbours. */
export function ramp(t: number): readonly [number, number, number] {
  const k = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(k));
  return mix(RAMP[i] ?? RAMP[0], RAMP[i + 1] ?? RAMP[0], k - i);
}
