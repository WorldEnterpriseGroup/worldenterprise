import { DESK_DEFINITIONS, deskPath } from '../../data/desks.ts';
import { COMPARISONS, INDUSTRIES, JOURNEY, SEGMENTS } from '../../data/families.ts';
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
import { findHubPage, liveCards, resolveEntries } from '../families/paths.ts';
import type { FamilyData, Registry } from '../families/types.ts';
import { readingPath } from '../families/view.ts';
import { PROGRAM_STEPS } from '../program/steps.ts';
import { familyTail, fixedCallout, hubTail } from './family-twin.ts';
import { transformMdx } from './mdx-transform.ts';

/**
 * Chooses which entries get a Markdown twin and assembles each one. Pure, so `node --test` runs it over the real content files;
 * src/components/geo/twin-sources.ts loads the collections and calls it with the live-route test.
 *
 * What gets a twin, and why that is all:
 * - insights, research briefs, fundability guides and the insights hub and desk pages, whose MDX body goes through the documented
 *   transforms of mdx-transform.ts (a component it does not know means no twin, never a twin with a hole);
 * - the marketing and legal pages whose page file adds only a lead line and a call to action to the MDX body (listed in PAGE_TWINS);
 * - service lines and playbooks, built from the same frontmatter fields the page renders, because their body prose is MDX;
 * - the page-family pages (founder segments, industries, comparisons, journey) and the industries, compare and journey hubs, which
 *   family-twin.ts builds from the same views the templates render. A family page exists only for a launched registry entry that holds
 *   a pages entry, exactly as its route does (resolveEntries), so a new family page gets its twin with no change here;
 * - the FAQ and the glossary, built from their data files.
 * Library templates are excluded: src/pages/library/[slug].md.ts already serves them as downloads. The pages that are written in
 * the .astro file itself (pricing, who it is for, apply, program, investors, network, about, guides index) have no twin: a second
 * copy of their prose would drift from the page, and the registry-driven lists in llms.txt link them instead.
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
  { route: '/about/facts/', id: 'about/facts', lead: 'Plain answers about what WE is and is not, what it offers, how seats and packages work, and how to reach the team.' },
  { route: '/about/manifesto/', id: 'about/manifesto', lead: site.signature },
  { route: '/about/editorial-policy/', id: 'about/editorial-policy', lead: 'How WE chooses, sources, checks, dates and corrects what it publishes.' },
  { route: '/legal/privacy/', id: 'legal/privacy', lead: 'What the site collects, where it goes, and what it never does.' },
  { route: '/legal/accessibility/', id: 'legal/accessibility', lead: 'Our target, how the site is built and tested, and the gaps we know about.' },
  { route: '/legal/terms/', id: 'legal/terms', lead: 'The rules for using this website.' },
];

/** The lead src/pages/insights/index.astro shows under its H1 (tests/unit/wp-91 pins the two together). */
export const INSIGHTS_LEAD = 'Practical, sourced pieces on how a SaaS idea becomes a company. Written by World Enterprise Editorial.';

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
  /** The desk id. When absent, the first segment of the entry id (the desk folder) is used. */
  readonly topic?: string | undefined;
  readonly publishedDate: Date;
  readonly updatedDate?: Date | undefined;
  /** The founder segments the article is for (the reading path of a segment page). */
  readonly segments?: readonly string[] | undefined;
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
  /** The page's description, which a family page shows as its lead. */
  readonly description?: string | undefined;
  /** The parsed `family` object of a page-family page. */
  readonly family?: FamilyData | undefined;
}

export interface GuideData {
  readonly section: string;
  readonly title: string;
  readonly description: string;
  readonly sources: readonly SourceLike[];
  readonly updated: Date;
}

/** The open abstract of a gated brief (src/content/briefs). Only these fields are ever read: the full text is outside the build (D-23). */
export interface BriefData {
  readonly title: string;
  readonly description: string;
  readonly outline: readonly string[];
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
  /** The guides collection. Optional so a content set without guides still assembles. */
  readonly guides?: readonly Entry<GuideData>[] | undefined;
  /** The briefs collection: open abstracts only. Optional so a content set without briefs still assembles. */
  readonly briefs?: readonly Entry<BriefData>[] | undefined;
  readonly faq: readonly FaqTwinItem[];
  readonly glossary: readonly GlossaryTwinItem[];
  /** The most recent date among the FAQ and glossary pages, which their page files fix by hand. */
  readonly referenceUpdated: Date;
}

