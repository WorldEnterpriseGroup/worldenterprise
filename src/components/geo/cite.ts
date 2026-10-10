import { site } from '../../data/site.ts';
import { buildAbsolute } from '../../lib/url-core.ts';

/**
 * The suggested citation of a page. Pure, so a unit test checks the exact text. The author is the editorial Organization that the
 * article byline and the JSON-LD name ("World Enterprise Editorial"), never a person.
 */
export const CITATION_AUTHOR = 'World Enterprise Editorial';

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export interface CitationInput {
  readonly title: string;
  /** Route path, for example /insights/x/. The citation always names the production URL. */
  readonly path: string;
  /** The date the page was last updated, or first published when it was never updated. */
  readonly date?: Date | undefined;
}

/** For example: World Enterprise Editorial. “Title.” World Enterprise Incubator, updated October 9, 2026. https://worldenterprise.org/insights/x/ */
export function citationText({ title, path, date }: CitationInput): string {
  const heading = title.replace(/[.!?]+$/, '');
  const stamp = date === undefined || Number.isNaN(date.getTime()) ? '' : `, updated ${dateFormat.format(date)}`;
  return `${CITATION_AUTHOR}. “${heading}.” ${site.name}${stamp}. ${buildAbsolute(path, site.origin)}`;
}
