/**
 * Shared sales copy (SALES.md sections 1.4, 6 and 8; SITE-COPY.md sections 5 and 6). Pure data.
 */

/** Under every block of statistics (SALES.md 8.1). */
export const HONESTY_LINE = "These figures describe all new U.S. businesses, not WE's results.";

/** The end band of /why-it-takes-time/ (SITE-COPY.md 5.10). */
export const CLOCK_HONESTY = [
  HONESTY_LINE,
  'No one can promise that a company will survive.',
  "WE's promise is to do the work on the real timeline.",
] as const;

export const NO_FUNDING = 'WE makes no promise of funding.';

/**
 * The category line and the proposed replacement for claim C-29 (ORCHESTRATION "Sales direction adopted": C-29 is replaced with
 * SALES.md's wording). `src/data/claims.ts` is outside WP-58's write set, so the registry edit is handed to its holder (handoff note);
 * these pages use the wording directly.
 */
export const CATEGORY = 'Long-horizon business incubation and consulting, paced to the years a company really takes.';

export const POSITIONING =
  'WE is a long-horizon business incubation and consulting firm. WE steers a dedicated, fully remote team that builds a software-enabled company with its founder, for as long as the work is useful.';

export const PRIMARY_CTA = { label: 'Start a readiness review', href: '/apply/' } as const;
export const TIMELINE_BRIEF_CTA = { label: 'Get the timeline brief', href: '/why-it-takes-time/brief/' } as const;
export const HOW_LONG_CTA = { label: 'See how long it really takes', href: '/why-it-takes-time/' } as const;
export const HOW_WE_WORK_CTA = { label: 'See how WE works', href: '/how-we-work/' } as const;
/** Until /how-we-work/ (WP-54) is live, the same label points at the page that explains the engagement today. */
export const HOW_WE_WORK_FALLBACK = { label: 'See how WE works', href: '/program/how-it-works/' } as const;
