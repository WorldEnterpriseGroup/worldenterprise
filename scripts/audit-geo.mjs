#!/usr/bin/env node
// GEO audit over the built site (docs/wave7-contracts.md, sections 2 and 3). Node built-ins only. Run after `astro build`:
//
//   node scripts/audit-geo.mjs [--dist dist]
//
//   llms.txt        structure (title, summary blockquote, the sections in contract order), the two required sentences, and every link:
//                   a link to a Markdown twin names a file that exists, whose first heading is the page H1 and whose canonical URL is the
//                   page's; a link to a page names a page that was built.
//   llms-full.txt   the same head, a size under the cap in src/lib/llms.ts, and every "Source:" block names a built page whose H1 and
//                   canonical match the block.
//   Markdown twins  every .md outside library/ has its page, the page advertises it with <link rel="alternate" type="text/markdown">,
//                   the first heading is the page H1, the canonical URL is the page's, and the text is plain Markdown (no JSX leak).
//   Denylist        no twin and no llms file contains a phrase that scripts/audit-claims.mjs scans for (a twin stands for its page route). The
//                   llms files are skipped by the denylist's C-13-peers rule, so this audit holds them: the head may use the FAQ calendar
//                   sentence and nothing else of that rule's vocabulary, and each llms-full page block is scanned as the page it copies.
//   robots.txt      a production build names the AI crawlers, allows them, and lists the sitemap; a preview build disallows everything.
// Exit code 1 on any error.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scan, textRouteOf, loadDenylist } from './audit-claims.mjs';
import { mainHeadings, canonicalLinks } from './audit-seo.mjs';
import { distRel, routeOfHtml, walkFiles } from './lib/html.mjs';

export const ORIGIN = 'https://worldenterprise.org';
export const NO_FUNDING_SENTENCE = 'WE makes no promise of funding.';

/** The H2 sections of llms.txt, in contract order. `optional` sections may be absent (their pages may not be live). */
export const LLMS_SECTIONS = [
  { heading: 'What WE is', optional: false },
  { heading: 'What WE offers', optional: false },
  { heading: 'What WE does not do', optional: false },
  { heading: 'Published commercial facts', optional: false },
  { heading: 'Key pages', optional: true },
  { heading: 'How WE decides', optional: true },
  { heading: 'Contact', optional: false },
  { heading: 'Optional', optional: true },
];

const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** The verbatim Investor Introductions disclaimer, read from the denylist rule that requires it so the audit holds one copy of the wording. */
export function requiredSentences(denylist = loadDenylist()) {
  const rule = denylist.required.find((r) => r.id === 'R-W7-C14-intro-disclaimer');
  if (rule === undefined) throw new Error('claims-denylist.json has no required rule R-W7-C14-intro-disclaimer');
  return [NO_FUNDING_SENTENCE, rule.text];
}

/** Every `[text](url)` link of a Markdown file. */
export function markdownLinks(text) {
  return [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => ({ text: m[1], url: m[2] }));
}

/** The route that a link to this origin names, with the kind of target. Returns null for an external link. */
export function targetOfLink(url, origin = ORIGIN) {
  if (url !== origin && !url.startsWith(`${origin}/`)) return null;
  const path = url.slice(origin.length) || '/';
  if (path.endsWith('.md')) {
    const stem = path.slice(0, -'.md'.length);
    const route = stem === '/index' ? '/' : `${stem}/`;
    return { kind: 'twin', route, file: path.slice(1) };
  }
  return { kind: 'page', route: path };
}

