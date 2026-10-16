/**
 * The sources behind every statement and statistic on /sbir-sttr/** (WP-34, #83). Pure data: no Astro imports, so `node --test` can
 * check it. Each entry is recorded, with its retrieval date and how the figure was derived, in `.astro-magazine/sources/wp-34.json`.
 *
 * `fetched: false` marks a page that was cited by a reputable index or a search result but that this build could not retrieve itself
 * (the retrieval date is then omitted, never invented).
 */

export type SbirSourceId =
  | 'sba-release-26-43'
  | 'congress-s3971'
  | 'doe-sbir'
  | 'nasa-sbir'
  | 'nih-seed'
  | 'nsf-seed-fund'
  | 'sbir-about'
  | 'sbir-apply'
  | 'sbir-agencies'
  | 'sbir-policy-directive'
  | 'sbir-fast'
  | 'sbir-award-data'
  | 'nih-success-rates'
  | 'sam-checklist'
  | 'sba-sbdc'
  | 'taba-nida'
  | 'apex-search';

export interface SbirSource {
  readonly id: SbirSourceId;
  readonly title: string;
  readonly publisher: string;
  /** Always https. */
  readonly url: string;
  /** The short citation used in a figure's source line. */
  readonly short: string;
  /** UTC date this build retrieved the page (YYYY-MM-DD), or null when it could not. */
  readonly accessed: string | null;
}

export const RETRIEVED = '2026-10-15';

