import { footerNav, primaryNav, utilityNav } from '../data/nav.ts';

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
  add('/legal/', 'Legal');
  add('/tools/', 'Tools');
  add('/fundability/', 'Fundability');
  add('/insights/topic/', 'Topics');
  return map;
}

const LABELS = buildLabelMap();

function titleCase(segment: string): string {
  return segment
    .split('-')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Derives breadcrumbs from a route path. Ancestors take their label from the navigation data; the last crumb
 * takes `currentLabel` (the page title). The home crumb is always first.
 */
export function buildCrumbs(path: string, currentLabel: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];
  const segments = path.split('/').filter((s) => s !== '' && !s.endsWith('.html'));
  let acc = '';
  segments.forEach((segment, index) => {
    acc += `/${segment}`;
    const href = `${acc}/`;
    const isLast = index === segments.length - 1;
    crumbs.push({ label: isLast ? currentLabel : (LABELS.get(href) ?? titleCase(segment)), href });
  });
  return crumbs;
}
