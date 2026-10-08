import { footerNav, primaryNav, utilityNav } from '../data/nav.ts';
import { routes } from '../data/routes.ts';

export interface Crumb {
  readonly label: string;
  readonly href: string;
}

function buildLabelMap(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  const add = (href: string, label: string): void => {
    if (!map.has(href)) map.set(href, label);
  };
  for (const item of primaryNav) {
    add(item.href, item.label);
    if (item.kind === 'mega') {
      for (const col of item.columns) for (const link of col.links) add(link.href, link.label);
    }
  }
  for (const col of footerNav) for (const link of col.links) add(link.href, link.label);
  for (const link of utilityNav.links) add(link.href, link.label);
  add('/insights/', 'Insights');
  add('/research/', 'Research');
  add('/library/', 'Templates');
  add('/tools/', 'Tools');
  add('/fundability/', 'Fundability');
  return map;
}

const LABELS = buildLabelMap();

/** Launched ledger paths. An ancestor crumb is emitted only when its route exists, so no crumb links to a missing page. */
const LAUNCHED: ReadonlySet<string> = new Set(routes.filter((r) => r.launch).map((r) => r.path));

function titleCase(segment: string): string {
  return segment
    .split('-')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Derives breadcrumbs from a route path. Ancestors take their label from the navigation data and are skipped when the
 * ancestor path is not a launched route (for example /legal/ or /insights/topic/); the last crumb takes
 * `currentLabel` (the page title). The home crumb is always first.
 */
export function buildCrumbs(path: string, currentLabel: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];
  const segments = path.split('/').filter((s) => s !== '' && !s.endsWith('.html'));
  let acc = '';
  segments.forEach((segment, index) => {
    acc += `/${segment}`;
    const href = `${acc}/`;
    const isLast = index === segments.length - 1;
    if (!isLast && !LAUNCHED.has(href)) return;
    crumbs.push({ label: isLast ? currentLabel : (LABELS.get(href) ?? titleCase(segment)), href });
  });
  return crumbs;
}
