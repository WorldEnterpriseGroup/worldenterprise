/**
 * The editorial desks (docs/wave8-contracts.md, section 2). This is the only place a desk is defined: the ledger rows, the topic
 * enum of the insights schema, the desk labels, the topic route and the owner of each article are derived from it.
 * Plain data with no imports, so it loads under plain Node and in the browser alike.
 */
/** Desk ids in display order. The four that existed before wave 8 keep the first four places (nothing is reordered). */
export const DESKS = ['dream', 'build', 'grow', 'fundable', 'starting', 'funding', 'legal', 'team', 'ai', 'gtm', 'pathways', 'models', 'sectors', 'ops'] as const;
export type DeskId = (typeof DESKS)[number];
export type Desk = DeskId;

export type DeskOwner = 'WP-66' | 'WP-67' | 'WP-68' | 'WP-69' | 'WP-81' | 'WP-82' | 'WP-83' | 'WP-84' | 'WP-85' | 'WP-88' | 'WP-89';

export interface DeskDefinition {
  readonly id: DeskId;
  /** Display name, sentence case. */
  readonly name: string;
  /** One sentence, no promise of outcomes. */
  readonly blurb: string;
  /** The package that writes the desk's articles and its intro page. */
  readonly owner: DeskOwner;
  /** One-based position in `DESKS` (a test keeps the two in step). */
  readonly order: number;
}

export const DESK_DEFINITIONS: readonly DeskDefinition[] = [
  { id: 'dream', name: 'Dream', blurb: 'Decide what to build, and whether to build it, before any code exists.', owner: 'WP-82', order: 1 },
  { id: 'build', name: 'Build', blurb: 'Scope, staff and ship a first release without over-building.', owner: 'WP-82', order: 2 },
  { id: 'grow', name: 'Grow', blurb: 'Win the first customers and keep them.', owner: 'WP-85', order: 3 },
  { id: 'fundable', name: 'Fundable', blurb: 'Prepare evidence that survives diligence. No promise of funding.', owner: 'WP-67', order: 4 },
  { id: 'starting', name: 'Starting out', blurb: 'Where you begin depends on who you are: first-time, technical, non-technical, solo, student, second-career, corporate and global founders.', owner: 'WP-83', order: 5 },
  { id: 'funding', name: 'Funding and capital', blurb: 'Understand the money you can raise or borrow, before you ask for it.', owner: 'WP-66', order: 6 },
  { id: 'legal', name: 'Legal and company basics', blurb: 'The company, equity, IP and privacy basics to ask your counsel about. Not legal advice.', owner: 'WP-67', order: 7 },
  { id: 'team', name: 'Team and hiring', blurb: 'Hire, onboard and run a small team, in-house or remote.', owner: 'WP-68', order: 8 },
  { id: 'ai', name: 'AI-native building', blurb: 'Build and operate a product that depends on a model, with the risks stated.', owner: 'WP-69', order: 9 },
  { id: 'gtm', name: 'Go-to-market', blurb: 'Position, price and reach your first customers.', owner: 'WP-81', order: 10 },
  { id: 'pathways', name: 'Pathways', blurb: 'The routes into a company and the routes to capital, side by side.', owner: 'WP-84', order: 11 },
  { id: 'models', name: 'Business models', blurb: 'How B2B SaaS, vertical SaaS, marketplaces, platforms and developer products work, and what each asks of a first company.', owner: 'WP-85', order: 12 },
  { id: 'sectors', name: 'Sectors', blurb: 'Considerations for building software in fintech, healthtech, edtech and climate tech. General information, not a claim of experience.', owner: 'WP-88', order: 13 },
  { id: 'ops', name: 'Operations and wellbeing', blurb: 'Run the company and look after the founder, in general terms and without advice.', owner: 'WP-89', order: 14 },
];

/** The desk ids as a tuple, for `z.enum` (the insights `topic` field). */
export const DESK_ENUM = DESKS;

export const DESK_LABELS: Readonly<Record<DeskId, { readonly name: string; readonly blurb: string }>> = Object.fromEntries(
  DESK_DEFINITIONS.map((d) => [d.id, { name: d.name, blurb: d.blurb }]),
) as Record<DeskId, { readonly name: string; readonly blurb: string }>;

export const DESK_OWNERS: Readonly<Record<DeskId, DeskOwner>> = Object.fromEntries(DESK_DEFINITIONS.map((d) => [d.id, d.owner])) as Record<DeskId, DeskOwner>;

export function isDeskId(value: string): value is DeskId {
  return (DESKS as readonly string[]).includes(value);
}

/** The path of a desk's topic page. */
export function deskPath(id: DeskId): string {
  return `/insights/topic/${id}/`;
}
