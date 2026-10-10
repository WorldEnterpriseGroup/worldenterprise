import { asOfLabel, COMPARE_ROWS } from './copy.ts';
import type { CompareData, FamilyLink, FamilySource, IndustryData, JourneyData, SegmentData } from './types.ts';

/**
 * View models of the family templates: pure functions from a page's parsed `family` object to exactly what the components render,
 * so every ordering and every neutrality rule can be tested without Astro. A component takes a view and adds markup, never logic.
 */

// ---------------------------------------------------------------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------------------------------------------------------------

/** An article as the reading path sees it: its route, its title and the segments it lists in its frontmatter. */
export interface ArticleRef {
  readonly title: string;
  readonly href: string;
  readonly summary?: string | undefined;
  readonly segments: readonly string[];
  /** Publication date, newest first when set. */
  readonly published?: Date | undefined;
}

/** Articles whose `segments` field lists the slug. Zero, one or many. Newest first, then by title, so the order is stable. */
export function readingPath(articles: readonly ArticleRef[], slug: string): readonly FamilyLink[] {
  return articles
    .filter((article) => article.segments.includes(slug))
    .sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0) || a.title.localeCompare(b.title, 'en'))
    .map((article) => ({ title: article.title, href: article.href, description: article.summary }));
}

export interface SegmentView {
  readonly whoFor: string;
  readonly challenges: readonly { readonly title: string; readonly text: string }[];
  readonly reading: readonly FamilyLink[];
  readonly sources: readonly FamilySource[];
}

export function segmentView(data: SegmentData, reading: readonly FamilyLink[]): SegmentView {
  return { whoFor: data.whoFor, challenges: data.challenges, reading, sources: data.sources };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Industries
// ---------------------------------------------------------------------------------------------------------------------------------

export interface PerimeterItemView {
  readonly title: string;
  readonly text: string;
  readonly jurisdiction: string;
  readonly asOf: string;
  /** Position of the item's source in the Sources list, counting from 1. */
  readonly sourceNumber: number;
  readonly sourceHref: string;
  readonly sourceTitle: string;
}

export interface IndustryView {
  readonly buyer: string;
  readonly perimeter: readonly PerimeterItemView[];
  readonly dataQuestions: readonly string[];
  readonly salesCycle: string;
  readonly sources: readonly FamilySource[];
}

/** The anchor id `SourcesList` gives a source. */
export function sourceAnchor(id: string): string {
  return `#source-${id}`;
}

export function industryView(data: IndustryData): IndustryView {
  const perimeter = data.perimeter.map((item): PerimeterItemView => {
    const index = data.sources.findIndex((source) => source.id === item.sourceId);
    const source = data.sources[index];
    if (source === undefined) {
      throw new Error(`Industry "${data.slug}": perimeter item "${item.title}" cites source "${item.sourceId}", which is not in family.sources.`);
    }
    return {
      title: item.title,
      text: item.text,
      jurisdiction: item.jurisdiction,
      asOf: asOfLabel(item.asOf),
      sourceNumber: index + 1,
      sourceHref: sourceAnchor(source.id),
      sourceTitle: source.title,
    };
  });
  return { buyer: data.buyer, perimeter, dataQuestions: data.dataQuestions, salesCycle: data.salesCycle, sources: data.sources };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------------------------------------------------------------

export interface CompareRowView {
  readonly label: string;
  /** One cell per side, in the order of `sides`. */
  readonly cells: readonly [string, string];
}

export interface CompareAskView {
  readonly name: string;
  readonly items: readonly string[];
}

export interface CompareFitView {
  readonly name: string;
  readonly text: string;
}

export interface CompareDefinitionView {
  readonly term: string;
  readonly text: string;
  readonly sourceNumber: number;
  readonly sourceHref: string;
}

export interface CompareView {
  readonly names: readonly [string, string];
  readonly rows: readonly CompareRowView[];
  readonly asks: readonly [CompareAskView, CompareAskView];
  readonly fits: readonly [CompareFitView, CompareFitView];
  readonly definitions: readonly CompareDefinitionView[];
  readonly sources: readonly FamilySource[];
}

/**
 * Both sides go through the same mapping, field for field, in the order the data gives them: nothing here looks at which side is
 * first, so the template is neutral by construction (the schema already gives both sides the same fields).
 */
export function compareView(data: CompareData): CompareView {
  const [left, right] = data.sides;
  const rows = COMPARE_ROWS.map((row): CompareRowView => ({ label: row.label, cells: [left[row.key], right[row.key]] }));
  const definitions = data.definitions.map((definition): CompareDefinitionView => {
    const index = data.sources.findIndex((source) => source.id === definition.sourceId);
    const source = data.sources[index];
    if (source === undefined) {
      throw new Error(`Comparison "${data.slug}": definition "${definition.term}" cites source "${definition.sourceId}", which is not in family.sources.`);
    }
    return { term: definition.term, text: definition.text, sourceNumber: index + 1, sourceHref: sourceAnchor(source.id) };
  });
  return {
    names: [left.name, right.name],
    rows,
    asks: [
      { name: left.name, items: left.askThis },
      { name: right.name, items: right.askThis },
    ],
    fits: [
      { name: left.name, text: data.whereEachFits[0] },
      { name: right.name, text: data.whereEachFits[1] },
    ],
    definitions,
    sources: data.sources,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Journey
// ---------------------------------------------------------------------------------------------------------------------------------

/** A step of the program as the journey list sees it. The titles equal PROGRAM_STEPS; the list adds no step and no duration. */
export interface StepInput {
  readonly title: string;
  readonly body: string;
}

export type StepState = 'done' | 'current' | 'next';

export interface JourneyStepView {
  readonly n: number;
  readonly title: string;
  readonly body: string;
  readonly state: StepState;
}

/** The steps in order, each marked relative to the page's own step: earlier steps done, that step current, later steps next. */
export function journeySteps(steps: readonly StepInput[], current?: number): readonly JourneyStepView[] {
  return steps.map((step, index): JourneyStepView => {
    const n = index + 1;
    const state: StepState = current === undefined || n > current ? 'next' : n === current ? 'current' : 'done';
    return { n, title: step.title, body: step.body, state };
  });
}

export interface ChecklistItemView {
  readonly id: string;
  readonly text: string;
  /** Present only when the target is live (fail-closed). */
  readonly href?: string;
}

export interface JourneyView {
  readonly steps: readonly JourneyStepView[];
  readonly current: number | undefined;
  readonly questions: readonly string[];
  readonly checklist: readonly ChecklistItemView[];
  readonly sources: readonly FamilySource[];
}

/** The route part of a path: a link target may carry a hash or a query, the ledger knows only the route. */
export function routeOf(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

export function journeyView(data: JourneyData, steps: readonly StepInput[], isLive: (path: string) => boolean): JourneyView {
  if (data.step !== undefined && (data.step < 1 || data.step > steps.length)) {
    throw new Error(`Journey "${data.slug}": step ${data.step} is outside the ${steps.length} steps of the program.`);
  }
  const checklist = (data.checklist ?? []).map((item): ChecklistItemView => {
    const live = item.href !== undefined && isLive(routeOf(item.href));
    return { id: item.id, text: item.text, ...(live && item.href !== undefined ? { href: item.href } : {}) };
  });
  return { steps: journeySteps(steps, data.step), current: data.step, questions: data.questions, checklist, sources: data.sources };
}
