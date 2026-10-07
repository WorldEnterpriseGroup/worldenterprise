#!/usr/bin/env node
// JSON-LD validator over the built site (SAGE-PLAN 6.9). Node built-ins only. Run after `astro build`:
//
//   node scripts/validate-jsonld.mjs [--dist dist]
//
// Per page: every ld+json block parses; @context is schema.org; every @type is on the allowlist (mirrors ALLOWED_TYPES in
// src/lib/schema.ts); Offer, Review, AggregateRating, Person and Event never appear; required properties per type exist;
// every { "@id": ... } reference resolves inside the page graph; @id values are unique; the page node's url matches the
// canonical. The organisation node carries no EIN, SIN, PSC, SIC, founding date or street address (claim C-18).
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { canonicalLinks, listBuiltPages } from './audit-seo.mjs';

export const ORIGIN = 'https://worldenterprise.org';
export const ORG_ID = `${ORIGIN}/#org`;

export const ALLOWED_TYPES = new Set([
  'ProfessionalService', 'Organization', 'PostalAddress',
  'WebSite', 'SearchAction', 'EntryPoint',
  'WebPage', 'CollectionPage', 'AboutPage', 'ContactPage',
  'BreadcrumbList', 'ListItem',
  'Service', 'Article', 'Report',
  'FAQPage', 'Question', 'Answer',
  'DefinedTermSet', 'DefinedTerm',
]);

export const FORBIDDEN_TYPES = new Set(['Offer', 'AggregateOffer', 'Review', 'AggregateRating', 'Rating', 'Person', 'Event']);

/** Properties that must never appear anywhere (no Offer evidence, no identifiers, no street address). */
const FORBIDDEN_KEYS = new Set([
  'offers', 'price', 'priceCurrency', 'review', 'aggregateRating',
  'foundingDate', 'taxID', 'vatID', 'duns', 'leiCode', 'iso6523Code', 'isicV4', 'streetAddress', 'postalCode', 'telephone', 'email',
]);

const PAGE_TYPES = new Set(['WebPage', 'CollectionPage', 'AboutPage', 'ContactPage']);

const REQUIRED = {
  ProfessionalService: ['@id', 'name', 'legalName', 'url', 'logo', 'description', 'address', 'naics'],
  WebSite: ['@id', 'url', 'name', 'publisher'],
  WebPage: ['@id', 'url', 'name', 'description', 'isPartOf'],
  CollectionPage: ['@id', 'url', 'name', 'description', 'isPartOf'],
  AboutPage: ['@id', 'url', 'name', 'description', 'isPartOf'],
  ContactPage: ['@id', 'url', 'name', 'description', 'isPartOf'],
  BreadcrumbList: ['@id', 'itemListElement'],
  Service: ['@id', 'name', 'description', 'serviceType', 'provider'],
  Article: ['@id', 'headline', 'description', 'datePublished', 'dateModified', 'author', 'publisher'],
  Report: ['@id', 'headline', 'description', 'datePublished', 'dateModified', 'author', 'publisher'],
  FAQPage: ['@id', 'mainEntity'],
  DefinedTermSet: ['@id', 'name', 'hasDefinedTerm'],
  SearchAction: ['target', 'query-input'],
  ListItem: ['position', 'name', 'item'],
  Question: ['name', 'acceptedAnswer'],
  Answer: ['text'],
  DefinedTerm: ['name', 'description'],
  PostalAddress: [],
  EntryPoint: ['urlTemplate'],
  Organization: ['name'],
};

