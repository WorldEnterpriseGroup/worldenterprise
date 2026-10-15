/**
 * The call-to-action ladder of the WP-56 templates, with the labels and microcopy of the sales strategy (SALES.md section 6.1,
 * binding for wave 9). Every rung is checked against the live routes, so a target that is not built yet drops out and its fallback
 * takes its place: "Get the timeline brief" stays hidden until /briefs/real-timeline/ exists, and "See how long it really takes"
 * stands in for it once /why-it-takes-time/ is live. A ladder never promises an outcome, a reply time or scarcity.
 */

import { targetFor } from '../../../data/cta/targets.ts';

export interface LadderCta {
  readonly label: string;
  readonly href: string;
  /** One line under the action, from SALES.md 6.1. */
  readonly note?: string | undefined;
}

export type IsLive = (path: string) => boolean;

/** A shared CTA target (WP-51 owns the labels, docs/wave9-contracts.md section 8). A missing key is a build error, never a silent label. */
function shared(key: 'apply' | 'contact'): { readonly label: string; readonly href: string } {
  const target = targetFor(key);
  if (target === undefined) throw new Error(`src/data/cta/targets.ts has no "${key}" target: the WP-56 CTA ladder reads its label there.`);
  return target;
}
const apply = shared('apply');
const contact = shared('contact');

/** Primary (commit). The label and target come from the shared CTA data (WP-51), so a family page never writes its own primary. */
export const READINESS_REVIEW: LadderCta = {
  label: apply.label,
  href: apply.href,
  note: "Tell WE where the company stands. WE replies to arrange a conversation and a written read of your company's timeline.",
};

/** Secondary (understand). */
export const HOW_LONG: LadderCta = {
  label: 'See how long it really takes',
  href: '/why-it-takes-time/',
  note: 'The public data on how long a business takes, in six charts.',
};

/** Secondary (understand). */
export const HOW_WE_WORKS: LadderCta = { label: 'See how WE works', href: '/how-we-work/' };

/** Tertiary (stay in touch). Hidden until its endpoint and page exist. */
export const TIMELINE_BRIEF: LadderCta = {
  label: 'Get the timeline brief',
  href: '/briefs/real-timeline/',
  note: 'A short PDF of the charts and sources, sent by email to the address you give.',
};

/** Utility. */
export const TALK_TO_WE: LadderCta = { label: contact.label, href: contact.href, note: 'A question that does not fit a form.' };

export interface Ladder {
  readonly primary?: LadderCta | undefined;
  readonly secondary?: LadderCta | undefined;
  readonly utility?: LadderCta | undefined;
}

const first = (candidates: readonly LadderCta[], isLive: IsLive): LadderCta | undefined => candidates.find((c) => isLive(c.href));

/**
 * The mid-body action of an article: the timeline brief, else its fallback, else nothing (SALES.md 6.2, "Articles").
 */
export function midBody(isLive: IsLive): LadderCta | undefined {
  return first([TIMELINE_BRIEF, HOW_LONG], isLive);
}

/**
 * The end of an article, brief or reference page: "Start a readiness review", then the timeline brief or its fallback (or how WE
 * works when neither exists), then "Talk to WE". Each rung only when its route is live; a rung never repeats another.
 */
export function endLadder(isLive: IsLive): Ladder {
  const primary = first([READINESS_REVIEW], isLive);
  const secondary = first([TIMELINE_BRIEF, HOW_LONG, HOW_WE_WORKS], isLive);
  const utility = first([TALK_TO_WE], isLive);
  return {
    ...(primary !== undefined ? { primary } : {}),
    ...(secondary !== undefined ? { secondary } : {}),
    ...(utility !== undefined ? { utility } : {}),
  };
}

/** The hero actions of a WP-56 hub: the readiness review first, then the hub's own secondary action when its route is live. */
export function hubActions(isLive: IsLive, secondary?: LadderCta): { primary?: LadderCta; secondary?: LadderCta } {
  const primary = first([READINESS_REVIEW], isLive);
  const second = secondary !== undefined && isLive(secondary.href) && secondary.href !== primary?.href ? secondary : undefined;
  return { ...(primary !== undefined ? { primary } : {}), ...(second !== undefined ? { secondary: second } : {}) };
}
