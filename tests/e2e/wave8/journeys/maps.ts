// WP-90: the four customer-journey maps of docs/wave8-contracts.md section 11, as data.
//
// A map is one ordered walk from an entry page to the end of the journey. Each step names the page the visitor is on, the stage it serves
// (section 11.1), the one link the visitor clicks next (its role is always `link`, its accessible name is the visible text, its destination is
// the next step's page) or, on a form page, the submission. Links are found by role and visible text and never by class or position, so the
// redesign only edits this file.
//
// This module is plain TypeScript with no Playwright import: the specs walk the maps in a browser, and tests/unit/wp-90/maps.test.ts checks
// them against the route ledger and the CTA and navigation data without one.

export type Audience = 'startup' | 'investor' | 'partner' | 'corporate';
export const AUDIENCE_IDS: readonly Audience[] = ['startup', 'investor', 'partner', 'corporate'];

export type Stage = 'awareness' | 'consideration' | 'conversion' | 'onboarding' | 'advocacy';
export const STAGE_ORDER: readonly Stage[] = ['awareness', 'consideration', 'conversion', 'onboarding', 'advocacy'];

/** Where the name of a link comes from: the CTA and navigation data (checked against it by the unit test) or the copy of the page itself. */
export type LinkSource = 'cta-data' | 'page-copy';

/** A link the visitor can see. `name` is its visible text; it is matched exactly unless `exact` is false. */
export interface LinkRef {
  readonly name: string;
  readonly exact?: boolean;
  /** The path the link leads to. */
  readonly href: string;
  readonly source: LinkSource;
}

/** A link that the page's primary or secondary action offers (contracts section 6.2), asserted present with its href and not clicked. */
export interface ActionRef extends LinkRef {
  readonly kind: 'primary' | 'secondary';
}

/** Click a link. `kind` says what the link is on its page; `forward` is a plain link in the page content (a thanks page, a form page). */
export interface ClickTake extends LinkRef {
  readonly kind: 'primary' | 'secondary' | 'forward';
}

export type FormKind = 'apply' | 'contact' | 'brief-request' | 'investor-interest' | 'partner-enquiry';

/** Send the form of this page. With no endpoint the journey ends at the disabled form; with a mocked endpoint it goes on to `thanks`. */
export interface SubmitTake {
  readonly kind: 'submit';
  readonly form: FormKind;
  readonly thanks: string;
}

export type Take = ClickTake | SubmitTake;

export interface Step {
  readonly page: string;
  readonly stage: Stage;
  /** The primary and secondary actions of the page that the visitor does not take here, asserted present with their href. */
  readonly also?: readonly ActionRef[];
  /** What the visitor does next. A terminal step has none. */
  readonly take?: Take;
}

export interface JourneyMap {
  readonly audience: Audience;
  readonly title: string;
  /** The door on the home page that leads to the entry page (the audience strip, WP-62). Absent when the entry page is the home page. */
  readonly homeDoor?: LinkRef;
  readonly steps: readonly Step[];
}

/** Contract 11.3 rule 2: a conversion page is reachable from `/` in at most this many navigations. */
export const MAX_CLICK_DEPTH = 3;

/** The forms that offer a mailto fallback (contracts section 3.4). No other form may. */
export const MAILTO_FORMS: readonly FormKind[] = ['apply', 'contact'];

/** What a visitor types, per form. The keys are the control names of src/components/forms. */
export interface FormAnswers {
  readonly text: Readonly<Record<string, string>>;
  readonly select: Readonly<Record<string, string>>;
}

