/**
 * The calls to action of the home page and the program pages (SALES.md 6.1 and 6.2, SITE-COPY 1 and 2). Primary: start a readiness
 * review. Secondary: see how long it really takes, or see how WE works. The routes behind the secondaries are new (WP-54, WP-58); until
 * one is built, the action falls back to the closest built page, so no page links a route that is not live. The tertiary "Get the
 * timeline brief" stays hidden until its brief is a live route.
 */

export interface Action {
  readonly label: string;
  readonly href: string;
}

/** Whether a route is built and launched (`RouteState.isLive`). */
export type IsLive = (path: string) => boolean;

export const START_REVIEW: Action = { label: 'Start a readiness review', href: '/apply/' };

/** Candidates in order of preference; the first live one wins. */
const HOW_LONG: readonly Action[] = [
  { label: 'See how long it really takes', href: '/why-it-takes-time/' },
  { label: 'See how the work is paced', href: '/program/how-it-works/' },
];

const HOW_WE_WORK: readonly Action[] = [
  { label: 'See how WE works', href: '/how-we-work/' },
  { label: 'See how WE works', href: '/program/how-it-works/' },
];

const SEE_PROGRAM: readonly Action[] = [{ label: 'See the program', href: '/program/' }];

/** Only the new engagement page: the pricing-era page is never linked from these routes. */
const PAID: readonly Action[] = [{ label: 'See how WE is paid', href: '/how-we-work/#paid' }];

const WHO: readonly Action[] = [
  { label: 'Find your situation', href: '/who-we-work-with/' },
  { label: 'Find your situation', href: '/founders/' },
];

const UBF: readonly Action[] = [
  { label: 'Explore the Universal Business Framework', href: '/about/frameworks/ubf/' },
  { label: 'Explore the WE frameworks', href: '/about/frameworks/' },
];

const TIMELINE_BRIEF: readonly Action[] = [{ label: 'Get the timeline brief', href: '/briefs/real-timeline/' }];

export const ACTIONS = { howLong: HOW_LONG, howWeWork: HOW_WE_WORK, program: SEE_PROGRAM, paid: PAID, who: WHO, ubf: UBF, timelineBrief: TIMELINE_BRIEF } as const;
export type ActionKey = keyof typeof ACTIONS;

/** The path part of an href, without a fragment or query. */
export function routeOf(href: string): string {
  return href.replace(/[#?].*$/, '');
}

/** The first action whose route is live, or undefined when none is (the caller then shows no link). */
export function pick(key: ActionKey, isLive: IsLive): Action | undefined {
  return ACTIONS[key].find((a) => isLive(routeOf(a.href)));
}
