/**
 * The words the family templates fix, so a page cannot omit, reword or reorder them (contracts section 8.2). Headings are sentence
 * case. Every sentence here is traced in `.astro-magazine/sources/wp-71.json` (`template_sentences`) and is scanned against the
 * claims denylist by tests/unit/wp-71/copy.test.ts.
 */

/** The fixed sentences. Each is quoted from, or restates, a rule of docs/wave8-contracts.md. */
export const FIXED = {
  /** Contracts section 8.2, segments. */
  segment: 'This page describes a situation. It is not an eligibility rule.',
  /** Contracts section 8.2, industries. */
  industry: 'This page is about considerations. It does not describe any WE company or result.',
  /** Contracts section 0, rule 11: comparison pages compare categories, never products or companies. */
  compare: 'This page compares categories. It does not compare products or companies.',
  /** Contracts section 0, rule 10: the journey pages describe a sequence and promise no duration. */
  journey: 'This page describes a sequence. It does not state how long any step takes.',
  /** Contracts section 8.2, journey: the checklist is guidance, never a condition of applying. */
  checklist: 'This checklist is guidance. It is not a condition of applying.',
} as const;

export type FixedKey = keyof typeof FIXED;

/** The section headings each template renders, in the order it renders them. */
export const HEADINGS = {
  segments: { whoFor: 'Who this is for', challenges: 'Common challenges', reading: 'Reading path' },
  industries: {
    buyer: 'Who buys and who decides',
    perimeter: 'The regulatory and standards perimeter',
    data: 'Questions about data handling',
    sales: 'The sales cycle',
  },
  compare: {
    table: 'Side by side',
    ask: 'Questions to ask',
    fits: 'Where each fits',
    definitions: 'Definitions',
  },
  journey: { steps: 'The steps', questions: 'Questions you can ask', checklist: 'Checklist', pages: 'In this journey' },
  shared: { sources: 'Sources', about: 'About this page' },
} as const;

/** The caption of the side-by-side table. */
export const COMPARE_CAPTION = 'The two categories on the same three questions';

/** The row labels of the side-by-side table. The same rows, in the same order, for both sides. */
export const COMPARE_ROWS = [
  { key: 'whatItIs', label: 'What it is' },
  { key: 'whoItFits', label: 'Who it fits' },
  { key: 'asksOfFounder', label: 'What it asks of a founder' },
] as const;

/** The column header of the row labels in the side-by-side table. */
export const COMPARE_QUESTION_COLUMN = 'Question';

/** Eyebrows used when a page's frontmatter sets none. */
export const EYEBROWS = {
  segments: 'Founder segments',
  industries: 'Industry considerations',
  compare: 'Comparison',
  journey: 'Journey',
} as const;

/** What a hub shows when its own `index` page has not been written yet. The structure stays; the intro is generic. */
export const HUB_FALLBACK = {
  industries: {
    title: 'Industries',
    description: 'Considerations for SaaS companies in regulated and specialist industries, drawn from primary sources.',
    lead: 'Considerations by industry, each from primary sources. These pages describe no WE company or result.',
  },
  compare: {
    title: 'Compare',
    description: 'Plain comparisons of categories a founder weighs, with the sources named and no products ranked.',
    lead: 'Plain comparisons of categories, with the sources named.',
  },
  journey: {
    title: 'Journey',
    description: 'The steps from application to a working team, in order, with questions a founder can ask at each step.',
    lead: 'The steps from application to a working team, in order.',
  },
} as const;

/** Headings of the list of pages on each hub. */
export const HEADINGS_HUB = {
  industries: 'Industries',
  compare: 'Comparisons',
  journey: 'Journey pages',
} as const;

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** "As of October 12, 2026", from the date of a perimeter item. UTC, so the build host's zone cannot move the day. */
export function asOfLabel(date: Date): string {
  return `As of ${dateFormat.format(date)}`;
}

/** "Step 2 of 5" for a journey page that names its step. */
export function stepEyebrow(step: number, total: number): string {
  return `Step ${step} of ${total}`;
}
