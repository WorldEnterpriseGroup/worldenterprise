import { buildAbsolute } from './url-core.ts';
import { twinPath } from './markdown-twins.ts';
import type { RenderedTwin } from './markdown-twins.ts';

/**
 * /llms.txt and /llms-full.txt (docs/wave7-contracts.md, section 3). Both are generated from data passed in by the endpoints,
 * never typed by hand: the site identity (site.ts), the packages (packages.ts), the live routes (route state) and the Markdown
 * twins. This module is pure, free of Astro globals, so a unit test can change a package name and see both files change.
 */

/** The no-funding sentence, required in both files by rule R-W7-C05-no-funding-disclaimer. */
export const NO_FUNDING_SENTENCE = 'WE makes no promise of funding.';

/** Cap on /llms-full.txt, in bytes of UTF-8. A unit test builds the real file and fails when it passes the cap. */
export const LLMS_FULL_MAX_BYTES = 262_144;

/**
 * The share of the cap that /llms-full.txt plans for (W8-26): the selection stops at 90 percent so a page that grows or a desk that
 * is added does not push the build over the hard cap. The throw in buildLlmsFullTxt stays as the backstop.
 */
export const LLMS_FULL_BUDGET_RATIO = 0.9;

/** The planned size ceiling of /llms-full.txt, in bytes of UTF-8. */
export const llmsFullBudget = (cap: number = LLMS_FULL_MAX_BYTES): number => Math.floor(cap * LLMS_FULL_BUDGET_RATIO);

export interface LlmsSite {
  readonly name: string;
  readonly legalName: string;
  readonly tagline: string;
  readonly description: string;
  readonly origin: string;
}

export interface LlmsPackage {
  readonly name: string;
  readonly stageFit: string;
  readonly depth: string;
}

export interface LlmsServiceLine {
  readonly line: string;
  readonly title: string;
  readonly route: string;
  readonly summary: string;
}

export interface LlmsPage {
  readonly route: string;
  readonly title: string;
  readonly description?: string | undefined;
}

/** A named group of pages in llms.txt: a page family, an insight desk. */
export interface LlmsGroup {
  readonly label: string;
  /** The group's hub page, when it has one and it is live. */
  readonly hub?: LlmsPage | undefined;
  /** The live entries, in registry order. Titles are registry labels, so a blocked word never rides in on a page title. */
  readonly pages: readonly LlmsPage[];
}

export interface LlmsInput {
  readonly site: LlmsSite;
  readonly packages: readonly LlmsPackage[];
  readonly serviceLines: readonly LlmsServiceLine[];
  /** The pages WE points a reader to first. Live routes only; the caller filters. */
  readonly keyPages: readonly LlmsPage[];
  /** The insight desks that have a live page, in registry order. */
  readonly desks?: readonly LlmsGroup[] | undefined;
  /** The page families (segments, industries, comparisons, journey, briefs) with a live page, in registry order. */
  readonly families?: readonly LlmsGroup[] | undefined;
  /** Briefs, articles and other pages listed under Optional. Live routes only. */
  readonly optionalPages: readonly LlmsPage[];
  /** The decision-criteria page, or null while /program/how-we-decide/ is not live. */
  readonly howWeDecide: LlmsPage | null;
  /** Routes that have a Markdown twin; a link to any other route goes to the HTML page. */
  readonly twinRoutes: ReadonlySet<string>;
  /** The form routes, or null when the route is not live. */
  readonly contactRoute: string | null;
  readonly applyRoute: string | null;
  /**
   * What /about/facts/ says about the paid investor add-on: that it is separate from the packages, the flat-fee sentence and the
   * verbatim disclaimer. Taken from the facts page so the wording lives in one reviewed place.
   */
  readonly addOnStatement: string;
  /** The FAQ sentence about intake calendars and demo days, verbatim: the denylist allows its wording on the machine files. */
  readonly calendarStatement: string;
}

function linkTo(page: LlmsPage, twinRoutes: ReadonlySet<string>, origin: string): string {
  const url = buildAbsolute(twinRoutes.has(page.route) ? twinPath(page.route) : page.route, origin);
  const note = page.description !== undefined && page.description !== '' ? `: ${page.description}` : '';
  return `- [${page.title}](${url})${note}`;
}

const list = (lines: readonly string[]): string => lines.join('\n');

