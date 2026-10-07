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

export function websiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${site.origin}/`,
    name: site.name,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
  };
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

export function graph(nodes: readonly JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': nodes };
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
