/**
 * The founder tools, as data. The /tools/ hub renders one card per entry whose route is live in this build (the route ledger decides, so a
 * tool whose page has not merged is never linked), and the tests read the same list. Pure data, no Astro imports.
 *
 * Each summary says what the visitor does and what they get back. None states a price, an amount or an outcome.
 */

export interface ToolEntry {
  readonly title: string;
  readonly href: string;
  /** One word above the title on the card. */
  readonly eyebrow: string;
  readonly summary: string;
}

export const TOOLS: readonly ToolEntry[] = [
  {
    title: 'Team Composer',
    href: '/tools/team-composer/',
    eyebrow: 'Sketch',
    summary: 'Choose the roles your SaaS team needs and how many people each one needs, then carry the sketch to the application. No sign-up, no price.',
  },
  {
    title: 'Metrics calculator',
    href: '/tools/metrics-calculator/',
    eyebrow: 'Calculate',
    summary: 'Type one month of your numbers and see net new MRR, gross revenue churn, quick ratio, CAC payback, LTV to CAC and runway, with every formula shown.',
  },
  {
    title: 'Evidence room builder',
    href: '/tools/evidence-room/',
    eyebrow: 'Prepare',
    summary: 'Work through a checklist built from the data room and investor readiness guides. Filter by stage, tick items off, then print the list or copy it as Markdown.',
  },
  {
    title: 'Runway calculator',
    href: '/tools/runway-calculator/',
    eyebrow: 'Calculate',
    summary: 'Type cash, net burn and, if you want it, burn growth, and see runway in months, rounded down, with every step of the working shown.',
  },
  {
    title: 'Pricing page checker',
    href: '/tools/pricing-page-checker/',
    eyebrow: 'Check',
    summary:
      'Tick the statements from the launch checklist in the pricing page article that are true of your own page. See a count of what is marked and what is left.',
  },
  {
    title: 'Cap table explainer',
    href: '/tools/cap-table-explainer/',
    eyebrow: 'Calculate',
    summary: 'Type the shares you hold, the shares others hold and the shares to issue. See your ownership before and after, with every division shown.',
  },
];

export const HUB = {
  lead: 'Tools that run in your browser. Your numbers and choices stay on the page.',
  primary: 'Open the metrics calculator',
  secondary: 'Compose your team',
  ctaTitle: 'Prepare with a team that steers the work',
  ctaText:
    'Service Line F covers fundability and investor readiness inside the program. WE prepares the evidence. The raise itself, and the legal advice around it, stay with you and your own counsel.',
  ctaPrimary: 'See Service Line F',
  ctaSecondary: 'Apply',
} as const;