/** Structure of llms.txt: title, blockquote summary, then the contract's sections in order, with the two required sentences. */
export function auditLlmsStructure(name, text, { sentences = requiredSentences(), siteName = 'World Enterprise Incubator' } = {}) {
  const errors = [];
  const err = (msg) => errors.push(`${name}: ${msg}`);
  const lines = text.split('\n');
  if (lines[0] !== `# ${siteName}` && !lines[0].startsWith(`# ${siteName}:`)) err(`first line must be "# ${siteName}", found "${lines[0]}"`);
  const summary = lines.slice(1).find((line) => line.trim() !== '');
  if (summary === undefined || !summary.startsWith('> ')) err('the title must be followed by a one-sentence summary blockquote ("> ...")');
  const headings = lines.filter((line) => /^## /.test(line)).map((line) => line.slice(3).trim());
  if (name === 'llms.txt') {
    let cursor = -1;
    for (const section of LLMS_SECTIONS) {
      const at = headings.indexOf(section.heading);
      if (at === -1) {
        if (!section.optional) err(`missing section "## ${section.heading}"`);
        continue;
      }
      if (at < cursor) err(`section "## ${section.heading}" is out of order`);
      cursor = Math.max(cursor, at);
    }
    const unknown = headings.filter((h) => !LLMS_SECTIONS.some((s) => s.heading === h));
    if (unknown.length > 0) err(`unknown section(s): ${unknown.map((h) => `"${h}"`).join(', ')}`);
  }
  const body = squash(text);
  for (const sentence of sentences) {
    if (!body.includes(squash(sentence))) err(`missing the required sentence "${sentence}"`);
  }
  return errors;
}

/** Page facts that a twin must agree with: H1 and canonical. */
export function pageFacts(html) {
  const h1 = mainHeadings(html)?.find((h) => h.level === 1)?.text;
  const canonicals = canonicalLinks(html);
  return { h1, canonical: canonicals.length === 1 ? canonicals[0] : undefined };
}

/** The alternate Markdown links of a page: [{ href, well-formed }]. */
export function markdownAlternates(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /\srel\s*=\s*("alternate"|'alternate')/i.test(tag) && /\stype\s*=\s*("text\/markdown"|'text\/markdown')/i.test(tag))
    .map((tag) => /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)?.slice(1).find((v) => v !== undefined));
}

/** The first heading and the Canonical URL line of a twin. */
export function twinFacts(markdown) {
  const heading = /^# (.+)$/m.exec(markdown)?.[1]?.trim();
  const canonical = /^Canonical URL: (\S+)\s*$/m.exec(markdown)?.[1];
  return { heading, canonical };
}

/** Lint of a twin: the same rules as src/lib/markdown-twins.ts lintMarkdown, restated here so the audit needs no TypeScript import. */
export function lintTwin(markdown) {
  const problems = [];
  if (/^\s*---\r?\n/.test(markdown)) problems.push('frontmatter remains');
  const prose = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  if (/^\s*(?:import|export)\s/m.test(prose)) problems.push('an import or export statement remains');
  if (/<!--/.test(prose)) problems.push('an HTML comment remains');
  const withoutAutolinks = prose.replace(/<https?:\/\/[^>\s]+>/g, '');
  if (/<\/?[A-Za-z][^>]*>/.test(withoutAutolinks)) problems.push('a tag (JSX or HTML) remains');
  if (/[{}]/.test(withoutAutolinks)) problems.push('a brace (an expression) remains');
  return problems;
}

/**
 * One twin against its page. `pages` is a Map of route to html; `twin` is { file, route, text }.
 */
export function auditTwin(twin, pages, origin = ORIGIN) {
  const errors = [];
  const err = (msg) => errors.push(`${twin.file}: ${msg}`);
  const html = pages.get(twin.route);
  if (html === undefined) {
    err(`the page ${twin.route} it mirrors was not built`);
    return errors;
  }
  const page = pageFacts(html);
  const facts = twinFacts(twin.text);
  if (facts.heading === undefined) err('has no first heading');
  else if (page.h1 !== undefined && squash(facts.heading) !== squash(page.h1)) err(`first heading "${facts.heading}" differs from the page H1 "${page.h1}"`);
  if (facts.canonical === undefined) err('has no "Canonical URL:" line');
  else if (page.canonical !== undefined && facts.canonical !== page.canonical) err(`canonical "${facts.canonical}" differs from the page's "${page.canonical}"`);
  const expectedHref = `${origin}/${twin.file}`;
  const alternates = markdownAlternates(html);
  if (!alternates.includes(expectedHref)) err(`the page ${twin.route} does not advertise it: expected <link rel="alternate" type="text/markdown" href="${expectedHref}">`);
  for (const problem of lintTwin(twin.text)) err(`not plain Markdown: ${problem}`);
  return errors;
}

/** A page that advertises a twin must have the file. */
export function auditAlternates(pages, twinFiles, origin = ORIGIN) {
  const errors = [];
  for (const [route, html] of pages) {
    for (const href of markdownAlternates(html)) {
      if (href === undefined || !href.startsWith(`${origin}/`) || !href.endsWith('.md')) {
        errors.push(`${route}: the Markdown alternate link has an unusable href "${href ?? ''}"`);
      } else if (!twinFiles.has(href.slice(origin.length + 1))) {
        errors.push(`${route}: advertises ${href}, which was not built`);
      }
    }
  }
  return errors;
}

