import type { JourneyMap } from '../../e2e/wave8/journeys/maps.ts';

/**
 * Deliberately broken maps. Each one breaks one rule of validateMap, and tests/unit/wp-90/maps.test.ts proves the validator rejects it
 * with that code. They are never walked in a browser.
 */
const APPLY_PAIR = { name: 'Start a readiness review', href: '/apply/', source: 'cta-data' } as const;

/** The forward link of the first step leads to a page that was never launched. */
export const DEAD_LINK: JourneyMap = {
  audience: 'startup',
  title: 'fixture: a link to a page that does not exist',
  steps: [
    { page: '/', stage: 'awareness', take: { kind: 'secondary', name: 'See the vault', href: '/vault-that-does-not-exist/', source: 'page-copy' } },
    { page: '/vault-that-does-not-exist/', stage: 'awareness' },
  ],
};

/** The forward link was removed: the first step takes no link and the map goes on. */
export const REMOVED_FORWARD_LINK: JourneyMap = {
  audience: 'startup',
  title: 'fixture: a removed forward link',
  steps: [
    { page: '/', stage: 'awareness' },
    { page: '/apply/', stage: 'conversion', take: { kind: 'submit', form: 'apply', thanks: '/apply/thanks/' } },
    { page: '/apply/thanks/', stage: 'onboarding' },
  ],
};

/** A link whose label and target no CTA or navigation data offers. */
export const UNKNOWN_CTA: JourneyMap = {
  audience: 'startup',
  title: 'fixture: a made-up call to action',
  steps: [
    { page: '/', stage: 'awareness', take: { kind: 'primary', name: 'Join the waiting list now', href: '/apply/', source: 'cta-data' } },
    { page: '/apply/', stage: 'conversion', take: { kind: 'submit', form: 'apply', thanks: '/apply/thanks/' } },
    { page: '/apply/thanks/', stage: 'onboarding' },
  ],
};

/** The link goes to one page and the next step is another. */
export const BROKEN_CHAIN: JourneyMap = {
  audience: 'startup',
  title: 'fixture: the next step is not where the link goes',
  steps: [
    { page: '/', stage: 'awareness', take: { kind: 'primary', ...APPLY_PAIR } },
    { page: '/faq/', stage: 'consideration' },
  ],
};

/** The form is four navigations from the home page. */
export const TOO_DEEP: JourneyMap = {
  audience: 'startup',
  title: 'fixture: a conversion page too many clicks from home',
  steps: [
    { page: '/', stage: 'awareness', take: { kind: 'secondary', name: 'See how long it really takes', href: '/why-it-takes-time/', source: 'cta-data' } },
    { page: '/why-it-takes-time/', stage: 'awareness', take: { kind: 'secondary', name: 'See how WE works', href: '/how-we-work/', source: 'cta-data' } },
    { page: '/how-we-work/', stage: 'consideration', take: { kind: 'forward', name: 'Read the FAQ', href: '/faq/', source: 'page-copy' } },
    { page: '/faq/', stage: 'consideration', take: { kind: 'primary', ...APPLY_PAIR } },
    { page: '/apply/', stage: 'conversion', take: { kind: 'submit', form: 'apply', thanks: '/apply/thanks/' } },
    { page: '/apply/thanks/', stage: 'onboarding' },
  ],
};

/** The journey stops on the conversion page. */
export const OPEN_END: JourneyMap = {
  audience: 'startup',
  title: 'fixture: a journey that never gets past the form',
  steps: [
    { page: '/', stage: 'awareness', take: { kind: 'primary', ...APPLY_PAIR } },
    { page: '/apply/', stage: 'conversion' },
  ],
};
