/**
 * The Resources hub groups (SAGE-PLAN 5.2, RESOURCES). Each item is shown only when its route is live.
 */
export interface ResourceItem {
  readonly title: string;
  readonly path: string;
  readonly description: string;
}

export interface ResourceGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly ResourceItem[];
}

export const RESOURCE_GROUPS: readonly ResourceGroup[] = [
  {
    id: 'read',
    title: 'Read',
    items: [
      { title: 'Insights', path: '/insights/', description: 'Sourced articles on validating, building, growing and becoming fundable.' },
      { title: 'Research briefs', path: '/research/', description: 'Designed reports with methodology, limitations and public sources.' },
      { title: 'Newsletter', path: '/newsletter/', description: 'New playbooks, templates and research briefs by email.' },
    ],
  },
  {
    id: 'use',
    title: 'Use',
    items: [
      { title: 'Templates and checklists', path: '/library/', description: 'Six working documents to copy, print or download as Markdown.' },
      { title: 'Team Composer', path: '/tools/team-composer/', description: 'Sketch the roles you need. No sign-up, no price.' },
      { title: 'Glossary', path: '/glossary/', description: 'Plain definitions of the terms founders meet.' },
    ],
  },
  {
    id: 'answers',
    title: 'Get answers',
    items: [
      { title: 'FAQ', path: '/faq/', description: 'What a seat is, how the remote model works and what WE does not do.' },
      { title: 'Search', path: '/search/', description: 'Find a page by what it says.' },
    ],
  },
];

export const RESOURCE_STRIP: readonly ResourceItem[] = [
  { title: 'Editorial policy', path: '/about/editorial-policy/', description: 'How WE writes and checks what it publishes.' },
  { title: 'RSS feed', path: '/rss.xml', description: 'Insights and research briefs as a feed.' },
];

export function liveGroups(isLive: (path: string) => boolean): ResourceGroup[] {
  return RESOURCE_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => isLive(item.path)) })).filter(
    (group) => group.items.length > 0,
  );
}
