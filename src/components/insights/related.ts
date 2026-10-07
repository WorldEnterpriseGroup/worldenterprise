import { routes } from '../../data/routes.ts';

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

export const PLAYBOOK_TITLES: Readonly<Record<string, string>> = {
  'validate-the-problem': 'Validate the problem',
  'design-the-product': 'Design the product',
  'build-and-ship-v1': 'Build and ship v1',
  'earn-your-first-customers': 'Earn your first customers',
  'build-repeatable-growth': 'Build repeatable growth',
};

export const TEMPLATE_TITLES: Readonly<Record<string, string>> = {
  'one-page-problem-brief': 'One-page problem brief',
  'customer-interview-guide': 'Customer interview guide',
  'mvp-cut-line-worksheet': 'MVP cut-line worksheet',
  'weekly-investor-update-template': 'Weekly investor update template',
  'seed-data-room-checklist': 'Seed data room checklist',
  'security-baseline-checklist': 'Security baseline checklist',
};

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

/** Deterministic 32-bit hash (FNV-1a) used to seed cover art. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
