import type { SlotId } from '../../assets/photo/slots.ts';
import { primaryNav } from '../../data/nav.ts';
import type { ServiceLine } from '../../data/nav.ts';

/**
 * Pure helpers for the seven service lines (claim C-04). No Astro imports, so they run under `node --test`.
 * The route slug of a line is the file name of its entry in src/content/services.
 */
export const LINE_ORDER: readonly ServiceLine[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const LINE_SLOT: Readonly<Record<ServiceLine, SlotId>> = {
  A: 'svc-a',
  B: 'svc-b',
  C: 'svc-c',
  D: 'svc-d',
  E: 'svc-e',
  F: 'svc-f',
  G: 'svc-g',
};

/** The two jobs the services menu groups the lines under (SAGE-PLAN 5.2). */
export const LINE_GROUPS: readonly { readonly id: 'build' | 'fundable'; readonly heading: string; readonly lines: readonly ServiceLine[] }[] = [
  { id: 'build', heading: 'Build the company', lines: ['A', 'B', 'C', 'D'] },
  { id: 'fundable', heading: 'Become fundable', lines: ['E', 'F', 'G'] },
];

export interface PlaybookRef {
  readonly title: string;
  readonly description: string;
}

/** Playbook slugs from the route ledger (owned by WP-04). Titles follow the services menu wording. */
export const PLAYBOOKS: Readonly<Record<string, PlaybookRef>> = {
  'validate-the-problem': { title: 'Validate the problem', description: 'Check that the problem and the customer are real before you build.' },
  'design-the-product': { title: 'Design the product', description: 'Turn what you learned into a first version worth building.' },
  'build-and-ship-v1': { title: 'Build and ship v1', description: 'Plan, build and release the first version of your SaaS.' },
  'earn-your-first-customers': { title: 'Earn your first customers', description: 'Run pilots and a simple pipeline until customers say yes.' },
  'build-repeatable-growth': { title: 'Build repeatable growth', description: 'Find the channels and habits that keep working.' },
};

export interface NextLink {
  readonly title: string;
  readonly href: string;
  readonly description?: string;
}

/** Guide pages that sit next to a line. Paths come from the route ledger. */
export const EXTRA_NEXT: Readonly<Partial<Record<ServiceLine, readonly NextLink[]>>> = {
  E: [{ title: 'How the program works', href: '/program/how-it-works/', description: 'From application to the first working cycle.' }],
  F: [
    { title: 'Investor readiness checklist', href: '/fundability/investor-readiness-checklist/', description: 'The evidence a serious investor asks for.' },
    { title: 'The seed data room', href: '/fundability/data-room/', description: 'What goes in it and how to organise it.' },
  ],
  G: [{ title: 'Dedicated teams', href: '/program/dedicated-teams/', description: 'How WE seats and steers a team for your company.' }],
};

export function servicePath(slug: string): string {
  return `/services/${slug}/`;
}

export function playbookPath(slug: string): string {
  return `/playbooks/${slug}/`;
}

/** One-line description of a line, taken from the services menu so the two never drift apart. */
export function lineTagline(line: ServiceLine): string {
  for (const item of primaryNav) {
    if (item.kind !== 'mega' || item.id !== 'services') continue;
    for (const column of item.columns) {
      for (const link of column.links) {
        if (link.line === line && link.description !== undefined) return link.description;
      }
    }
  }
  throw new Error(`No services menu entry with a description for line ${line}.`);
}

/** Last segment of a collection entry id: entries may sit in sub-folders while the URL is flat. */
export function entrySlug(id: string): string {
  return id.split('/').at(-1) ?? id;
}
