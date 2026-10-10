/**
 * The words of the partner journey (WP-65, docs/wave8-contracts.md sections 0 and 11): the partners hub, the categories, how an enquiry
 * is handled, the FAQ, the enquiry page, the thanks page and the partner part of `/network/`. Pure data with no Astro globals, so a
 * unit test can read it. Every sentence here is mapped in `.astro-magazine/sources/wp-65.json` and `tests/unit/wp-65/copy-ledger.test.ts`
 * fails on one that is not. The posture is an inbound program: it names no company, claims no existing partner and promises no price,
 * saving, meeting, reply or response time (D-21).
 */
import type { PartnerCategory } from '../../data/forms.ts';
import { PARTNER_CATEGORY_LABELS } from '../forms/copy.ts';

/** The six categories the pages describe. The form adds a seventh option, "Something else", which is not a category of its own. */
export type PartnerCategoryId = Exclude<PartnerCategory, 'other'>;

export interface CategoryCopy {
  readonly id: PartnerCategoryId;
  readonly label: string;
  readonly summary: string;
  /** What a good enquiry from this category says. */
  readonly goodEnquiry: readonly string[];
  /** What WE does not do for this category. */
  readonly doesNot: readonly string[];
}

const CATEGORY_BODY: Readonly<Record<PartnerCategoryId, Omit<CategoryCopy, 'id' | 'label'>>> = {
  'tooling-saas': {
    summary: 'Products a SaaS team uses to build, run, sell or support its software.',
    goodEnquiry: [
      'Say what the product does, who it is for and which stage of a company it suits.',
      'Say how a founder gets it and what it costs the founder.',
    ],
    doesNot: ['WE does not say that WE uses or recommends a product.', 'WE does not test or certify a product.'],
  },
  'cloud-credits': {
    summary: 'Programs that give early-stage companies cloud usage credits or similar allowances.',
    goodEnquiry: ['Say who qualifies, how a company applies and when the credits expire.', 'Say what happens when the credits run out.'],
    doesNot: ['WE does not promise that a founder will receive credits.', 'WE does not state an amount of credits.'],
  },
  legal: {
    summary: 'Firms that advise early-stage companies on formation, contracts and regulation.',
    goodEnquiry: ['Say which jurisdictions the firm covers and which matters it takes on.', 'Say how the firm bills a founder.'],
    doesNot: ['WE does not give legal advice.', 'WE does not choose a firm for a founder.'],
  },
  'finance-accounting': {
    summary: 'Firms that keep the books, taxes and financial reporting of young companies in order.',
    goodEnquiry: ['Say which services the firm provides and which size of company it works with.', 'Say how the firm bills a founder.'],
    doesNot: ['WE does not give tax advice.', "WE does not handle a founder's money."],
  },
  delivery: {
    summary: "Teams that deliver engineering, design or operations work alongside a founder's own team.",
    goodEnquiry: ['Say which skills the team covers and how it hands work over.', 'Say how the team is managed and how it bills for its work.'],
    doesNot: [
      'WE steers its own dedicated teams and manages their subcontractors, and an enquiry does not change that.',
      'A delivery partner is a category here, and WE lists none.',
    ],
  },
  ecosystem: {
    summary: 'Communities, events and resource programs that support founders.',
    goodEnquiry: ['Say who the program is for, how a founder joins and what it asks of a member.', 'Say who runs the program.'],
    doesNot: ['WE does not promise a founder a place in any program.', 'WE names no program on this site.'],
  },
};

export const CATEGORY_IDS: readonly PartnerCategoryId[] = ['tooling-saas', 'cloud-credits', 'legal', 'finance-accounting', 'delivery', 'ecosystem'];

export const CATEGORIES: readonly CategoryCopy[] = CATEGORY_IDS.map((id) => ({ id, label: PARTNER_CATEGORY_LABELS[id], ...CATEGORY_BODY[id] }));

/** Sentences more than one page states. One constant each, so the pages cannot drift apart. */
export const NO_PARTNERSHIP = 'An enquiry creates no partnership, no referral arrangement and no commitment on either side.';
export const DECIDES = 'WE reads each enquiry and decides whether to talk further.';
export const NO_NAMES = 'WE names no partner on this site until a written record exists.';
export const NO_RESPONSE_TIME = 'WE does not state a response time on this site.';
export const NO_PROMISES = 'WE does not promise a partner a meeting, a reply, an introduction or a place on this site.';
export const FOUNDER_ASKS_FIRST = 'WE introduces a partner to a founder only when the founder asks for help in that category and agrees to the introduction.';