export const FORM_ANSWERS: Readonly<Record<FormKind, FormAnswers>> = {
  apply: { text: { name: 'Test Founder', email: 'founder@example.org' }, select: { stage: 'idea' } },
  contact: { text: { name: 'Test Founder', email: 'founder@example.org', message: 'A short message for the team.' }, select: { audience: 'startup', topic: 'general' } },
  'brief-request': { text: { name: 'Test Founder', email: 'founder@example.org' }, select: {} },
  'investor-interest': { text: { name: 'Test Investor', email: 'investor@example.org', focus: 'Early-stage SaaS.' }, select: {} },
  'partner-enquiry': {
    text: {
      name: 'Test Partner',
      email: 'partner@example.org',
      company: 'Example Legal LLP',
      companyUrl: 'https://example.org',
      offer: 'Fixed-fee company formation for founders, with the terms written on a page.',
    },
    select: { partnerCategory: 'legal' },
  },
};

const APPLY = 'Start a readiness review';

export const MAPS: readonly JourneyMap[] = [
  {
    audience: 'startup',
    title: 'A founder who wants to know if WE fits',
    steps: [
      {
        page: '/',
        stage: 'awareness',
        also: [{ kind: 'primary', name: APPLY, href: '/apply/', source: 'cta-data' }],
        take: { kind: 'secondary', name: 'See how long it really takes', href: '/why-it-takes-time/', source: 'cta-data' },
      },
      {
        page: '/why-it-takes-time/',
        stage: 'awareness',
        also: [{ kind: 'primary', name: APPLY, href: '/apply/', source: 'cta-data' }],
        take: { kind: 'secondary', name: 'See how WE works', href: '/how-we-work/', source: 'cta-data' },
      },
      {
        page: '/how-we-work/',
        stage: 'consideration',
        also: [{ kind: 'secondary', name: 'Talk to WE', href: '/contact/', source: 'cta-data' }],
        take: { kind: 'primary', name: APPLY, href: '/apply/', source: 'cta-data' },
      },
      { page: '/apply/', stage: 'conversion', take: { kind: 'submit', form: 'apply', thanks: '/apply/thanks/' } },
      {
        page: '/apply/thanks/',
        stage: 'onboarding',
        take: { kind: 'forward', name: 'Playbook: validate the problem', href: '/playbooks/validate-the-problem/', source: 'page-copy' },
      },
      { page: '/playbooks/validate-the-problem/', stage: 'onboarding' },
    ],
  },
  {
    audience: 'investor',
    title: 'An investor who wants to meet startups',
    homeDoor: { name: 'For investors', exact: false, href: '/investors/', source: 'cta-data' },
    steps: [
      {
        page: '/investors/',
        stage: 'awareness',
        also: [{ kind: 'primary', name: 'Ask to meet a company', href: '/investors/interest/', source: 'cta-data' }],
        take: { kind: 'secondary', name: 'Meet the startups', href: '/investors/meet-startups/', source: 'cta-data' },
      },
      {
        page: '/investors/meet-startups/',
        stage: 'consideration',
        take: { kind: 'primary', name: 'Ask to meet a company', href: '/investors/interest/', source: 'cta-data' },
      },
      { page: '/investors/interest/', stage: 'conversion', take: { kind: 'submit', form: 'investor-interest', thanks: '/investors/interest/thanks/' } },
      {
        page: '/investors/interest/thanks/',
        stage: 'onboarding',
        take: { kind: 'forward', name: 'What you can see', href: '/investors/what-you-can-see/', source: 'cta-data' },
      },
      { page: '/investors/what-you-can-see/', stage: 'onboarding' },
    ],
  },
  {
    audience: 'partner',
    title: 'An organization that wants to partner with WE',
    homeDoor: { name: 'For partners', exact: false, href: '/network/partners/', source: 'cta-data' },
    steps: [
      {
        page: '/network/partners/',
        stage: 'awareness',
        also: [{ kind: 'primary', name: 'Send an enquiry', href: '/network/partners/enquire/', source: 'cta-data' }],
        take: { kind: 'secondary', name: 'See the categories', href: '/network/partners/categories/', source: 'cta-data' },
      },
      {
        page: '/network/partners/categories/',
        stage: 'consideration',
        also: [{ kind: 'secondary', name: 'How enquiries work', href: '/network/partners/how-it-works/', source: 'cta-data' }],
        take: { kind: 'primary', name: 'Send an enquiry', href: '/network/partners/enquire/', source: 'cta-data' },
      },
      { page: '/network/partners/enquire/', stage: 'conversion', take: { kind: 'submit', form: 'partner-enquiry', thanks: '/network/partners/enquire/thanks/' } },
      {
        page: '/network/partners/enquire/thanks/',
        stage: 'onboarding',
        take: { kind: 'forward', name: 'Partner FAQ', href: '/network/partners/faq/', source: 'cta-data' },
      },
      { page: '/network/partners/faq/', stage: 'onboarding' },
    ],
  },
  {
    audience: 'corporate',
    title: 'A corporate team that wants to build a company from inside',
    homeDoor: { name: 'For corporate teams', exact: false, href: '/founders/corporate-innovators/', source: 'cta-data' },
    steps: [
      {
        page: '/founders/corporate-innovators/',
        stage: 'awareness',
        also: [{ kind: 'primary', name: APPLY, href: '/apply/', source: 'cta-data' }],
        take: { kind: 'secondary', name: 'Request the brief: Corporate spinouts', href: '/briefs/corporate-spinouts/', source: 'cta-data' },
      },
      { page: '/briefs/corporate-spinouts/', stage: 'conversion', take: { kind: 'submit', form: 'brief-request', thanks: '/briefs/thanks/' } },
      {
        page: '/briefs/thanks/',
        stage: 'onboarding',
        take: { kind: 'forward', name: 'What happens after you apply', href: '/journey/after-you-apply/', source: 'cta-data' },
      },
      { page: '/journey/after-you-apply/', stage: 'onboarding' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Walking a map: which steps run and which are skipped.

export interface SkippedStep {
  readonly page: string;
  readonly reason: string;
}

export interface WalkPlan {
  /** The steps the suite walks: every step up to the first one whose page is not live. */
  readonly steps: readonly Step[];
  /** The steps it skips, each with the reason, in map order. */
  readonly skipped: readonly SkippedStep[];
}

/**
 * Contracts 11.3 rule 5: a map step whose route is not launched (a cut page) is skipped, not faked, and listed in the output. A walk cannot
 * go through a page that does not exist, so the first such step ends the walk and every step after it is skipped too. `reasonFor` says why
 * a path is not live (cut with `launch: false`, or launched but not built); it returns undefined for a live path.
 */
export function planWalk(map: JourneyMap, reasonFor: (path: string) => string | undefined): WalkPlan {
  const steps: Step[] = [];
  const skipped: SkippedStep[] = [];
  let cut: string | undefined;
  for (const step of map.steps) {
    const own = reasonFor(step.page);
    if (cut === undefined && own === undefined) {
      steps.push(step);
      continue;
    }
    cut ??= own;
    skipped.push({ page: step.page, reason: own ?? `an earlier step is not live (${cut})` });
  }
  return { steps, skipped };
}

/** The number of link clicks from the entry page to the first conversion page, or undefined when the map has none. */
export function clicksToConversion(map: JourneyMap): number | undefined {
  let clicks = 0;
  for (const step of map.steps) {
    if (step.stage === 'conversion') return clicks;
    if (step.take !== undefined && step.take.kind !== 'submit') clicks += 1;
  }
  return undefined;
}

/** The navigations from `/` to the first conversion page: the home door (if the map has one) plus the clicks within the map. */
export function depthFromHome(map: JourneyMap): number | undefined {
  const within = clicksToConversion(map);
  return within === undefined ? undefined : within + (map.homeDoor !== undefined ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Validating a map against the site's data.

export interface MapContext {
  /** Whether a path is a launched route of the ledger. */
  readonly isLaunched: (path: string) => boolean;
  /** `${name}\n${href}` of every label and target the CTA and navigation data can produce (see pairKey). */
  readonly ctaPairs: ReadonlySet<string>;
}

export const pairKey = (name: string, href: string): string => `${name}\n${href}`;

/** The problems of a map; an empty list means it is sound. Each message starts with a stable code. */
export function validateMap(map: JourneyMap, context: MapContext): string[] {
  const problems: string[] = [];
  const at = (index: number, text: string): string => `${map.audience} step ${index + 1} (${map.steps[index]?.page ?? '?'}): ${text}`;
  const checkLink = (index: number, link: LinkRef, what: string): void => {
    if (!context.isLaunched(link.href)) problems.push(at(index, `dead-link: ${what} "${link.name}" leads to ${link.href}, which is not a launched route`));
    if (link.source === 'cta-data' && !context.ctaPairs.has(pairKey(link.name, link.href))) {
      problems.push(at(index, `unknown-cta: no CTA or navigation data offers "${link.name}" to ${link.href}`));
    }
  };

  if (map.steps.length === 0) return [`${map.audience}: empty-map: a map needs steps`];
  let previous: Stage | undefined;
  map.steps.forEach((step, index) => {
    if (!context.isLaunched(step.page)) problems.push(at(index, `dead-page: ${step.page} is not a launched route`));
    if (previous !== undefined && STAGE_ORDER.indexOf(step.stage) < STAGE_ORDER.indexOf(previous)) {
      problems.push(at(index, `stage-order: ${step.stage} comes after ${previous}`));
    }
    previous = step.stage;
    for (const action of step.also ?? []) checkLink(index, action, `the ${action.kind} action`);

    const next = map.steps[index + 1];
    const take = step.take;
    if (take === undefined) {
      if (next !== undefined) problems.push(at(index, 'dead-end: the step has no link to the next page'));
      return;
    }
    if (take.kind === 'submit') {
      if (next?.page !== take.thanks) problems.push(at(index, `broken-chain: the form goes to ${take.thanks} but the next step is ${next?.page ?? 'missing'}`));
      if (!context.isLaunched(take.thanks)) problems.push(at(index, `dead-link: the thanks page ${take.thanks} is not a launched route`));
      if (step.stage !== 'conversion') problems.push(at(index, 'stage-order: a form step must be in the conversion stage'));
      return;
    }
    checkLink(index, take, `the ${take.kind} link`);
    if (next === undefined) problems.push(at(index, `dead-end: the link to ${take.href} has no step after it`));
    else if (next.page !== take.href) problems.push(at(index, `broken-chain: the link goes to ${take.href} but the next step is ${next.page}`));
  });

  const last = map.steps[map.steps.length - 1];
  if (last?.take !== undefined) problems.push(`${map.audience}: open-end: the last step must be terminal`);
  if (last !== undefined && last.stage !== 'onboarding' && last.stage !== 'advocacy') problems.push(`${map.audience}: open-end: the journey must end after the conversion`);
  if (!map.steps.some((s) => s.take?.kind === 'submit')) problems.push(`${map.audience}: no-conversion: the map never reaches a form`);
  const depth = depthFromHome(map);
  if (depth !== undefined && depth > MAX_CLICK_DEPTH) problems.push(`${map.audience}: click-depth: the form is ${depth} navigations from the home page, the limit is ${MAX_CLICK_DEPTH}`);
  if (map.homeDoor !== undefined && map.homeDoor.href !== map.steps[0]?.page) problems.push(`${map.audience}: broken-chain: the home door leads to ${map.homeDoor.href}, not to the entry page`);
  if (map.homeDoor !== undefined && map.homeDoor.source === 'cta-data' && !context.ctaPairs.has(pairKey(map.homeDoor.name, map.homeDoor.href))) {
    problems.push(`${map.audience}: unknown-cta: the audience strip has no door "${map.homeDoor.name}" to ${map.homeDoor.href}`);
  }
  return problems;
}
