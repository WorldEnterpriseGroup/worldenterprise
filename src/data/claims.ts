/**
 * Claims registry (SAGE-PLAN 3.1). Components read `claims.<name>`; there is no free-text escape.
 * Status: publish (P), softened (S, default off), excluded (X, never on the site, denylist-scanned).
 */
export type ClaimStatus = 'publish' | 'softened' | 'excluded';

export interface Claim {
  readonly id: string;
  readonly status: ClaimStatus;
  /** Only claims with status publish or softened can be enabled. Excluded claims are never enabled. */
  readonly enabled: boolean;
  /** Where the claim comes from. Required for every entry. */
  readonly source: string;
  readonly summary: string;
}

export const CLAIM_IDS = [
  'C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06', 'C-07', 'C-08', 'C-09', 'C-10', 'C-11', 'C-12',
  'C-13', 'C-14', 'C-15', 'C-16', 'C-17', 'C-18', 'C-19', 'C-20', 'C-21', 'C-22', 'C-23', 'C-24',
] as const;

export type ClaimId = (typeof CLAIM_IDS)[number];

const OPERATOR = 'Operator brief';

export const claimRegistry: Readonly<Record<ClaimId, Claim>> = {
  'C-01': { id: 'C-01', status: 'publish', enabled: true, source: `${OPERATOR}; whitelab README`, summary: 'Fully digital, fully remote; no physical offices' },
  'C-02': { id: 'C-02', status: 'publish', enabled: true, source: OPERATOR, summary: 'Dedicated offshore team seats, scalable by notice (no notice period, no seat counts)' },
  'C-03': { id: 'C-03', status: 'publish', enabled: true, source: `${OPERATOR}; agreement recital D`, summary: 'WE steers the team and manages its subcontractors' },
  'C-04': { id: 'C-04', status: 'publish', enabled: true, source: 'whitelab/drafts/10-packet-2.md:237-243', summary: 'Service Lines A to G, each with a "does not do" block' },
  'C-05': { id: 'C-05', status: 'publish', enabled: true, source: OPERATOR, summary: 'No promise of funding (mandatory disclaimer). Never an outcome promise such as "fundable company"' },
  'C-06': { id: 'C-06', status: 'excluded', enabled: false, source: OPERATOR, summary: 'Seat price figure: flag-gated through flags.seatPrice.published' },
  'C-07': { id: 'C-07', status: 'softened', enabled: false, source: OPERATOR, summary: 'SAFE as compensation concept (FLAG-SAFE, counsel clearance)' },
  'C-08': { id: 'C-08', status: 'excluded', enabled: false, source: OPERATOR, summary: 'SAFE mechanics: tranche timing, cap, discount, MFN, pro-rata, percentages' },
  'C-09': { id: 'C-09', status: 'excluded', enabled: false, source: OPERATOR, summary: '"No success fees" pending counsel' },
  'C-10': { id: 'C-10', status: 'excluded', enabled: false, source: 'whitelab/template/KEY-VALUES.md', summary: 'Package names, nine-milestone scheme, phases, fee tables' },
  'C-11': { id: 'C-11', status: 'softened', enabled: false, source: 'ORBITAL registry description', summary: '"Over 20 years of experience" (FLAG-YEARS)' },
  'C-12': { id: 'C-12', status: 'excluded', enabled: false, source: 'ORBITAL registry description', summary: 'Premier, market dominance, scientific approach, industry leaders' },
  'C-13': { id: 'C-13', status: 'excluded', enabled: false, source: 'none exist', summary: 'Portfolio, clients, case studies, testimonials, funding raised, metrics, logo walls; also peer sessions, cohorts, mentors and alumni while none exist' },
  'C-14': { id: 'C-14', status: 'excluded', enabled: false, source: 'implies funding', summary: 'Investor network, introductions, Demo Day outcomes' },
  'C-15': { id: 'C-15', status: 'excluded', enabled: false, source: 'none evidenced', summary: 'Security or compliance certifications' },
  'C-16': { id: 'C-16', status: 'excluded', enabled: false, source: 'none', summary: 'Time-to-MVP, runway, 10x, growth guarantees' },
  'C-17': { id: 'C-17', status: 'excluded', enabled: false, source: 'whitelab elevate/C-graphics', summary: 'Whitelab figures 02, 03 and 05' },
  'C-18': { id: 'C-18', status: 'publish', enabled: true, source: 'ORBITAL registry', summary: 'Legal entity name and Delaware PBC (FLAG-PBC); never EIN, SIN, PSC, SIC' },
  'C-19': { id: 'C-19', status: 'publish', enabled: true, source: 'dot-github/Frameworks', summary: 'WE operating frameworks, paraphrased, no efficacy claims (FLAG-FOCUS)' },
  'C-20': { id: 'C-20', status: 'excluded', enabled: false, source: 'registry mentions only', summary: 'Galactic Enterprise Framework, World Enterprise Framework' },
  'C-21': { id: 'C-21', status: 'publish', enabled: true, source: 'whitelab design spec', summary: '"Two companies, one objective" as a phrase on the dedicated-teams page only' },
  'C-22': { id: 'C-22', status: 'softened', enabled: false, source: 'Exhibit J', summary: 'security@ mailbox in security.txt once confirmed monitored' },
  'C-23': { id: 'C-23', status: 'softened', enabled: false, source: 'counsel', summary: 'Terms of use ship only when counsel signs; privacy and accessibility statements are factual' },
  'C-24': { id: 'C-24', status: 'excluded', enabled: false, source: 'whitelab agreement draft Exhibit D (unratified)', summary: 'Specific security and confidentiality controls (FLAG-SECURITY)' },
};

/** Named toggles components read. Each maps to one registry entry. */
export const claims = {
  /** C-07 */ safeConcept: claimRegistry['C-07'].enabled,
  /** C-11 */ years20: claimRegistry['C-11'].enabled,
  /** C-22 */ securityMailbox: claimRegistry['C-22'].enabled,
  /** C-23 */ legalTerms: claimRegistry['C-23'].enabled,
  /** C-24 */ securityPractices: claimRegistry['C-24'].enabled,
} as const;

/** True when a claim may be cited by content (status publish or softened, and enabled). */
export function isClaimUsable(id: ClaimId): boolean {
  const claim = claimRegistry[id];
  return claim.status !== 'excluded' && claim.enabled;
}

/** Build assertion: excluded claims can never be enabled, and every entry carries a source. */
export function assertClaimRegistry(): void {
  for (const id of CLAIM_IDS) {
    const claim = claimRegistry[id];
    if (claim.id !== id) throw new Error(`Claim registry key ${id} does not match entry id ${claim.id}.`);
    if (claim.status === 'excluded' && claim.enabled) throw new Error(`Claim ${id} is excluded and cannot be enabled.`);
    if (claim.source.trim() === '') throw new Error(`Claim ${id} has no source.`);
  }
}

assertClaimRegistry();
