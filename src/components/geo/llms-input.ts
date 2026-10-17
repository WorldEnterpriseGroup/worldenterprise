import { getPublished } from '../../lib/content.ts';
import { getRouteState } from '../../lib/route-state.ts';
import { buildTwin } from '../../lib/markdown-twins.ts';
import type { RenderedTwin } from '../../lib/markdown-twins.ts';
import { planLlmsFull } from '../../lib/llms.ts';
import type { LlmsInput, LlmsPage, LlmsServiceLine } from '../../lib/llms.ts';
import { DESK_DEFINITIONS } from '../../data/desks.ts';
import { site } from '../../data/site.ts';
import { getCollection } from 'astro:content';
import { deskGroups, familyGroups, fullTiers } from './llms-plan.ts';
import { addOnStatementFrom, calendarStatementFrom } from './qa.ts';
import { getTwins } from './twin-sources.ts';

/**
 * Loads the inputs of /llms.txt and /llms-full.txt: the live routes, the collections and the twins. The text itself is built by
 * src/lib/llms.ts from this data, so a change to site.ts, a service line, a page title or the route state changes both files.
 */

interface KeyPageSpec {
  readonly route: string;
  /** Entry id in the pages collection, or null when the page has no entry. */
  readonly entry: string | null;
  /** Title and description for a page that has no pages entry. */
  readonly title?: string;
  readonly description?: string;
}

/** The pages WE points a reader to first, in reading order. A page that is not live is left out. */
const KEY_PAGES: readonly KeyPageSpec[] = [
  { route: '/about/facts/', entry: 'about/facts' },
  { route: '/program/', entry: 'program/index' },
  { route: '/program/how-it-works/', entry: 'program/how-it-works' },
  { route: '/program/dedicated-teams/', entry: 'program/dedicated-teams' },
  { route: '/services/', entry: 'services/index' },
  { route: '/how-we-work/', entry: 'how-we-work/how-we-work' },
  { route: '/program/who-its-for/', entry: 'program/who-its-for' },
  { route: '/apply/', entry: 'apply/apply' },
  { route: '/faq/', entry: null, title: 'FAQ', description: 'Short, plain answers about what a seat is, how the remote model works, what WE does not do, and how to apply.' },
  { route: '/glossary/', entry: null, title: 'Glossary', description: 'Plain definitions of the funding, finance, product, legal and security terms early-stage SaaS founders meet.' },
  { route: '/playbooks/', entry: 'playbooks/index' },
  { route: '/research/', entry: 'research/index' },
  { route: '/insights/', entry: 'insights/index' },
];

/** Listed under Optional: company, legal and editorial pages. */
const OPTIONAL_PAGES: readonly KeyPageSpec[] = [
  { route: '/about/', entry: 'about/index' },
  { route: '/about/manifesto/', entry: 'about/manifesto' },
  { route: '/about/editorial-policy/', entry: 'about/editorial-policy' },
  { route: '/about/frameworks/', entry: 'about/frameworks' },
  { route: '/press/', entry: 'press/index' },
  { route: '/legal/privacy/', entry: 'legal/privacy' },
  { route: '/legal/accessibility/', entry: 'legal/accessibility' },
];

const HOW_WE_DECIDE_ROUTE = '/program/how-we-decide/';

/**
 * The curated first tier of /llms-full.txt, ahead of the page families and the desks (llms-plan.ts): the company pages whose twins
 * exist, then every service line and playbook, the FAQ, the glossary and the metrics definitions brief that the FAQ and the glossary
 * point to. A twin of a route that is not live is skipped by the plan. Articles are linked from llms.txt, never inlined.
 */
const CURATED_ROUTES: readonly string[] = ['/about/facts/', '/about/manifesto/', '/about/editorial-policy/', '/faq/', '/glossary/', '/research/early-stage-saas-metrics-definitions/'];

export interface LlmsLoad {
  readonly input: LlmsInput;
  /** The rendered twins for /llms-full.txt, in order, chosen by planLlmsFull within 90 percent of the cap. */
  readonly fullPages: readonly RenderedTwin[];
}

