import { breadcrumbNode, graph, organizationNode, pageNode, serializeJsonLd, websiteNode } from '../../../src/lib/schema.ts';
import type { JsonLdNode } from '../../../src/lib/schema.ts';

export interface PageHtmlOptions {
  readonly path?: string;
  readonly title?: string;
  readonly description?: string;
  readonly robots?: string;
  readonly main?: string;
  readonly extraNodes?: readonly JsonLdNode[];
  readonly withBreadcrumb?: boolean;
  readonly ogImage?: string;
  readonly canonical?: string;
}

/** Builds HTML shaped like the real dist output: chrome headings before <main>, JSON-LD from the real builders. */
export function pageHtml(options: PageHtmlOptions = {}): string {
  const path = options.path ?? '/program/';
  const title = options.title ?? 'Program | World Enterprise';
  const description = options.description ?? 'The World Enterprise program, step by step, from application to the first working cycle.';
  const canonical = options.canonical ?? `https://worldenterprise.org${path}`;
  const nodes: JsonLdNode[] = [
    organizationNode('https://worldenterprise.org/logo.svg'),
    websiteNode(),
    pageNode({ path, name: 'Program', description, type: 'WebPage' }),
    ...(options.withBreadcrumb === false ? [] : [breadcrumbNode(path, [{ label: 'Home', href: '/' }, { label: 'Program', href: path }])]),
    ...(options.extraNodes ?? []),
  ];
  const image = options.ogImage;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="description" content="${description}"><link rel="canonical" href="${canonical}">
<meta name="robots" content="${options.robots ?? 'index,follow'}">
<meta property="og:site_name" content="World Enterprise"><meta property="og:type" content="website">
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${image}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<script type="application/ld+json">${serializeJsonLd(graph(nodes))}</script></head>
<body><header><h2 class="mega-panel__heading">Program</h2></header>
<main id="main">${options.main ?? '<h1>Program</h1><h2>Steps</h2><h3>Apply</h3>'}</main>
<footer><h2>Learn</h2></footer></body></html>`;
}

export const NOINDEX = new Set(['/apply/thanks/', '/search/', '/sitemap/', '/404.html']);
