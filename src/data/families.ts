import type { DeskId } from './desks.ts';

/**
 * The page-family registry (docs/wave8-contracts.md, section 8.1): the only hand-edited list of founder segments, industries,
 * comparisons, journey pages and brief ids. Ledger rows, nav links, sitemap entries, hub cards and tests derive from it.
 * A content package adds a page by adding a file in the `pages` collection whose slug is already here; it never edits this file.
 * Only WP-60 (stage 0) and WP-99 (to flip `launch`) edit it. Plain data, importable under plain Node and in the browser.
 */
export const AUDIENCES = ['startup', 'investor', 'partner', 'corporate'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Readonly<Record<Audience, string>> = {
  startup: 'For startups',
  investor: 'For investors',
  partner: 'For partners',
  corporate: 'For corporate teams',
};

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

/** WP-60 to WP-99: the wave 8 packages. The route ledger's `RouteOwner` includes it. */
export type WaveEightOwner = `WP-${'6' | '7' | '8' | '9'}${Digit}`;

/** WP-51 to WP-58: the wave 9 packages that own a family entry (W9-13: WP-58 owns the timeline brief). */
export type WaveNineOwner = `WP-5${'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'}`;

export type FamilyId = 'segments' | 'industries' | 'compare' | 'journey' | 'briefs';

export interface FamilyEntry {
  /** The file name in the pages collection, or the brief id. */
  readonly slug: string;
  /** Derived: '/founders/first-time-founders/'. */
  readonly path: string;
  /** Short label for nav, cards and the palette, at most 40 characters. */
  readonly label: string;
  readonly order: number;
  /** The content owner package, for example 'WP-73'. */
  readonly owner: WaveEightOwner | WaveNineOwner;
  /** False = first cut within the family (plan 4.6). */
  readonly core: boolean;
  /** True by default; WP-99 flips a cut entry and records a reason. */
  readonly launch: boolean;
  /** Required when `launch` is false. */
  readonly reason?: string;
  /** Set on the one entry whose slug or title holds a word the `C-13-peers` rule blocks. */
  readonly blockedWord?: string;
}
export interface SegmentEntry extends FamilyEntry {
  readonly short: string;
}
export interface BriefEntry extends FamilyEntry {
  readonly audience: readonly Audience[];
  readonly desks: readonly DeskId[];
}

export interface FamilyDefinition<T extends FamilyEntry = FamilyEntry> {
  readonly id: FamilyId;
  /** Where the family's files live. A `pages` folder holds `<slug>.mdx`; the briefs folder holds `<id>.md`. */
  readonly collection: 'pages' | 'briefs';
  readonly folder: string;
  /** The hub route of the family, when it has one. */
  readonly hub?: { readonly path: string; readonly owner: WaveEightOwner };
  readonly entries: readonly T[];
}

/** A slug that can never be a family slug: reserved routes and the collection index. */
export const RESERVED_SLUGS: readonly string[] = ['portfolio', 'stories', 'index', 'thanks'];

type EntryInput = Omit<FamilyEntry, 'path' | 'order' | 'launch'> & { readonly launch?: boolean };

/** The fields every entry derives: its path from the family base, its order from its position, `launch` true unless stated. */
function derived(base: string, input: EntryInput, index: number): Pick<FamilyEntry, 'path' | 'order' | 'launch'> {
  return { path: `${base}${input.slug}/`, order: index + 1, launch: input.launch ?? true };
}

interface SegmentInput extends EntryInput {
  readonly short: string;
}

const SEGMENT_INPUTS: readonly SegmentInput[] = [
  { slug: 'first-time-founders', short: 'first-time', label: 'First-time founders', owner: 'WP-73', core: true },
  { slug: 'technical-founders', short: 'technical', label: 'Technical founders', owner: 'WP-73', core: true },
  { slug: 'non-technical-founders', short: 'non-technical', label: 'Non-technical founders', owner: 'WP-73', core: true },
  { slug: 'solo-founders', short: 'solo', label: 'Solo founders', owner: 'WP-73', core: true },
  { slug: 'corporate-innovators', short: 'corporate', label: 'Corporate innovators', owner: 'WP-73', core: true },
  { slug: 'student-founders', short: 'student', label: 'Student founders', owner: 'WP-73', core: true },
  { slug: 'second-career-founders', short: 'second-career', label: 'Second-career founders', owner: 'WP-73', core: true },
  { slug: 'global-remote-founders', short: 'global', label: 'Global and remote founders', owner: 'WP-73', core: true },
];

const INDUSTRY_INPUTS: readonly EntryInput[] = [
  { slug: 'fintech', label: 'Fintech', owner: 'WP-74', core: true },
  { slug: 'healthtech', label: 'Healthtech', owner: 'WP-74', core: true },
  { slug: 'edtech', label: 'Edtech', owner: 'WP-74', core: true },
  { slug: 'climate-tech', label: 'Climate tech', owner: 'WP-74', core: true },
  { slug: 'legaltech', label: 'Legaltech', owner: 'WP-74', core: false },
  { slug: 'logistics', label: 'Logistics', owner: 'WP-74', core: false },
  { slug: 'proptech', label: 'Proptech', owner: 'WP-74', core: false },
];

const COMPARE_INPUTS: readonly EntryInput[] = [
  // The label never carries the blocked word: every generated list renders from the label alone (contracts section 8.1). The slug does not
  // carry it either: the audit scans the URL in a sitemap, a feed, JSON-LD and an og:url meta, so the slug was renamed (Q-7, 60b item 13).
  { slug: 'incubator-vs-other-programs', label: 'Incubators and other startup programs', owner: 'WP-75', core: true, blockedWord: 'accelerator' },
  { slug: 'incubator-vs-venture-studio', label: 'Incubators and venture studios', owner: 'WP-75', core: true },
  { slug: 'dedicated-team-vs-agency', label: 'A dedicated team or an agency', owner: 'WP-75', core: true },
  { slug: 'dedicated-team-vs-freelancers', label: 'A dedicated team or freelancers', owner: 'WP-75', core: true },
  { slug: 'build-vs-buy', label: 'Build or buy', owner: 'WP-75', core: false },
  { slug: 'onshore-vs-offshore-teams', label: 'Onshore or offshore teams', owner: 'WP-75', core: false },
  { slug: 'bootstrapping-vs-outside-funding', label: 'Bootstrapping or outside funding', owner: 'WP-75', core: false },
];

const JOURNEY_INPUTS: readonly EntryInput[] = [
  { slug: 'after-you-apply', label: 'After you apply', owner: 'WP-72', core: true },
  { slug: 'first-months', label: 'The first months', owner: 'WP-72', core: true },
  { slug: 'onboarding-checklist', label: 'Onboarding checklist', owner: 'WP-72', core: true },
];

interface BriefInput extends EntryInput {
  readonly audience: readonly Audience[];
  readonly desks: readonly DeskId[];
}

const BRIEF_INPUTS: readonly BriefInput[] = [
  { slug: 'funding-paths', label: 'Funding paths', owner: 'WP-63', core: true, audience: ['startup'], desks: ['funding'] },
  { slug: 'company-setup', label: 'Company setup', owner: 'WP-63', core: true, audience: ['startup'], desks: ['legal'] },
  { slug: 'ai-native-build', label: 'AI-native build', owner: 'WP-63', core: true, audience: ['startup'], desks: ['ai'] },
  { slug: 'first-100-customers', label: 'The first 100 customers', owner: 'WP-79', core: true, audience: ['startup'], desks: ['gtm', 'grow'] },
  { slug: 'pre-seed-evidence-pack', label: 'Pre-seed evidence pack', owner: 'WP-79', core: false, audience: ['startup'], desks: ['fundable'] },
  { slug: 'first-hires', label: 'First hires', owner: 'WP-79', core: false, audience: ['startup'], desks: ['team'] },
  { slug: 'early-stage-diligence', label: 'Early-stage diligence', owner: 'WP-80', core: false, audience: ['investor'], desks: ['fundable'] },
  { slug: 'ai-company-diligence', label: 'AI company diligence', owner: 'WP-80', core: false, audience: ['investor'], desks: ['ai'] },
  { slug: 'partnering-with-founders', label: 'Partnering with founders', owner: 'WP-80', core: false, audience: ['partner'], desks: ['pathways'] },
  { slug: 'corporate-spinouts', label: 'Corporate spinouts', owner: 'WP-80', core: false, audience: ['corporate'], desks: ['pathways'] },
  // Wave 9 (W9-13): the timeline brief, the tertiary CTA of the sales literature.
  { slug: 'real-timeline', label: 'The real timeline', owner: 'WP-58', core: false, audience: ['startup'], desks: ['starting'] },
];

export const SEGMENTS: FamilyDefinition<SegmentEntry> = {
  id: 'segments',
  collection: 'pages',
  folder: 'founders',
  entries: SEGMENT_INPUTS.map((input, index): SegmentEntry => ({ ...input, ...derived('/founders/', input, index) })),
};

export const INDUSTRIES: FamilyDefinition = {
  id: 'industries',
  collection: 'pages',
  folder: 'industries',
  hub: { path: '/industries/', owner: 'WP-74' },
  entries: INDUSTRY_INPUTS.map((input, index): FamilyEntry => ({ ...input, ...derived('/industries/', input, index) })),
};

export const COMPARISONS: FamilyDefinition = {
  id: 'compare',
  collection: 'pages',
  folder: 'compare',
  hub: { path: '/compare/', owner: 'WP-75' },
  entries: COMPARE_INPUTS.map((input, index): FamilyEntry => ({ ...input, ...derived('/compare/', input, index) })),
};

export const JOURNEY: FamilyDefinition = {
  id: 'journey',
  collection: 'pages',
  folder: 'journey',
  hub: { path: '/journey/', owner: 'WP-72' },
  entries: JOURNEY_INPUTS.map((input, index): FamilyEntry => ({ ...input, ...derived('/journey/', input, index) })),
};

export const BRIEFS: FamilyDefinition<BriefEntry> = {
  id: 'briefs',
  collection: 'briefs',
  folder: '',
  hub: { path: '/briefs/', owner: 'WP-63' },
  entries: BRIEF_INPUTS.map((input, index): BriefEntry => ({ ...input, ...derived('/briefs/', input, index) })),
};

export const FAMILIES: readonly FamilyDefinition[] = [SEGMENTS, INDUSTRIES, COMPARISONS, JOURNEY, BRIEFS];

export function getFamily(id: FamilyId): FamilyDefinition {
  const found = FAMILIES.find((f) => f.id === id);
  if (found === undefined) throw new Error(`Unknown page family "${id}".`);
  return found;
}

/** Slugs of the founder segments, the values an article's `segments` field may hold. */
export const SEGMENT_SLUGS: readonly string[] = SEGMENTS.entries.map((e) => e.slug);

/** The short names the article tables use ('first-time', 'technical', ...), mapped to the registry slug. */
export const SEGMENT_SHORT_NAMES: Readonly<Record<string, string>> = Object.fromEntries(SEGMENTS.entries.map((e) => [e.short, e.slug]));

export const BRIEF_IDS: readonly string[] = BRIEFS.entries.map((e) => e.slug);

/** Every path a family registers: the hub of each family and every entry (including cut entries). */
export function familyPaths(family: FamilyDefinition): readonly string[] {
  return [...(family.hub !== undefined ? [family.hub.path] : []), ...family.entries.map((e) => e.path)];
}

/**
 * The label a generated list shows. An entry that carries a blocked word is rendered from its label alone, never from a
 * title or description, so the word appears only on the page itself, its Markdown twin and the two llms files.
 */
export function familyLabel(entry: FamilyEntry): string {
  return entry.label;
}
