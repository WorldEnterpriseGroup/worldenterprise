/**
 * The investor FAQ (WP-64). Pure data with no Astro imports. The page renders the list and builds its FAQPage JSON-LD from the same items
 * (faqPageNode in src/components/reference/jsonld.ts), so the markup and the structured data cannot drift.
 *
 * One answer names the paid add-on, and so it carries the owner's disclaimer verbatim (F-5, claim C-14; tests/unit/wp-18/copy.test.ts reads
 * this file for the literal text). tests/unit/wp-64 asserts the literal equals INTRODUCTIONS_DISCLAIMER.
 */
import type { FaqItem } from '../reference/jsonld.ts';

export interface InvestorFaq extends FaqItem {
  /** The claims the answer restates, for the sentence ledger and the handoff. */
  readonly claims: readonly string[];
}

export const INVESTOR_FAQ: readonly InvestorFaq[] = [
  {
    id: 'can-i-meet-a-company',
    question: 'Can I meet a company WE incubates?',
    answer:
      'You can ask. Send the interest form and say what you look for. WE asks the founder, and the founder decides. WE cannot promise a meeting, a reply or funding.',
    claims: ['C-25'],
  },
  {
    id: 'which-companies',
    question: 'Which companies can I see?',
    answer:
      "WE lists a company only with its founder's written consent. WE names no company until a written record exists.",
    claims: ['C-25'],
  },
  {
    id: 'is-this-an-offer',
    question: 'Is this an offer of securities?',
    answer:
      'Nothing on this site is an offer to sell, or a solicitation of an offer to buy, any security. WE does not negotiate terms, advise on securities or handle funds.',
    claims: ['C-14'],
  },
  {
    id: 'recommendation',
    question: 'Does WE recommend a company as an investment?',
    answer:
      'WE does not advise investors or recommend any company as an investment, and an introduction is not an endorsement. WE does not verify a company’s statements. They remain that company’s own.',
    claims: ['C-14'],
  },
  {
    id: 'funding',
    question: 'Does WE promise funding?',
    answer: 'WE makes no promise of funding. It does not predict that any company will raise money.',
    claims: ['C-05'],
  },
  {
    id: 'what-to-send',
    question: 'What does the interest form ask for?',
    answer:
      'The form asks for your name and email address. The firm, website, how you describe yourself, the sectors and stages you want to see, and a message are optional. It asks for no accreditation status, no amounts and no fund size.',
    claims: ['C-28'],
  },
  {
    id: 'your-details',
    question: 'What does WE do with my details?',
    answer: 'WE uses the details in the form to answer your request, as the privacy notice describes.',
    claims: ['C-28'],
  },
  {
    id: 'reply',
    question: 'Will WE reply?',
    answer: 'WE cannot promise a reply or a meeting.',
    claims: ['C-25'],
  },
  {
    id: 'paid-add-on',
    question: 'Is there a fee for introductions?',
    answer:
      'A company can buy Investor Introductions, a separate, paid add-on. A flat fee covers curation and preparation. The fee does not depend on whether any investment closes. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.',
    claims: ['C-14'],
  },
  {
    id: 'readiness',
    question: 'How does a founder get ready?',
    answer:
      'A founder can work through the readiness checklist and the self-check before asking for anything. WE judges whether its readiness criteria are met.',
    claims: ['C-14'],
  },
];
