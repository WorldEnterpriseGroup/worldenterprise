import type { HeroCta } from '../hero/types.ts';

/**
 * The calls to action of the WP-55 pages, in the SALES.md hierarchy (ORCHESTRATION "Sales direction adopted"): primary "Start a
 * readiness review", secondary "See how WE works" and "See how long it really takes", utility "Talk to WE", partner "Refer a founder".
 * The two secondary routes are new in wave 9; until they are live the page falls back to a live page that answers the same question,
 * so no button ever links a dead route.
 */
export const START_REVIEW: HeroCta = { label: 'Start a readiness review', href: '/apply/' };
export const TALK_TO_WE: HeroCta = { label: 'Talk to WE', href: '/contact/' };
export const REFER_A_FOUNDER: HeroCta = { label: 'Refer a founder', href: '/network/partners/enquire/' };
export const SEE_FRAMEWORKS: HeroCta = { label: 'See the frameworks', href: '/about/frameworks/' };

type IsLive = (path: string) => boolean;

/** "See how WE works": /how-we-work/ once it is live, the program's how-it-works page until then. */
export function seeHowWeWorks(isLive: IsLive): HeroCta | undefined {
  if (isLive('/how-we-work/')) return { label: 'See how WE works', href: '/how-we-work/' };
  if (isLive('/program/how-it-works/')) return { label: 'See how WE works', href: '/program/how-it-works/' };
  return undefined;
}

/** "See how long it really takes": only when /why-it-takes-time/ is live; the claim needs its charts behind it. */
export function seeHowLong(isLive: IsLive): HeroCta | undefined {
  return isLive('/why-it-takes-time/') ? { label: 'See how long it really takes', href: '/why-it-takes-time/' } : undefined;
}

/** The first secondary action that is live: how long it takes, then how WE works. */
export function secondaryAction(isLive: IsLive): HeroCta | undefined {
  return seeHowLong(isLive) ?? seeHowWeWorks(isLive);
}
