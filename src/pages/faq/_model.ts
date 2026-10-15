import { anchorId, groupBy } from '../../components/reference/jsonld.ts';

/**
 * What the FAQ page shows, as data (WP-78, docs/wave8-contracts.md section 8.4). The page groups the entries by audience first, in a fixed
 * order, and by topic inside each audience. This module is pure and free of Astro globals so a unit test can build the same sections the
 * page does. Its file name starts with an underscore, so Astro does not turn it into a route.
 *
 * An entry with no `audience` is general and sits first, under "For everyone". A "Read more" link is shown only when its route is live, so
 * an answer can point at a page that another package is still writing and the link appears when that page does, with no edit here.
 */

export type FaqAudience = 'startup' | 'investor' | 'partner' | 'corporate';
export type SectionId = 'general' | FaqAudience;

/** The shape of a `faq` collection entry that the page needs. */
export interface FaqEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly group: string;
  readonly audience?: FaqAudience | undefined;
  readonly seeAlso: readonly string[];
}

export interface SectionDefinition {
  readonly id: SectionId;
  /** The h2 of the section and the text of its jump link. */
  readonly label: string;
  /** The section's anchor, `faq-for-<slug>`. */
  readonly slug: string;
}

/** The reading order of the page: general first, then each audience. */
export const SECTIONS: readonly SectionDefinition[] = [
  { id: 'general', label: 'For everyone', slug: 'faq-for-everyone' },
  { id: 'startup', label: 'For startups', slug: 'faq-for-startups' },
  { id: 'investor', label: 'For investors', slug: 'faq-for-investors' },
  { id: 'partner', label: 'For partners', slug: 'faq-for-partners' },
  { id: 'corporate', label: 'For corporate teams', slug: 'faq-for-corporate-teams' },
];

/**
 * The link text of every route an entry can name in `seeAlso`: the title of the page it leads to. A live route with no title here is an
 * error, so a link is never written from a bare path. tests/unit/wp-78 checks each title against the page's own frontmatter where the
 * page is in the repository.
 */
export const SEE_ALSO_TITLES: Readonly<Record<string, string>> = {
  '/apply/': 'Start a readiness review',
  '/contact/': 'Talk to WE',
  '/fundability/': 'Fundability and investor readiness',
  '/investors/interest/': 'Ask to meet a company',
  '/investors/meet-startups/': 'Meet the startups',
  '/investors/readiness-criteria/': 'Readiness criteria',
  '/investors/what-you-can-see/': 'What you can see',
  '/legal/privacy/': 'Privacy notice',
  '/network/partners/': 'Partner with WE',
  '/network/partners/categories/': 'Partner categories',
  '/network/partners/enquire/': 'Send a partner enquiry',
  '/network/partners/faq/': 'Partner FAQ',
  '/network/partners/how-it-works/': 'How partner enquiries work',
  '/how-we-work/': 'How WE works',
  '/program/build/': 'Build: ship the first product',
  '/program/dedicated-teams/': 'Dedicated seats, steered by WE',
  '/program/dream/': 'Dream: validate the problem',
  '/program/grow/': 'Grow: earn customers',
  '/program/how-it-works/': 'How the program works',
  '/program/how-we-decide/': 'How WE decides',
  '/program/who-its-for/': 'Who the program is for',
  '/services/': 'Seven service lines',
  '/services/customer-and-market-development/': 'Customer Relations and Market Development',
  '/services/professional-services-coordination/': 'Professional-Services Coordination',
  '/tools/': 'Founder tools',
  '/tools/team-composer/': 'Team Composer',
};

export interface SeeAlsoLink {
  readonly href: string;
  readonly title: string;
}

export interface GroupView {
  readonly heading: string;
  /**
   * Unique across the page. The heading anchor is `faq-group-<slug>` and the accordion name is `faq-<slug>`. A general group's slug is its
   * topic alone, which keeps the ids the page has always had; an audience group's slug starts with the audience, so a topic that two
   * audiences share never collides.
   */
  readonly slug: string;
  readonly items: readonly FaqEntry[];
  /** The pages the group's answers point to, once each, in the order the answers name them, live routes only. */
  readonly seeAlso: readonly SeeAlsoLink[];
}

export interface SectionView extends SectionDefinition {
  readonly groups: readonly GroupView[];
}

export interface JumpLink {
  readonly href: string;
  readonly label: string;
}

/** Lower case, runs of anything but letters and digits become one hyphen. */
export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sectionOf(entry: FaqEntry): SectionId {
  return entry.audience ?? 'general';
}

function seeAlsoOf(items: readonly FaqEntry[], isLive: (path: string) => boolean): SeeAlsoLink[] {
  const links: SeeAlsoLink[] = [];
  const seen = new Set<string>();
  for (const entry of items) {
    for (const path of entry.seeAlso) {
      if (seen.has(path) || !isLive(path)) continue;
      const title = SEE_ALSO_TITLES[path];
      if (title === undefined) throw new Error(`FAQ entry "${entry.id}" names ${path} in seeAlso, which is live but has no title in SEE_ALSO_TITLES (src/pages/faq/_model.ts).`);
      seen.add(path);
      links.push({ href: path, title });
    }
  }
  return links;
}

/**
 * The sections of the page: general first, then each audience, and inside each the topics in the order the file first uses them. A
 * section with no entry is left out, so the page never shows an empty heading. Every anchor and accordion name is unique; a clash throws.
 */
export function buildSections(entries: readonly FaqEntry[], isLive: (path: string) => boolean): SectionView[] {
  const sections: SectionView[] = [];
  const anchors = new Set<string>();
  const claim = (anchor: string): void => {
    if (anchors.has(anchor)) throw new Error(`The FAQ page would use the anchor or accordion name "${anchor}" twice.`);
    anchors.add(anchor);
  };
  for (const definition of SECTIONS) {
    const inSection = entries.filter((entry) => sectionOf(entry) === definition.id);
    if (inSection.length === 0) continue;
    claim(definition.slug);
    const groups = groupBy(inSection).map((bucket): GroupView => {
      const topic = slugify(bucket.group);
      const slug = definition.id === 'general' ? topic : `${definition.id}-${topic}`;
      claim(`faq-group-${slug}`);
      claim(`faq-${slug}`);
      for (const entry of bucket.items) claim(anchorId('faq', entry.id));
      return { heading: bucket.group, slug, items: bucket.items, seeAlso: seeAlsoOf(bucket.items, isLive) };
    });
    sections.push({ ...definition, groups });
  }
  return sections;
}

/** The jump list at the top of the page: one in-page link per section that has questions. */
export function jumpLinks(sections: readonly SectionView[]): JumpLink[] {
  return sections.map((section) => ({ href: `#${section.slug}`, label: section.label }));
}
