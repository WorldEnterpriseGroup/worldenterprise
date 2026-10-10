import { routes } from '../../data/routes.ts';
import { listCollectionTitles } from '../../lib/content-files.ts';

export interface RelatedItem {
  readonly kind: string;
  readonly title: string;
  readonly href: string;
}

export type ServiceLine = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export const SERVICE_PATHS: Readonly<Record<ServiceLine, { readonly title: string; readonly path: string }>> = {
  A: { title: 'Brand and Identity', path: '/services/brand-and-identity/' },
  B: { title: 'Product and IT Development', path: '/services/product-and-it-development/' },
  C: { title: 'Customer and Market Development', path: '/services/customer-and-market-development/' },
  D: { title: 'Business Management and Operations', path: '/services/business-management-and-operations/' },
  E: { title: 'Digital Incubation', path: '/services/digital-incubation/' },
  F: { title: 'Fundability and Investor Readiness', path: '/services/fundability-and-investor-readiness/' },
  G: { title: 'Professional Services Coordination', path: '/services/professional-services-coordination/' },
};

/** Playbook slug to title, read from src/content/playbooks/ so a new playbook needs no edit here (decision W8-7). */
export const PLAYBOOK_TITLES: Readonly<Record<string, string>> = listCollectionTitles(process.cwd(), 'playbooks');

/** Library template slug to title, read from src/content/library/. */
export const TEMPLATE_TITLES: Readonly<Record<string, string>> = listCollectionTitles(process.cwd(), 'library');

const ledger = new Set(routes.map((r) => r.path));

function assertInLedger(path: string): string {
  if (!ledger.has(path)) throw new Error(`Related link ${path} is not in the route ledger (src/data/routes.ts).`);
  return path;
}

export interface RelatedRefs {
  readonly services: readonly ServiceLine[];
  readonly playbook?: string | undefined;
  readonly template?: string | undefined;
}

/**
 * Resolves frontmatter references to rail items. An unknown playbook or template slug throws (validated at build).
 * Targets that are not live yet are omitted so the link audit never sees a dead link.
 */
export function pickRelated(refs: RelatedRefs, isLive: (path: string) => boolean): RelatedItem[] {
  const items: RelatedItem[] = [];
  for (const line of refs.services) {
    const s = SERVICE_PATHS[line];
    items.push({ kind: `Service line ${line}`, title: s.title, href: assertInLedger(s.path) });
  }
  if (refs.playbook !== undefined) {
    const title = PLAYBOOK_TITLES[refs.playbook];
    if (title === undefined) throw new Error(`Unknown relatedPlaybook "${refs.playbook}".`);
    items.push({ kind: 'Playbook', title, href: assertInLedger(`/playbooks/${refs.playbook}/`) });
  }
  if (refs.template !== undefined) {
    const title = TEMPLATE_TITLES[refs.template];
    if (title === undefined) throw new Error(`Unknown relatedTemplate "${refs.template}".`);
    items.push({ kind: 'Template', title, href: assertInLedger(`/library/${refs.template}/`) });
  }
  return items.filter((i) => isLive(i.href));
}

/** An article that a `related` slug can resolve to. */
export interface ArticleRef {
  readonly slug: string;
  readonly title: string;
}

/** The most `related` articles one article shows in its rail. */
export const MAX_RELATED_ARTICLES = 3;

/**
 * Resolves the `related` frontmatter (article slugs) to rail items, failing closed: a slug with no article, a slug that is not in the
 * ledger, and an article that is not live are all dropped, never thrown, so a package can name an article that another package has not
 * merged yet and no dead link can ship (the `pickRelated` precedent). Duplicates and the article itself are dropped too.
 */
export function pickRelatedArticles(
  slugs: readonly string[],
  articles: readonly ArticleRef[],
  isLive: (path: string) => boolean,
  self?: string,
): RelatedItem[] {
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const items: RelatedItem[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    if (slug === self || seen.has(slug)) continue;
    seen.add(slug);
    const article = bySlug.get(slug);
    const href = `/insights/${slug}/`;
    if (article === undefined || !ledger.has(href) || !isLive(href)) continue;
    items.push({ kind: 'Related article', title: article.title, href });
    if (items.length === MAX_RELATED_ARTICLES) break;
  }
  return items;
}

/** Deterministic 32-bit hash (FNV-1a) used to seed cover art. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