export interface AssembleOptions {
  /** True when the page at the route is built, indexable and not a draft. */
  readonly isEligible: (route: string) => boolean;
  /** True when a link to the route resolves in this build (what `MaybeLink` and the article lists check). Defaults to `isEligible`. */
  readonly isLive?: ((route: string) => boolean) | undefined;
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

const byNewest = (a: { readonly date: Date; readonly title: string }, b: { readonly date: Date; readonly title: string }): number =>
  b.date.getTime() - a.date.getTime() || a.title.localeCompare(b.title, 'en');

/** Builds every twin source for the given content. A candidate whose route is not eligible or whose text fails the lint is listed in `skipped`. */
export function assembleTwins(content: TwinContent, options: AssembleOptions): AssembledTwins {
  const twins: TwinSource[] = [];
  const skipped: SkippedTwin[] = [];
  const isLive = options.isLive ?? options.isEligible;

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

  /** Adds a twin whose body is MDX: converted first, and skipped with the reason when the transform refuses it. */
  const addMdx = (source: Omit<TwinSource, 'statements' | 'body'> & { readonly mdx: string; readonly head?: string; readonly tail?: string }): void => {
    if (!options.isEligible(source.route)) {
      skipped.push({ route: source.route, reason: 'the page is not built, not indexable or a draft' });
      return;
    }
    const converted = transformMdx(source.mdx, { isLive });
    if (!converted.ok) {
      skipped.push({ route: source.route, reason: `MDX body not converted: ${converted.reason}` });
      return;
    }
    const { mdx: _mdx, head, tail, ...rest } = source;
    const body = [head ?? '', converted.markdown, tail ?? ''].filter((part) => part.trim() !== '').join('\n\n');
    add({ ...rest, body });
  };

  for (const entry of content.insights) {
    addMdx({
      route: `/insights/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.description,
      updated: entry.data.updatedDate ?? entry.data.publishedDate,
      mdx: entry.body ?? '',
      tail: sourcesBody(entry.data.sources),
    });
  }

  for (const entry of content.research) {
    addMdx({
      route: `/research/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.subtitle,
      updated: entry.data.updatedDate ?? entry.data.publishedDate,
      mdx: entry.body ?? '',
      tail: [`## Methodology\n\n${entry.data.methodology.trim()}`, `## Limitations\n\n${entry.data.limitations.trim()}`, sourcesBody(entry.data.sources)]
        .filter((part) => part !== '')
        .join('\n\n'),
    });
  }

  for (const spec of PAGE_TWINS) {
    const entry = content.pages.find((candidate) => candidate.id === spec.id || candidate.id === `${spec.id}/index`);
    if (entry === undefined) {
      skipped.push({ route: spec.route, reason: `no pages entry ${spec.id}` });
      continue;
    }
    addMdx({ route: spec.route, title: entry.data.title, lead: spec.lead, updated: entry.data.updated, mdx: entry.body ?? '' });
  }

  for (const entry of content.guides ?? []) {
    if (entry.data.section !== 'fundability') continue;
    addMdx({
      route: `/fundability/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.description,
      updated: entry.data.updated,
      mdx: entry.body ?? '',
      tail: sourcesBody(entry.data.sources),
    });
  }

  // A brief's squeeze page: the open abstract and the section titles. Nothing is read from the brief itself.
  for (const entry of content.briefs ?? []) {
    addMdx({
      route: `/briefs/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      lead: entry.data.description,
      updated: entry.data.updated,
      mdx: entry.body ?? '',
      tail: ['## What is inside', '', ...entry.data.outline.map((title) => `- ${title}`)].join('\n'),
    });
  }

  // The insights hub and the desk pages: the page's own text, then the list of what is live under it.
  const liveArticles = content.insights
    .map((entry) => ({
      desk: entry.data.topic ?? entry.id.split('/')[0] ?? '',
      route: `/insights/${lastSegment(entry.id)}/`,
      title: entry.data.title,
      description: entry.data.description,
      date: entry.data.publishedDate,
      segments: entry.data.segments ?? [],
    }))
    .filter((article) => isLive(article.route));
  const liveDesks = DESK_DEFINITIONS.filter((desk) => liveArticles.some((article) => article.desk === desk.id) && isLive(deskPath(desk.id)));

  const hub = content.pages.find((candidate) => candidate.id === 'insights' || candidate.id === 'insights/index');
  if (hub === undefined) {
    skipped.push({ route: '/insights/', reason: 'no pages entry insights' });
  } else {
    addMdx({
      route: '/insights/',
      title: hub.data.title,
      lead: INSIGHTS_LEAD,
      updated: hub.data.updated,
      mdx: hub.body ?? '',
      tail: liveDesks.length === 0 ? '' : ['## Desks', '', ...liveDesks.map((desk) => `- [${desk.name}](${deskPath(desk.id)}): ${desk.blurb}`)].join('\n'),
    });
  }

  for (const desk of liveDesks) {
    const page = content.pages.find((candidate) => candidate.id === `insights/topic-${desk.id}`);
    const articles = liveArticles.filter((article) => article.desk === desk.id).sort(byNewest);
    const newest = articles.reduce((latest, article) => (article.date > latest ? article.date : latest), articles[0]?.date ?? new Date(0));
    addMdx({
      route: deskPath(desk.id),
      title: page?.data.title ?? `${desk.name} insights`,
      lead: desk.blurb,
      updated: page?.data.updated ?? newest,
      mdx: page?.body ?? '',
      tail: ['## Articles', '', ...articles.map((article) => `- [${article.title}](${article.route}): ${article.description}`)].join('\n'),
    });
  }

  // The page families. A page exists when the registry launches its slug and a pages entry holds it (resolveEntries, the rule of the
  // routes), so the twins follow the routes with no list kept here. A malformed `family` object skips the twin; the page itself fails the build.
  const addFamilies = (): void => {
    const refs = content.pages.map((page) => ({ id: page.id, description: page.data.description ?? '' }));
    const context = { steps: PROGRAM_STEPS, isLive };
    const families: readonly { readonly registry: Registry; readonly id: FamilyData['id'] }[] = [
      { registry: SEGMENTS, id: 'segments' },
      { registry: INDUSTRIES, id: 'industries' },
      { registry: COMPARISONS, id: 'compare' },
      { registry: JOURNEY, id: 'journey' },
    ];
    for (const { registry, id } of families) {
      for (const { entry, page } of resolveEntries(registry, content.pages)) {
        const family = page.data.family;
        if (family === undefined || family.id !== id || family.slug !== entry.slug) {
          skipped.push({ route: entry.path, reason: `the family object does not match ${registry.folder}/${entry.slug}` });
          continue;
        }
        addMdx({
          route: entry.path,
          title: page.data.title,
          lead: page.data.description ?? '',
          updated: page.data.updated,
          mdx: page.body ?? '',
          head: fixedCallout(id),
          tail: familyTail(family, {
            ...context,
            reading:
              id === 'segments'
                ? readingPath(
                    liveArticles.map((article) => ({ title: article.title, href: article.route, summary: article.description, segments: article.segments, published: article.date })),
                    entry.slug,
                  )
                : [],
          }),
        });
      }
    }
    for (const { registry, id } of families) {
      const hubPage = findHubPage(registry, content.pages);
      const route = registry.hub?.path;
      if (id === 'segments' || hubPage === undefined || route === undefined) continue;
      const family = hubPage.data.family;
      addMdx({
        route,
        title: hubPage.data.title,
        lead: hubPage.data.description ?? '',
        updated: hubPage.data.updated,
        mdx: hubPage.body ?? '',
        head: fixedCallout(id),
        tail: hubTail(id, liveCards(registry, refs, isLive), id === 'journey' ? { steps: PROGRAM_STEPS, questions: family?.id === 'journey' ? family.questions : [] } : {}),
      });
    }
  };

  addFamilies();

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
