/**
 * Types of the page-family templates (contracts section 8). The registry and the frontmatter shapes are WP-60's; these are the
 * structural views the templates need, so the templates stay pure TypeScript over plain data and the unit tests can drive them
 * with fabricated pages. A registry entry or a parsed `family` object from WP-60 is assignable to each of them.
 */

/** The fields of a registry entry (src/data/families.ts `FamilyEntry`) that the templates read. */
export interface RegistryEntry {
  readonly slug: string;
  readonly path: string;
  readonly label: string;
  readonly order: number;
  readonly launch: boolean;
  readonly blockedWord?: string | undefined;
}

/** The fields of a family definition (src/data/families.ts `FamilyDefinition`) that the templates read. */
export interface Registry<T extends RegistryEntry = RegistryEntry> {
  readonly id: string;
  /** Folder of the family's files in the `pages` collection, for example `industries`. */
  readonly folder: string;
  readonly hub?: { readonly path: string } | undefined;
  readonly entries: readonly T[];
}

export interface FamilySource {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly accessed: Date;
}

export interface SegmentData {
  readonly id: 'segments';
  readonly slug: string;
  readonly whoFor: string;
  readonly challenges: readonly { readonly title: string; readonly text: string }[];
  readonly sources: readonly FamilySource[];
}

export interface IndustryData {
  readonly id: 'industries';
  readonly slug: string;
  readonly buyer: string;
  readonly perimeter: readonly {
    readonly title: string;
    readonly text: string;
    readonly jurisdiction: string;
    readonly asOf: Date;
    readonly sourceId: string;
  }[];
  readonly dataQuestions: readonly string[];
  readonly salesCycle: string;
  readonly sources: readonly FamilySource[];
}

export interface CompareSideData {
  readonly name: string;
  readonly whatItIs: string;
  readonly whoItFits: string;
  readonly asksOfFounder: string;
  readonly askThis: readonly string[];
}

export interface CompareData {
  readonly id: 'compare';
  readonly slug: string;
  readonly sides: readonly [CompareSideData, CompareSideData];
  readonly whereEachFits: readonly [string, string];
  readonly definitions: readonly { readonly term: string; readonly text: string; readonly sourceId: string }[];
  readonly sources: readonly FamilySource[];
}

export type JourneyStage = 'awareness' | 'consideration' | 'conversion' | 'onboarding' | 'advocacy';

export interface JourneyData {
  readonly id: 'journey';
  readonly slug: string;
  readonly stage: JourneyStage;
  readonly step?: number | undefined;
  readonly questions: readonly string[];
  readonly checklist?: readonly { readonly id: string; readonly text: string; readonly href?: string | undefined }[] | undefined;
  readonly sources: readonly FamilySource[];
}

export type FamilyData = SegmentData | IndustryData | CompareData | JourneyData;

/** A link a template renders: a reading-path article, a hub card, a checklist target. */
export interface FamilyLink {
  readonly title: string;
  readonly href: string;
  readonly description?: string | undefined;
}

/** A pages entry reduced to what a hub card needs. */
export interface PageRef {
  /** Entry id in the `pages` collection, for example `industries/fintech`. */
  readonly id: string;
  readonly description: string;
}
