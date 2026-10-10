import { site } from '../../data/site.ts';
import type { JsonLdNode } from '../../lib/schema.ts';
import { buildAbsolute } from '../../lib/url-core.ts';

/**
 * The JSON-LD node for one founder tool. It follows the WebApplication contract of the JSON-LD validator (scripts/validate-jsonld.mjs):
 * an `@id`, a `name` and a `url`, and no `offers`, `price` or other key on its forbidden list. The tool carries no price claim, so the
 * node says nothing about what using it costs.
 *
 * src/lib/schema.ts belongs to another package, so the two `@id` values it does not export are rebuilt here from the same origin. They
 * are the ones schema.ts builds for the organisation and for the page node (`pageNode` uses `${url}#webpage`).
 */
export interface WebApplicationInput {
  /** The tool's route, for example /tools/metrics-calculator/. */
  readonly path: string;
  readonly name: string;
  readonly description: string;
}

const ORG_ID = `${site.origin}/#org`;

export function webApplicationNode({ path, name, description }: WebApplicationInput): JsonLdNode {
  const url = buildAbsolute(path, site.origin);
  return {
    '@type': 'WebApplication',
    '@id': `${url}#app`,
    name,
    url,
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en-US',
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@id': `${url}#webpage` },
  };
}
