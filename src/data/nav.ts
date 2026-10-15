/**
 * Navigation as data (SAGE-PLAN 5). Rendered by MegaNav (>= 1100 px) and MobileNav (below).
 * Only items whose route is launched and exists appear; items marked l2 stay hidden until their route ships.
 * Use resolveNav() with a predicate from src/lib/route-state.ts to filter.
 * Wave 8 (docs/wave8-contracts.md, 1.4) only adds: an audience lens, a Topics column from the desk registry, Briefs, Industries and
 * Compare, the journey pages and Partners. No item was removed or reordered, and every addition stays hidden until its route is live.
 */
import { AUDIENCE_LABELS } from './families.ts';
import { DESK_DEFINITIONS, deskPath } from './desks.ts';

export type ServiceLine = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface NavLink {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
  /** Service line letter, rendered as a hex icon. */
  readonly line?: ServiceLine;
  /** Specified for completeness; hidden until the route ships. */
  readonly l2?: boolean;
  /** A shorter visible label where the header row is tight (1100 to 1239px); the full label stays the accessible name (W9-13). */
  readonly short?: string;
}

export interface NavColumn {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

export interface NavFeatured {
  readonly label: string;
  readonly title: string;
  readonly text?: string;
  readonly cta: { readonly label: string; readonly href: string };
  /** Slot id from src/assets/photo/slots.ts, or null for a vector. */
  readonly slot: string | null;
  /** When true, the featured card is filled from the newest entry of the `research` collection. */
  readonly newestResearch?: boolean;
}

export interface NavSection {
  readonly id: string;
  readonly label: string;
  /** Hub route. The label is a real link to it, so the baseline works without JavaScript. */
  readonly href: string;
  readonly lead: string;
  readonly leadLink: string;
  readonly columns: readonly NavColumn[];
  readonly featured: NavFeatured;
  readonly strip: readonly NavLink[];
}

export interface DirectNavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export type PrimaryNavItem =
  | ({ readonly kind: 'mega' } & NavSection)
  | ({ readonly kind: 'direct' } & DirectNavItem);

export const utilityNav: { readonly statement: string; readonly links: readonly NavLink[] } = {
  statement: 'A digital incubator for SaaS',
  links: [
    { label: 'For investors', href: '/investors/' },
    { label: 'Press', href: '/press/' },
    { label: 'Contact', href: '/contact/' },
    { label: 'Search', href: '/search/' },
    { label: 'Careers', href: '/careers/', l2: true },
  ],
};

export const applyButton: NavLink = { label: 'Start a readiness review', href: '/apply/', short: 'Readiness review' };

export const primaryNav: readonly PrimaryNavItem[] = [
  {
    kind: 'mega',
    id: 'program',
    label: 'Program',
    href: '/program/',
    lead: 'A digital incubator for SaaS. Dedicated team seats, steered by WE, from first idea to first customers.',
    leadLink: 'Explore the program',
    columns: [
      {
        heading: 'How it works',
        links: [
          { label: 'How it works', href: '/program/how-it-works/', description: 'Apply, scope, seat your team, work in focused cycles' },
          { label: 'Your journey', href: '/journey/', description: 'From first visit to the first months inside the program' },
          { label: 'After you apply', href: '/journey/after-you-apply/', description: 'What happens to an application, step by step' },
          { label: 'The digital incubation model', href: '/program/digital-incubation-model/', description: 'Fully remote by design: no office, no relocation' },
          { label: 'Dedicated teams', href: '/program/dedicated-teams/', description: 'Offshore seats that work only on your company' },
          { label: "Who it's for", href: '/program/who-its-for/', description: 'The founders and ideas WE builds with' },
          { label: 'How WE decides', href: '/program/how-we-decide/', description: 'How an application is read' },
        ],
      },
      {
        heading: 'The WE path',
        links: [
          { label: 'Dream', href: '/program/dream/', description: 'Validate the problem and the customer' },
          { label: 'Build', href: '/program/build/', description: 'Turn the validated idea into a product that ships' },
          { label: 'Grow', href: '/program/grow/', description: 'Earn your first customers and gather evidence' },
          { label: 'Cohorts', href: '/program/cohorts/', l2: true },
          { label: 'Demo Day', href: '/program/demo-day/', l2: true },
        ],
      },
    ],
    featured: { label: 'Start here', title: 'Start with a readiness review', cta: { label: 'Start a readiness review', href: '/apply/' }, slot: null },
    strip: [
      { label: 'Compare seat options', href: '/pricing/' },
      { label: 'Read the FAQ', href: '/faq/' },
    ],
  },
  {
    kind: 'mega',
    id: 'services',
    label: 'Services',
    href: '/services/',
    lead: 'Seven service lines, one team steered by WE.',
    leadLink: 'All services',
    columns: [
      {
        heading: 'Build the company',
        links: [
          { label: 'Brand and Identity', href: '/services/brand-and-identity/', line: 'A', description: 'Name, identity and the system behind it' },
          { label: 'Product and IT Development', href: '/services/product-and-it-development/', line: 'B', description: 'Design, build and release your SaaS' },
          { label: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/', line: 'C', description: 'Discovery, pilots and pipeline discipline' },
          { label: 'Business Management and Operations', href: '/services/business-management-and-operations/', line: 'D', description: 'Cadence, goals, metrics and the weekly rhythm' },
        ],
      },
      {
        heading: 'Learn and prepare',
        links: [
          { label: 'Digital Incubation', href: '/services/digital-incubation/', line: 'E', description: 'Workspace, curriculum and coaching' },
          { label: 'Fundability and Investor Readiness', href: '/services/fundability-and-investor-readiness/', line: 'F', description: 'The evidence a serious investor asks for' },
          { label: 'Professional-Services Coordination', href: '/services/professional-services-coordination/', line: 'G', description: 'WE coordinates your own counsel, accountant and specialists; it does not replace them' },
        ],
      },
    ],
    featured: {
      label: 'Tool',
      title: 'Compose your team',
      text: 'Sketch the roles you need. No sign-up, no price.',
      cta: { label: 'Open the Team Composer', href: '/tools/team-composer/' },
      slot: null,
    },
    strip: [
      { label: 'Dedicated teams', href: '/program/dedicated-teams/' },
      { label: 'Pricing', href: '/pricing/' },
    ],
  },
  {
    kind: 'mega',
    id: 'playbooks',
    label: 'Playbooks',
    href: '/playbooks/',
    lead: 'Practical SaaS playbooks, written to be used.',
    leadLink: 'All playbooks',
    columns: [
      {
        heading: 'Stage playbooks',
        links: [
          { label: 'Validate the problem', href: '/playbooks/validate-the-problem/' },
          { label: 'Design the product', href: '/playbooks/design-the-product/' },
          { label: 'Build and ship v1', href: '/playbooks/build-and-ship-v1/' },
          { label: 'Earn your first customers', href: '/playbooks/earn-your-first-customers/' },
          { label: 'Build repeatable growth', href: '/playbooks/build-repeatable-growth/' },
        ],
      },
      {
        heading: 'Fundability',
        links: [
          { label: 'Investor readiness', href: '/fundability/' },
          { label: 'Readiness checklist', href: '/fundability/investor-readiness-checklist/' },
          { label: 'The seed data room', href: '/fundability/data-room/' },
          { label: 'SAFEs in plain language', href: '/fundability/safe-explained/' },
          { label: 'Investor updates', href: '/fundability/investor-updates/' },
        ],
      },
      {
        heading: 'Trust',
        links: [
          { label: 'Trust center', href: '/trust/', description: 'How WE handles information, the standards WE maps work to' },
          { label: 'Security baseline brief', href: '/research/saas-security-baseline-year-one/' },
          { label: 'Accessibility brief', href: '/research/accessibility-as-a-launch-requirement/' },
        ],
      },
    ],
    featured: {
      label: 'Self-check',
      title: 'Investor readiness self-check',
      text: 'Not a prediction of funding.',
      cta: { label: 'Take the self-check', href: '/fundability/' },
      slot: null,
    },
    strip: [
      { label: 'Templates', href: '/library/' },
      { label: 'Glossary', href: '/glossary/' },
    ],
  },
  {
    kind: 'mega',
    id: 'resources',
    label: 'Resources',
    href: '/resources/',
    lead: 'Read it, use it, check it.',
    leadLink: 'Browse resources',
    columns: [
      {
        heading: 'Read',
        links: [
          { label: 'Insights', href: '/insights/' },
          { label: 'Research briefs', href: '/research/' },
          { label: 'Briefs', href: '/briefs/' },
          { label: 'Industries', href: '/industries/' },
          { label: 'Compare', href: '/compare/' },
          { label: 'Newsletter', href: '/newsletter/' },
        ],
      },
      {
        heading: 'Use',
        links: [
          { label: 'Templates and checklists', href: '/library/' },
          { label: 'Team Composer', href: '/tools/team-composer/' },
          { label: 'Founder tools', href: '/tools/' },
          { label: 'Glossary', href: '/glossary/' },
        ],
      },
      {
        heading: 'Get answers',
        links: [
          { label: 'FAQ', href: '/faq/' },
          { label: 'Search', href: '/search/' },
          { label: 'Events', href: '/events/', l2: true },
        ],
      },
      {
        heading: 'Topics',
        links: DESK_DEFINITIONS.map((desk) => ({ label: desk.name, href: deskPath(desk.id) })),
      },
    ],
    featured: {
      label: 'Newest research brief',
      title: 'Research briefs',
      cta: { label: 'Read the brief', href: '/research/' },
      slot: null,
      newestResearch: true,
    },
    strip: [
      { label: 'Editorial policy', href: '/about/editorial-policy/' },
      { label: 'RSS', href: '/rss.xml' },
    ],
  },
  {
    kind: 'mega',
    id: 'network',
    label: 'Network',
    href: '/network/',
    lead: 'The founder profile, operator roles and standards behind your team.',
    leadLink: 'The WE network',
    columns: [
      {
        heading: 'Founders',
        links: [
          { label: 'Who WE builds with', href: '/founders/', description: 'The founder profile and the evidence WE looks for' },
          { label: 'Apply', href: '/apply/' },
          { label: 'Founder stories', href: '/founders/stories/', l2: true },
          { label: 'Portfolio', href: '/founders/portfolio/', l2: true },
        ],
      },
      {
        heading: 'Operators',
        links: [
          { label: 'Operators', href: '/network/operators/', description: 'The roles WE places around your team' },
          { label: 'Delivery partners', href: '/network/delivery-partners/', l2: true },
          { label: 'Partners', href: '/network/partners/' },
        ],
      },
      {
        heading: 'Investors',
        links: [{ label: 'For investors', href: '/investors/', description: 'How WE prepares companies, and what WE does not do' }],
      },
    ],
    featured: { label: 'Founders', title: 'Build a company with WE', cta: { label: 'Start a readiness review', href: '/apply/' }, slot: null },
    strip: [
      { label: 'Pricing', href: '/pricing/' },
      { label: 'Contact', href: '/contact/' },
    ],
  },
  {
    kind: 'mega',
    id: 'audiences',
    label: 'For you',
    href: '/briefs/',
    lead: 'Start from who you are: a startup, an investor, a partner or a corporate team.',
    leadLink: 'Browse the briefs',
    columns: [
      {
        heading: AUDIENCE_LABELS.startup,
        links: [
          { label: 'Apply', href: '/apply/' },
          { label: 'Founder segments', href: '/founders/' },
          { label: 'What happens after you apply', href: '/journey/after-you-apply/' },
          { label: 'Tools', href: '/tools/' },
        ],
      },
      {
        heading: AUDIENCE_LABELS.investor,
        links: [
          { label: 'For investors', href: '/investors/' },
          { label: 'Meet the startups', href: '/investors/meet-startups/' },
          { label: 'What you can see', href: '/investors/what-you-can-see/' },
          { label: 'Express interest', href: '/investors/interest/' },
        ],
      },
      {
        heading: AUDIENCE_LABELS.partner,
        links: [
          { label: 'Partner with WE', href: '/network/partners/' },
          { label: 'Categories', href: '/network/partners/categories/' },
          { label: 'How it works', href: '/network/partners/how-it-works/' },
          { label: 'Enquire', href: '/network/partners/enquire/' },
        ],
      },
      {
        heading: AUDIENCE_LABELS.corporate,
        links: [
          { label: 'Corporate innovators', href: '/founders/corporate-innovators/' },
          { label: 'Corporate spinouts brief', href: '/briefs/corporate-spinouts/' },
          { label: 'Contact', href: '/contact/' },
        ],
      },
    ],
    featured: { label: 'Start here', title: 'Read a brief', text: 'Open abstracts. The full brief arrives by email.', cta: { label: 'Read the funding paths brief', href: '/briefs/funding-paths/' }, slot: null },
    strip: [{ label: 'Your journey', href: '/journey/' }],
  },
  {
    kind: 'mega',
    id: 'about',
    label: 'About',
    href: '/about/',
    lead: 'A digital incubator for SaaS, run by World Enterprise Group Incorporated.',
    leadLink: 'About WE',
    columns: [
      {
        heading: 'Company',
        links: [
          { label: 'About WE', href: '/about/' },
          { label: 'Facts about WE', href: '/about/facts/' },
          { label: 'Manifesto', href: '/about/manifesto/' },
          { label: 'How WE steers a team: frameworks', href: '/about/frameworks/' },
          { label: 'Editorial policy', href: '/about/editorial-policy/' },
          { label: 'Leadership', href: '/about/team/', l2: true },
        ],
      },
      {
        heading: 'Connect',
        links: [
          { label: 'Press', href: '/press/' },
          { label: 'Contact', href: '/contact/' },
          { label: 'Careers', href: '/careers/', l2: true },
        ],
      },
    ],
    featured: { label: 'Why WE exists', title: 'Read the manifesto', cta: { label: 'Read the manifesto', href: '/about/manifesto/' }, slot: null },
    strip: [],
  },
];

export interface FooterColumn {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

/** Footer columns (SAGE-PLAN 5.4). */
export const footerNav: readonly FooterColumn[] = [
  {
    heading: 'Program',
    links: [
      { label: 'How it works', href: '/program/how-it-works/' },
      { label: 'Your journey', href: '/journey/' },
      { label: 'Dedicated teams', href: '/program/dedicated-teams/' },
      { label: 'Pricing', href: '/pricing/' },
      { label: 'Apply', href: '/apply/' },
      { label: 'FAQ', href: '/faq/' },
    ],
  },
  {
    heading: 'Services',
    links: [
      { label: 'Brand and Identity', href: '/services/brand-and-identity/', line: 'A' },
      { label: 'Product and IT Development', href: '/services/product-and-it-development/', line: 'B' },
      { label: 'Customer Relations and Market Development', href: '/services/customer-and-market-development/', line: 'C' },
      { label: 'Business Management and Operations', href: '/services/business-management-and-operations/', line: 'D' },
      { label: 'Digital Incubation', href: '/services/digital-incubation/', line: 'E' },
      { label: 'Fundability and Investor Readiness', href: '/services/fundability-and-investor-readiness/', line: 'F' },
      { label: 'Professional-Services Coordination', href: '/services/professional-services-coordination/', line: 'G' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'Playbooks', href: '/playbooks/' },
      { label: 'Fundability', href: '/fundability/' },
      { label: 'Insights', href: '/insights/' },
      { label: 'Research', href: '/research/' },
      { label: 'Briefs', href: '/briefs/' },
      { label: 'Industries', href: '/industries/' },
      { label: 'Compare', href: '/compare/' },
      { label: 'Templates', href: '/library/' },
      { label: 'Glossary', href: '/glossary/' },
      { label: 'Search', href: '/search/' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about/' },
      { label: 'Manifesto', href: '/about/manifesto/' },
      { label: 'Frameworks', href: '/about/frameworks/' },
      { label: 'Network', href: '/network/' },
      { label: 'Partners', href: '/network/partners/' },
      { label: 'For investors', href: '/investors/' },
      { label: 'Press', href: '/press/' },
      { label: 'Contact', href: '/contact/' },
    ],
  },
  {
    heading: 'Trust and legal',
    links: [
      { label: 'Trust center', href: '/trust/' },
      { label: 'Accessibility statement', href: '/legal/accessibility/' },
      { label: 'Privacy notice', href: '/legal/privacy/' },
      { label: 'Terms', href: '/legal/terms/' },
      { label: 'Editorial policy', href: '/about/editorial-policy/' },
      { label: 'Site map', href: '/sitemap/' },
      { label: 'RSS', href: '/rss.xml' },
    ],
  },
];

/** Returns the nav with every link removed whose route is not live, and sections with no live hub removed. */
export function resolveNav(isLive: (href: string) => boolean): readonly PrimaryNavItem[] {
  const keep = (link: NavLink): boolean => link.l2 !== true && isLive(link.href);
  const result: PrimaryNavItem[] = [];
  for (const item of primaryNav) {
    if (!isLive(item.href)) continue;
    if (item.kind === 'direct') {
      result.push(item);
      continue;
    }
    const columns = item.columns
      .map((c) => ({ heading: c.heading, links: c.links.filter(keep) }))
      .filter((c) => c.links.length > 0);
    result.push({ ...item, columns, strip: item.strip.filter(keep) });
  }
  return result;
}

export function resolveFooter(isLive: (href: string) => boolean): readonly FooterColumn[] {
  return footerNav
    .map((c) => ({ heading: c.heading, links: c.links.filter((l) => l.l2 !== true && isLive(l.href)) }))
    .filter((c) => c.links.length > 0);
}

export function resolveUtility(isLive: (href: string) => boolean): readonly NavLink[] {
  return utilityNav.links.filter((l) => l.l2 !== true && isLive(l.href));
}

/**
 * Pages that a panel lists so people can find them but that are not part of that section: Apply is the header call to action
 * (it also sits in the Network panel), Contact is a utility link (it also sits in the About panel), and Trust is the standalone trust
 * centre (it also sits in the Playbooks panel). On these pages no top-level item is current; the link to the page itself keeps
 * aria-current="page". Prefixes, so /apply/thanks/ is covered.
 */
const SECTIONLESS_PREFIXES = ['/apply/', '/contact/', '/trust/'] as const;

/**
 * Which primary section a path belongs to, for aria-current="true" on the top-level link.
 * Order: sectionless pages, hub prefix, then the longest panel link that is a prefix of the path, then the resources fallback.
 */
export function activeSectionId(path: string): string | null {
  if (path === '/') return null;
  if (SECTIONLESS_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  for (const item of primaryNav) {
    if (path.startsWith(item.href)) return item.id;
  }
  let best: { id: string; length: number } | null = null;
  for (const item of primaryNav) {
    if (item.kind !== 'mega') continue;
    for (const column of item.columns) {
      for (const link of column.links) {
        if (link.href !== '/' && path.startsWith(link.href) && (best === null || link.href.length > best.length)) {
          best = { id: item.id, length: link.href.length };
        }
      }
    }
  }
  if (best !== null) return best.id;
  if (path.startsWith('/insights/') || path.startsWith('/research/') || path.startsWith('/library/') || path.startsWith('/glossary/')) return 'resources';
  return null;
}
