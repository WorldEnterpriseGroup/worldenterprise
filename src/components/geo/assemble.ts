import { site } from '../../data/site.ts';
import {
  buildTwin,
  faqTwinBody,
  glossaryTwinBody,
  playbookTwinBody,
  requiredStatements,
  serviceTwinBody,
  sourcesBody,
} from '../../lib/markdown-twins.ts';
import type { FaqTwinItem, GlossaryTwinItem, RequiredRuleLike, SourceLike, TwinSource } from '../../lib/markdown-twins.ts';

/**
 * Chooses which entries get a Markdown twin and assembles each one. Pure, so `node --test` runs it over the real content files;
 * src/components/geo/twin-sources.ts loads the collections and calls it with the live-route test.
 *
 * What gets a twin, and why that is all:
 * - insights and research briefs, whose MDX body is plain Markdown (the others use components, so they are skipped, not converted);
 * - the marketing and legal pages whose page file adds only a lead line and a call to action to the MDX body (listed in PAGE_TWINS);
 * - service lines and playbooks, built from the same frontmatter fields the page renders, because their body prose is MDX;
 * - the FAQ and the glossary, built from their data files.
 * Library templates are excluded: src/pages/library/[slug].md.ts already serves them as downloads.
 */

export interface PageTwinSpec {
  readonly route: string;
  /** Entry id in the pages collection. */
  readonly id: string;
  /** The lead the page shows under its H1. */
  readonly lead: string;
}

/** Pages whose rendered content is the MDX body plus the lead. Anything else would produce a twin that is a fragment of its page. */
export const PAGE_TWINS: readonly PageTwinSpec[] = [
  { route: '/about/facts/', id: 'about/facts', lead: 'Plain answers about what WE is, what it is not and how it works, each sourced from this site.' },
  { route: '/about/manifesto/', id: 'about/manifesto', lead: site.signature },
  { route: '/about/editorial-policy/', id: 'about/editorial-policy', lead: 'How WE chooses, sources, checks, dates and corrects what it publishes.' },
  { route: '/legal/privacy/', id: 'legal/privacy', lead: 'What the site collects, where it goes, and what it never does.' },
  { route: '/legal/accessibility/', id: 'legal/accessibility', lead: 'Our target, how the site is built and tested, and the gaps we know about.' },
  { route: '/legal/terms/', id: 'legal/terms', lead: 'The rules for using this website.' },
];

export const FAQ_LEAD = 'Straight answers, including what WE does not do.';
export const GLOSSARY_LEAD = 'Terms founders meet, defined neutrally. These are general definitions, not legal or financial advice.';

interface Entry<D> {
  readonly id: string;
  readonly body?: string | undefined;
  readonly data: D;
}

export interface InsightData {
  readonly title: string;
  readonly description: string;
  readonly publishedDate: Date;
  readonly updatedDate?: Date | undefined;
  readonly sources: readonly SourceLike[];
}

export interface ResearchData {
  readonly title: string;
  readonly subtitle: string;
  readonly publishedDate: Date;
  readonly updatedDate?: Date | undefined;
  readonly methodology: string;
  readonly limitations: string;
  readonly sources: readonly SourceLike[];
}

export interface PageData {
  readonly title: string;
  readonly updated: Date;
}

export interface ServiceData {
  readonly title: string;
  readonly summary: string;
  readonly covers: readonly string[];
  readonly artifacts: readonly { readonly name: string; readonly purpose: string }[];
  readonly doesNotCover: readonly string[];
  readonly updated: Date;
}

export interface PlaybookData {
  readonly title: string;
  readonly description: string;
  readonly steps: readonly { readonly title: string; readonly body: string }[];
  readonly artifacts: readonly string[];
  readonly updated: Date;
}

