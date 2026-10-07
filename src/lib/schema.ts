import { site } from '../data/site.ts';
import type { Crumb } from './breadcrumbs.ts';
import { buildAbsolute } from './url-core.ts';

/**
 * JSON-LD graph builders (SAGE-PLAN 6.9). Sitewide: ProfessionalService organisation plus WebSite.
 * Per page: WebPage-family node and BreadcrumbList. No Offer, Event, Review, Person or AggregateRating at launch,
 * no EIN, SIN, PSC, SIC and no foundingDate.
 */
export type JsonLdNode = Readonly<Record<string, unknown>>;

export type PageSchemaType = 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage';

const ORG_ID = `${site.origin}/#org`;
const WEBSITE_ID = `${site.origin}/#website`;

export function organizationNode(logoUrl: string): JsonLdNode {
  return {
    '@type': 'ProfessionalService',
    '@id': ORG_ID,
    name: site.name,
    legalName: site.legalName,
    url: `${site.origin}/`,
    logo: logoUrl,
    description: site.description,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.locality,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    naics: site.naics,
    sameAs: site.sameAs,
  };
}

// Every @type the site may emit (SAGE-PLAN 6.9). scripts/validate-jsonld.mjs mirrors this list and fails on any other type.
// Nested value types (PostalAddress, ListItem, Question, Answer, DefinedTerm, EntryPoint) are included.
export const ALLOWED_TYPES = [
  'ProfessionalService', 'Organization', 'PostalAddress',
  'WebSite', 'SearchAction', 'EntryPoint',
  'WebPage', 'CollectionPage', 'AboutPage', 'ContactPage',
  'BreadcrumbList', 'ListItem',
  'Service', 'Article', 'Report',
  'FAQPage', 'Question', 'Answer',
  'DefinedTermSet', 'DefinedTerm',
] as const;

// Types that must never appear while the site has no offer, event, person or review evidence (claims C-06, C-12, C-13).
export const FORBIDDEN_TYPES = ['Offer', 'AggregateOffer', 'Review', 'AggregateRating', 'Rating', 'Person', 'Event'] as const;

export interface WebsiteNodeOptions {
  /** Adds a SearchAction. Pass true only when /search/?q= is a live route. */
  readonly searchEnabled?: boolean;
}

export function websiteNode({ searchEnabled = false }: WebsiteNodeOptions = {}): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${site.origin}/`,
    name: site.name,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
    ...(searchEnabled ? { potentialAction: searchActionNode() } : {}),
  };
}

export function searchActionNode(): JsonLdNode {
  return {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${site.origin}/search/?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  };
}

/** Adds the SearchAction to any WebSite node in the list that lacks one. Used by JsonLd.astro once /search/ is live. */
export function withSearchAction(nodes: readonly JsonLdNode[]): readonly JsonLdNode[] {
  return nodes.map((node) =>
    node['@type'] === 'WebSite' && node.potentialAction === undefined ? { ...node, potentialAction: searchActionNode() } : node,
  );
}

export function breadcrumbNode(path: string, crumbs: readonly Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${buildAbsolute(path, site.origin)}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: buildAbsolute(crumb.href, site.origin),
    })),
  };
}

export interface PageNodeInput {
  readonly path: string;
  readonly name: string;
  readonly description: string;
  readonly type: PageSchemaType;
  readonly updated?: Date;
}

export function pageNode({ path, name, description, type, updated }: PageNodeInput): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': type,
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: 'en-US',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    ...(updated !== undefined ? { dateModified: updated.toISOString() } : {}),
  };
}

/**
 * Removes a `breadcrumb` reference whose BreadcrumbList is not in the graph (the home page and 404 have no crumbs),
 * so every @id the graph references resolves inside the graph.
 */
export function pruneDanglingBreadcrumbs(nodes: readonly JsonLdNode[]): readonly JsonLdNode[] {
  const ids = new Set(nodes.map((n) => n['@id']).filter((id): id is string => typeof id === 'string'));
  return nodes.map((node) => {
    const ref = node.breadcrumb as { readonly '@id'?: string } | undefined;
    if (ref === undefined || (ref['@id'] !== undefined && ids.has(ref['@id']))) return node;
    return Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'breadcrumb'));
  });
}

export function graph(nodes: readonly JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': pruneDanglingBreadcrumbs(nodes) };
}

/** Serialises JSON-LD for an inline script, escaping characters that could end the script element. */
export function serializeJsonLd(value: JsonLdNode): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export interface ArticleNodeInput {
  readonly path: string;
  readonly headline: string;
  readonly description: string;
  readonly published: Date;
  readonly modified?: Date;
  readonly image?: string;
  /** "Article" for insights, "Report" for research briefs. */
  readonly type?: 'Article' | 'Report';
}

/** Insight and brief node. Author is the accountable editorial Organization, never a person. */
export function articleNode({ path, headline, description, published, modified, image, type = 'Article' }: ArticleNodeInput): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': type,
    '@id': `${url}#article`,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    headline,
    description,
    datePublished: published.toISOString(),
    dateModified: (modified ?? published).toISOString(),
    author: { '@type': 'Organization', name: 'World Enterprise Editorial', url: `${site.origin}/about/editorial-policy/` },
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
    ...(image !== undefined ? { image } : {}),
  };
}

export interface ServiceNodeInput {
  readonly path: string;
  readonly name: string;
  readonly description: string;
  /** Service line letter and title, for example "Service Line A: Brand and Identity". */
  readonly serviceType: string;
}

/** Service line node. Provider is the organisation; there is deliberately no Offer while the price is unpublished (C-06). */
export function serviceNode({ path, name, description, serviceType }: ServiceNodeInput): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': 'Service',
    '@id': `${url}#service`,
    name,
    description,
    serviceType,
    url,
    provider: { '@id': ORG_ID },
    mainEntityOfPage: { '@id': `${url}#webpage` },
  };
}

export interface FaqItem {
  readonly question: string;
  /** Plain text answer; markup is stripped by the caller. */
  readonly answer: string;
}

export function faqPageNode(path: string, items: readonly FaqItem[]): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface GlossaryTerm {
  readonly term: string;
  readonly definition: string;
}

export function definedTermSetNode(path: string, name: string, terms: readonly GlossaryTerm[]): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': 'DefinedTermSet',
    '@id': `${url}#terms`,
    name,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    hasDefinedTerm: terms.map((t) => ({ '@type': 'DefinedTerm', name: t.term, description: t.definition })),
  };
}