/** Every link of an llms file: a twin link names a built twin of the right page, a page link names a built page. */
export function auditLlmsLinks(name, text, { pages, twinFiles, origin = ORIGIN }) {
  const errors = [];
  const err = (msg) => errors.push(`${name}: ${msg}`);
  for (const link of markdownLinks(text)) {
    const target = targetOfLink(link.url, origin);
    if (target === null) continue;
    if (target.kind === 'twin') {
      const twin = twinFiles.get(target.file);
      if (twin === undefined) {
        err(`links to ${link.url}, which was not built`);
        continue;
      }
      for (const problem of auditTwin({ file: target.file, route: target.route, text: twin }, pages, origin)) err(`linked twin: ${problem}`);
    } else if (!pages.has(target.route)) {
      err(`links to ${link.url}, but no page ${target.route} was built`);
    }
  }
  return errors;
}

/** llms-full.txt: each `Source:` block names a built page, and the block's heading and canonical agree with it. */
export function auditLlmsFullBlocks(text, pages, origin = ORIGIN) {
  const errors = [];
  const blocks = text.split(/^---\n\n(?=Source: )/m).slice(1);
  if (blocks.length === 0) errors.push('llms-full.txt: has no page blocks');
  for (const block of blocks) {
    const source = /^Source: (\S+)\s*$/m.exec(block)?.[1];
    if (source === undefined) {
      errors.push('llms-full.txt: a block has no "Source:" line');
      continue;
    }
    const target = targetOfLink(source, origin);
    const html = target === null ? undefined : pages.get(target.route);
    if (target === null || html === undefined) {
      errors.push(`llms-full.txt: block ${source} names a page that was not built`);
      continue;
    }
    const page = pageFacts(html);
    const facts = twinFacts(block);
    if (page.h1 !== undefined && (facts.heading === undefined || squash(facts.heading) !== squash(page.h1))) {
      errors.push(`llms-full.txt: block ${source} starts with "${facts.heading ?? ''}", the page H1 is "${page.h1}"`);
    }
    if (page.canonical !== undefined && facts.canonical !== page.canonical) errors.push(`llms-full.txt: block ${source} canonical "${facts.canonical ?? ''}" differs from the page's "${page.canonical}"`);
  }
  return errors;
}

/** Parses robots.txt into groups: [{ agents: [...], allow: [...], disallow: [...] }] and the sitemap lines. */
export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let sawRule = true;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const key = field.trim().toLowerCase();
    if (key === 'user-agent') {
      if (current === null || sawRule) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
        sawRule = false;
      }
      current.agents.push(value);
    } else if (key === 'allow' || key === 'disallow') {
      sawRule = true;
      current?.[key].push(value);
    } else if (key === 'sitemap') {
      sitemaps.push(value);
    }
  }
  return { groups, sitemaps };
}

/** robots.txt of a production build names every AI crawler with an allow and lists the sitemap; a preview build blocks everyone. */
export function auditRobots(text, { preview, agents, origin = ORIGIN }) {
  const errors = [];
  const err = (msg) => errors.push(`robots.txt: ${msg}`);
  const { groups, sitemaps } = parseRobots(text);
  const star = groups.find((g) => g.agents.includes('*'));
  if (preview) {
    if (star === undefined || !star.disallow.includes('/')) err('a preview build must disallow everything ("User-agent: *" and "Disallow: /")');
    if (groups.some((g) => g.allow.length > 0)) err('a preview build must not allow anything');
    return errors;
  }
  if (star === undefined || !star.allow.includes('/')) err('production must allow everything for "User-agent: *"');
  if (groups.some((g) => g.disallow.some((rule) => rule !== ''))) err('production must not disallow any path');
  for (const agent of agents) {
    const group = groups.find((g) => g.agents.some((name) => name.toLowerCase() === agent.toLowerCase()));
    if (group === undefined) err(`no group names the crawler ${agent}`);
    else if (!group.allow.includes('/')) err(`the group for ${agent} does not allow "/"`);
  }
  if (!sitemaps.includes(`${origin}/sitemap-index.xml`)) err(`must list "Sitemap: ${origin}/sitemap-index.xml"`);
  return errors;
}

/** Denylist over a twin or an llms file, as plain text, on the route the file stands for. */
export function auditDenylist(file, text, set) {
  return scan(text, { route: textRouteOf(file), rules: set.scanRules, plain: true }).map((hit) => `${file}: ${hit.rule} (${hit.claim}) matched "${hit.match}" in: ${hit.context}`);
}

/** The one sentence of the FAQ that the machine files restate and that the denylist's C-13-peers rule allows there. */
export const CALENDAR_SENTENCE = 'This site does not describe a cohort calendar or a demo day.';
/** A route that no allowPaths entry names, so every context rule runs in full on text that has no page of its own. */
const NO_PAGE_ROUTE = '/llms-head/';

