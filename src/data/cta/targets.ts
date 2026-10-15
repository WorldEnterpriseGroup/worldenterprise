import { BRIEFS } from '../families.ts';
import type { CtaVariant, TargetKey } from './types.ts';

/**
 * What each CTA target says and where it goes (docs/wave8-contracts.md, section 6.1 and 6.2). The words follow the policy: a CTA names
 * what happens next and never promises an outcome, and there is no scarcity, urgency, count or social proof. WP-62 refines the copy here.
 */

/** The wording of a target used as a band: a heading, a body and an optional honest qualifier. */
export interface TargetBand {
  readonly heading: string;
  readonly body: string;
  readonly note?: string;
}

export interface Target {
  readonly href: string;
  /** The button label, whether the target is primary or secondary. */
  readonly label: string;
  readonly variant: CtaVariant;
  /** Absent for a target that only ever serves as a secondary link. */
  readonly band?: TargetBand;
}

/** The brief ids whose band carries the funding qualifier: the brief is about money, and WE promises none. */
const FUNDING_BRIEFS: readonly string[] = ['funding-paths', 'pre-seed-evidence-pack'];

export const NO_FUNDING_NOTE = 'WE makes no promise of funding.';

const FIXED: Readonly<Record<'apply' | 'briefs' | 'journey' | 'contact' | 'tools' | 'investor-interest' | 'partner-enquiry', Target>> = {
  apply: {
    href: '/apply/',
    label: 'Start a readiness review',
    variant: 'apply',
    band: {
      heading: 'Start a readiness review',
      body: 'The application form asks about your company, your team and what you are building.',
    },
  },
  briefs: {
    href: '/briefs/',
    label: 'Browse the briefs',
    variant: 'brief',
    band: {
      heading: 'Read an abstract, then request the brief',
      body: 'Each brief has an open abstract. The full brief arrives by email after you ask for it.',
    },
  },
  journey: {
    href: '/journey/after-you-apply/',
    label: 'See what follows an application',
    variant: 'apply',
    band: {
      heading: 'See what follows an application',
      body: 'Read the steps after you apply, in the order they come.',
    },
  },
  contact: {
    href: '/contact/',
    label: 'Talk to WE',
    variant: 'contact',
    band: {
      heading: 'Talk to WE',
      body: 'Send a message through the contact form and say what you want to talk about.',
    },
  },
  tools: {
    href: '/tools/',
    label: 'Open the tools',
    variant: 'tools',
    band: {
      heading: 'Work through it with a tool',
      body: 'Calculators and planners for the questions founders ask first.',
    },
  },
  'investor-interest': {
    href: '/investors/interest/',
    label: 'Register investor interest',
    variant: 'investor-interest',
    band: {
      heading: 'Tell WE what you look for',
      body: 'Share the stages and sectors you follow. This is an expression of interest, not a commitment from either side.',
    },
  },
  'partner-enquiry': {
    href: '/network/partners/enquire/',
    label: 'Refer a founder',
    variant: 'partner-enquiry',
    band: {
      heading: 'Ask about partnering with WE',
      body: 'Describe your organization and what you offer to early-stage companies. This is an enquiry, not a commitment from either side.',
    },
  },
};

/** The labels of the plain ledger paths that a surface may offer as its secondary link. */
const PATH_LABELS: Readonly<Record<string, string>> = {
  '/industries/': 'Browse the industries',
  '/insights/topic/sectors/': 'Read the sector articles',
  '/program/how-it-works/': 'See how the program works',
  '/journey/first-months/': 'Read about the first months',
  '/journey/onboarding-checklist/': 'Open the onboarding checklist',
};

/** The registered brief ids and their labels, from the family registry. */
function briefTarget(id: string): Target | undefined {
  const entry = BRIEFS.entries.find((e) => e.slug === id);
  if (entry === undefined) return undefined;
  const funding = FUNDING_BRIEFS.includes(id);
  return {
    href: entry.path,
    label: 'Request the brief',
    variant: 'brief',
    band: {
      heading: `Request the brief: ${entry.label}`,
      body: 'Read the open abstract first. The full brief arrives by email after you ask for it.',
      ...(funding ? { note: NO_FUNDING_NOTE } : {}),
    },
  };
}

/** The target a key names, or undefined for a key that names nothing (an unknown brief id, an unlisted path). */
export function targetFor(key: TargetKey): Target | undefined {
  if (key.startsWith('brief:')) return briefTarget(key.slice('brief:'.length));
  if (key.startsWith('path:')) {
    const path = key.slice('path:'.length);
    const label = PATH_LABELS[path];
    return label === undefined ? undefined : { href: path, label, variant: 'apply' };
  }
  return FIXED[key as keyof typeof FIXED];
}

/** The key a frontmatter `cta` override names. */
export function keyForVariant(variant: CtaVariant, briefId?: string): TargetKey {
  switch (variant) {
    case 'apply':
      return 'apply';
    case 'brief':
      return briefId === undefined ? 'briefs' : `brief:${briefId}`;
    case 'investor-interest':
      return 'investor-interest';
    case 'partner-enquiry':
      return 'partner-enquiry';
    case 'tools':
      return 'tools';
    case 'contact':
      return 'contact';
  }
}

/** Every key the default map can name, for the tests. */
export function allKeys(): readonly TargetKey[] {
  return [
    ...(Object.keys(FIXED) as TargetKey[]),
    ...BRIEFS.entries.map((e): TargetKey => `brief:${e.slug}`),
    ...Object.keys(PATH_LABELS).map((p): TargetKey => `path:${p}`),
  ];
}
