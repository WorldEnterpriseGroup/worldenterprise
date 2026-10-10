import { APPLY, TALK_TO_WE } from '../hero/ctas.ts';
import type { HeroCta } from '../hero/types.ts';

/**
 * Hero actions per family, from the default map of contracts section 6.2. The templates set the hero's primary and secondary action
 * and nothing else: the end-of-page band belongs to the layouts (`cta-end`). Every candidate is checked against the live routes, so
 * a cut or not-yet-built target drops out and a hero never links to a dead page ("dead targets fail closed", section 6.1).
 */
export interface HeroActions {
  readonly primary?: HeroCta;
  readonly secondary?: HeroCta;
}

export type IsLive = (path: string) => boolean;

/** The override a page may set in its frontmatter (`cta`): a variant and, for a brief, its id. */
export interface CtaOverride {
  readonly variant: 'apply' | 'brief' | 'investor-interest' | 'partner-enquiry' | 'tools' | 'contact';
  readonly briefId?: string | undefined;
}

export interface BriefRef {
  readonly slug: string;
  readonly path: string;
  readonly label: string;
}

const BRIEF_HUB: HeroCta = { label: 'Browse the briefs', href: '/briefs/' };
const TOOLS_HUB: HeroCta = { label: 'Open the tools', href: '/tools/' };
const HOW_IT_WORKS_STEP: HeroCta = { label: 'See how it works', href: '/program/how-it-works/' };
const SECTORS: HeroCta = { label: 'Read the sector articles', href: '/insights/topic/sectors/' };

/** The first candidate whose target is live, or undefined. */
export function firstLive(candidates: readonly (HeroCta | undefined)[], isLive: IsLive): HeroCta | undefined {
  return candidates.find((candidate): candidate is HeroCta => candidate !== undefined && isLive(candidate.href));
}

function build(primary: HeroCta | undefined, secondary: HeroCta | undefined): HeroActions {
  // A secondary equal to the primary is dropped (section 6.1).
  const second = secondary !== undefined && secondary.href !== primary?.href ? secondary : undefined;
  return { ...(primary !== undefined ? { primary } : {}), ...(second !== undefined ? { secondary: second } : {}) };
}

/** Segment pages: apply, then the segment's brief or tool by frontmatter `cta`, else the brief hub. */
export function segmentActions(cta: CtaOverride | undefined, briefs: readonly BriefRef[], isLive: IsLive): HeroActions {
  const primary = firstLive([APPLY], isLive);
  const brief = cta?.variant === 'brief' && cta.briefId !== undefined ? briefs.find((b) => b.slug === cta.briefId) : undefined;
  const preferred: HeroCta | undefined =
    brief !== undefined
      ? { label: `Request the brief: ${brief.label}`, href: brief.path }
      : cta?.variant === 'tools'
        ? TOOLS_HUB
        : cta?.variant === 'contact'
          ? TALK_TO_WE
          : undefined;
  return build(primary, firstLive([preferred, BRIEF_HUB], isLive));
}

/** Industry hub and pages: apply, then the sector articles, then the brief hub. */
export function industryActions(isLive: IsLive): HeroActions {
  return build(firstLive([APPLY], isLive), firstLive([SECTORS, BRIEF_HUB], isLive));
}

/** Comparison hub and pages: apply, then how the program works. */
export function compareActions(isLive: IsLive): HeroActions {
  return build(firstLive([APPLY], isLive), firstLive([HOW_IT_WORKS_STEP], isLive));
}

const JOURNEY_NEXT: Readonly<Record<string, HeroCta>> = {
  index: { label: 'See what happens after you apply', href: '/journey/after-you-apply/' },
  'after-you-apply': { label: 'Read the first months', href: '/journey/first-months/' },
  'first-months': { label: 'Open the onboarding checklist', href: '/journey/onboarding-checklist/' },
  'onboarding-checklist': TOOLS_HUB,
};

/** Journey hub and pages (6.2): apply, then the next page in order; the last page points at the tools hub. */
export function journeyActions(slug: string, isLive: IsLive): HeroActions {
  return build(firstLive([APPLY], isLive), firstLive([JOURNEY_NEXT[slug]], isLive));
}