/** The Insight desks and Page families sections, generated from the registries so a new desk or family appears without an edit here. */
function groupSections(input: LlmsInput): string[] {
  const { origin } = input.site;
  const sections: string[] = [];
  const desks = (input.desks ?? []).flatMap((desk) => (desk.hub === undefined ? [] : [linkTo({ ...desk.hub, title: desk.label }, input.twinRoutes, origin)]));
  if (desks.length > 0) {
    sections.push(['## Insight desks', '', 'Each desk lists its own articles.', '', list(desks)].join('\n'));
  }
  const families = (input.families ?? []).filter((family) => family.hub !== undefined || family.pages.length > 0);
  if (families.length > 0) {
    const blocks = families.map((family) => {
      const lines = [
        ...(family.hub === undefined ? [] : [linkTo({ ...family.hub, title: `${family.label}: overview` }, input.twinRoutes, origin)]),
        ...family.pages.map((page) => linkTo(page, input.twinRoutes, origin)),
      ];
      return [`### ${family.label}`, '', list(lines)].join('\n');
    });
    sections.push(['## Page families', '', blocks.join('\n\n')].join('\n'));
  }
  return sections;
}

/** The statements both files carry, in one place so the two cannot drift apart. */
function limitsSection(input: LlmsInput): string {
  return [
    '## What WE does not do',
    '',
    list([
      `- ${NO_FUNDING_SENTENCE}`,
      `- ${input.addOnStatement}`,
      `- ${input.calendarStatement}`,
      '- WE does not give legal, tax or accounting advice, and does not keep your books or file your taxes.',
    ]),
  ].join('\n');
}

function commercialSection(input: LlmsInput): string {
  const ask = input.contactRoute === null ? 'Ask WE directly for the current rate.' : `Ask for the current rate through the contact form: ${buildAbsolute(input.contactRoute, input.site.origin)}`;
  return [
    '## Published commercial facts',
    '',
    list([
      '- The seat is the unit of work. A seat is one dedicated place on a founder’s team, filled by a person who works offshore and works only on that company. WE steers the team and manages the subcontractors who fill the seats.',
      `- WE offers ${input.packages.length} packages: ${input.packages.map((p) => p.name).join(', ')}. Each is a pre-configured seat plan sized for a company stage and covers all ${input.serviceLines.length} service lines at a different depth. A custom seat plan is the alternative.`,
      '- Seats scale up or down by notice. The written agreement sets out how.',
      `- Amounts are not published. ${ask}`,
      '- The paid add-on named in the section above is separate from the packages.',
    ]),
  ].join('\n');
}

function offersSection(input: LlmsInput): string {
  const lines = input.serviceLines.map((s) => `- [${s.title}](${buildAbsolute(s.route, input.site.origin)}): ${s.summary}`);
  const packages = input.packages.map((p) => `- ${p.name} (depth: ${p.depth}). Sized for: ${p.stageFit}`);
  return [
    `## What WE offers`,
    '',
    `${input.serviceLines.length} service lines, each with a page that says what it covers and what it does not:`,
    '',
    list(lines),
    '',
    `${input.packages.length} packages, named for the stage a company is at:`,
    '',
    list(packages),
  ].join('\n');
}

function whatSection(input: LlmsInput): string {
  const { site } = input;
  return [
    `## What WE is`,
    '',
    `${site.name} is ${site.tagline.charAt(0).toLowerCase()}${site.tagline.slice(1)}, run by ${site.legalName}. The work is fully remote and there are no physical offices. Dedicated team seats, steered by WE, take a founder from a first idea toward first customers and the evidence an investor asks for.`,
  ].join('\n');
}

/** The text of /llms.txt. */
export function buildLlmsTxt(input: LlmsInput): string {
  const { site } = input;
  const sections: string[] = [
    `# ${site.name}`,
    `> ${site.description}`,
    whatSection(input),
    offersSection(input),
    limitsSection(input),
    commercialSection(input),
  ];
  if (input.keyPages.length > 0) {
    sections.push(['## Key pages', '', 'Links go to the Markdown version of a page where one exists, and to the page itself otherwise.', '', list(input.keyPages.map((p) => linkTo(p, input.twinRoutes, site.origin)))].join('\n'));
  }
  sections.push(...groupSections(input));
  if (input.howWeDecide !== null) {
    sections.push(['## How WE decides', '', linkTo(input.howWeDecide, input.twinRoutes, site.origin)].join('\n'));
  }
  const contact: string[] = [];
  if (input.applyRoute !== null) contact.push(`- Apply: ${buildAbsolute(input.applyRoute, site.origin)}`);
  if (input.contactRoute !== null) contact.push(`- Contact form: ${buildAbsolute(input.contactRoute, site.origin)}`);
  contact.push('- WE publishes no email address yet, so the forms are the way to reach the team.');
  sections.push(['## Contact', '', list(contact)].join('\n'));
  if (input.optionalPages.length > 0) {
    sections.push(['## Optional', '', list(input.optionalPages.map((p) => linkTo(p, input.twinRoutes, site.origin)))].join('\n'));
  }
  return `${sections.join('\n\n')}\n`;
}