/**
 * Denylist over llms.txt and llms-full.txt. The denylist lets C-13-peers skip both files so that they can restate the FAQ sentence
 * above, which means the rule cannot hold them to anything. This holds them instead: the head (everything outside a `Source:` block)
 * is scanned on a route no allowance covers, with that one sentence removed, and each page block is scanned as the page it copies.
 */
export function auditLlmsDenylist(file, text, set) {
  const errors = [];
  const [head, ...blocks] = text.split(/^---\n\n(?=Source: )/m);
  const report = (where, route, body) => {
    for (const hit of scan(body, { route, rules: set.scanRules, plain: true })) errors.push(`${file}: ${where}: ${hit.rule} (${hit.claim}) matched "${hit.match}" in: ${hit.context}`);
  };
  report('head', NO_PAGE_ROUTE, head.split(CALENDAR_SENTENCE).join(' '));
  for (const block of blocks) {
    const source = /^Source: (\S+)\s*$/m.exec(block)?.[1];
    const target = source === undefined ? null : targetOfLink(source);
    report(source ?? 'a block without a Source line', target === null ? NO_PAGE_ROUTE : target.route, block);
  }
  return errors;
}

/** Reads the production bundle. `dist` must exist. */
export function readDist(dist) {
  const pages = new Map();
  const twins = new Map();
  for (const file of walkFiles(dist)) {
    const rel = distRel(dist, file);
    if (rel.startsWith('pagefind/') || rel.startsWith('_astro/')) continue;
    if (rel.endsWith('.html')) pages.set(routeOfHtml(rel), readFileSync(file, 'utf8'));
    else if (rel.endsWith('.md') && !rel.startsWith('library/')) twins.set(rel, readFileSync(file, 'utf8'));
  }
  const read = (name) => (existsSync(join(dist, name)) ? readFileSync(join(dist, name), 'utf8') : undefined);
  return { pages, twins, llms: read('llms.txt'), llmsFull: read('llms-full.txt'), robots: read('robots.txt') };
}

/** The whole audit. `options`: preview, agents, maxFullBytes, denylist. Returns { errors, counts }. */
export function auditGeo({ pages, twins, llms, llmsFull, robots }, options) {
  const errors = [];
  const set = options.denylist ?? loadDenylist();
  const sentences = requiredSentences(set);
  if (llms === undefined) errors.push('llms.txt is missing from dist');
  else {
    errors.push(...auditLlmsStructure('llms.txt', llms, { sentences }), ...auditLlmsLinks('llms.txt', llms, { pages, twinFiles: twins }), ...auditLlmsDenylist('llms.txt', llms, set));
  }
  if (llmsFull === undefined) errors.push('llms-full.txt is missing from dist');
  else {
    errors.push(...auditLlmsStructure('llms-full.txt', llmsFull, { sentences }), ...auditLlmsFullBlocks(llmsFull, pages), ...auditLlmsDenylist('llms-full.txt', llmsFull, set));
    const bytes = new TextEncoder().encode(llmsFull).length;
    if (bytes > options.maxFullBytes) errors.push(`llms-full.txt: ${bytes} bytes is over the cap of ${options.maxFullBytes}`);
  }
  for (const [file, text] of twins) {
    errors.push(...auditTwin({ file, route: textRouteOf(file), text }, pages), ...auditDenylist(file, text, set));
  }
  errors.push(...auditAlternates(pages, twins));
  if (robots === undefined) errors.push('robots.txt is missing from dist');
  else errors.push(...auditRobots(robots, { preview: options.preview, agents: options.agents }));
  return { errors, counts: { pages: pages.size, twins: twins.size } };
}

async function main() {
  const args = process.argv.slice(2);
  const distIndex = args.indexOf('--dist');
  const dist = distIndex === -1 ? 'dist' : args[distIndex + 1];
  if (!dist || !existsSync(dist)) {
    console.error(`audit-geo: dist directory not found: ${dist}`);
    process.exit(2);
  }
  let options;
  try {
    const seo = await import(pathToFileURL(join(process.cwd(), 'src/lib/seo.ts')).href);
    const llmsModule = await import(pathToFileURL(join(process.cwd(), 'src/lib/llms.ts')).href);
    options = { preview: process.env.PUBLIC_PREVIEW === '1', agents: seo.AI_CRAWLER_AGENTS, maxFullBytes: llmsModule.LLMS_FULL_MAX_BYTES };
  } catch (error) {
    console.error(`audit-geo: could not load src/lib/seo.ts and src/lib/llms.ts: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  const { errors, counts } = auditGeo(readDist(dist), options);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`audit-geo: ${counts.pages} pages, ${counts.twins} Markdown twins, ${errors.length} error(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
