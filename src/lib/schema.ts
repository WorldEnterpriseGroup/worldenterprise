import { site } from '../data/site.ts';
import type { Crumb } from './breadcrumbs.ts';
import { buildAbsolute } from './url-core.ts';

/**
 * JSON-LD graph builders (SAGE-PLAN 6.9). Sitewide: ProfessionalService organisation plus WebSite.
 * Per page: WebPage-family node and BreadcrumbList. No standalone Offer, Event, Review, Person or AggregateRating at launch,
 * no EIN, SIN, PSC, SIC and no foundingDate. The one place an Offer may appear is the organisation's OfferCatalog of the four
 * packages, and only without a price (withOrganizationEnrichment); the validator enforces both halves of that rule.
 */
export type JsonLdNode = Readonly<Record<string, unknown>>;

export type PageSchemaType = 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage';

const ORG_ID = `${site.origin}/#org`;
const WEBSITE_ID = `${site.origin}/#website`;

/**
 * The organisation logo is a file in public/, so its URL never carries a content hash. The copy under src/assets/brand is hashed by
 * the build and changes whenever the artwork is edited, which would orphan the URL a search engine has cached.
 * tests/unit/wp-19/wordmark.test.ts keeps the two files identical.
 */
export const LOGO_PATH = '/press/we-logo-wordmark.svg';

export function logoUrl(): string {
  return buildAbsolute(LOGO_PATH, site.origin);
}

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
  'OfferCatalog', 'WebApplication', 'CreativeWork',
] as const;

// Types that must never appear while the site has no offer, event, person or review evidence (claims C-06, C-12, C-13).
// Offer is the one nested exception: scripts/validate-jsonld.mjs accepts it only as an item of the organisation's OfferCatalog, without a price.
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
  /** Works the article cites (briefCitations). Omitted when empty. */
  readonly citation?: readonly JsonLdNode[];
}

/** Insight and brief node. Author is the accountable editorial Organization, never a person. */
export function articleNode({ path, headline, description, published, modified, image, type = 'Article', citation }: ArticleNodeInput): JsonLdNode {
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
    ...(citation !== undefined && citation.length > 0 ? { citation } : {}),
  };
}

export interface CitedSource {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
}

/** The `citation` of a research brief: each source it lists, as a CreativeWork with its publisher. Same order as the page's sources list. */
export function briefCitations(sources: readonly CitedSource[]): readonly JsonLdNode[] {
  return sources.map((source) => ({
    '@type': 'CreativeWork',
    name: source.title,
    url: source.url,
    publisher: { '@type': 'Organization', name: source.publisher },
  }));
}

const IMAGE_NODE_TYPES: ReadonlySet<unknown> = new Set(['Article', 'Report']);

/**
 * Gives every Article and Report node that has no image of its own the page's social card, which Google recommends for article rich
 * results. A page without a real card (a placeholder slot) passes undefined and the nodes are returned untouched, so the graph
 * never points at an image that does not exist.
 */
export function withArticleImage(nodes: readonly JsonLdNode[], image: string | undefined): readonly JsonLdNode[] {
  if (image === undefined) return nodes;
  return nodes.map((node) => (IMAGE_NODE_TYPES.has(node['@type']) && node.image === undefined ? { ...node, image } : node));
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

export interface OrganizationEnrichment {
  /** The packages, in order. Names, stage fit and depth only: the catalog carries no price, amount or seat count (claims C-06, C-10). */
  readonly packages: readonly { readonly id: string; readonly name: string; readonly stageFit: string; readonly depth: string }[];
  /** The titles of the live service lines; they become `knowsAbout`. */
  readonly serviceLines: readonly string[];
}

/** The OfferCatalog of the four packages. Each Offer names a package and the Service it stands for; none has a price. */
export function packageCatalogNode(packages: OrganizationEnrichment['packages']): JsonLdNode {
  const pricing = `${site.origin}/pricing/`;
  return {
    '@type': 'OfferCatalog',
    name: `${site.name} packages`,
    itemListElement: packages.map((pkg) => ({
      '@type': 'Offer',
      name: `${pkg.name} package`,
      description: pkg.stageFit,
      itemOffered: {
        '@type': 'Service',
        '@id': `${pricing}#package-${pkg.id}`,
        name: `${pkg.name} package`,
        description: pkg.stageFit,
        serviceType: `${pkg.depth} depth in every service line`,
        url: pricing,
        provider: { '@id': ORG_ID },
      },
    })),
  };
}

/**
 * Gives the organisation node a `hasOfferCatalog` (the four packages, without price) and `knowsAbout` (the live service lines).
 * It is a transform, applied by JsonLd.astro, so organizationNode() itself still emits no Offer (tests/unit/wp-09/schema.test.ts).
 * A list that is empty adds nothing, and an organisation node that already has the property keeps its own.
 */
export function withOrganizationEnrichment(nodes: readonly JsonLdNode[], enrichment: OrganizationEnrichment): readonly JsonLdNode[] {
  return nodes.map((node) => {
    if (node['@type'] !== 'ProfessionalService') return node;
    return {
      ...node,
      ...(node.hasOfferCatalog === undefined && enrichment.packages.length > 0 ? { hasOfferCatalog: packageCatalogNode(enrichment.packages) } : {}),
      ...(node.knowsAbout === undefined && enrichment.serviceLines.length > 0 ? { knowsAbout: [...enrichment.serviceLines] } : {}),
    };
  });
}