export interface TwinContent {
  readonly insights: readonly Entry<InsightData>[];
  readonly research: readonly Entry<ResearchData>[];
  readonly pages: readonly Entry<PageData>[];
  readonly services: readonly Entry<ServiceData>[];
  readonly playbooks: readonly Entry<PlaybookData>[];
  readonly faq: readonly FaqTwinItem[];
  readonly glossary: readonly GlossaryTwinItem[];
  /** The most recent date among the FAQ and glossary pages, which their page files fix by hand. */
  readonly referenceUpdated: Date;
}

export interface AssembleOptions {
  /** True when the page at the route is built, indexable and not a draft. */
  readonly isEligible: (route: string) => boolean;
  /** The `required` rules of claims-denylist.json. */
  readonly required: readonly RequiredRuleLike[];
}

export interface SkippedTwin {
  readonly route: string;
  readonly reason: string;
}

export interface AssembledTwins {
  readonly twins: readonly TwinSource[];
  readonly skipped: readonly SkippedTwin[];
}

const lastSegment = (id: string): string => id.split('/').at(-1) ?? id;

function withSources(body: string, sources: readonly SourceLike[]): string {
  const list = sourcesBody(sources);
  return list === '' ? body.trim() : `${body.trim()}\n\n${list}`;
}

/** Builds every twin source for the given content. A candidate whose route is not eligible or whose text fails the lint is listed in `skipped`. */
export function assembleTwins(content: TwinContent, options: AssembleOptions): AssembledTwins {
  const twins: TwinSource[] = [];
  const skipped: SkippedTwin[] = [];

  const add = (source: Omit<TwinSource, 'statements'>): void => {
    if (!options.isEligible(source.route)) {
      skipped.push({ route: source.route, reason: 'the page is not built, not indexable or a draft' });
      return;
    }
    const statements = requiredStatements(source.route, source.body, options.required);
    const candidate: TwinSource = { ...source, statements };
    const built = buildTwin(candidate);
    if (built.problems.length > 0) {
      skipped.push({ route: source.route, reason: built.problems.join('; ') });
      return;
    }
    twins.push(candidate);
  };

  for (const entry of content.insights) {
    add({
      route: `/insights/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.description,
      updated: entry.data.updatedDate ?? entry.data.publishedDate,
      body: withSources(entry.body ?? '', entry.data.sources),
    });
  }

  for (const entry of content.research) {
    const sections = [entry.body ?? '', `## Methodology\n\n${entry.data.methodology}`, `## Limitations\n\n${entry.data.limitations}`];
    add({
      route: `/research/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.subtitle,
      updated: entry.data.updatedDate ?? entry.data.publishedDate,
      body: withSources(sections.map((s) => s.trim()).join('\n\n'), entry.data.sources),
    });
  }

  for (const spec of PAGE_TWINS) {
    const entry = content.pages.find((candidate) => candidate.id === spec.id || candidate.id === `${spec.id}/index`);
    if (entry === undefined) {
      skipped.push({ route: spec.route, reason: `no pages entry ${spec.id}` });
      continue;
    }
    add({ route: spec.route, title: entry.data.title, lead: spec.lead, updated: entry.data.updated, body: entry.body ?? '' });
  }

  for (const entry of content.services) {
    add({
      route: `/services/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.summary,
      updated: entry.data.updated,
      body: serviceTwinBody(entry.data),
    });
  }

  for (const entry of content.playbooks) {
    add({
      route: `/playbooks/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.description,
      updated: entry.data.updated,
      body: playbookTwinBody(entry.data),
    });
  }

  if (content.faq.length > 0) {
    add({ route: '/faq/', title: 'FAQ', lead: FAQ_LEAD, updated: content.referenceUpdated, body: faqTwinBody(content.faq) });
  }
  if (content.glossary.length > 0) {
    add({ route: '/glossary/', title: 'Glossary', lead: GLOSSARY_LEAD, updated: content.referenceUpdated, body: glossaryTwinBody(content.glossary) });
  }

  return { twins, skipped };
}
