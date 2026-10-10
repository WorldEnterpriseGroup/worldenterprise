import { routes } from '../data/routes.ts';
import { site, pageTitle } from '../data/site.ts';
import { readFlag } from './env.ts';
import { buildAbsolute, normalizeBase } from './url-core.ts';

/**
 * SEO helpers (SAGE-PLAN 6.9). Titles are "{Page} | World Enterprise Incubator" and stay within 60 characters;
 * descriptions stay within 160. Canonicals are always absolute production URLs, even on preview builds.
 */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

export type RobotsDirective = 'index,follow' | 'noindex,follow' | 'noindex,nofollow';

export function buildTitle(page?: string): string {
  return pageTitle(page);
}

export function canonicalUrl(path: string): string {
  return buildAbsolute(path, site.origin);
}

/** Trims a description to the 160 character limit at a word boundary, adding an ellipsis only when it cuts. */
export function clampDescription(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_MAX) return clean;
  const cut = clean.slice(0, DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : cut.length).replace(/[,;:.\s]+$/, '')}\u2026`;
}

export interface RobotsInput {
  readonly noindex?: boolean;
  readonly follow?: boolean;
  readonly draft?: boolean;
}

/** Preview builds and drafts are never indexed. Routes marked noindex in the ledger keep link following. */
export function resolveRobots({ noindex = false, follow = true, draft = false }: RobotsInput): RobotsDirective {
  if (readFlag('PUBLIC_PREVIEW') || draft) return 'noindex,nofollow';
  if (noindex) return follow ? 'noindex,follow' : 'noindex,nofollow';
  return 'index,follow';
}

/** Paths the ledger marks noindex (thanks page, search, HTML site map, 404). */
const NOINDEX_PATHS: ReadonlySet<string> = new Set(routes.filter((r) => !r.indexable).map((r) => r.path));

/** Path prefixes that are never listed: the dev styleguide and the WP-00 content fixtures. */
const EXCLUDED_PREFIXES = ['/styleguide/'] as const;
const EXCLUDED_SEGMENT = '/fixture-';

/**
 * Whether a built page URL belongs in sitemap-0.xml. Noindex routes, fixtures and the styleguide are excluded.
 * Pass this to the @astrojs/sitemap `filter` option (request filed for WP-15).
 */
export function isSitemapUrl(pageUrl: string): boolean {
  const path = new URL(pageUrl).pathname;
  if (NOINDEX_PATHS.has(path)) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  return !path.includes(EXCLUDED_SEGMENT);
}

export interface SitemapItemLike {
  readonly url: string;
  readonly lastmod?: Date | string | undefined;
  readonly [key: string]: unknown;
}

/**
 * Adds a real lastmod to a sitemap item. `lookup` receives the URL pathname and returns the content updatedDate,
 * else the date of the last git commit that touched the source file, else undefined. When it returns undefined the
 * item is left without lastmod: an invented date is worse than none.
 */
export function withLastmod<T extends SitemapItemLike>(item: T, lookup: (pathname: string) => Date | undefined): T & { readonly lastmod?: Date | string | undefined } {
  const found = lookup(new URL(item.url).pathname);
  if (found === undefined || Number.isNaN(found.getTime())) return item;
  return { ...item, lastmod: found.toISOString() };
}

/**
 * Documented AI crawler and assistant user-agent tokens, grouped by vendor. Production names each one with an explicit
 * allow (DP-2), so the policy is stated rather than implied by the wildcard group. The list is recalled from vendor
 * documentation, not fetched; the handoff names the vendor page to re-check each family against.
 */
export const AI_CRAWLER_GROUPS: readonly { readonly vendor: string; readonly agents: readonly string[] }[] = [
  { vendor: 'OpenAI', agents: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User'] },
  { vendor: 'Anthropic', agents: ['ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai'] },
  { vendor: 'Google (AI training and Gemini grounding control)', agents: ['Google-Extended'] },
  { vendor: 'Apple (AI training control)', agents: ['Applebot-Extended'] },
  { vendor: 'Perplexity', agents: ['PerplexityBot', 'Perplexity-User'] },
  { vendor: 'Common Crawl', agents: ['CCBot'] },
];

/** Every AI crawler token named in robots.txt, in file order. */
export const AI_CRAWLER_AGENTS: readonly string[] = AI_CRAWLER_GROUPS.flatMap((group) => group.agents);

/**
 * robots.txt body. Preview builds disallow everything (named crawlers included, through the wildcard group) and
 * advertise no sitemap. Production allows all and names each AI crawler with its own allow group.
 */
export function robotsTxt(preview: boolean): string {
  if (preview) return 'User-agent: *\nDisallow: /\n';
  const named = AI_CRAWLER_GROUPS.map((group) => [`# ${group.vendor}`, ...group.agents.flatMap((agent) => [`User-agent: ${agent}`, 'Allow: /', ''])].join('\n')).join('\n');
  return `User-agent: *\nAllow: /\n\n${named}\nSitemap: ${site.origin}/sitemap-index.xml\n`;
}

