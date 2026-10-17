/**
 * The words of the investor journey (WP-64, issue #44). Pure data with no Astro imports, so unit tests can load it. Every sentence here is
 * mapped in .astro-magazine/sources/wp-64.json (tests/unit/wp-64/ledger.test.ts fails on a sentence with no mapping) and runs through the
 * claims denylist.
 *
 * WE has no published portfolio (D-21, W8-17). The honest invitation is therefore a process: how an investor asks, how a founder consents,
 * what an investor can inspect now and what WE cannot promise (claim C-25). Nothing here names a company, a person, a number or a date.
 *
 * The add-on is not named in this file. A file that names it must carry the verbatim disclaimer (tests/unit/wp-18/copy.test.ts), so the
 * pages that name it say so in their own content files or in faq.ts, next to the disclaimer.
 */
import type { HeroCta } from '../hero/types.ts';

/** The funding sentence of claim C-05, verbatim. */
export const FUNDING_SENTENCE = 'WE makes no promise of funding.';

/** The one fixed sentence the showcase shows while no consented record exists (W8-17). */
export const SHOWCASE_EMPTY = "No company is listed yet. WE lists a company here only with its founder's written consent.";

/** The hero action on every investor page that is not the form itself. The interest form is the conversion step. */
export const ASK_TO_MEET: HeroCta = { label: 'Ask to meet a company', href: '/investors/interest/' };

/** The journey pages, in reading order. A page links to a sibling only when that sibling is live in the build. */
export interface JourneyLink {
  readonly title: string;
  readonly href: string;
  readonly text: string;
}

export const JOURNEY_LINKS: readonly JourneyLink[] = [
  { title: 'Meet the startups', href: '/investors/meet-startups/', text: 'How an investor asks, and how a founder decides.' },
  { title: 'What you can see', href: '/investors/what-you-can-see/', text: 'What is open now, and what appears only with consent.' },
  { title: 'Readiness criteria', href: '/investors/readiness-criteria/', text: 'The evidence WE expects before it curates anything.' },
  { title: 'Showcase format', href: '/investors/showcase-format/', text: 'The fields a company page can show, and the consent behind each.' },
  { title: 'Investor FAQ', href: '/investors/faq/', text: 'Short answers to the questions investors ask first.' },
];

/** Aside column of the interest form and the thanks page: open pages an investor can read before anyone replies. */
export const OPEN_NOW_LINKS: readonly JourneyLink[] = [
  { title: 'What you can see', href: '/investors/what-you-can-see/', text: 'What is open now.' },
  { title: 'Showcase format', href: '/investors/showcase-format/', text: 'The fields a company page can show.' },
  { title: 'Investor FAQ', href: '/investors/faq/', text: 'Short answers.' },
  { title: 'Readiness criteria', href: '/investors/readiness-criteria/', text: 'The evidence WE expects.' },
];

/** The guides behind the materials table. Each is a launched route; the hub still links through the liveness check. */
export const MATERIAL_LINKS: readonly { readonly title: string; readonly href: string }[] = [
  { title: 'Readiness checklist', href: '/fundability/investor-readiness-checklist/' },
  { title: 'Seed data room', href: '/fundability/data-room/' },
  { title: 'Investor updates', href: '/fundability/investor-updates/' },
  { title: 'SAFEs in plain language', href: '/fundability/safe-explained/' },
];

/** The steps of the process, one sentence of body each. The hub and the meet-startups page share them. */
export const PROCESS_STEPS: readonly { readonly title: string; readonly body: string }[] = [
  { title: 'You ask', body: 'Send the interest form and say which sectors and stages you want to see.' },
  { title: 'WE asks the founder', body: 'WE asks a founder whether to take part. The founder may say no.' },
  { title: 'The founder consents in writing', body: 'WE keeps the consent as a written record that says what the founder agrees to share.' },
  { title: 'You see what the founder allows', body: 'WE shares only what the founder agreed to share.' },
];

export const HUB = {
  lead: 'Ask to meet a company WE incubates. WE asks the founder first, and the founder decides.',
  notOfferTitle: 'Not an offer of securities',
  notOffer:
    'Nothing on this site is an offer to sell, or a solicitation of an offer to buy, any security. WE does not offer securities through this site or in any other way described on it.',
  companiesHeading: 'The companies',
  processHeading: 'How an investor meets a company',
  moreHeading: 'Read before you ask',
  materialsHeading: 'The materials',
  materialsCaption: 'Materials WE helps a founder prepare',
  materialsColumns: ['Material', 'What it is'],
  materials: [
    ['A readiness checklist', 'A list of the evidence an investor commonly asks for, so a founder can see the gaps.'],
    ['A seed data room', 'A guide to organizing and keeping current the documents an investor reads.'],
    ['Investor updates', 'A consistent shape for the regular update a founder sends to people who have backed the company.'],
    ['Plain explanations', 'Generic, sourced explanations of terms such as SAFEs. They describe the instrument and do not describe any deal.'],
  ] as const,
  limitsTitle: "The limits of WE's role",
  limits: [
    'WE does not offer, sell or place securities, and takes no part in any financing.',
    'WE does not negotiate terms, advise on securities or handle funds.',
    'WE does not advise investors or recommend any company as an investment, and an introduction is not an endorsement.',
    'WE does not verify a company’s statements. They remain that company’s own.',
    'WE does not promise or predict a meeting, a reply or funding for any company.',
  ],
  diligenceHeading: 'Your diligence stays yours',
  diligence:
    'Any company that shows you materials prepared with WE’s help is making its own case. You decide whether to reply, and you do your own diligence.',
} as const;

