import { site } from '../../data/site.ts';
import { buildAbsolute } from '../../lib/url-core.ts';

/**
 * JSON-LD builders for the reference pages (SAGE-PLAN 6.9): FAQPage on /faq/ and DefinedTermSet on /glossary/.
 * Pure functions with no Astro imports so node --test can run them.
 */
export type JsonLdNode = Readonly<Record<string, unknown>>;

export interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface GlossaryItem {
  readonly id: string;
  readonly term: string;
  readonly definition: string;
}

/** Stable in-page anchor for a glossary term or FAQ entry. */
export function anchorId(prefix: 'term' | 'faq', id: string): string {
  return `${prefix}-${id}`;
}

export function faqPageNode(path: string, items: readonly FaqItem[]): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${site.origin}/#website` },
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      '@id': `${url}#${anchorId('faq', item.id)}`,
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function definedTermSetNode(path: string, name: string, items: readonly GlossaryItem[]): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  const setId = `${url}#termset`;
  return {
    '@type': 'DefinedTermSet',
    '@id': setId,
    url,
    name,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${site.origin}/#website` },
    hasDefinedTerm: items.map((item) => ({
      '@type': 'DefinedTerm',
      '@id': `${url}#${anchorId('term', item.id)}`,
      name: item.term,
      description: item.definition,
      inDefinedTermSet: { '@id': setId },
    })),
  };
}

/** Groups items by their `group` field, keeping first-seen group order and input order inside each group. */
export function groupBy<T extends { readonly group: string }>(items: readonly T[]): { group: string; items: T[] }[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = map.get(item.group);
    if (bucket === undefined) {
      order.push(item.group);
      map.set(item.group, [item]);
    } else {
      bucket.push(item);
    }
  }
  return order.map((group) => ({ group, items: map.get(group) ?? [] }));
}

/** The glossary's groups in reading order. A group missing from a data set is skipped; a group not named here follows these, in first-seen order. */
export const GLOSSARY_GROUP_ORDER: readonly string[] = [
  'Funding',
  'Finance and metrics',
  'Legal and contracts',
  'Customers and product',
  'Go-to-market',
  'Product delivery',
  'Team and hiring',
  'AI and data',
  'Security and accessibility',
  'WE vocabulary',
];

/** Stable in-page anchor for a glossary group heading: `group-` plus the lowercase, hyphenated group name. */
export function groupAnchorId(group: string): string {
  return `group-${group
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

/** Groups items in `GLOSSARY_GROUP_ORDER`, then any other group in first-seen order. Input order is kept inside each group. */
export function orderedGroups<T extends { readonly group: string }>(items: readonly T[]): { group: string; items: T[] }[] {
  const grouped = groupBy(items);
  const rank = (group: string): number => {
    const index = GLOSSARY_GROUP_ORDER.indexOf(group);
    return index === -1 ? GLOSSARY_GROUP_ORDER.length : index;
  };
  return grouped
    .map((entry, position) => ({ entry, position }))
    .sort((a, b) => rank(a.entry.group) - rank(b.entry.group) || a.position - b.position)
    .map(({ entry }) => entry);
}

export interface DefinitionMarkers {
  readonly 'data-generic-definition'?: '';
  readonly 'data-claim-allow'?: string;
}

/**
 * The claims-audit attributes for one definition element (contracts section 8.4): `data-generic-definition` for a SAFE-mechanics term,
 * `data-claim-allow` with the rule ids, space separated, for a term that names a peers or fee wording on purpose. Neither for a plain term.
 */
export function definitionMarkers(term: { readonly genericDefinition?: boolean; readonly claimAllow?: readonly string[] }): DefinitionMarkers {
  const allow = term.claimAllow ?? [];
  return {
    ...(term.genericDefinition === true ? { 'data-generic-definition': '' as const } : {}),
    ...(allow.length > 0 ? { 'data-claim-allow': allow.join(' ') } : {}),
  };
}

/** Letters of the alphabet that start at least one term, for the glossary jump list. */
export function initials(terms: readonly string[]): string[] {
  const set = new Set<string>();
  for (const term of terms) {
    const first = term.trim().charAt(0).toUpperCase();
    if (first !== '') set.add(/[A-Z]/.test(first) ? first : '#');
  }
  return [...set].sort((a, b) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)));
}