/** Thrown when /llms-full.txt would pass its cap. The build fails loudly rather than truncating a page. */
export class LlmsFullTooLargeError extends Error {
  readonly bytes: number;
  readonly cap: number;

  constructor(bytes: number, cap: number) {
    super(`llms-full.txt is ${bytes} bytes, over the cap of ${cap}. Remove a page from the key list or raise LLMS_FULL_MAX_BYTES in src/lib/llms.ts.`);
    this.name = 'LlmsFullTooLargeError';
    this.bytes = bytes;
    this.cap = cap;
  }
}

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

function fullHead(input: LlmsInput): string[] {
  const { site } = input;
  return [
    `# ${site.name}: full text of the key pages`,
    `> ${site.description}`,
    whatSection(input),
    limitsSection(input),
    commercialSection(input),
    `Each block below is one page, headed by its canonical URL. The index of all pages is ${buildAbsolute('/llms.txt', site.origin)}.`,
  ];
}

const fullBlock = (page: RenderedTwin, origin: string): string => `---\n\nSource: ${buildAbsolute(page.route, origin)}\n\n${page.markdown.trimEnd()}`;

export interface DroppedPage {
  readonly route: string;
  readonly reason: string;
}

export interface LlmsFullPlan {
  /** The pages that fit, in the order of the tiers. */
  readonly pages: readonly RenderedTwin[];
  readonly dropped: readonly DroppedPage[];
  /** Bytes the planned file takes. */
  readonly bytes: number;
}

/**
 * Chooses the pages of /llms-full.txt from tiers of candidates, most important first. A page is taken when the file stays within
 * the planned budget (90 percent of the cap) and left out otherwise, so the file stays under the cap however many pages a tier holds.
 * A route in two tiers is taken once. A twin with lint problems is dropped, because buildLlmsFullTxt refuses it.
 */
export function planLlmsFull(input: LlmsInput, tiers: readonly (readonly RenderedTwin[])[], cap: number = LLMS_FULL_MAX_BYTES): LlmsFullPlan {
  const budget = llmsFullBudget(cap);
  const pages: RenderedTwin[] = [];
  const dropped: DroppedPage[] = [];
  const seen = new Set<string>();
  let bytes = byteLength(`${fullHead(input).join('\n\n')}\n`);
  for (const tier of tiers) {
    for (const page of tier) {
      if (seen.has(page.route)) continue;
      seen.add(page.route);
      if (page.problems.length > 0) {
        dropped.push({ route: page.route, reason: `lint: ${page.problems.join('; ')}` });
        continue;
      }
      const size = byteLength(`\n\n${fullBlock(page, input.site.origin)}`);
      if (bytes + size > budget) {
        dropped.push({ route: page.route, reason: `over the planned budget of ${budget} bytes by ${bytes + size - budget}` });
        continue;
      }
      bytes += size;
      pages.push(page);
    }
  }
  return { pages, dropped, bytes };
}

/**
 * The text of /llms-full.txt: the same identity and limits as llms.txt, then the full text of each key page, every block headed
 * by its canonical URL. `pages` are rendered twins in the order they should appear; a twin with lint problems is refused, because a
 * file that leaks JSX is worse than a file without the page. Over the cap it throws; planLlmsFull keeps a real build well under it.
 */
export function buildLlmsFullTxt(input: LlmsInput, pages: readonly RenderedTwin[], cap: number = LLMS_FULL_MAX_BYTES): string {
  const broken = pages.filter((p) => p.problems.length > 0);
  if (broken.length > 0) {
    throw new Error(`llms-full.txt was given twins with lint problems: ${broken.map((p) => `${p.route} (${p.problems.join('; ')})`).join(', ')}`);
  }
  const blocks = pages.map((page) => fullBlock(page, input.site.origin));
  const text = `${[...fullHead(input), ...blocks].join('\n\n')}\n`;
  const bytes = byteLength(text);
  if (bytes > cap) throw new LlmsFullTooLargeError(bytes, cap);
  return text;
}
