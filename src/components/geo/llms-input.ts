import { getPublished } from '../../lib/content.ts';
import { getRouteState } from '../../lib/route-state.ts';
import { buildTwin } from '../../lib/markdown-twins.ts';
import type { RenderedTwin } from '../../lib/markdown-twins.ts';
import type { LlmsInput, LlmsPage, LlmsServiceLine } from '../../lib/llms.ts';
import { packages } from '../../data/packages.ts';
import { site } from '../../data/site.ts';
import { getCollection } from 'astro:content';
import { addOnStatementFrom, calendarStatementFrom } from './qa.ts';
import { getTwins } from './twin-sources.ts';

/**
 * Loads the inputs of /llms.txt and /llms-full.txt: the live routes, the collections and the twins. The text itself is built by
 * src/lib/llms.ts from this data, so a change to packages.ts, site.ts, a page title or the route state changes both files.
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
  { route: '/pricing/', entry: 'pricing/pricing' },
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

/** The twins whose full text goes into /llms-full.txt: the about, service and playbook pages. Briefs and articles are linked from llms.txt. */
const FULL_PREFIXES = ['/about/', '/services/', '/playbooks/', '/glossary/'] as const;

/** Single twins added to /llms-full.txt: the FAQ, and the metrics definitions brief that the FAQ and the glossary point to. */
const FULL_ROUTES: ReadonlySet<string> = new Set(['/faq/', '/research/early-stage-saas-metrics-definitions/']);

export interface LlmsLoad {
  readonly input: LlmsInput;
  /** The rendered twins for /llms-full.txt, in order. */
  readonly fullPages: readonly RenderedTwin[];
}

export async function loadLlms(): Promise<LlmsLoad> {
  const state = await getRouteState();
  const { twins } = await getTwins();
  const twinRoutes = new Set(twins.map((t) => t.route));
  const pages = await getPublished('pages');
  const services = await getPublished('services');
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

  const optionalTwins: LlmsPage[] = twins
    .filter((t) => t.route.startsWith('/research/') || t.route.startsWith('/insights/'))
    .map((t) => ({ route: t.route, title: t.title, description: t.lead }));

  const serviceLines: LlmsServiceLine[] = services
    .map((s) => ({ line: s.data.line, title: s.data.title, route: `/services/${s.id.split('/').at(-1) ?? s.id}/`, summary: s.data.summary }))
    .filter((s) => state.isLive(s.route))
    .sort((a, b) => a.line.localeCompare(b.line));

  const decide = resolve({ route: HOW_WE_DECIDE_ROUTE, entry: 'program/how-we-decide', title: 'How WE decides' });

  const input: LlmsInput = {
    site: { name: site.name, legalName: site.legalName, tagline: site.tagline, description: site.description, origin: site.origin },
    packages: packages.map((p) => ({ name: p.name, stageFit: p.stageFit, depth: p.depth })),
    serviceLines,
    keyPages: present(KEY_PAGES.map(resolve)),
    optionalPages: [...present(OPTIONAL_PAGES.map(resolve)), ...optionalTwins],
    howWeDecide: decide,
    twinRoutes,
    contactRoute: state.isLive('/contact/') ? '/contact/' : null,
    applyRoute: state.isLive('/apply/') ? '/apply/' : null,
    addOnStatement: addOnStatementFrom(factsBody),
    calendarStatement: calendarStatementFrom(faq.find((e) => e.id === 'is-it-an-accelerator')?.data.answer),
  };

  const fullPages = twins
    .filter((t) => FULL_ROUTES.has(t.route) || FULL_PREFIXES.some((prefix) => t.route.startsWith(prefix)))
    .map((t) => buildTwin(t));
  return { input, fullPages };
}
