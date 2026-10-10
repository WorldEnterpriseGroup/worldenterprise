import { COMPARE_CAPTION, COMPARE_QUESTION_COLUMN, FIXED, HEADINGS, HEADINGS_HUB, stepEyebrow } from '../families/copy.ts';
import type { FamilyData, FamilyLink, FamilySource } from '../families/types.ts';
import { compareView, industryView, journeyView, segmentView } from '../families/view.ts';
import type { StepInput } from '../families/view.ts';
import { markdownTable } from './mdx-transform.ts';

/**
 * The Markdown of a page-family page (segments, industries, comparisons, journey), made from the same pure views the templates render
 * (src/components/families/view.ts) and the same fixed words (copy.ts), so a twin cannot say anything the page does not. The order is the
 * template's: the fixed sentence under "About this page", the page's own body, then the structured sections. Pure, so a unit test drives
 * it with fabricated data; the assembly (assemble.ts) decides which pages get one.
 */

export interface FamilyTwinContext {
  /** The reading path of a segment: its live articles, newest first. Empty for every other family. */
  readonly reading: readonly FamilyLink[];
  /** The program's steps, for the journey list. */
  readonly steps: readonly StepInput[];
  /** True when a link to the route resolves in this build. */
  readonly isLive: (route: string) => boolean;
}

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** The callout every family page opens with: the heading and the one sentence its template fixes. */
export function fixedCallout(family: 'segments' | 'industries' | 'compare' | 'journey'): string {
  const sentence = family === 'segments' ? FIXED.segment : family === 'industries' ? FIXED.industry : family === 'compare' ? FIXED.compare : FIXED.journey;
  return ['> **' + HEADINGS.shared.about + '**', '>', `> ${sentence}`].join('\n');
}

function sourcesList(sources: readonly FamilySource[]): string {
  if (sources.length === 0) return '';
  return [`## ${HEADINGS.shared.sources}`, '', ...sources.map((s, i) => `${i + 1}. ${s.title}. ${s.publisher}. <${s.url}>. Accessed ${dateFormat.format(s.accessed)}.`)].join('\n');
}

const bullets = (items: readonly string[]): string => items.map((item) => `- ${item}`).join('\n');

const linkLine = (link: FamilyLink): string => `- [${link.title}](${link.href})${link.description === undefined || link.description === '' ? '' : `: ${link.description}`}`;

/** The sections a family page renders after its own body, as Markdown. */
export function familyTail(data: FamilyData, context: FamilyTwinContext): string {
  const parts: string[] = [];
  if (data.id === 'segments') {
    const view = segmentView(data, context.reading);
    parts.push(`## ${HEADINGS.segments.whoFor}\n\n${view.whoFor}`);
    parts.push([`## ${HEADINGS.segments.challenges}`, ...view.challenges.map((c) => `### ${c.title}\n\n${c.text}`)].join('\n\n'));
    if (view.reading.length > 0) parts.push([`## ${HEADINGS.segments.reading}`, '', ...view.reading.map(linkLine)].join('\n'));
    parts.push(sourcesList(view.sources));
  } else if (data.id === 'industries') {
    const view = industryView(data);
    parts.push(`## ${HEADINGS.industries.buyer}\n\n${view.buyer}`);
    parts.push(
      [
        `## ${HEADINGS.industries.perimeter}`,
        ...view.perimeter.map((item) => `### ${item.title}\n\n${item.jurisdiction}. ${item.asOf}.\n\n${item.text}\n\nSource ${item.sourceNumber}: ${item.sourceTitle}`),
      ].join('\n\n'),
    );
    parts.push(`## ${HEADINGS.industries.data}\n\n${bullets(view.dataQuestions)}`);
    parts.push(`## ${HEADINGS.industries.sales}\n\n${view.salesCycle}`);
    parts.push(sourcesList(view.sources));
  } else if (data.id === 'compare') {
    const view = compareView(data);
    parts.push(`## ${HEADINGS.compare.table}\n\n${markdownTable(COMPARE_CAPTION, [COMPARE_QUESTION_COLUMN, ...view.names], view.rows.map((row) => [row.label, ...row.cells]))}`);
    parts.push([`## ${HEADINGS.compare.ask}`, ...view.asks.map((side) => `### ${side.name}\n\n${bullets(side.items)}`)].join('\n\n'));
    parts.push([`## ${HEADINGS.compare.fits}`, ...view.fits.map((side) => `### ${side.name}\n\n${side.text}`)].join('\n\n'));
    parts.push(`## ${HEADINGS.compare.definitions}\n\n${view.definitions.map((d) => `- **${d.term}.** ${d.text} Source ${d.sourceNumber}.`).join('\n')}`);
    parts.push(sourcesList(view.sources));
  } else {
    const view = journeyView(data, context.steps, context.isLive);
    const marker = view.current === undefined ? '' : `${stepEyebrow(view.current, view.steps.length)}\n\n`;
    parts.push(`## ${HEADINGS.journey.steps}\n\n${marker}${view.steps.map((step) => `${step.n}. **${step.title}.** ${step.body}`).join('\n')}`);
    if (view.questions.length > 0) parts.push(`## ${HEADINGS.journey.questions}\n\n${bullets(view.questions)}`);
    if (view.checklist.length > 0) {
      parts.push(
        [`## ${HEADINGS.journey.checklist}`, '', `> ${FIXED.checklist}`, '', ...view.checklist.map((item) => (item.href === undefined ? `- ${item.text}` : `- [${item.text}](${item.href})`))].join('\n'),
      );
    }
    parts.push(sourcesList(view.sources));
  }
  return parts.filter((part) => part.trim() !== '').join('\n\n');
}

/** The sections of a family hub after its own body: the journey hub's steps and questions, then the list of live pages. */
export function hubTail(family: 'industries' | 'compare' | 'journey', cards: readonly FamilyLink[], extra: { readonly steps?: readonly StepInput[]; readonly questions?: readonly string[] } = {}): string {
  const parts: string[] = [];
  if (extra.steps !== undefined && extra.steps.length > 0) {
    parts.push(`## ${HEADINGS.journey.steps}\n\n${extra.steps.map((step, i) => `${i + 1}. **${step.title}.** ${step.body}`).join('\n')}`);
  }
  if (extra.questions !== undefined && extra.questions.length > 0) parts.push(`## ${HEADINGS.journey.questions}\n\n${bullets(extra.questions)}`);
  if (cards.length > 0) parts.push([`## ${HEADINGS_HUB[family]}`, '', ...cards.map(linkLine)].join('\n'));
  return parts.join('\n\n');
}