export const MEET = {
  lead: 'How an investor asks to meet a company WE incubates, and how the founder decides.',
  processHeading: 'How it works',
  limitsHeading: 'What WE cannot promise',
  limits: [
    'WE cannot promise a meeting, a reply or funding.',
    'WE names no company until a written record exists.',
    'WE does not advise investors or recommend any company as an investment, and an introduction is not an endorsement.',
  ],
  askHeading: 'Ready to ask',
  askText: 'The interest form takes your name and email address. The rest is optional.',
} as const;

export const SEE = {
  lead: 'What is open now, and what appears only with a founder’s consent.',
  openHeading: 'Open now',
  openCaption: 'Pages an investor can read today',
  openColumns: ['Page', 'What it is'],
  consentHeading: 'Shown only with consent',
  consentLead: 'A company appears only when its founder has agreed in writing. The written record names each permission.',
  scopeCaption: 'The permissions a founder can give',
  scopeColumns: ['Permission', 'What it lets WE show'],
  limitsHeading: 'What WE cannot show',
  limits: [
    'WE cannot show a company that has not agreed.',
    'WE does not verify a company’s statements. They remain that company’s own.',
  ],
  companiesHeading: 'Companies listed now',
} as const;

/** The four things a founder can permit. They are the consent scopes of the portfolio schema (docs/wave8-contracts.md, section 7). */
export const CONSENT_SCOPES: readonly { readonly scope: 'name' | 'description' | 'website' | 'investor-introductions'; readonly label: string; readonly text: string }[] = [
  { scope: 'name', label: 'Name', text: 'The company’s name appears on the page.' },
  { scope: 'description', label: 'Description', text: 'A one-line description and the company’s stage appear on the page.' },
  { scope: 'website', label: 'Website', text: 'A link to the company’s own site appears on the page.' },
  { scope: 'investor-introductions', label: 'Meeting investors', text: 'The founder agrees to meet investors who ask.' },
];

export const STAGE_LABELS: Readonly<Record<'idea' | 'validating' | 'building' | 'launched', string>> = {
  idea: 'Idea',
  validating: 'Validating',
  building: 'Building',
  launched: 'Launched',
};

export const CRITERIA = {
  lead: 'The evidence WE expects before it curates any introduction, and a self-check a founder can run first.',
  criteriaHeading: 'The criteria',
  criteriaCaption: 'Readiness criteria, from the work in Service Line F',
  criteriaColumns: ['From line F', 'What must be in place'],
  selfCheckHeading: 'Run the self-check first',
  selfCheck:
    'The self-check lists twelve statements. Tick the ones that are true today. It does not score you, and nothing you tick is stored or sent anywhere.',
  selfCheckLink: 'Open the self-check',
  statementsHeading: 'The twelve statements',
  limitsHeading: 'What the criteria do not do',
  limits: [
    'Meeting the criteria does not mean an introduction will be made.',
    'WE judges whether the criteria are met.',
    'WE cannot promise a meeting, a reply or funding.',
  ],
} as const;

export const FORMAT = {
  lead: 'The fields a company page can show, and the written consent behind each one.',
  fieldsHeading: 'The fields',
  fieldsCaption: 'Fields of a company page and the permission each needs',
  fieldsColumns: ['Field', 'What it shows', 'Needs the permission'],
  fields: [
    ['Name', 'The company’s name.', 'Name'],
    ['One line', 'One sentence about the company, agreed with the founder.', 'Description'],
    ['Stage', 'Idea, validating, building or launched.', 'Description'],
    ['Website', 'A link to the company’s own site.', 'Website'],
  ] as const,
  rules: [
    'A page shows a field only when the founder has agreed to it.',
    'A page with no agreed field is not listed.',
  ],
  rulesHeading: 'The rules of the format',
  neverHeading: 'What the format leaves out',
  never: 'The format has no field for logos, metrics, founder names or amounts.',
  emptyHeading: 'Companies listed now',
} as const;

/** What follows the form. The form page and the thanks page say the same thing, in one place. */
const NEXT_STEPS: readonly { readonly title: string; readonly body: string }[] = [
  { title: 'WE reads what you sent', body: 'WE uses the details you sent to answer your request, as the privacy notice describes.' },
  { title: 'WE asks a founder', body: 'WE asks a founder whether to take part. The founder may say no.' },
  { title: 'The founder decides', body: 'WE shares only what the founder agreed to share. WE cannot promise a meeting or a reply.' },
];

export const INTEREST = {
  lead: 'Tell WE what you look for. WE asks the founder before it shares anything.',
  start: 'Start the form',
  nextHeading: 'What happens next',
  next: NEXT_STEPS,
  asideHeading: 'Before you send',
  asideLinksHeading: 'Read first',
  asideNote: 'The form asks for no accreditation status, no amounts and no fund size.',
} as const;

export const THANKS = {
  lead: 'Your interest is with WE.',
  nextHeading: 'What happens next',
  next: NEXT_STEPS,
  asideHeading: 'While you wait',
} as const;

export const FAQ_LEAD = 'Short answers, including what WE cannot promise.';
export const FAQ_HEADING = 'Questions investors ask';