/** What an enquiry should say. It restates what the form asks for. */
export const ENQUIRY_CONTENTS: readonly string[] = [
  'The name of the organization and its website.',
  'The category that fits what it provides.',
  'What the organization provides to founders.',
  'The terms a founder would see, including who qualifies and what it costs.',
  'Anything a founder should know before asking for an introduction.',
];

export const HREFS = {
  hub: '/network/partners/',
  categories: '/network/partners/categories/',
  howItWorks: '/network/partners/how-it-works/',
  faq: '/network/partners/faq/',
  enquire: '/network/partners/enquire/',
  thanks: '/network/partners/enquire/thanks/',
} as const;

export interface HeroAction {
  readonly label: string;
  readonly href: string;
}

export const ACTIONS = {
  enquire: { label: 'Send an enquiry', href: HREFS.enquire },
  categories: { label: 'See the categories', href: HREFS.categories },
  howItWorks: { label: 'How enquiries work', href: HREFS.howItWorks },
  faq: { label: 'Read the FAQ', href: HREFS.faq },
} as const satisfies Record<string, HeroAction>;

export const HUB = {
  lead: 'Organizations that help founders can tell WE what they offer.',
  categories: {
    heading: 'Who WE wants to hear from',
    intro: 'WE reads enquiries from organizations in six categories.',
    link: 'What a good enquiry says',
    other: 'If none of the six fits, the form has a Something else option.',
  },
  offer: {
    heading: 'What WE can offer a partner',
    intro: 'WE offers three things, and none is promised in advance.',
    items: [
      "A warm introduction to a founder, when that founder asks for help in the partner's category.",
      'Content written together with the partner, when the subject helps founders.',
      'A place in a founder playbook, where the offer fits the stage the playbook covers.',
    ],
  },
  asks: {
    heading: 'What WE asks of a partner',
    items: [
      'Terms are written down before any introduction.',
      'The offer is described accurately, including who qualifies and what a founder pays.',
      'The enquiry says what the organization provides and on what terms.',
    ],
  },
  limits: {
    heading: 'What WE does not do',
    items: [
      'WE does not say on this site that WE uses, endorses or works with any named product.',
      'WE does not promise a price, a saving or any terms on behalf of a partner.',
      NO_PROMISES,
      NO_PARTNERSHIP,
    ],
  },
  more: {
    heading: 'Before you send an enquiry',
    howItWorks: 'How an enquiry is read',
    faq: 'Read the partner FAQ',
  },
  passItOn: {
    heading: 'Pass it on',
    question: 'Know an organization that helps founders?',
    action: 'Share the enquiry form with them.',
  },
  body: ['WE is a digital incubator for SaaS companies.', 'An organization that helps or equips founders may send WE an enquiry.'],
} as const;

export const CATEGORIES_PAGE = {
  lead: 'Six kinds of organization, and what a good enquiry from each says.',
  body: ['Each category below says what a good enquiry contains and what WE does not do for it.'],
  goodHeading: 'What a good enquiry says',
  doesNotHeading: 'What WE does not do',
  close: 'A category is a way to sort enquiries, and WE names no organization in any of them.',
} as const;

export const HOW_PAGE = {
  lead: 'How WE reads an enquiry, and how an introduction happens.',
  body: ['An enquiry is read by WE, and WE decides whether to talk further.', 'An introduction to a founder happens only when the founder asks for it.'],
  stepsHeading: 'From enquiry to introduction',
  steps: [
    { title: 'Send an enquiry', body: 'Use the enquiry form and say what the organization provides to founders and on what terms.' },
    { title: 'WE reads it', body: DECIDES },
    { title: 'WE replies if it talks further', body: 'WE writes to the email address in the enquiry.' },
    { title: 'Terms are written down', body: 'Before any introduction, the terms a founder would see are written down.' },
    { title: 'A founder asks first', body: FOUNDER_ASKS_FIRST },
  ],
  contentsHeading: 'What an enquiry should contain',
  contentsIntro: 'WE reads the enquiry as written, so it should say these things.',
  promiseHeading: 'What WE does not promise',
  promises: [NO_PARTNERSHIP, NO_RESPONSE_TIME, NO_PROMISES, NO_NAMES],
} as const;

export interface FaqCopy {
  readonly id: string;
  readonly question: string;
  /** One sentence each, so the ledger maps them one by one. The page joins them into a paragraph. */
  readonly answer: readonly string[];
}

