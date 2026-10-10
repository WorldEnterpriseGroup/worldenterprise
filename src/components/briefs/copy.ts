/**
 * The words of the gated-brief pages that are not content files: the squeeze page, the hub cards and the research links. Pure data, free of
 * Astro globals, so a unit test can read it. `.astro-magazine/sources/wp-63.json` maps each sentence to a claim, a decision or a label
 * (docs/wave8-contracts.md section 9), and tests/unit/wp-63/copy-ledger.test.ts fails on a sentence with no mapping.
 *
 * No word here promises a delivery time, a result or a price. The brief is never called free, and the page never says when it arrives.
 */

export const BRIEF_COPY = {
  eyebrow: 'Executive brief',
  heroPrimary: 'Request this brief',
  heroSecondary: 'See the outline',
  outlineHeading: 'What the brief covers',
  outlineIntro: 'The sections of the full brief, in order.',
  outlineSends: 'WE sends the full text by email to the address you give.',
  depthHeading: 'About this brief',
  depthLabel: 'Brief details',
  formatLabel: 'Format',
  formatValue: 'Written brief',
  updatedLabel: 'Updated',
  sectionsLabel: 'Sections',
  requestHeading: 'Request the brief',
  notAcceptingTitle: 'Requests are not being accepted yet',
  notAccepting: 'WE is not accepting brief requests on this page yet, and the form cannot be sent.',
  notAdvice: 'This brief gives considerations for founders. It is not legal, tax or investment advice.',
  relatedHeading: 'Related briefs',
  relatedNone: 'More briefs are on the briefs page.',
  allBriefs: 'All executive briefs',
  applyLead: 'Have an idea of your own?',
  applyLink: 'Apply to World Enterprise Incubator',
} as const;

/** The card line under a brief on the hub and in the related list. Dates and counts only: no reading time, no promise. */
export function depthLine(updated: Date, sections: number): string {
  const date = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(updated);
  return `Updated ${date}. ${sections} ${sections === 1 ? 'section' : 'sections'}.`;
}

/** The hub page: the open research briefs sit under the executive briefs so a reader finds both from one place. */
export const HUB_COPY = {
  emptyText: 'No executive brief is published yet.',
  researchHeading: 'Open research briefs',
  researchText: 'The research briefs on this site are open to read, with no request needed.',
} as const;

/** The thanks page aside. The links are checked against the live routes, so a page that does not exist is never linked. */
export const THANKS_COPY = {
  asideHeading: 'While you wait',
  moreBriefs: 'Read about the other executive briefs',
  afterApply: 'What happens after you apply',
  apply: 'Apply to World Enterprise Incubator',
  contact: 'Contact WE',
} as const;

/** The link from an open research page to the briefs hub. It renders only while the hub is live. */
export const RESEARCH_LINK_COPY = {
  heading: 'Executive briefs',
  text: 'WE also writes longer executive briefs for founders, which are sent by email on request.',
  link: 'See the executive briefs',
} as const;