export interface SecurityTxtInput {
  readonly contact: string | null;
  /** Date after which the file should be considered stale. */
  readonly expires: Date;
}

/**
 * The RFC 9116 Contact value for a configured contact: an https: URL (for example GitHub private vulnerability reporting, which
 * needs no mailbox), a mailto: or tel: URI, or a bare mailbox address, which gets mailto:. Anything else is refused at build time,
 * because a malformed Contact line is worse than none (cleartext http: is not allowed by the RFC for web URIs).
 */
export function securityContactUri(contact: string): string {
  const value = contact.trim();
  if (/^(https:\/\/|mailto:|tel:)\S+$/i.test(value)) return value;
  if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(value)) return `mailto:${value}`;
  throw new Error(`security.txt contact must be an https: URL, a mailto: or tel: URI, or a mailbox address. Got "${contact}".`);
}

/** security.txt (RFC 9116) body, or null while no confirmed contact exists (C-22). */
export function securityTxt({ contact, expires }: SecurityTxtInput): string | null {
  if (contact === null) return null;
  return [
    `Contact: ${securityContactUri(contact)}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${site.origin}/.well-known/security.txt`,
    '',
  ].join('\n');
}

/**
 * Speculation rules: prerender same-site links on hover, except the thanks page and search. Base-aware for preview.
 * href_matches takes a path pattern, so cross-origin links never match and need no separate guard.
 */
export function speculationRules(rawBase: string | undefined): Record<string, unknown> {
  const base = normalizeBase(rawBase);
  return {
    prerender: [
      {
        where: {
          and: [
            { href_matches: `${base}/*` },
            { not: { href_matches: `${base}/apply/thanks/` } },
            { not: { href_matches: `${base}/search/*` } },
          ],
        },
        eagerness: 'moderate',
      },
    ],
  };
}

export interface SitemapSection {
  readonly id: string;
  readonly label: string;
  readonly links: readonly { readonly href: string; readonly label: string }[];
}

const SECTION_LABELS: Readonly<Record<string, string>> = {
  '': 'Home',
  program: 'Program',
  apply: 'Apply',
  pricing: 'Pricing',
  tools: 'Tools',
  services: 'Services',
  playbooks: 'Playbooks',
  fundability: 'Fundability',
  trust: 'Trust',
  resources: 'Resources',
  insights: 'Insights',
  research: 'Research',
  library: 'Templates and checklists',
  glossary: 'Reference',
  faq: 'Reference',
  newsletter: 'Reference',
  search: 'Reference',
  network: 'Network',
  founders: 'Network',
  investors: 'Network',
  about: 'About',
  press: 'Company',
  contact: 'Company',
  legal: 'Legal',
};

function titleCaseSlug(slug: string): string {
  const words = slug.split('-').filter((w) => w !== '');
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

/**
 * Groups live, indexable paths into site map sections in first-seen order. `labelFor` supplies a link label (from the
 * navigation data or collection titles); the fallback is the last path segment.
 */
export function groupSitemapRoutes(paths: readonly string[], labelFor: (path: string) => string | undefined): readonly SitemapSection[] {
  const sections = new Map<string, { label: string; links: { href: string; label: string }[] }>();
  for (const path of paths) {
    const first = path.split('/').filter((s) => s !== '')[0] ?? '';
    const label = SECTION_LABELS[first] ?? titleCaseSlug(first);
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const section = sections.get(id) ?? { label, links: [] };
    const last = path.split('/').filter((s) => s !== '').at(-1) ?? 'home';
    section.links.push({ href: path, label: labelFor(path) ?? (path === '/' ? 'Home' : titleCaseSlug(last)) });
    sections.set(id, section);
  }
  return [...sections].map(([id, value]) => ({ id, label: value.label, links: value.links }));
}
