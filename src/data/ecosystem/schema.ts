import type { JsonLdNode } from '../../lib/schema.ts';
import { buildAbsolute } from '../../lib/url-core.ts';
import { site } from '../site.ts';
import { ALL_ENTRIES } from './index.ts';
import type { EcosystemEntry } from './types.ts';

/**
 * JSON-LD for the directory. A DefinedTermSet of DefinedTerm nodes, one per program, because the site's validator allows no ItemList
 * (scripts/validate-jsonld.mjs, outside this package). Each term names the program, links to its own site and says what it offers.
 */
export function directoryNode(path: string, name: string, entries: readonly EcosystemEntry[] = ALL_ENTRIES): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': 'DefinedTermSet',
    '@id': `${url}#programs`,
    name,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    hasDefinedTerm: entries.map((e) => ({ '@type': 'DefinedTerm', name: e.name, url: e.url, description: e.offers })),
  };
}
