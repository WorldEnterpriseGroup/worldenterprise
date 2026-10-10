/**
 * The words of the wave 8 forms, in one place (docs/wave8-contracts.md section 3.5). The three form components render them and the
 * disclaimers sit inside the components, so a page cannot drop one. Pure data, free of Astro globals, so a unit test can read it.
 */
import { INVESTOR_KINDS, PARTNER_CATEGORIES } from '../../data/forms.ts';
import type { InvestorKind, PartnerCategory } from '../../data/forms.ts';
import type { Audience } from '../../data/families.ts';

/** How a visitor describes themselves on the contact form. The values are the four audiences of the contract. */
export const CONTACT_AUDIENCE_OPTIONS: readonly { readonly value: Audience | ''; readonly label: string }[] = [
  { value: '', label: 'Choose who you are writing as' },
  { value: 'startup', label: 'A founder or a startup team' },
  { value: 'investor', label: 'An investor' },
  { value: 'partner', label: 'A possible partner' },
  { value: 'corporate', label: 'A corporate team' },
];

/** The same four, for a brief that is written for more than one audience. */
export const BRIEF_AUDIENCE_LABELS: Readonly<Record<Audience, string>> = {
  startup: 'A founder or a startup team',
  investor: 'An investor',
  partner: 'A possible partner',
  corporate: 'A corporate team',
};

export const PARTNER_CATEGORY_LABELS: Readonly<Record<PartnerCategory, string>> = {
  'tooling-saas': 'Tooling and software products',
  'cloud-credits': 'Cloud services and credits',
  legal: 'Legal services',
  'finance-accounting': 'Finance and accounting',
  delivery: 'Engineering and delivery services',
  ecosystem: 'Ecosystem and community programs',
  other: 'Something else',
};

export const INVESTOR_KIND_LABELS: Readonly<Record<InvestorKind, string>> = {
  angel: 'An angel investor',
  fund: 'A venture or seed fund',
  corporate: 'A corporate investor',
  'family-office': 'A family office',
  other: 'Something else',
};

export const PARTNER_CATEGORY_OPTIONS = [
  { value: '', label: 'Choose a category' },
  ...PARTNER_CATEGORIES.map((value) => ({ value, label: PARTNER_CATEGORY_LABELS[value] })),
] as const;

export const INVESTOR_KIND_OPTIONS = [
  { value: '', label: 'Choose one, or leave it empty' },
  ...INVESTOR_KINDS.map((value) => ({ value, label: INVESTOR_KIND_LABELS[value] })),
] as const;

export const FORM_NOTICES = {
  /** BriefRequestForm: no promise of delivery time. */
  briefSends: 'WE sends the brief by email to the address you give.',
  /** InvestorInterestForm: the verbatim funding sentence (claim C-05). */
  noFunding: 'WE makes no promise of funding.',
  /** PartnerEnquiryForm. */
  noPartnership: 'Sending an enquiry does not create a partnership. WE decides whether to talk further.',
  /** Shown instead of the form when the intake endpoint is not connected and the kind has no mailbox fallback. */
  notConnected: 'This form is not connected yet. It is shown so you can see what WE asks for, and it cannot be sent until WE connects it.',
} as const;

export const FORM_CONSENT = {
  'brief-request': 'I agree that WE may use these details to send me this brief and answer my request, as described in the privacy notice.',
  'brief-updates': 'WE may also email me related briefs and articles.',
  'investor-interest': 'I agree that WE may use these details to answer my interest, as described in the privacy notice.',
  'partner-enquiry': 'I agree that WE may use these details to answer my enquiry, as described in the privacy notice.',
} as const;

export const FORM_SUBMIT_LABELS = {
  'brief-request': 'Send me the brief',
  'investor-interest': 'Send my interest',
  'partner-enquiry': 'Send my enquiry',
} as const;
