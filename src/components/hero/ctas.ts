import type { HeroCta } from './types.ts';

/**
 * Hero actions that more than one layout offers. The labels match the buttons already used in the header and in the
 * call-to-action bands, so a visitor sees one name for one action. Every path is a launched ledger route.
 */
export const APPLY: HeroCta = { label: 'Apply', href: '/apply/' };
export const TALK_TO_WE: HeroCta = { label: 'Talk to WE', href: '/contact/' };
export const COMPOSE_TEAM: HeroCta = { label: 'Compose your team', href: '/tools/team-composer/' };
export const HOW_IT_WORKS: HeroCta = { label: 'See how it works', href: '/program/how-it-works/' };

/** An in-page action: the href is a fragment, so the hero links to a section further down the same page. */
export function jumpTo(label: string, fragment: string): HeroCta {
  return { label, href: fragment.startsWith('#') ? fragment : `#${fragment}` };
}
