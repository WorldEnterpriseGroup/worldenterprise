/**
 * What each founder tool computes, as data for its schematic (WP-24): what you put in, what the tool does with it and what you get back.
 * The /tools/ hub draws a small schematic on every card and each tool page draws the full one under its hero, so a reader sees the tool
 * before using it. The labels describe the working only; none is an amount, a price or an outcome. Pure data, no Astro imports.
 */

export type ToolVerb = 'calculate' | 'check' | 'prepare' | 'sketch';
export type ToolGlyph = 'runway' | 'metrics' | 'cap-table' | 'evidence' | 'pricing' | 'team';

export interface ToolSchematicData {
  readonly href: string;
  readonly verb: ToolVerb;
  readonly glyph: ToolGlyph;
  readonly inputs: readonly string[];
  /** What the tool does, in a few words. */
  readonly working: string;
  readonly outputs: readonly string[];
  /** One sentence for the drawing's text alternative. */
  readonly alt: string;
  /** Where on the road from idea to raise the tool helps most (an index into ROAD). */
  readonly stage: number;
}

/** The stretches of the long road the tool map draws, in order. */
export const ROAD = ['Shaping the idea', 'Building the first release', 'Launching to customers', 'Growing the company', 'Preparing for investors'] as const;

export const VERB_LABELS: Readonly<Record<ToolVerb, string>> = {
  calculate: 'Calculate',
  check: 'Check',
  prepare: 'Prepare',
  sketch: 'Sketch',
};

export const SCHEMATICS: readonly ToolSchematicData[] = [
  {
    href: '/tools/team-composer/',
    verb: 'sketch',
    glyph: 'team',
    inputs: ['The roles you need', 'How many people each role takes'],
    working: 'Groups the roles',
    outputs: ['Building the product', 'Building the company', 'Coordinating the work'],
    alt: 'Roles go in, are grouped, and come out as a team sketch in three groups: the product, the company and the coordination.',
    stage: 1,
  },
  {
    href: '/tools/metrics-calculator/',
    verb: 'calculate',
    glyph: 'metrics',
    inputs: ['One month of revenue movements', 'Customers and acquisition spend', 'Cash and net burn'],
    working: 'Applies six formulas',
    outputs: ['Net new MRR', 'Gross revenue churn', 'Quick ratio', 'CAC payback', 'LTV to CAC', 'Runway'],
    alt: 'One month of numbers goes in and six SaaS metrics come out, each with the formula shown.',
    stage: 3,
  },
  {
    href: '/tools/evidence-room/',
    verb: 'prepare',
    glyph: 'evidence',
    inputs: ['Your stage', 'The items you already hold'],
    working: 'Filters the checklist',
    outputs: ['What is ready', 'What is left', 'A list to print or copy as Markdown'],
    alt: 'Your stage and the items you hold go in; a filtered checklist of what is ready and what is left comes out.',
    stage: 4,
  },
  {
    href: '/tools/runway-calculator/',
    verb: 'calculate',
    glyph: 'runway',
    inputs: ['Cash in the bank', 'Net burn a month', 'Burn growth, if any'],
    working: 'Divides, month by month',
    outputs: ['Runway in whole months', 'Every step of the working'],
    alt: 'Cash, net burn and burn growth go in; runway in whole months comes out, with the working shown.',
    stage: 3,
  },
  {
    href: '/tools/pricing-page-checker/',
    verb: 'check',
    glyph: 'pricing',
    inputs: ['Statements from the launch checklist', 'The ones true of your page'],
    working: 'Counts what you marked',
    outputs: ['How many are marked', 'Which are left'],
    alt: 'The checklist statements you tick go in; a count of what is marked and a list of what is left come out.',
    stage: 2,
  },
  {
    href: '/tools/cap-table-explainer/',
    verb: 'calculate',
    glyph: 'cap-table',
    inputs: ['Shares you hold', 'Shares others hold', 'Shares to issue'],
    working: 'Divides before and after',
    outputs: ['Your ownership before', 'Your ownership after', 'Every division shown'],
    alt: 'Share counts go in; your ownership before and after the new shares comes out as two divisions.',
    stage: 4,
  },
];

export function schematicFor(href: string): ToolSchematicData {
  const found = SCHEMATICS.find((s) => s.href === href);
  if (found === undefined) throw new Error(`schematics: no schematic for ${href}`);
  return found;
}
