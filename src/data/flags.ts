/**
 * Feature flags that gate publication. Every flag defaults OFF and is flipped only by the operator or counsel
 * (gate G-LEGAL, SAGE-PLAN 3.2). There is no free-text escape: components read these booleans.
 */
export const flags = {
  /** C-06 / FLAG-PRICE. When true, the Team Composer renders seats x rate. The figure itself lives in the rate field below. */
  seatPrice: {
    published: false,
    /** Monthly per-seat rate in whole currency units. Must stay null while published is false. */
    monthlyRate: null as number | null,
  },
  /** C-23. Terms of use ship only when counsel signs. Drives the /legal/terms/ route. */
  legalTerms: false,
  /** FLAG-PBC. When true, the footer and About page may call WE a "Delaware public benefit corporation". */
  pbcWording: false,
  /** FLAG-LIMITS. Service-line limits ("What this line does not do") confirmed by the operator. */
  limitsConfirmed: false,
  /** FLAG-FOCUS. Focus Shifts confirmed as used in seat operations. */
  focusShiftConfirmed: false,
} as const;

export type Flags = typeof flags;

if (!flags.seatPrice.published && flags.seatPrice.monthlyRate !== null) {
  throw new Error('flags.seatPrice.monthlyRate must be null while flags.seatPrice.published is false (claim C-06).');
}