/** Extracts and parses every ld+json block. Parse failures are returned as errors, never thrown. */
export function extractJsonLd(html) {
  const docs = [];
  const errors = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      docs.push(JSON.parse(match[1]));
    } catch (error) {
      errors.push(`JSON-LD block does not parse: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { docs, errors };
}

function typesOf(node) {
  const t = node['@type'];
  return Array.isArray(t) ? t : t === undefined ? [] : [t];
}

/** Walks every object in a value, calling visit(object, jsonPath). */
function walk(value, visit, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, visit, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    visit(value, path);
    for (const [key, child] of Object.entries(value)) walk(child, visit, `${path}.${key}`);
  }
}

/** Validates one parsed JSON-LD document and returns a list of error strings. */
export function validateDocument(doc) {
  const errors = [];
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return ['JSON-LD document must be an object'];
  if (doc['@context'] !== 'https://schema.org') errors.push(`@context must be "https://schema.org", got ${JSON.stringify(doc['@context'])}`);
  const graph = doc['@graph'];
  if (!Array.isArray(graph) || graph.length === 0) return [...errors, '@graph must be a non-empty array'];

  const ids = new Set();
  for (const node of graph) {
    const id = node['@id'];
    if (typeof id === 'string') {
      if (ids.has(id)) errors.push(`duplicate @id ${id}`);
      ids.add(id);
    }
  }

  walk(graph, (obj, path) => {
    const keys = Object.keys(obj);
    const isReference = keys.length === 1 && keys[0] === '@id';
    if (isReference) {
      if (!ids.has(obj['@id'])) errors.push(`${path}: @id reference ${obj['@id']} does not resolve in the graph`);
      return;
    }
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) errors.push(`${path}: forbidden property "${key}"`);
    }
    const types = typesOf(obj);
    if (obj['@type'] === undefined && !('@context' in obj)) {
      errors.push(`${path}: object has no @type`);
      return;
    }
    for (const type of types) {
      if (FORBIDDEN_TYPES.has(type)) errors.push(`${path}: forbidden @type ${type}`);
      else if (!ALLOWED_TYPES.has(type)) errors.push(`${path}: @type ${type} is not on the allowlist`);
      for (const prop of REQUIRED[type] ?? []) {
        if (obj[prop] === undefined || obj[prop] === '' || (Array.isArray(obj[prop]) && obj[prop].length === 0)) {
          errors.push(`${path}: ${type} is missing required property "${prop}"`);
        }
      }
    }
  });

  const orgs = graph.filter((n) => typesOf(n).includes('ProfessionalService'));
  if (orgs.length !== 1) errors.push(`expected exactly one ProfessionalService node, found ${orgs.length}`);
  else if (orgs[0]['@id'] !== ORG_ID) errors.push(`organisation @id must be ${ORG_ID}`);
  if (graph.filter((n) => typesOf(n).includes('WebSite')).length !== 1) errors.push('expected exactly one WebSite node');

  for (const node of graph) {
    if (typesOf(node).some((t) => t === 'Article' || t === 'Report')) {
      const author = node.author;
      if (author?.['@type'] !== 'Organization' || author?.name !== 'World Enterprise Editorial') {
        errors.push(`${node['@id']}: author must be the Organization "World Enterprise Editorial"`);
      }
    }
    if (typesOf(node).includes('SearchAction') && !String(node.target?.urlTemplate ?? '').includes('{search_term_string}')) {
      errors.push('SearchAction target.urlTemplate must contain {search_term_string}');
    }
  }
  return errors;
}

/** Validates all JSON-LD on one page, including the page node's url against the canonical. */
export function validatePage({ path, html }) {
  const errors = [];
  const { docs, errors: parseErrors } = extractJsonLd(html);
  const out = (msg) => errors.push(`${path}: ${msg}`);
  for (const e of parseErrors) out(e);
  if (docs.length === 0 && parseErrors.length === 0) out('no JSON-LD block');
  for (const doc of docs) for (const e of validateDocument(doc)) out(e);

  const canonical = canonicalLinks(html)[0];
  const pageNodes = docs.flatMap((d) => (Array.isArray(d['@graph']) ? d['@graph'] : [])).filter((n) => typesOf(n).some((t) => PAGE_TYPES.has(t)));
  if (docs.length > 0 && pageNodes.length !== 1) out(`expected exactly one page node (WebPage family), found ${pageNodes.length}`);
  else if (pageNodes[0] !== undefined && canonical !== undefined && pageNodes[0].url !== canonical) {
    out(`page node url ${pageNodes[0].url} differs from the canonical ${canonical}`);
  }
  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  const distIndex = args.indexOf('--dist');
  const dist = distIndex === -1 ? 'dist' : args[distIndex + 1];
  if (!dist || !existsSync(dist)) {
    console.error(`validate-jsonld: dist directory not found: ${dist}`);
    process.exit(2);
  }
  const pages = listBuiltPages(dist);
  const errors = pages.flatMap((page) => validatePage(page));
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`validate-jsonld: ${pages.length} pages, ${errors.length} error(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