export const FAQ_PAGE = {
  lead: 'Short answers about partner enquiries.',
  body: ['These answers cover who can send an enquiry and what an enquiry does and does not create.'],
} as const;

export const FAQ_ITEMS: readonly FaqCopy[] = [
  {
    id: 'program',
    question: 'Does WE have a partner program?',
    answer: [
      'WE takes enquiries from organizations that help or equip founders.',
      'WE names no partner on this site.',
      'Sending an enquiry does not create a partnership.',
    ],
  },
  {
    id: 'who',
    question: 'Which organizations can send an enquiry?',
    answer: ['Any organization that helps or equips founders may send one.', 'The form groups them in six categories and has a Something else option.'],
  },
  {
    id: 'creates',
    question: 'Does an enquiry create a partnership?',
    answer: ['Sending an enquiry does not create a partnership.', 'WE decides whether to talk further.'],
  },
  {
    id: 'introduce',
    question: 'Will WE introduce my organization to founders?',
    answer: [
      'WE may introduce an organization to a founder when that founder asks for help in its category and agrees to the introduction.',
      'WE cannot promise an introduction, a meeting or a reply.',
    ],
  },
  {
    id: 'endorse',
    question: "Does WE endorse a partner's product?",
    answer: ['WE does not say on this site that WE uses, endorses or works with any named product.', NO_NAMES],
  },
  {
    id: 'say',
    question: 'What should an enquiry say?',
    answer: ['An enquiry should name the organization, its website, its category, what it provides to founders and the terms a founder would see.'],
  },
  {
    id: 'details',
    question: 'What does WE do with the details in the form?',
    answer: ['WE uses the details in a form to answer the enquiry, as the privacy notice describes.'],
  },
  {
    id: 'reply',
    question: 'How long does a reply take?',
    answer: [NO_RESPONSE_TIME, 'WE replies to the email address in the enquiry when it decides to talk further.'],
  },
];

export const ENQUIRE_PAGE = {
  lead: 'Tell WE what your organization provides to founders.',
  body: ['Use this form to tell WE what your organization provides to founders and on what terms.'],
  start: 'Start the enquiry',
  asideContents: 'What to include',
  asideNext: 'What happens next',
  nextItems: [DECIDES, 'WE replies to the email address you give if it talks further.', NO_RESPONSE_TIME],
  asideCollects: 'What WE collects',
  collects: [
    'WE uses the details in this form to answer your enquiry, as the privacy notice describes.',
    'WE sets no cookies, runs no analytics and loads no third-party scripts.',
  ],
  asideLinks: 'Read first',
  links: [
    { label: 'What a good enquiry says', href: HREFS.categories },
    { label: 'How enquiries work', href: HREFS.howItWorks },
    { label: 'Partner FAQ', href: HREFS.faq },
  ],
} as const;

export const THANKS_PAGE = {
  lead: 'Your enquiry is with WE.',
  body: [
    'Your enquiry has been sent to WE.',
    DECIDES,
    'WE does not state a response time on this site, so check that the address you entered is one you read.',
  ],
  nextHeading: 'What happens next',
  steps: [
    { title: 'WE reads your enquiry', body: 'WE reads what you wrote about the organization and what it provides.' },
    { title: 'WE decides whether to talk further', body: 'If WE decides to talk further, the reply goes to the email address you gave.' },
    { title: 'Nothing is promised', body: NO_PARTNERSHIP },
  ],
  asideHeading: 'While you wait',
  links: [
    { label: 'How enquiries work', href: HREFS.howItWorks },
    { label: 'Partner FAQ', href: HREFS.faq },
    { label: 'The six categories', href: HREFS.categories },
    { label: 'Contact WE', href: '/contact/' },
  ],
} as const;

/** The partner part of `/network/`, and the intro under its hero. */
export const NETWORK_COPY = {
  introHeading: 'Described by roles and criteria',
  intro: [
    'WE is a fully remote digital incubator for SaaS, so its network is not a building or a member list.',
    'It has four parts you can read about today.',
    'This section names no people and no companies.',
  ],
  partsHeading: 'Four places to start',
  partsLabel: 'The four parts of the WE network',
  partners: {
    title: 'Partners',
    eyebrow: 'Organizations that help founders',
    text: 'An organization that helps or equips founders may send WE an enquiry. WE names no partner on this site.',
    subtreeDescription: 'How an organization that helps founders can send WE an enquiry',
  },
} as const;