export const SBIR_SOURCES: readonly SbirSource[] = [
  {
    id: 'sba-release-26-43',
    title: 'Administrator Loeffler Applauds SBIR-STTR Reauthorization (SBA news release 26-43, April 13, 2026)',
    publisher: 'U.S. Small Business Administration',
    url: 'https://www.sba.gov/article/2026/04/13/administrator-loeffler-applauds-sbir-sttr-reauthorization',
    short: 'U.S. Small Business Administration, news release 26-43',
    accessed: RETRIEVED,
  },
  {
    id: 'congress-s3971',
    title: 'S.3971, Small Business Innovation and Economic Security Act (119th Congress)',
    publisher: 'U.S. Congress, congress.gov',
    url: 'https://www.congress.gov/bill/119th-congress/senate-bill/3971',
    short: 'congress.gov, S. 3971',
    accessed: null,
  },
  {
    id: 'doe-sbir',
    title: 'SBIR/STTR Programs, Office of Science notice on reauthorization',
    publisher: 'U.S. Department of Energy',
    url: 'https://science.osti.gov/sbir',
    short: 'U.S. Department of Energy, SBIR/STTR notice',
    accessed: RETRIEVED,
  },
  {
    id: 'nasa-sbir',
    title: 'NASA SBIR/STTR, solicitation schedule (last updated October 14, 2026)',
    publisher: 'National Aeronautics and Space Administration',
    url: 'https://www.nasa.gov/sbir_sttr/',
    short: 'NASA SBIR/STTR program page',
    accessed: RETRIEVED,
  },
  {
    id: 'nih-seed',
    title: 'Small Business Program Basics',
    publisher: 'National Institutes of Health, NIH SEED',
    url: 'https://seed.nih.gov/small-business-funding/small-business-program-basics',
    short: 'NIH SEED, Small Business Program Basics',
    accessed: RETRIEVED,
  },
  {
    id: 'nsf-seed-fund',
    title: "America's Seed Fund, powered by NSF",
    publisher: 'U.S. National Science Foundation',
    url: 'https://seedfund.nsf.gov/',
    short: "NSF America's Seed Fund",
    accessed: RETRIEVED,
  },
  {
    id: 'sbir-about',
    title: 'About SBIR and STTR',
    publisher: 'U.S. Small Business Administration, SBIR.gov',
    url: 'https://www.sbir.gov/about',
    short: 'SBIR.gov, About',
    accessed: RETRIEVED,
  },
  {
    id: 'sbir-apply',
    title: 'How to Apply',
    publisher: 'U.S. Small Business Administration, SBIR.gov',
    url: 'https://www.sbir.gov/apply',
    short: 'SBIR.gov, How to Apply',
    accessed: RETRIEVED,
  },
  {
    id: 'sbir-agencies',
    title: 'Participating Federal Agencies',
    publisher: 'U.S. Small Business Administration, SBIR.gov',
    url: 'https://www.sbir.gov/participating-agencies',
    short: 'SBIR.gov, Participating Federal Agencies',
    accessed: RETRIEVED,
  },
  {
    id: 'sbir-policy-directive',
    title: 'SBIR and STTR Policy Directive (May 2023) and the Policy Directives page',
    publisher: 'U.S. Small Business Administration, SBIR.gov',
    url: 'https://www.sbir.gov/about/policies',
    short: 'SBA SBIR/STTR Policy Directive',
    accessed: RETRIEVED,
  },
  {
    id: 'sbir-fast',
    title: 'Federal and State Technology (FAST) Partnership Program',
    publisher: 'U.S. Small Business Administration, SBIR.gov',
    url: 'https://www.sbir.gov/community/fast',
    short: 'SBIR.gov, FAST Partnership Program',
    accessed: RETRIEVED,
  },
  {
    id: 'sbir-award-data',
    title: 'SBIR.gov award data download (no-abstract CSV), all agencies, 1983 to 2026',
    publisher: 'U.S. Small Business Administration, SBIR.gov',
    url: 'https://data.www.sbir.gov/mod_awarddatapublic_no_abstract/award_data_no_abstract.csv',
    short: 'SBIR.gov award data download',
    accessed: RETRIEVED,
  },
  {
    id: 'nih-success-rates',
    title: 'Table 215: NIH SBIR and STTR competing applications, awards, success rates and total funding by phase, fiscal years 2015 to 2025',
    publisher: 'National Institutes of Health, NIH RePORT',
    url: 'https://report.nih.gov/funding/nih-budget-and-spending-data-past-fiscal-years/success-rates',
    short: 'NIH RePORT, success rates, Table 215',
    accessed: RETRIEVED,
  },
  {
    id: 'sam-checklist',
    title: 'Entity Registration Checklist: Prepare for Entity Registration in SAM.gov',
    publisher: 'U.S. General Services Administration, SAM.gov',
    url: 'https://sam.gov/sites/default/files/2024-11/entity-checklist.pdf',
    short: 'SAM.gov, Entity Registration Checklist',
    accessed: null,
  },
  {
    id: 'sba-sbdc',
    title: 'Small Business Development Centers (SBDCs)',
    publisher: 'U.S. Small Business Administration',
    url: 'https://www.sba.gov/local-assistance/resource-partners/small-business-development-centers-sbdc',
    short: 'SBA, Small Business Development Centers',
    accessed: RETRIEVED,
  },
  {
    id: 'taba-nida',
    title: 'Technical and Business Assistance (TABA) Program',
    publisher: 'National Institutes of Health, National Institute on Drug Abuse',
    url: 'https://nida.nih.gov/funding/small-business-innovation-research-sbir-technology-transfer-sttr-programs/entrepreneurship-business-programs/technical-business-assistance',
    short: 'NIH, Technical and Business Assistance (TABA)',
    accessed: null,
  },
  {
    id: 'apex-search',
    title: 'APEX Accelerators, Department of Defense Office of Small Business Programs',
    publisher: 'U.S. Department of Defense, Office of Small Business Programs',
    url: 'https://business.defense.gov/Engage/News/Article/3821927/apex-accelerators-are-a-critical-front-door-for-businesses',
    short: 'DoD Office of Small Business Programs, APEX Accelerators',
    accessed: null,
  },
];

const BY_ID: ReadonlyMap<SbirSourceId, SbirSource> = new Map(SBIR_SOURCES.map((s) => [s.id, s]));

export function sbirSource(id: SbirSourceId): SbirSource {
  const source = BY_ID.get(id);
  if (source === undefined) throw new Error(`Unknown SBIR source id "${id}"`);
  return source;
}

/** The anchor a figure's source line links to on the page that lists the source (`#source-<id>`). */
export const sourceAnchor = (id: SbirSourceId): string => `#source-${id}`;
