/**
 * Site identity. Every value here is taken from the claims ladder (SAGE-PLAN section 3) or the ORBITAL registry.
 * Never add a street address (C-01), EIN, SIN, PSC, SIC or a founding date (C-18).
 */
export const site = {
  /** Public brand name. */
  name: 'World Enterprise',
  /** Legal entity name, used in the footer legal line and JSON-LD legalName (C-18, FLAG-PBC pending). */
  legalName: 'World Enterprise Group Incorporated',
  legalLine: 'World Enterprise Group Incorporated, a Delaware public benefit corporation',
  origin: 'https://worldenterprise.org',
  tagline: 'A business incubation and consulting firm',
  motto: 'WE Dream. WE Build. WE Grow.',
  signature: 'Where vision becomes evidence.',
  description:
    'Long-horizon business incubation and consulting. WE steers a dedicated, fully remote team that builds a software-enabled company. WE promises no funding.',
  /** Title suffix: "{Page} | World Enterprise" (max 60 characters in total). */
  titleSuffix: 'World Enterprise',
  locality: 'Lewes',
  region: 'DE',
  country: 'US',
  /** NAICS 541611, administrative management and general management consulting. */
  naics: '541611',
  sameAs: ['https://github.com/WorldEnterpriseGroup'],
  /**
   * Mailboxes. Not published until the operator confirms each exists and is monitored (C-22, B-2). Confirmed 2026-10-28 by the owner:
   * hello@, apply@ and security@ are aliases of the monitored shared mailbox info@worldenterprise.org, which is also where FormSubmit
   * delivers every form (RELEASE.md sections 5 to 7).
   */
  mailboxes: {
    hello: { address: 'hello@worldenterprise.org', confirmed: true },
    apply: { address: 'apply@worldenterprise.org', confirmed: true },
  },
  /** security@ address for /.well-known/security.txt, or null until confirmed monitored (C-22). Confirmed 2026-10-28, see mailboxes. */
  securityContact: 'security@worldenterprise.org' as string | null,
} as const;

export type Site = typeof site;

/** Builds a page title of the form "{Page} | World Enterprise". The home page uses the brand alone. */
export function pageTitle(page?: string): string {
  if (page === undefined || page.trim() === '') return `${site.name}: ${site.tagline}`;
  return `${page.trim()} | ${site.titleSuffix}`;
}