export async function loadLlms(): Promise<LlmsLoad> {
  const state = await getRouteState();
  const { twins } = await getTwins();
  const twinRoutes = new Set(twins.map((t) => t.route));
  const pages = await getPublished('pages');
  const services = await getPublished('services');
  const playbooks = await getPublished('playbooks');
  const insights = await getPublished('insights');
  const research = await getPublished('research');
  const faq = await getCollection('faq');

  const factsBody = pages.find((p) => p.id === 'about/facts')?.body;
  const byId = new Map(pages.map((p) => [p.id, p.data] as const));
  const resolve = (spec: KeyPageSpec): LlmsPage | null => {
    if (!state.isLive(spec.route)) return null;
    const entry = spec.entry === null ? undefined : (byId.get(spec.entry) ?? byId.get(spec.entry.replace(/\/index$/, '')));
    const title = entry?.title ?? spec.title;
    if (title === undefined) return null;
    return { route: spec.route, title, description: entry?.description ?? spec.description };
  };
  const present = (list: readonly (LlmsPage | null)[]): LlmsPage[] => list.filter((p): p is LlmsPage => p !== null);

  // Every live article, from the collections rather than the twins, so an article whose twin failed the lint is still listed (as its HTML page).
  const slugOf = (id: string): string => id.split('/').at(-1) ?? id;
  const deskOrder = new Map(DESK_DEFINITIONS.map((desk) => [desk.id as string, desk.order] as const));
  const articles: LlmsPage[] = [
    ...insights
      .map((e) => ({ page: { route: `/insights/${slugOf(e.id)}/`, title: e.data.title, description: e.data.description }, order: deskOrder.get(e.data.topic) ?? 99, date: e.data.publishedDate }))
      .filter((a) => state.isLive(a.page.route))
      .sort((a, b) => a.order - b.order || b.date.getTime() - a.date.getTime() || a.page.title.localeCompare(b.page.title, 'en'))
      .map((a) => a.page),
    ...research
      .map((e) => ({ route: `/research/${slugOf(e.id)}/`, title: e.data.title, description: e.data.subtitle }))
      .filter((p) => state.isLive(p.route))
      .sort((a, b) => a.title.localeCompare(b.title, 'en')),
  ];

  const serviceLines: LlmsServiceLine[] = services
    .map((s) => ({ line: s.data.line, title: s.data.title, route: `/services/${s.id.split('/').at(-1) ?? s.id}/`, summary: s.data.summary }))
    .filter((s) => state.isLive(s.route))
    .sort((a, b) => a.line.localeCompare(b.line));

  const decide = resolve({ route: HOW_WE_DECIDE_ROUTE, entry: 'program/how-we-decide', title: 'How WE decides' });

  const input: LlmsInput = {
    site: { name: site.name, legalName: site.legalName, tagline: site.tagline, description: site.description, origin: site.origin },
    serviceLines,
    keyPages: present(KEY_PAGES.map(resolve)),
    desks: deskGroups(state.isLive),
    families: familyGroups(state.isLive),
    optionalPages: [...present(OPTIONAL_PAGES.map(resolve)), ...articles],
    howWeDecide: decide,
    twinRoutes,
    contactRoute: state.isLive('/contact/') ? '/contact/' : null,
    applyRoute: state.isLive('/apply/') ? '/apply/' : null,
    addOnStatement: addOnStatementFrom(factsBody),
    calendarStatement: calendarStatementFrom(faq.find((e) => /\bdemo day\b/.test(e.data.answer))?.data.answer),
  };

  const rendered = new Map(twins.map((t) => [t.route, buildTwin(t)] as const));
  const curated = [
    ...CURATED_ROUTES.slice(0, 3),
    ...serviceLines.map((s) => s.route),
    ...playbooks.map((p) => `/playbooks/${slugOf(p.id)}/`),
    ...CURATED_ROUTES.slice(3),
  ];
  const plan = planLlmsFull(input, fullTiers({ twins: rendered, curated, isLive: state.isLive }));
  return { input, fullPages: plan.pages };
}
