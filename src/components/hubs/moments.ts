/**
 * Media moments on the hubs (WP-24). A moment is one figure a reader stops at: an authored diagram, a sourced chart, a scene, a row of
 * sourced figures or an illustrated index. Every moment carries `data-moment` (its kind) and `data-media-id` (a stable id, unique on
 * the site), set by HubFigure or HubMoment, so the unit tests count them in the source and the e2e specs count them on the page.
 *
 * HUB_MOMENTS is the inventory the handoff lists: route, then the media ids it shows, in page order. The first two of each route sit in
 * the first viewport or the first section after it. Pure data.
 */

export const MOMENT_KINDS = ['diagram', 'chart', 'illustration', 'scene', 'stats', 'index', 'timeline'] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

export function momentKind(kind: string): MomentKind {
  if ((MOMENT_KINDS as readonly string[]).includes(kind)) return kind as MomentKind;
  throw new RangeError(`moment kind "${kind}" is not one of ${MOMENT_KINDS.join(', ')}`);
}

/** A media id: lower-case words joined by hyphens, starting `hub-`. */
export function mediaId(id: string): string {
  if (/^hub-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return id;
  throw new RangeError(`media id "${id}" must start "hub-" and use lower-case letters, digits and hyphens`);
}

export interface HubInventory {
  /** Source files that render the route's moments (the tests read them). */
  readonly files: readonly string[];
  readonly moments: readonly string[];
  /** The early interaction: what the reader can do in the first sections without leaving the page. */
  readonly interaction: string;
}

export const HUB_MOMENTS: Readonly<Record<string, HubInventory>> = {
  '/insights/': {
    files: ['src/pages/insights/index.astro'],
    moments: ['hub-insights-sky', 'hub-insights-clock', 'hub-insights-desks', 'hub-insights-reading'],
    interaction: 'Desk filter: radio buttons that show one desk at a time, with no script.',
  },
  '/insights/topic/': {
    files: ['src/pages/insights/topic/[topic].astro'],
    moments: ['hub-topic-sky', 'hub-topic-reading'],
    interaction: 'The desk legend: this desk is lit and every other desk opens its own page.',
  },
  '/tools/': {
    files: ['src/pages/tools/index.astro', 'src/components/tools/ToolMap.astro'],
    moments: ['hub-tools-map', 'hub-tools-cards'],
    interaction: 'Verb filter: calculate, check, prepare or sketch.',
  },
  '/library/': {
    files: ['src/pages/library/index.astro', 'src/components/library/ShelfDiagram.astro', 'src/components/library/DocAnatomy.astro'],
    moments: ['hub-library-shelf', 'hub-library-anatomy', 'hub-library-cards'],
    interaction: 'Kind filter: templates, checklists, worksheets or guides.',
  },
  '/resources/': {
    files: ['src/pages/resources/index.astro'],
    moments: ['hub-resources-matrix', 'hub-resources-formation'],
    interaction: 'Stage filter over the lists by stage; every matrix header jumps to its list.',
  },
  '/industries/': {
    files: ['src/pages/industries/[...hub].astro'],
    moments: ['hub-industries-orbit', 'hub-industries-survival', 'hub-industries-swarm'],
    interaction: 'The orbit labels: each world is a link to its industry page.',
  },
  '/compare/': {
    files: ['src/pages/compare/[...hub].astro', 'src/components/hubs/HorizonCompare.astro'],
    moments: ['hub-compare-horizon', 'hub-compare-odds'],
    interaction: 'The horizon figure opens its data table; each card opens one comparison.',
  },
  '/journey/': {
    files: ['src/pages/journey/[...hub].astro'],
    moments: ['hub-journey-clock', 'hub-journey-rounds'],
    interaction: 'The timeline links each gate to its source; the step list opens each step.',
  },
  '/founders/': {
    files: ['src/pages/founders/index.astro'],
    moments: ['hub-founders-age', 'hub-founders-figures', 'hub-founders-situations'],
    interaction: 'The founder-age scatter opens its data table; the orbit labels light each situation.',
  },
  '/investors/': {
    files: ['src/pages/investors/index.astro'],
    moments: ['hub-investors-gaps', 'hub-investors-dilution', 'hub-investors-figures'],
    interaction: 'Each chart opens its data table.',
  },
  '/faq/': {
    files: ['src/pages/faq/index.astro'],
    moments: ['hub-faq-map', 'hub-faq-figures'],
    interaction: 'The question map: every topic in its legend jumps to its questions.',
  },
};

/** The tool pages that draw their schematic (`hub-tool-<slug>`) above the tool itself. */
export const TOOL_SCHEMATIC_PAGES = [
  'src/pages/tools/runway-calculator.astro',
  'src/pages/tools/metrics-calculator.astro',
  'src/pages/tools/cap-table-explainer.astro',
  'src/pages/tools/evidence-room.astro',
  'src/pages/tools/pricing-page-checker.astro',
  'src/pages/tools/team-composer.astro',
] as const;
