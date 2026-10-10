import type { Ground } from './types.ts';

/**
 * The lockup rules (decision D-8, and the usage list on /press/): the wordmark is dark on light only, there is no reversed version, and
 * the clear space around it equals the height of one of its cells, which is the full height of the artwork. A size is therefore one
 * spacing token used twice: as the height of the wordmark and as the padding on every side.
 */
export const LOCKUP_SIZES = ['sm', 'md', 'lg'] as const;
export type LockupSize = (typeof LOCKUP_SIZES)[number];

/** The spacing token that sets both the artwork height and the clear space for each size. */
export const LOCKUP_CLEAR_SPACE: Readonly<Record<LockupSize, string>> = {
  sm: '--sp-5',
  md: '--sp-6',
  lg: '--sp-7',
};

/** Grounds the wordmark may sit on. */
export const LOCKUP_GROUNDS: readonly Ground[] = ['light', 'tint'];

/** Throws, naming the rule, when the lockup would be placed on a dark band. */
export function assertLockupGround(ground: Ground): void {
  if (!LOCKUP_GROUNDS.includes(ground)) {
    throw new Error(`Lockup placed on a "${ground}" ground: the logo is dark on light only and never sits on a dark band (decision D-8, no reversed logo).`);
  }
}
