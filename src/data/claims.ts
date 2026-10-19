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
  'C-25', 'C-26', 'C-27', 'C-28', 'C-29', 'C-30', 'C-31', 'C-32', 'C-33', 'C-34', 'C-35', 'C-36',
] as const;

export type ClaimId = (typeof CLAIM_IDS)[number];

const OPERATOR = 'Operator brief';
const OWNER_2026_10_09 = 'Owner decision 2026-10-09 (.astro-magazine/decisions.md)';
const OWNER_2026_10_10 = 'CEO direction 2026-10-10; D-21 (.astro-magazine/decisions.md)';
const WP35 = 'WP-35 sources ledger (.astro-magazine/sources/wp-35.json)';
const OWNER_2026_10_14 = 'CEO direction 2026-10-14; W9-10 (.astro-magazine/decisions.md)';

export const claimRegistry: Readonly<Record<ClaimId, Claim>> = {
  'C-01': { id: 'C-01', status: 'publish', enabled: true, source: `${OPERATOR}; operator README`, summary: 'Fully digital, fully remote; no physical offices' },
  'C-02': { id: 'C-02', status: 'publish', enabled: true, source: OPERATOR, summary: 'A dedicated team that works only on your company, scaled by notice (no notice period or team size published)' },
  'C-03': { id: 'C-03', status: 'publish', enabled: true, source: `${OPERATOR}; agreement recital D`, summary: 'WE steers the team and manages its subcontractors' },
  'C-04': { id: 'C-04', status: 'publish', enabled: true, source: 'Operator draft packet 2, lines 237-243', summary: 'Service Lines A to G, each with a "does not do" block' },
  'C-05': { id: 'C-05', status: 'publish', enabled: true, source: OPERATOR, summary: 'No promise of funding (mandatory disclaimer). Never an outcome promise such as "fundable company"' },
  'C-06': { id: 'C-06', status: 'excluded', enabled: false, source: OPERATOR, summary: 'Seat price figure: flag-gated through flags.seatPrice.published' },
  // Wave 9 (W9-13): off until counsel clears it; every equity line ships as its non-equity fallback. Every mechanic stays excluded under C-08.
  'C-07': { id: 'C-07', status: 'softened', enabled: false, source: OWNER_2026_10_14, summary: 'Equity concept only: WE is paid for the ongoing engagement, plus equity earned in arrears for steering, so WE is aligned with the company long term; nothing is granted for work not yet done. No prices, percentages, caps, valuations or instrument terms (C-08)' },
  'C-08': { id: 'C-08', status: 'excluded', enabled: false, source: OPERATOR, summary: 'SAFE mechanics: tranche timing, cap, discount, MFN, pro-rata, percentages' },
  'C-09': { id: 'C-09', status: 'excluded', enabled: false, source: OPERATOR, summary: '"No success fees" pending counsel' },
  // Wave 9 (W9-13): the public packages are retired. C-10 now only fixes what stays unpublished about the commercial model.
  'C-10': { id: 'C-10', status: 'publish', enabled: true, source: `${OPERATOR}; ${OWNER_2026_10_09}; W9-13`, summary: 'Commercial terms are set in the agreement a founder reviews, not on the site. No package, price, seat count, rate card, milestone or payment scheme, fee election or term is published' },
  'C-11': { id: 'C-11', status: 'softened', enabled: false, source: 'ORBITAL registry description', summary: '"Over 20 years of experience" (FLAG-YEARS)' },
  'C-12': { id: 'C-12', status: 'excluded', enabled: false, source: 'ORBITAL registry description', summary: 'Premier, market dominance, scientific approach, industry leaders' },
  'C-13': { id: 'C-13', status: 'excluded', enabled: false, source: 'none exist', summary: 'Portfolio, clients, case studies, testimonials, funding raised, metrics, logo walls; also peer sessions, cohorts, mentors and alumni while none exist' },
  'C-14': { id: 'C-14', status: 'publish', enabled: true, source: `${OWNER_2026_10_09}; counsel to review before the gh-pages release`, summary: 'Investor Introductions as a separate paid add-on: a flat fee for curation and preparation that does not depend on any investment closing; no success fee, stake or transaction-based pay; WE negotiates no terms, gives no securities advice and handles no funds; curated, limited and only after the line F readiness criteria are met; no promise of a meeting, a reply or funding; the disclaimer is shown wherever the add-on is named. Still excluded: an investor network, Demo Day outcomes, success-based or guaranteed wording' },
  'C-15': { id: 'C-15', status: 'excluded', enabled: false, source: 'none evidenced', summary: 'Security or compliance certifications' },
  'C-16': { id: 'C-16', status: 'excluded', enabled: false, source: 'none', summary: 'Time-to-MVP, runway, 10x, growth guarantees' },
  // Wave 9 (W9-10): only the genericized figures are published; the source figures stay off the site.
  'C-17': { id: 'C-17', status: 'publish', enabled: true, source: OWNER_2026_10_14, summary: 'Genericized concept figures only: the Dream, Build, Grow journey roadmap; a readiness scorecard with no weights or thresholds; the engagement-and-steering flow with no amounts and no valuation cap. Source figures stay excluded' },
  'C-18': { id: 'C-18', status: 'publish', enabled: true, source: 'ORBITAL registry', summary: 'Legal entity name and Delaware PBC (FLAG-PBC); never EIN, SIN, PSC, SIC' },
  'C-19': { id: 'C-19', status: 'publish', enabled: true, source: 'dot-github/Frameworks', summary: 'WE operating frameworks, paraphrased, no efficacy claims (FLAG-FOCUS)' },
  'C-20': { id: 'C-20', status: 'excluded', enabled: false, source: 'registry mentions only', summary: 'Galactic Enterprise Framework, World Enterprise Framework' },
  'C-21': { id: 'C-21', status: 'publish', enabled: true, source: 'Operator design spec', summary: '"Two companies, one objective" as a phrase on the dedicated-teams page only' },
  'C-22': { id: 'C-22', status: 'softened', enabled: false, source: 'Exhibit J', summary: 'security@ mailbox in security.txt once confirmed monitored' },
  'C-23': { id: 'C-23', status: 'softened', enabled: false, source: 'counsel', summary: 'Terms of use ship only when counsel signs; privacy and accessibility statements are factual' },
  'C-24': { id: 'C-24', status: 'excluded', enabled: false, source: 'Operator agreement draft Exhibit D (unratified)', summary: 'Specific security and confidentiality controls (FLAG-SECURITY)' },
  // Wave 8 (WP-60): the claims the investor, partner and gated-brief pages cite. Each says what WE does and never what it will deliver.
  'C-25': { id: 'C-25', status: 'publish', enabled: true, source: OWNER_2026_10_10, summary: 'Investors may ask to meet the companies WE incubates. WE cannot promise a meeting, a reply or funding, and names no company until a written record exists (D-21)' },
  'C-26': { id: 'C-26', status: 'publish', enabled: true, source: OWNER_2026_10_10, summary: 'An organization that helps or equips founders may send WE an enquiry. Sending one creates no partnership, no referral arrangement and no commitment on either side' },
  'C-27': { id: 'C-27', status: 'publish', enabled: true, source: `${OWNER_2026_10_10}; D-23`, summary: 'WE sends a requested brief by email to the address the reader gave' },
  'C-28': { id: 'C-28', status: 'publish', enabled: true, source: `${OWNER_2026_10_10}; privacy notice`, summary: 'WE uses the details in a form to answer the request, as the privacy notice describes' },
  // Wave 9 (W9-13): C-29 follows SALES.md 1.4 (long-horizon business incubation and consulting). C-01 to C-03 and C-05 stay inside the sentence.
  'C-29': { id: 'C-29', status: 'publish', enabled: true, source: `${OWNER_2026_10_10}; ${OPERATOR}`, summary: 'WE is a long-horizon business incubation and consulting firm. WE steers a dedicated, fully remote team that builds a software-enabled company with its founder, for as long as the work is useful. WE makes no promise of funding.' },
  // Wave 10 (WP-35, #84): third-party public statistics quoted on /data/. Each says what the source published about all new U.S. businesses,
  // never what WE delivers (the pages say so). Retrieval dates and transformations are in .astro-magazine/sources/wp-35.json.
  'C-30': { id: 'C-30', status: 'publish', enabled: true, source: `${WP35}; BLS Business Employment Dynamics, Table 7 (bls-bed-total)`, summary: 'About half of new establishments are gone by year 5: of the 2015 opening-year group, 50.2% were still open at year 5 and 34.7% at year 10' },
  'C-31': { id: 'C-31', status: 'publish', enabled: true, source: `${WP35}; BLS Business Employment Dynamics, Table 7 (bls-bed-total)`, summary: 'In year 1 about one in five establishments closes; by year 13 the yearly figure is between 4 and 6 in 100, and the first years look alike in every opening-year group from 1994 to 2020' },
  'C-32': { id: 'C-32', status: 'publish', enabled: true, source: `${WP35}; Census Business Formation Statistics (census-bfs-monthly)`, summary: 'Applications to start a business reached 5,671,836 in 2025, more than double the 2,485,100 of 2005, and rose in every industry shown; an application is not a launched business' },
  'C-33': { id: 'C-33', status: 'publish', enabled: true, source: `${WP35}; Census Business Formation Statistics (census-bfs-monthly)`, summary: 'Of the 5,390,816 applications filed in 2021, 403,072 (fewer than 8 in 100) became an employer business within eight quarters; among applications that formed within eight quarters, the average wait to a first payroll rose from 1.48 quarters in 2005 to 2.29 in 2021' },
  'C-34': { id: 'C-34', status: 'publish', enabled: true, source: `${WP35}; Kauffman Indicators of Entrepreneurship, 2021 and 2025 (kauffman-2021, kauffman-2025)`, summary: 'The share of new entrepreneurs aged 20 to 34 fell from 34.3% in 1996 to 26.2% in 2021, while the share aged 55 to 64 rose from 14.8% to 22.8%' },
  'C-35': { id: 'C-35', status: 'publish', enabled: true, source: `${WP35}; Azoulay, Jones, Kim and Miranda, NBER Working Paper 24489, Table 5 (founder age)`, summary: 'Among U.S. startups founded in 2007 to 2009, the fastest-growing 1 in 1,000 had founders averaging 45.0 years old, against 41.8 for all startups, and founders of companies that exited averaged 46.7; an association, not a cause' },
  'C-36': { id: 'C-36', status: 'publish', enabled: true, source: `${WP35}; Carta State of Private Markets Q1 2026 (carta-spm-q1-2026), single quoted figures, not re-hosted`, summary: 'Among venture-backed companies, the median gap from Seed to Series A is 2.0 years, from A to B 2.1 and from B to C 2.4, and a company raising a Series E or later is a median 9.5 years old' },
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
